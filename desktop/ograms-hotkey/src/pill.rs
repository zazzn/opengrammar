//! The "✦ Rewrite" pill — the desktop analogue of the extension's LLM tone pill.
//! Pinned to the bottom-right of the focused field when AI is on and the field
//! has enough prose. Clicking it opens a small menu (Polish / Formalize / Casual);
//! choosing one rewrites the selection (or the whole field) via the LLM.
//!
//! NO-ACTIVATE popups (never steal focus, so the text field stays focused for the
//! rewrite to land on it). The menu uses a low-level mouse hook for light dismiss.

use std::cell::{Cell, RefCell};

use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, CreateFontW, CreateRoundRectRgn,
    CreateSolidBrush, DEFAULT_CHARSET, DRAW_TEXT_FORMAT, DT_CENTER, DT_LEFT, DT_NOPREFIX,
    DT_SINGLELINE, DT_VCENTER, DeleteObject, DrawTextW, EndPaint, FillRect, GetMonitorInfoW, HBRUSH,
    HFONT, HGDIOBJ, MONITOR_DEFAULTTONEAREST, MONITORINFO, MonitorFromPoint, OUT_TT_PRECIS,
    PAINTSTRUCT, SelectObject, SetBkMode, SetTextColor, SetWindowRgn, TRANSPARENT,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};
use windows::Win32::UI::WindowsAndMessaging::{
    BS_PUSHBUTTON, CallNextHookEx, CreateWindowExW, DefWindowProcW, DestroyWindow, ES_MULTILINE,
    ES_READONLY, GetClientRect, GetWindowRect, HHOOK, HMENU, IDC_ARROW, KillTimer, LoadCursorW,
    MSLLHOOKSTRUCT, PostThreadMessageW, RegisterClassW, SW_SHOWNOACTIVATE, SendMessageW, SetTimer,
    SetWindowsHookExW, ShowWindow, UnhookWindowsHookEx, WH_MOUSE_LL, WINDOW_EX_STYLE, WINDOW_STYLE,
    WM_APP, WM_COMMAND, WM_CTLCOLORBTN, WM_CTLCOLOREDIT, WM_CTLCOLORSTATIC, WM_DESTROY,
    WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN, WM_PAINT, WM_RBUTTONDOWN, WM_SETFONT, WM_TIMER,
    WNDCLASSW, WS_BORDER, WS_CHILD, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP,
    WS_TABSTOP, WS_VISIBLE, WS_VSCROLL,
};
use windows::core::{PCWSTR, w};

/// Posted when the pill is clicked — the monitor opens the tone menu.
pub const WM_PILL_CLICK: u32 = WM_APP + 25;
/// Posted (lParam = tone index 0/1/2) when a tone is chosen.
pub const WM_PILL_TONE: u32 = WM_APP + 26;
/// Posted when Apply is clicked in the rewrite preview — the monitor applies the
/// pending rewrite. (Cancel just closes the preview.)
pub const WM_PILL_APPLY: u32 = WM_APP + 27;

const ID_TONE_BASE: i32 = 200;
const ID_APPLY: i32 = 210;
const ID_CANCEL: i32 = 211;
pub const TONES: [&str; 3] = ["Polish", "Formalize", "Casual"];
const INDIGO: u32 = 0x4F46E5;

thread_local! {
    static PILL: Cell<isize> = const { Cell::new(0) };
    static MENU: Cell<isize> = const { Cell::new(0) };
    static WORKING: Cell<isize> = const { Cell::new(0) };
    static PREVIEW: Cell<isize> = const { Cell::new(0) };
    static HOOK: Cell<isize> = const { Cell::new(0) };
    static PILL_FONT: Cell<isize> = const { Cell::new(0) };
    static PILL_BG: Cell<isize> = const { Cell::new(0) };
    static MENU_FONT: Cell<isize> = const { Cell::new(0) };
    static MENU_BG: Cell<isize> = const { Cell::new(0) };
    static PV_FONT: Cell<isize> = const { Cell::new(0) };
    static PV_BG: Cell<isize> = const { Cell::new(0) };
    static PV_TITLE: RefCell<String> = const { RefCell::new(String::new()) };
}

