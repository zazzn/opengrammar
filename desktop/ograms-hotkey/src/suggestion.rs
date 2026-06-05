//! The inline suggestion card shown when the user clicks an underline — a small
//! NO-ACTIVATE popup (so it never steals focus from the text field, which would
//! clear the underlines). It mirrors the extension's review card: a kicker
//! ("AI suggestion" / "Correctness" / "Spelling"), the "Why?" reason, one button
//! per candidate correction (pick any), and Dismiss. Clicking a button posts the
//! decision (issue index + chosen candidate) back to the UI thread.

use std::cell::{Cell, RefCell};

use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, CreateFontW, CreateSolidBrush,
    DEFAULT_CHARSET, DT_LEFT, DT_NOPREFIX, DT_WORDBREAK, DeleteObject, DrawTextW, EndPaint,
    FillRect, GetMonitorInfoW, HBRUSH, HFONT, HGDIOBJ, MONITOR_DEFAULTTONEAREST, MONITORINFO,
    MonitorFromPoint, OUT_TT_PRECIS, PAINTSTRUCT, SelectObject, SetBkMode, SetTextColor, TRANSPARENT,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, GetDpiForWindow, MDT_EFFECTIVE_DPI};
use windows::Win32::UI::WindowsAndMessaging::{
    BS_PUSHBUTTON, CallNextHookEx, CreateWindowExW, DefWindowProcW, DestroyWindow, GWLP_USERDATA,
    GetClientRect, GetWindowLongPtrW, GetWindowRect, HHOOK, HMENU, IDC_ARROW, LoadCursorW,
    MSLLHOOKSTRUCT, PostThreadMessageW, RegisterClassW, SW_SHOWNOACTIVATE, SendMessageW,
    SetWindowLongPtrW, SetWindowsHookExW, ShowWindow, UnhookWindowsHookEx, WH_MOUSE_LL,
    WINDOW_EX_STYLE, WINDOW_STYLE, WM_APP, WM_COMMAND, WM_CTLCOLORBTN, WM_CTLCOLORSTATIC,
    WM_DESTROY, WM_LBUTTONDOWN, WM_MBUTTONDOWN, WM_PAINT, WM_RBUTTONDOWN, WM_SETFONT, WNDCLASSW,
    WS_CHILD, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP, WS_TABSTOP, WS_VISIBLE,
};
use windows::core::{PCWSTR, w};

/// Posted (wParam = drawn-issue index, lParam = candidate index) on Accept.
pub const WM_OVERLAY_APPLY: u32 = WM_APP + 21;
/// Posted (wParam = drawn-issue index) on Dismiss.
pub const WM_OVERLAY_DISMISS: u32 = WM_APP + 22;
/// Posted when a click lands outside the open card — the monitor closes it
/// (light dismiss, matching the extension's click-away behavior).
pub const WM_CARD_LIGHT_DISMISS: u32 = WM_APP + 24;

const ID_ACCEPT_BASE: i32 = 100;
const ID_DISMISS: i32 = 2;
const MAX_CANDIDATES: usize = 3;

struct CardInfo {
    kicker: String,
    reason: String,
    is_ai: bool,
}

thread_local! {
    static CURRENT: Cell<isize> = const { Cell::new(0) };
    static HOOK: Cell<isize> = const { Cell::new(0) };
    static FONT_BODY: Cell<isize> = const { Cell::new(0) };
    static FONT_KICKER: Cell<isize> = const { Cell::new(0) };
    static BRUSH: Cell<isize> = const { Cell::new(0) };
    static INFO: RefCell<CardInfo> =
        const { RefCell::new(CardInfo { kicker: String::new(), reason: String::new(), is_ai: false }) };
}

fn cref(rgb: u32) -> COLORREF {
    COLORREF((rgb & 0xFF) << 16 | (rgb >> 8 & 0xFF) << 8 | (rgb >> 16 & 0xFF))
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max.saturating_sub(1)).collect::<String>() + "…"
    }
}

/// Effective DPI of the monitor that contains screen point (x, y). The card must
/// size itself for the monitor it actually pops up on — on a mixed-DPI setup
/// (e.g. a 4K next to a 1440p) the system DPI is the wrong one and made the card
/// tiny on the higher-DPI display.
fn dpi_for_point(x: i32, y: i32) -> u32 {
    unsafe {
        let mon = MonitorFromPoint(POINT { x, y }, MONITOR_DEFAULTTONEAREST);
        let mut dpi_x = 96u32;
        let mut dpi_y = 96u32;
        if GetDpiForMonitor(mon, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y).is_ok() {
            dpi_x.max(96)
        } else {
            96
        }
    }
}

/// Work area (excludes the taskbar) of the monitor containing point (x, y), so a
/// popup can be clamped on-screen. Falls back to a generous rect on failure.
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