fn cref(rgb: u32) -> COLORREF {
    COLORREF((rgb & 0xFF) << 16 | (rgb >> 8 & 0xFF) << 8 | (rgb >> 16 & 0xFF))
}
fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn dpi_for_point(x: i32, y: i32) -> u32 {
    unsafe {
        let mon = MonitorFromPoint(POINT { x, y }, MONITOR_DEFAULTTONEAREST);
        let mut dx = 96u32;
        let mut dy = 96u32;
        if GetDpiForMonitor(mon, MDT_EFFECTIVE_DPI, &mut dx, &mut dy).is_ok() {
            dx.max(96)
        } else {
            96
        }
    }
}

fn work_area_for_point(x: i32, y: i32) -> RECT {
    unsafe {
        let mon = MonitorFromPoint(POINT { x, y }, MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if GetMonitorInfoW(mon, &mut mi).as_bool() {
            mi.rcWork
        } else {
            RECT { left: x - 2000, top: y - 2000, right: x + 2000, bottom: y + 2000 }
        }
    }
}

fn make_font(pt: f32, scale: f32, weight: i32) -> HFONT {
    unsafe {
        CreateFontW(
            -((pt * scale * 96.0 / 72.0).round() as i32),
            0,
            0,
            0,
            weight,
            0,
            0,
            0,
            DEFAULT_CHARSET,
            OUT_TT_PRECIS,
            CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY,
            0,
            w!("Segoe UI"),
        )
    }
}

fn free_cells(cells: &[&'static std::thread::LocalKey<Cell<isize>>]) {
    for cell in cells {
        let v = cell.with(|c| c.replace(0));
        if v != 0 {
            unsafe {
                let _ = DeleteObject(HGDIOBJ(v as *mut core::ffi::c_void));
            }
        }
    }
}

/// Hide the pill, menu, working bubble, and preview.
pub fn close() {
    close_preview();
    close_working();
    close_menu();
    close_pill();
}

/// Hide just the transient bits (menu / working / preview), keeping the pill.
pub fn close_transients() {
    close_preview();
    close_working();
    close_menu();
}

pub fn close_working() {
    WORKING.with(|c| {
        let h = c.get();
        if h != 0 {
            unsafe {
                let _ = DestroyWindow(HWND(h as *mut core::ffi::c_void));
            }
            c.set(0);
        }
    });
}

pub fn close_preview() {
    PREVIEW.with(|c| {
        let h = c.get();
        if h != 0 {
            unsafe {
                let _ = DestroyWindow(HWND(h as *mut core::ffi::c_void));
            }
            c.set(0);
        }
    });
}

pub fn close_pill() {
    PILL.with(|c| {
        let h = c.get();
        if h != 0 {
            unsafe {
                let _ = DestroyWindow(HWND(h as *mut core::ffi::c_void));
            }
            c.set(0);
        }
    });
}

pub fn close_menu() {
    HOOK.with(|hk| {
        let h = hk.get();
        if h != 0 {
            unsafe {
                let _ = UnhookWindowsHookEx(HHOOK(h as *mut core::ffi::c_void));
            }
            hk.set(0);
        }
    });
    MENU.with(|c| {
        let h = c.get();
        if h != 0 {
            unsafe {
                let _ = DestroyWindow(HWND(h as *mut core::ffi::c_void));
            }
            c.set(0);
        }
    });
}

/// Show (or move) the rewrite pill so its bottom-right sits near (x, y) — the
/// field's bottom-right corner. Clamped on-screen.
pub fn show_pill(x: i32, y: i32) {
    close_pill();
    unsafe {
        let Ok(hinstance) = GetModuleHandleW(None) else {
            return;
        };
        let class = w!("OGrammarPillClass");
        let wc = WNDCLASSW {
            lpfnWndProc: Some(pill_proc),
            hInstance: hinstance.into(),
            lpszClassName: class,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            ..Default::default()
        };
        RegisterClassW(&wc);

        let scale = (dpi_for_point(x, y) as f32) / 96.0;
        let s = |v: i32| (v as f32 * scale).round() as i32;
        let pw = s(96);
        let ph = s(26);
        // Position the pill so its bottom-right is at (x, y), clamped on-screen.
        let work = work_area_for_point(x, y);
        let px = (x - pw).min(work.right - pw).max(work.left);
        let py = (y - ph).min(work.bottom - ph).max(work.top);

        let bg = CreateSolidBrush(cref(INDIGO));
        PILL_BG.with(|b| b.set(bg.0 as isize));
        let font = make_font(9.5, scale, 600);
        PILL_FONT.with(|f| f.set(font.0 as isize));

        let hwnd = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW,
            class,
            w!("OGrammar rewrite"),
            WINDOW_STYLE(WS_POPUP.0),
            px,
            py,
            pw,
            ph,
            None,
            None,
            Some(hinstance.into()),
            None,
        )
        .unwrap_or_default();
        if hwnd.0.is_null() {
            return;
        }
        let rgn = CreateRoundRectRgn(0, 0, pw + 1, ph + 1, s(13), s(13));
        let _ = SetWindowRgn(hwnd, Some(rgn), true);
        PILL.with(|c| c.set(hwnd.0 as isize));
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

/// Show the tone menu (Polish / Formalize / Casual) anchored near (x, y).
pub fn show_menu(x: i32, y: i32) {
    close_menu();
    unsafe {
        let Ok(hinstance) = GetModuleHandleW(None) else {
            return;
        };
        let class = w!("OGrammarToneMenuClass");
        let wc = WNDCLASSW {
            lpfnWndProc: Some(menu_proc),
            hInstance: hinstance.into(),
            lpszClassName: class,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            ..Default::default()
        };
        RegisterClassW(&wc);

        let scale = (dpi_for_point(x, y) as f32) / 96.0;
        let s = |v: i32| (v as f32 * scale).round() as i32;
        let mw = s(180);
        let mh = s(28 + 34 * TONES.len() as i32 + 8);

        let work = work_area_for_point(x, y);
        let mx = x.min(work.right - mw).max(work.left);
        let my = y.min(work.bottom - mh).max(work.top);

        let bg = CreateSolidBrush(cref(0xFAFBFF));
        MENU_BG.with(|b| b.set(bg.0 as isize));
        let font = make_font(10.0, scale, 400);
        MENU_FONT.with(|f| f.set(font.0 as isize));

        let hwnd = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW,
            class,
            w!("OGrammar tone"),
            WINDOW_STYLE(WS_POPUP.0),
            mx,
            my,
            mw,
            mh,
            None,
            None,
            Some(hinstance.into()),
            None,
        )
        .unwrap_or_default();
        if hwnd.0.is_null() {
            return;
        }

        let bx = s(10);
        let bw = mw - s(20);
        let mut by = s(26);
        for (i, tone) in TONES.iter().enumerate() {
            let label = wide(tone);
            let h = CreateWindowExW(
                WINDOW_EX_STYLE(0),
                w!("BUTTON"),
                PCWSTR(label.as_ptr()),
                WINDOW_STYLE(WS_CHILD.0 | WS_VISIBLE.0 | BS_PUSHBUTTON as u32 | WS_TABSTOP.0),
                bx,
                by,
                bw,
                s(30),
                Some(hwnd),
                Some(HMENU((ID_TONE_BASE + i as i32) as isize as *mut core::ffi::c_void)),
                Some(hinstance.into()),
                None,
            )
            .unwrap_or_default();
            SendMessageW(h, WM_SETFONT, Some(WPARAM(font.0 as usize)), Some(LPARAM(1)));
            by += s(34);
        }

        MENU.with(|c| c.set(hwnd.0 as isize));
        if let Ok(hook) =
            SetWindowsHookExW(WH_MOUSE_LL, Some(menu_mouse_proc), Some(hinstance.into()), 0)
        {
            HOOK.with(|h| h.set(hook.0 as isize));
        }
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

/// A small status bubble. `auto_ms = Some(ms)` makes it self-close after `ms`.
fn show_bubble(x: i32, y: i32, msg: &str, auto_ms: Option<u32>) {
    close_working();
    unsafe {
        let Ok(hinstance) = GetModuleHandleW(None) else {
            return;
        };
        let class = w!("OGrammarWorkingClass");
        let wc = WNDCLASSW {
            lpfnWndProc: Some(working_proc),
            hInstance: hinstance.into(),
            lpszClassName: class,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            ..Default::default()
        };
        RegisterClassW(&wc);
        let scale = (dpi_for_point(x, y) as f32) / 96.0;
        let s = |v: i32| (v as f32 * scale).round() as i32;
        let w = s(200);
        let h = s(34);
        let work = work_area_for_point(x, y);
        let px = x.min(work.right - w).max(work.left);
        let py = y.min(work.bottom - h).max(work.top);
        PV_TITLE.with(|t| *t.borrow_mut() = msg.to_string());
        let bg = CreateSolidBrush(cref(0xFAFBFF));
        PV_BG.with(|b| b.set(bg.0 as isize));
        let font = make_font(10.0, scale, 600);
        PV_FONT.with(|f| f.set(font.0 as isize));
        let hwnd = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW,
            class,
            w!("OGrammar working"),
            WINDOW_STYLE(WS_POPUP.0),
            px,
            py,
            w,
            h,
            None,
            None,
            Some(hinstance.into()),
            None,
        )
        .unwrap_or_default();
        if hwnd.0.is_null() {
            return;
        }
        let rgn = CreateRoundRectRgn(0, 0, w + 1, h + 1, s(8), s(8));
        let _ = SetWindowRgn(hwnd, Some(rgn), true);
        WORKING.with(|c| c.set(hwnd.0 as isize));
        if let Some(ms) = auto_ms {
            SetTimer(Some(hwnd), 1, ms, None);
        }
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

/// "Rewriting…" bubble while the LLM rewrite is in flight.
pub fn show_working(x: i32, y: i32) {
    show_bubble(x, y, "Rewriting…", None);
}

/// A transient notice that self-closes — e.g. when the rewrite returns no change.
pub fn show_notice(x: i32, y: i32, msg: &str) {
    show_bubble(x, y, msg, Some(2500));
}

/// Show the rewrite PREVIEW: the proposed new text (read-only) with Apply /
/// Cancel. Nothing is applied until Apply is clicked.
pub fn show_preview(x: i32, y: i32, text: &str, tone: &str) {
    close_preview();
    unsafe {
        let Ok(hinstance) = GetModuleHandleW(None) else {
            return;
        };
        let class = w!("OGrammarPreviewClass");
        let wc = WNDCLASSW {
            lpfnWndProc: Some(preview_proc),
            hInstance: hinstance.into(),
            lpszClassName: class,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            ..Default::default()
        };
        RegisterClassW(&wc);
        let scale = (dpi_for_point(x, y) as f32) / 96.0;
        let s = |v: i32| (v as f32 * scale).round() as i32;
        let pw = s(380);
        let ph = s(30 + 150 + 46);
        let work = work_area_for_point(x, y);
        let px = x.min(work.right - pw).max(work.left);
        let py = y.min(work.bottom - ph).max(work.top);
        PV_TITLE.with(|t| *t.borrow_mut() = format!("{tone} — review, then Apply"));
        let bg = CreateSolidBrush(cref(0xFAFBFF));
        PV_BG.with(|b| b.set(bg.0 as isize));
        let font = make_font(10.0, scale, 400);
        PV_FONT.with(|f| f.set(font.0 as isize));

        let hwnd = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW,
            class,
            w!("OGrammar preview"),
            WINDOW_STYLE(WS_POPUP.0),
            px,
            py,
            pw,
            ph,
            None,
            None,
            Some(hinstance.into()),
            None,
        )
        .unwrap_or_default();
        if hwnd.0.is_null() {
            return;
        }

        // Read-only, scrollable multiline edit showing the proposed text.
        let edit_text = wide(text);
        let edit = CreateWindowExW(
            WINDOW_EX_STYLE(0),
            w!("EDIT"),
            PCWSTR(edit_text.as_ptr()),
            WINDOW_STYLE(
                WS_CHILD.0
                    | WS_VISIBLE.0
                    | WS_BORDER.0
                    | WS_VSCROLL.0
                    | (ES_MULTILINE as u32)
                    | (ES_READONLY as u32),
            ),
            s(10),
            s(30),
            pw - s(20),
            s(150),
            Some(hwnd),
            None,
            Some(hinstance.into()),
            None,
        )
        .unwrap_or_default();
        SendMessageW(edit, WM_SETFONT, Some(WPARAM(font.0 as usize)), Some(LPARAM(1)));

        let bw = s(110);
        let bh = s(30);
        let by = s(30 + 150 + 8);
        let mk_btn = |text: PCWSTR, bx, id: i32| {
            let h = CreateWindowExW(
                WINDOW_EX_STYLE(0),
                w!("BUTTON"),
                text,
                WINDOW_STYLE(WS_CHILD.0 | WS_VISIBLE.0 | BS_PUSHBUTTON as u32 | WS_TABSTOP.0),
                bx,
                by,
                bw,
                bh,
                Some(hwnd),
                Some(HMENU(id as isize as *mut core::ffi::c_void)),
                Some(hinstance.into()),
                None,
            )
            .unwrap_or_default();
            SendMessageW(h, WM_SETFONT, Some(WPARAM(font.0 as usize)), Some(LPARAM(1)));
        };
        mk_btn(w!("Apply"), pw - s(10) - bw, ID_APPLY);
        mk_btn(w!("Cancel"), pw - s(18) - bw * 2, ID_CANCEL);

        PREVIEW.with(|c| c.set(hwnd.0 as isize));
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

unsafe extern "system" fn working_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    unsafe {
        match msg {
            WM_PAINT => {
                let mut ps = PAINTSTRUCT::default();
                let hdc = BeginPaint(hwnd, &mut ps);
                let mut rc = RECT::default();
                let _ = GetClientRect(hwnd, &mut rc);
                FillRect(hdc, &rc, HBRUSH(PV_BG.with(|b| b.get()) as *mut core::ffi::c_void));
                SetBkMode(hdc, TRANSPARENT);
                let old = SelectObject(hdc, HGDIOBJ(PV_FONT.with(|f| f.get()) as *mut core::ffi::c_void));
                SetTextColor(hdc, cref(INDIGO));
                let mut buf = wide(&PV_TITLE.with(|t| t.borrow().clone()));
                DrawTextW(
                    hdc,
                    &mut buf,
                    &mut rc,
                    DRAW_TEXT_FORMAT(
                        (DT_CENTER.0 | DT_VCENTER.0 | DT_SINGLELINE.0 | DT_NOPREFIX.0) as u32,
                    ),
                );
                SelectObject(hdc, old);
                let _ = EndPaint(hwnd, &ps);
                LRESULT(0)
            }
            WM_TIMER => {
                let _ = KillTimer(Some(hwnd), 1);
                let _ = DestroyWindow(hwnd);
                LRESULT(0)
            }
            WM_DESTROY => {
                WORKING.with(|c| {
                    if c.get() == hwnd.0 as isize {
                        c.set(0);
                    }
                });
                free_cells(&[&PV_FONT, &PV_BG]);
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }
}

unsafe extern "system" fn preview_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    unsafe {
        match msg {
            WM_PAINT => {
                let mut ps = PAINTSTRUCT::default();
                let hdc = BeginPaint(hwnd, &mut ps);
                let mut rc = RECT::default();
                let _ = GetClientRect(hwnd, &mut rc);
                FillRect(hdc, &rc, HBRUSH(PV_BG.with(|b| b.get()) as *mut core::ffi::c_void));
                SetBkMode(hdc, TRANSPARENT);
                let old = SelectObject(hdc, HGDIOBJ(PV_FONT.with(|f| f.get()) as *mut core::ffi::c_void));
                SetTextColor(hdc, cref(INDIGO));
                let title = PV_TITLE.with(|t| t.borrow().clone());
                let mut buf = wide(&title);
                let mut tr = RECT { left: rc.left + 12, top: 7, right: rc.right, bottom: 28 };
                DrawTextW(
                    hdc,
                    &mut buf,
                    &mut tr,
                    DRAW_TEXT_FORMAT((DT_LEFT.0 | DT_SINGLELINE.0 | DT_NOPREFIX.0) as u32),
                );
                SelectObject(hdc, old);
                let _ = EndPaint(hwnd, &ps);
                LRESULT(0)
            }
            WM_CTLCOLORSTATIC | WM_CTLCOLOREDIT | WM_CTLCOLORBTN => {
                LRESULT(PV_BG.with(|b| b.get()))
            }
            WM_COMMAND => {
                let id = (wparam.0 & 0xFFFF) as i32;
                if id == ID_APPLY {
                    let _ = PostThreadMessageW(
                        GetCurrentThreadId(),
                        WM_PILL_APPLY,
                        WPARAM(0),
                        LPARAM(0),
                    );
                    let _ = DestroyWindow(hwnd);
                } else if id == ID_CANCEL {
                    let _ = DestroyWindow(hwnd);
                }
                LRESULT(0)
            }
            WM_DESTROY => {
                PREVIEW.with(|c| {
                    if c.get() == hwnd.0 as isize {
                        c.set(0);
                    }
                });
                free_cells(&[&PV_FONT, &PV_BG]);
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }
}

unsafe extern "system" fn pill_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_PAINT => {
                let mut ps = PAINTSTRUCT::default();
                let hdc = BeginPaint(hwnd, &mut ps);
                let mut rc = RECT::default();
                let _ = GetClientRect(hwnd, &mut rc);
                let brush = HBRUSH(PILL_BG.with(|b| b.get()) as *mut core::ffi::c_void);
                FillRect(hdc, &rc, brush);
                SetBkMode(hdc, TRANSPARENT);
                let font = HFONT(PILL_FONT.with(|f| f.get()) as *mut core::ffi::c_void);
                let old = SelectObject(hdc, HGDIOBJ(font.0));
                SetTextColor(hdc, cref(0xFFFFFF));
                let mut buf = wide("Rewrite");
                DrawTextW(
                    hdc,
                    &mut buf,
                    &mut rc,
                    DRAW_TEXT_FORMAT(
                        (DT_CENTER.0 | DT_VCENTER.0 | DT_SINGLELINE.0 | DT_NOPREFIX.0) as u32,
                    ),
                );
                SelectObject(hdc, old);
                let _ = EndPaint(hwnd, &ps);
                LRESULT(0)
            }
            WM_LBUTTONUP => {
                let _ =
                    PostThreadMessageW(GetCurrentThreadId(), WM_PILL_CLICK, WPARAM(0), LPARAM(0));
                LRESULT(0)
            }
            WM_DESTROY => {
                PILL.with(|c| {
                    if c.get() == hwnd.0 as isize {
                        c.set(0);
                    }
                });
                free_cells(&[&PILL_FONT, &PILL_BG]);
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }
}

unsafe extern "system" fn menu_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_PAINT => {
                let mut ps = PAINTSTRUCT::default();
                let hdc = BeginPaint(hwnd, &mut ps);
                let mut rc = RECT::default();
                let _ = GetClientRect(hwnd, &mut rc);
                let brush = HBRUSH(MENU_BG.with(|b| b.get()) as *mut core::ffi::c_void);
                FillRect(hdc, &rc, brush);
                SetBkMode(hdc, TRANSPARENT);
                let font = HFONT(MENU_FONT.with(|f| f.get()) as *mut core::ffi::c_void);
                let old = SelectObject(hdc, HGDIOBJ(font.0));
                SetTextColor(hdc, cref(INDIGO));
                let mut title = wide("Rewrite with AI");
                let mut tr = RECT { left: rc.left + 12, top: 6, right: rc.right, bottom: 26 };
                DrawTextW(
                    hdc,
                    &mut title,
                    &mut tr,
                    DRAW_TEXT_FORMAT((DT_LEFT.0 | DT_SINGLELINE.0 | DT_NOPREFIX.0) as u32),
                );
                SelectObject(hdc, old);
                let _ = EndPaint(hwnd, &ps);
                LRESULT(0)
            }
            WM_CTLCOLORBTN => LRESULT(MENU_BG.with(|b| b.get())),
            WM_COMMAND => {
                let id = (wparam.0 & 0xFFFF) as i32;
                if (ID_TONE_BASE..ID_TONE_BASE + TONES.len() as i32).contains(&id) {
                    let tone = (id - ID_TONE_BASE) as isize;
                    let _ = PostThreadMessageW(
                        GetCurrentThreadId(),
                        WM_PILL_TONE,
                        WPARAM(0),
                        LPARAM(tone),
                    );
                    let _ = DestroyWindow(hwnd);
                }
                LRESULT(0)
            }
            WM_DESTROY => {
                MENU.with(|c| {
                    if c.get() == hwnd.0 as isize {
                        c.set(0);
                    }
                });
                free_cells(&[&MENU_FONT, &MENU_BG]);
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }
}

/// Light-dismiss the tone menu on any mouse-down outside it.
unsafe extern "system" fn menu_mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
        if code >= 0 {
            let msg = wparam.0 as u32;
            if msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN || msg == WM_MBUTTONDOWN {
                let menu = MENU.with(|c| c.get());
                if menu != 0 && lparam.0 != 0 {
                    let info = &*(lparam.0 as *const MSLLHOOKSTRUCT);
                    let pt: POINT = info.pt;
                    let hwnd = HWND(menu as *mut core::ffi::c_void);
                    let mut rc = RECT::default();
                    if GetWindowRect(hwnd, &mut rc).is_ok() {
                        let inside = pt.x >= rc.left
                            && pt.x < rc.right
                            && pt.y >= rc.top
                            && pt.y < rc.bottom;
                        if !inside {
                            // Close on the next message pump turn (can't destroy
                            // from inside the hook safely) by posting WM_CLOSE.
                            let _ = PostThreadMessageW(
                                GetCurrentThreadId(),
                                WM_PILL_TONE,
                                WPARAM(usize::MAX),
                                LPARAM(-1),
                            );
                        }
                    }
                }
            }
        }
        CallNextHookEx(None, code, wparam, lparam)
    }
}