pub fn close() {
    // Remove the light-dismiss mouse hook first, then destroy the window.
    HOOK.with(|hk| {
        let h = hk.get();
        if h != 0 {
            unsafe {
                let _ = UnhookWindowsHookEx(HHOOK(h as *mut core::ffi::c_void));
            }
            hk.set(0);
        }
    });
    CURRENT.with(|c| {
        let h = c.get();
        if h != 0 {
            unsafe {
                let _ = DestroyWindow(HWND(h as *mut core::ffi::c_void));
            }
            c.set(0);
        }
    });
}

/// Show the suggestion card for `index`. (x, y) is the preferred top-left (just
/// below the word); `word_top` is the word's top edge so the card can flip above
/// it when it would otherwise spill off the bottom of the screen.
pub fn show(
    index: usize,
    _original: &str,
    candidates: &[String],
    reason: &str,
    kicker: &str,
    is_ai: bool,
    x: i32,
    y: i32,
    word_top: i32,
) {
    close();
    unsafe {
        let Ok(hinstance) = GetModuleHandleW(None) else {
            return;
        };
        let class = w!("OGrammarCardClass");
        let wc = WNDCLASSW {
            lpfnWndProc: Some(card_proc),
            hInstance: hinstance.into(),
            lpszClassName: class,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            ..Default::default()
        };
        RegisterClassW(&wc);

        let n = candidates.len().clamp(1, MAX_CANDIDATES);
        INFO.with(|i| {
            *i.borrow_mut() = CardInfo {
                kicker: kicker.to_string(),
                reason: truncate(reason, 120),
                is_ai,
            }
        });

        let scale = (dpi_for_point(x, y) as f32) / 96.0;
        let s = |v: i32| (v as f32 * scale).round() as i32;
        let cw = s(380);
        // kicker(20) + reason(40) + n candidate rows(32 each) + dismiss(34) + pad
        let ch = s(64 + 32 * n as i32 + 40);

        // Keep the card fully on-screen: flip it above the word if it would spill
        // off the bottom, then clamp into the monitor's work area.
        let work = work_area_for_point(x, y);
        let mut px = x;
        let mut py = y;
        if py + ch > work.bottom {
            py = word_top - ch - s(4);
        }
        px = px.min(work.right - cw).max(work.left);
        py = py.min(work.bottom - ch).max(work.top);

        let brush = CreateSolidBrush(cref(0xFAFBFF));
        BRUSH.with(|b| b.set(brush.0 as isize));
        let make_font = |pt: f32, weight: i32| -> HFONT {
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
        };
        let font_body = make_font(10.0, 400);
        let font_kicker = make_font(9.5, 600);
        FONT_BODY.with(|f| f.set(font_body.0 as isize));
        FONT_KICKER.with(|f| f.set(font_kicker.0 as isize));

        let hwnd = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW,
            class,
            w!("OGrammar suggestion"),
            WINDOW_STYLE(WS_POPUP.0),
            px,
            py,
            cw,
            ch,
            None,
            None,
            Some(hinstance.into()),
            None,
        )
        .unwrap_or_default();
        if hwnd.0.is_null() {
            return;
        }

        let mk = |text: PCWSTR, bx, by, bw, bh, id: i32| {
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
            SendMessageW(h, WM_SETFONT, Some(WPARAM(font_body.0 as usize)), Some(LPARAM(1)));
        };

        let bx = s(12);
        let bw = cw - s(24);
        let mut by = s(60);
        for (i, cand) in candidates.iter().take(n).enumerate() {
            let label = wide(&truncate(cand, 44));
            mk(PCWSTR(label.as_ptr()), bx, by, bw, s(28), ID_ACCEPT_BASE + i as i32);
            by += s(32);
        }
        by += s(4);
        mk(w!("Dismiss"), bx, by, bw, s(26), ID_DISMISS);

        SetWindowLongPtrW(hwnd, GWLP_USERDATA, index as isize);
        CURRENT.with(|c| c.set(hwnd.0 as isize));
        // Light-dismiss: watch global mouse-downs while the card is open; a click
        // anywhere outside it closes it (extension-style click-away). The hook is
        // removed in close(). It only reads the cursor position on button-down —
        // it is not a keystroke hook.
        if let Ok(hook) =
            SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_ll_proc), Some(hinstance.into()), 0)
        {
            HOOK.with(|h| h.set(hook.0 as isize));
        }
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

unsafe extern "system" fn card_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_PAINT => {
                let mut ps = PAINTSTRUCT::default();
                let hdc = BeginPaint(hwnd, &mut ps);
                let mut rc = RECT::default();
                let _ = GetClientRect(hwnd, &mut rc);
                let brush = HBRUSH(BRUSH.with(|b| b.get()) as *mut core::ffi::c_void);
                FillRect(hdc, &rc, brush);

                let dpi = GetDpiForWindow(hwnd).max(96) as i32;
                let px = |v: i32| v * dpi / 96;
                SetBkMode(hdc, TRANSPARENT);

                INFO.with(|info| {
                    let info = info.borrow();
                    // Kicker (colored).
                    let kf = HFONT(FONT_KICKER.with(|f| f.get()) as *mut core::ffi::c_void);
                    let old = SelectObject(hdc, HGDIOBJ(kf.0));
                    SetTextColor(hdc, cref(if info.is_ai { 0x4F46E5 } else { 0xE53935 }));
                    let mut kbuf = wide(&info.kicker);
                    let mut kr = RECT { left: px(14), top: px(10), right: rc.right - px(12), bottom: px(30) };
                    DrawTextW(
                        hdc,
                        &mut kbuf,
                        &mut kr,
                        windows::Win32::Graphics::Gdi::DRAW_TEXT_FORMAT(
                            (DT_LEFT.0 | DT_NOPREFIX.0) as u32,
                        ),
                    );
                    // Reason (grey, wrapped).
                    let bf = HFONT(FONT_BODY.with(|f| f.get()) as *mut core::ffi::c_void);
                    SelectObject(hdc, HGDIOBJ(bf.0));
                    SetTextColor(hdc, cref(0x5F6368));
                    let mut rbuf = wide(&info.reason);
                    let mut rr = RECT { left: px(14), top: px(30), right: rc.right - px(12), bottom: px(58) };
                    DrawTextW(
                        hdc,
                        &mut rbuf,
                        &mut rr,
                        windows::Win32::Graphics::Gdi::DRAW_TEXT_FORMAT(
                            (DT_LEFT.0 | DT_WORDBREAK.0 | DT_NOPREFIX.0) as u32,
                        ),
                    );
                    SelectObject(hdc, old);
                });
                let _ = EndPaint(hwnd, &ps);
                LRESULT(0)
            }
            WM_CTLCOLORSTATIC | WM_CTLCOLORBTN => LRESULT(BRUSH.with(|b| b.get())),
            WM_COMMAND => {
                let id = (wparam.0 & 0xFFFF) as i32;
                let index = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as usize;
                let tid = GetCurrentThreadId();
                if (ID_ACCEPT_BASE..ID_ACCEPT_BASE + MAX_CANDIDATES as i32).contains(&id) {
                    let cand = (id - ID_ACCEPT_BASE) as usize;
                    let _ = PostThreadMessageW(
                        tid,
                        WM_OVERLAY_APPLY,
                        WPARAM(index),
                        LPARAM(cand as isize),
                    );
                    let _ = DestroyWindow(hwnd);
                } else if id == ID_DISMISS {
                    let _ = PostThreadMessageW(tid, WM_OVERLAY_DISMISS, WPARAM(index), LPARAM(0));
                    let _ = DestroyWindow(hwnd);
                }
                LRESULT(0)
            }
            WM_DESTROY => {
                CURRENT.with(|c| {
                    if c.get() == hwnd.0 as isize {
                        c.set(0);
                    }
                });
                for cell in [&FONT_BODY, &FONT_KICKER, &BRUSH] {
                    let v = cell.with(|c| c.replace(0));
                    if v != 0 {
                        let _ = DeleteObject(HGDIOBJ(v as *mut core::ffi::c_void));
                    }
                }
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }
}

/// Low-level mouse hook installed only while a card is open. On any mouse-down
/// outside the card window it posts WM_CARD_LIGHT_DISMISS so the monitor closes
/// the card. Reads cursor position only — no keystrokes are observed.
unsafe extern "system" fn mouse_ll_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
        if code >= 0 {
            let msg = wparam.0 as u32;
            if msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN || msg == WM_MBUTTONDOWN {
                let card = CURRENT.with(|c| c.get());
                if card != 0 && lparam.0 != 0 {
                    let info = &*(lparam.0 as *const MSLLHOOKSTRUCT);
                    let pt: POINT = info.pt;
                    let hwnd = HWND(card as *mut core::ffi::c_void);
                    let mut rc = RECT::default();
                    if GetWindowRect(hwnd, &mut rc).is_ok() {
                        let inside = pt.x >= rc.left
                            && pt.x < rc.right
                            && pt.y >= rc.top
                            && pt.y < rc.bottom;
                        if !inside {
                            let _ = PostThreadMessageW(
                                GetCurrentThreadId(),
                                WM_CARD_LIGHT_DISMISS,
                                WPARAM(0),
                                LPARAM(0),
                            );
                        }
                    }
                }
            }
        }
        CallNextHookEx(None, code, wparam, lparam)
    }
}
