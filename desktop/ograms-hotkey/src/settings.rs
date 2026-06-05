//! Settings window — pure Win32, skinned to the OGrammar brand.
//!   * Segoe UI typography, DPI-scaled layout.
//!   * Indigo→purple gradient header (#4F46E5 → #7C3AED) with the wordmark.
//!   * Light #FAFBFF body, indigo section headers, grey hints.
//!   * Modern Win11 controls (Common-Controls v6 via the embedded manifest).
//! Pick-don't-type UX: friendly provider names, a per-provider Model dropdown,
//! and the exclusion list is built from a running-apps picker + Add/Remove.
//! Opened from the tray on its own thread; Save writes config.json + DPAPI key +
//! HKCU autostart and flags the monitor to hot-reload.

use std::cell::RefCell;
use std::sync::atomic::{AtomicBool, Ordering};

use windows::Win32::Foundation::{CloseHandle, COLORREF, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, CreateFontW, CreateSolidBrush,
    DEFAULT_CHARSET, DT_LEFT, DT_NOPREFIX, DT_SINGLELINE, DeleteObject, DrawTextW, EndPaint,
    FillRect, GetMonitorInfoW, HBRUSH, HDC, HFONT, HGDIOBJ, MONITOR_DEFAULTTONEAREST, MONITORINFO,
    MonitorFromPoint, OUT_TT_PRECIS, PAINTSTRUCT, SelectObject, SetBkMode, SetTextColor, TRANSPARENT,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::{
    OpenProcess, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
};
use windows::Win32::UI::HiDpi::{AdjustWindowRectExForDpi, GetDpiForWindow};
use windows::Win32::UI::WindowsAndMessaging::{
    BM_GETCHECK, BM_SETCHECK, BS_AUTOCHECKBOX, BS_PUSHBUTTON, CB_ADDSTRING, CB_GETCURSEL,
    CB_RESETCONTENT, CB_SETCURSEL, CBN_SELCHANGE, CBS_DROPDOWN, CBS_DROPDOWNLIST, CreateWindowExW,
    DefWindowProcW, DestroyWindow, DispatchMessageW, ES_AUTOHSCROLL, ES_PASSWORD, EnumWindows,
    GWLP_USERDATA, GetClientRect, GetCursorPos, GetDlgCtrlID, GetDlgItem, GetMessageW,
    GetWindowLongPtrW,
    GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, HMENU, IDC_ARROW,
    IsWindowVisible, LB_ADDSTRING, LB_DELETESTRING, LB_GETCURSEL, LBS_NOTIFY, LoadCursorW, MSG,
    PostQuitMessage, RegisterClassW, SET_WINDOW_POS_FLAGS, SW_SHOW,
    SendMessageW, SetWindowLongPtrW, SetWindowPos, SetWindowTextW, ShowWindow, TranslateMessage,
    WINDOW_EX_STYLE, WINDOW_STYLE, WM_COMMAND, WM_CTLCOLORBTN, WM_CTLCOLORSTATIC, WM_DESTROY,
    WM_ERASEBKGND, WM_PAINT, WM_SETFONT, WNDCLASSW, WS_BORDER, WS_CAPTION, WS_CHILD, WS_MINIMIZEBOX,
    WS_OVERLAPPED, WS_SYSMENU, WS_TABSTOP, WS_VISIBLE, WS_VSCROLL,
};
use windows::core::{BOOL, PCWSTR, w};

use crate::config::{self, Config};

static OPEN: AtomicBool = AtomicBool::new(false);

thread_local! {
    static RUNNING: RefCell<Vec<(String, String)>> = const { RefCell::new(Vec::new()) };
    static EXCLUDED: RefCell<Vec<(String, String)>> = const { RefCell::new(Vec::new()) };
}

const ID_ENABLE: i32 = 1001;
const ID_DIALECT: i32 = 1002;
const ID_AUTOSTART: i32 = 1003;
const ID_AI: i32 = 1004;
const ID_PROVIDER: i32 = 1005;
const ID_MODEL: i32 = 1006;
const ID_KEY: i32 = 1007;
const ID_RUNNING: i32 = 1008;
const ID_ADD: i32 = 1009;
const ID_EXCLUDED_LIST: i32 = 1010;
const ID_REMOVE: i32 = 1011;
const ID_SAVE: i32 = 1012;
const ID_CANCEL: i32 = 1013;
const ID_AUTOCORRECT: i32 = 1014;
const ID_AC_DELAY: i32 = 1015;
// Styled statics (so WM_CTLCOLORSTATIC can color them).
const ID_SECTION_AI: i32 = 2001;
const ID_SECTION_APPS: i32 = 2002;
const ID_HINT: i32 = 2003;
const ID_PRIVACY: i32 = 2004;

// Brand palette (0xRRGGBB).
const C_INDIGO: u32 = 0x4F46E5;
const C_PURPLE: u32 = 0x7C3AED;
const C_BODY: u32 = 0xFAFBFF;
const C_TEXT: u32 = 0x1C1C1E;
const C_GREY: u32 = 0x6B7280;
const C_LAVENDER: u32 = 0xE0E7FF;

const PROVIDER_IDS: &[&str] = &[
    "openai", "deepseek", "groq", "openrouter", "together", "abacus", "ollama", "custom",
];
const PROVIDER_NAMES: &[&str] = &[
    "OpenAI",
    "DeepSeek",
    "Groq",
    "OpenRouter",
    "Together AI",
    "Abacus",
    "Ollama (on your PC)",
    "Custom",
];
const DIALECTS: &[&str] = &["American", "British", "Canadian", "Australian"];
// Autocorrect delay presets: visible label + idle milliseconds before applying.
const AC_DELAYS: &[(&str, u64)] = &[
    ("after 1s", 1000),
    ("after 1.5s", 1500),
    ("after 2s", 2000),
    ("after 3s", 3000),
    ("after 5s", 5000),
];

fn models_for(provider: &str) -> &'static [&'static str] {
    // Curated to models that fit fast, accurate proofreading. Reasoning models
    // are excluded (slower, chain-of-thought overhead, no quality win). The Model
    // box stays editable, so power users can type any model. Best/default first.
    match provider {
        "openai" => &["gpt-4o-mini", "gpt-4.1-mini"],
        "deepseek" => &["deepseek-chat"],
        "groq" => &["llama-3.1-8b-instant", "llama-3.3-70b-versatile"],
        "openrouter" => &["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"],
        "together" => &["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
        "abacus" => &["route-llm"],
        "ollama" => ograms_engine::ollama::RECOMMENDED,
        _ => &[],
    }
}

fn friendly_name(exe_lower: &str) -> String {
    let known = match exe_lower {
        "chrome.exe" => "Google Chrome",
        "msedge.exe" => "Microsoft Edge",
        "firefox.exe" => "Firefox",
        "brave.exe" => "Brave",
        "opera.exe" | "opera_gx.exe" => "Opera",
        "vivaldi.exe" => "Vivaldi",
        "arc.exe" => "Arc",
        "iexplore.exe" => "Internet Explorer",
        "notepad.exe" => "Notepad",
        "notepad++.exe" => "Notepad++",
        "code.exe" => "VS Code",
        "slack.exe" => "Slack",
        "discord.exe" => "Discord",
        "teams.exe" | "ms-teams.exe" => "Microsoft Teams",
        "outlook.exe" => "Outlook",
        "winword.exe" => "Microsoft Word",
        "excel.exe" => "Microsoft Excel",
        "powerpnt.exe" => "Microsoft PowerPoint",
        "onenote.exe" => "OneNote",
        "thunderbird.exe" => "Thunderbird",
        "telegram.exe" => "Telegram",
        "signal.exe" => "Signal",
        "whatsapp.exe" => "WhatsApp",
        "claude.exe" => "Claude",
        "obsidian.exe" => "Obsidian",
        "zoom.exe" => "Zoom",
        _ => "",
    };
    if !known.is_empty() {
        return known.to_string();
    }
    let stem = exe_lower.strip_suffix(".exe").unwrap_or(exe_lower);
    let mut chars = stem.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => exe_lower.to_string(),
    }
}

/// Fonts + brushes + DPI scale, owned by the window (GWLP_USERDATA).
struct Skin {
    scale: f32,
    body: HFONT,
    title: HFONT,
    section: HFONT,
    hint: HFONT,
    brush_body: HBRUSH,
}

impl Skin {
    fn new(scale: f32) -> Self {
        let font = |pt: f32, weight: i32| -> HFONT {
            let height = -((pt * scale * 96.0 / 72.0).round() as i32);
            unsafe {
                CreateFontW(
                    height,
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
        };
        Self {
            scale,
            body: font(10.5, 400),
            title: font(18.0, 600),
            section: font(10.5, 600),
            hint: font(9.0, 400),
            brush_body: unsafe { CreateSolidBrush(cref(C_BODY)) },
        }
    }

    fn s(&self, v: i32) -> i32 {
        (v as f32 * self.scale).round() as i32
    }
}

impl Drop for Skin {
    fn drop(&mut self) {
        unsafe {
            for f in [self.body, self.title, self.section, self.hint] {
                let _ = DeleteObject(HGDIOBJ(f.0));
            }
            let _ = DeleteObject(HGDIOBJ(self.brush_body.0));
        }
    }
}

/// 0xRRGGBB → COLORREF (0x00BBGGRR).
fn cref(rgb: u32) -> COLORREF {
    let r = rgb >> 16 & 0xFF;
    let g = rgb >> 8 & 0xFF;
    let b = rgb & 0xFF;
    COLORREF(b << 16 | g << 8 | r)
}

pub fn open() {
    if OPEN.swap(true, Ordering::SeqCst) {
        return;
    }
    std::thread::spawn(|| {
        unsafe { run_window() };
        OPEN.store(false, Ordering::SeqCst);
    });
}

pub fn run_blocking() {
    OPEN.store(true, Ordering::SeqCst);
    unsafe { run_window() };
    OPEN.store(false, Ordering::SeqCst);
}

unsafe fn run_window() {
    unsafe {
        let Ok(hinstance) = GetModuleHandleW(None) else {
            return;
        };
        let class_name = w!("OGrammarSettingsClass");
        let wc = WNDCLASSW {
            lpfnWndProc: Some(wnd_proc),
            hInstance: hinstance.into(),
            lpszClassName: class_name,
            hCursor: LoadCursorW(None, IDC_ARROW).unwrap_or_default(),
            hbrBackground: HBRUSH::default(), // we paint the body ourselves
            ..Default::default()
        };
        RegisterClassW(&wc);

        let style =
            WINDOW_STYLE(WS_OVERLAPPED.0 | WS_CAPTION.0 | WS_SYSMENU.0 | WS_MINIMIZEBOX.0);

        // Open on the monitor under the cursor, sized for THAT monitor's DPI, and
        // centered in its work area — so the window scales correctly on a
        // mixed-resolution multi-monitor setup. (Per-Monitor-V2 means Windows
        // won't auto-scale it for us, and the primary monitor's DPI is often wrong.)
        let mut cursor = POINT::default();
        let _ = GetCursorPos(&mut cursor);
        let hmon = MonitorFromPoint(cursor, MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let _ = GetMonitorInfoW(hmon, &mut mi);
        let work = mi.rcWork;

        let Ok(hwnd) = CreateWindowExW(
            WINDOW_EX_STYLE(0),
            class_name,
            w!("OGrammar Settings"),
            style,
            // Create ON the target monitor so GetDpiForWindow reports its DPI.
            work.left,
            work.top,
            500,
            650,
            None,
            None,
            Some(hinstance.into()),
            None,
        ) else {
            return;
        };

        let dpi = GetDpiForWindow(hwnd).max(96);
        let scale = dpi as f32 / 96.0;
        let skin = Box::into_raw(Box::new(Skin::new(scale)));
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, skin as isize);

        // Size the window from the desired CLIENT area (so the title bar can't
        // clip the bottom row of controls). 500x600 client, DPI-scaled.
        let client_w = (500.0 * scale).round() as i32;
        let client_h = (600.0 * scale).round() as i32;
        let mut rect = RECT { left: 0, top: 0, right: client_w, bottom: client_h };
        let _ = AdjustWindowRectExForDpi(&mut rect, style, false, WINDOW_EX_STYLE(0), dpi);
        let win_w = rect.right - rect.left;
        let win_h = rect.bottom - rect.top;
        // Center within the target monitor's work area.
        let mon_w = (work.right - work.left).max(win_w);
        let mon_h = (work.bottom - work.top).max(win_h);
        let x = work.left + (mon_w - win_w) / 2;
        let y = work.top + (mon_h - win_h) / 2;
        let _ = SetWindowPos(
            hwnd,
            None,
            x.max(work.left),
            y.max(work.top),
            win_w,
            win_h,
            SET_WINDOW_POS_FLAGS(0x4), // SWP_NOZORDER
        );

        create_controls(hwnd, &*skin);
        let _ = ShowWindow(hwnd, SW_SHOW);

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

fn skin_of(hwnd: HWND) -> *const Skin {
    unsafe { GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *const Skin }
}

#[allow(clippy::too_many_arguments)]
unsafe fn mk(
    parent: HWND,
    class: PCWSTR,
    text: PCWSTR,
    extra_style: u32,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    id: i32,
    font: HFONT,
) -> HWND {
    unsafe {
        let hinstance = GetModuleHandleW(None).ok();
        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE(0),
            class,
            text,
            WINDOW_STYLE(WS_CHILD.0 | WS_VISIBLE.0 | extra_style),
            x,
            y,
            w,
            h,
            Some(parent),
            Some(HMENU(id as isize as *mut core::ffi::c_void)),
            hinstance.map(|h| h.into()),
            None,
        )
        .unwrap_or_default();
        SendMessageW(hwnd, WM_SETFONT, Some(WPARAM(font.0 as usize)), Some(LPARAM(1)));
        hwnd
    }
}

fn dlg(parent: HWND, id: i32) -> HWND {
    unsafe { GetDlgItem(Some(parent), id).unwrap_or_default() }
}

unsafe fn set_text(h: HWND, s: &str) {
    let wide: Vec<u16> = s.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let _ = SetWindowTextW(h, PCWSTR(wide.as_ptr()));
    }
}

unsafe fn get_text(h: HWND) -> String {
    unsafe {
        let len = GetWindowTextLengthW(h);
        if len <= 0 {
            return String::new();
        }
        let mut buf = vec![0u16; (len + 1) as usize];
        let n = GetWindowTextW(h, &mut buf);
        String::from_utf16_lossy(&buf[..n.max(0) as usize])
    }
}

unsafe fn set_check(h: HWND, checked: bool) {
    unsafe {
        SendMessageW(h, BM_SETCHECK, Some(WPARAM(usize::from(checked))), None);
    }
}

unsafe fn get_check(h: HWND) -> bool {
    unsafe { SendMessageW(h, BM_GETCHECK, None, None).0 == 1 }
}

unsafe fn combo_add(h: HWND, item: &str) {
    let wide: Vec<u16> = item.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        SendMessageW(h, CB_ADDSTRING, None, Some(LPARAM(wide.as_ptr() as isize)));
    }
}

unsafe fn list_add(h: HWND, item: &str) {
    let wide: Vec<u16> = item.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        SendMessageW(h, LB_ADDSTRING, None, Some(LPARAM(wide.as_ptr() as isize)));
    }
}

unsafe fn combo_sel(h: HWND) -> i32 {
    unsafe { SendMessageW(h, CB_GETCURSEL, None, None).0 as i32 }
}

unsafe fn combo_set_sel(h: HWND, i: i32) {
    unsafe {
        SendMessageW(h, CB_SETCURSEL, Some(WPARAM(i.max(0) as usize)), None);
    }
}

unsafe fn fill_models(combo: HWND, provider: &str, current: &str, ollama_url: &str) {
    unsafe {
        SendMessageW(combo, CB_RESETCONTENT, None, None);
        // Ollama: query the local server for the user's installed writing models
        // (best first), then recommended-to-pull — parity with the extension.
        // Other providers use the static curated list. The box stays editable.
        let models: Vec<String> = if provider == "ollama" {
            ograms_engine::ollama::dropdown_models(ollama_url)
        } else {
            models_for(provider).iter().map(|s| (*s).to_string()).collect()
        };
        for m in &models {
            combo_add(combo, m.as_str());
        }
        if !current.is_empty() {
            set_text(combo, current);
        } else if let Some(first) = models.first() {
            set_text(combo, first.as_str());
        }
    }
}

fn image_name(pid: u32) -> Option<String> {
    if pid == 0 {
        return None;
    }
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false.into(), pid).ok()?;
        let mut buf = [0u16; 260];
        let mut size = buf.len() as u32;
        let result = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT(0),
            windows::core::PWSTR(buf.as_mut_ptr()),
            &mut size,
        );
        let _ = CloseHandle(handle);
        result.ok()?;
        let path = String::from_utf16_lossy(&buf[..size as usize]);
        path.rsplit(['\\', '/'])
            .next()
            .map(|s| s.to_ascii_lowercase())
    }
}

unsafe extern "system" fn enum_apps(hwnd: HWND, lparam: LPARAM) -> BOOL {
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() || GetWindowTextLengthW(hwnd) == 0 {
            return BOOL(1);
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if let Some(exe) = image_name(pid) {
            if exe == "ograms-hotkey.exe" {
                return BOOL(1);
            }
            let out = &mut *(lparam.0 as *mut Vec<(String, String)>);
            if !out.iter().any(|(_, e)| e == &exe) {
                out.push((friendly_name(&exe), exe));
            }
        }
        BOOL(1)
    }
}

fn running_apps() -> Vec<(String, String)> {
    let mut apps: Vec<(String, String)> = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(enum_apps), LPARAM(&mut apps as *mut _ as isize));
    }
    apps.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));
    apps
}

unsafe fn create_controls(hwnd: HWND, skin: &Skin) {
    unsafe {
        let s = |v: i32| skin.s(v);
        let label = 0u32; // SS_LEFT
        let check = (BS_AUTOCHECKBOX as u32) | WS_TABSTOP.0;
        let edit = (ES_AUTOHSCROLL as u32) | WS_BORDER.0 | WS_TABSTOP.0;
        let edit_pw = edit | (ES_PASSWORD as u32);
        let combo_list = (CBS_DROPDOWNLIST as u32) | WS_VSCROLL.0 | WS_TABSTOP.0;
        let combo_edit = (CBS_DROPDOWN as u32) | WS_VSCROLL.0 | WS_TABSTOP.0;
        let listbox = LBS_NOTIFY as u32 | WS_BORDER.0 | WS_VSCROLL.0 | WS_TABSTOP.0;
        let button = (BS_PUSHBUTTON as u32) | WS_TABSTOP.0;
        let lx = 20;
        let ix = 150;
        let body = skin.body;

        // General
        mk(hwnd, w!("BUTTON"), w!("Enable OGrammar"), check, s(lx), s(80), s(300), s(22), ID_ENABLE, body);
        mk(hwnd, w!("STATIC"), w!("Language:"), label, s(lx), s(112), s(120), s(20), 0, body);
        mk(hwnd, w!("COMBOBOX"), w!(""), combo_list, s(ix), s(110), s(180), s(240), ID_DIALECT, body);
        mk(hwnd, w!("BUTTON"), w!("Start with Windows"), check, s(lx), s(140), s(200), s(22), ID_AUTOSTART, body);
        mk(hwnd, w!("BUTTON"), w!("Autocorrect"), check, s(240), s(140), s(100), s(22), ID_AUTOCORRECT, body);
        mk(hwnd, w!("COMBOBOX"), w!(""), combo_list, s(344), s(138), s(136), s(200), ID_AC_DELAY, body);

        // AI section
        mk(hwnd, w!("STATIC"), w!("AI CONTEXT CHECKING (OPTIONAL)"), label, s(lx), s(176), s(440), s(16), ID_SECTION_AI, skin.section);
        mk(hwnd, w!("BUTTON"), w!("Turn on AI suggestions"), check, s(lx), s(196), s(300), s(22), ID_AI, body);
        mk(hwnd, w!("STATIC"), w!("Service:"), label, s(lx), s(228), s(120), s(20), 0, body);
        mk(hwnd, w!("COMBOBOX"), w!(""), combo_list, s(ix), s(226), s(200), s(260), ID_PROVIDER, body);
        mk(hwnd, w!("STATIC"), w!("Model:"), label, s(lx), s(258), s(120), s(20), 0, body);
        mk(hwnd, w!("COMBOBOX"), w!(""), combo_edit, s(ix), s(256), s(300), s(240), ID_MODEL, body);
        mk(hwnd, w!("STATIC"), w!("API key:"), label, s(lx), s(288), s(120), s(20), 0, body);
        mk(hwnd, w!("EDIT"), w!(""), edit_pw, s(ix), s(286), s(300), s(24), ID_KEY, body);
        mk(hwnd, w!("STATIC"), w!("Saved encrypted on this PC — leave blank to keep current."), label, s(ix), s(312), s(320), s(14), ID_HINT, skin.hint);

        // Apps section
        mk(hwnd, w!("STATIC"), w!("DON'T CHECK THESE APPS"), label, s(lx), s(344), s(440), s(16), ID_SECTION_APPS, skin.section);
        mk(hwnd, w!("STATIC"), w!("Pick an open app and choose Add:"), label, s(lx), s(364), s(300), s(14), ID_HINT, skin.hint);
        mk(hwnd, w!("COMBOBOX"), w!(""), combo_list, s(lx), s(382), s(300), s(280), ID_RUNNING, body);
        mk(hwnd, w!("BUTTON"), w!("Add"), button, s(332), s(381), s(148), s(26), ID_ADD, body);
        mk(hwnd, w!("LISTBOX"), w!(""), listbox, s(lx), s(412), s(300), s(92), ID_EXCLUDED_LIST, body);
        mk(hwnd, w!("BUTTON"), w!("Remove"), button, s(332), s(412), s(148), s(26), ID_REMOVE, body);

        // Footer
        mk(
            hwnd,
            w!("STATIC"),
            w!(
                "Spelling and grammar run 100% on your device — nothing is uploaded.\nAI context checking only runs if you add your own key."
            ),
            label,
            s(lx),
            s(514),
            s(460),
            s(34),
            ID_PRIVACY,
            skin.hint,
        );
        mk(hwnd, w!("BUTTON"), w!("Save"), button, s(292), s(556), s(88), s(32), ID_SAVE, body);
        mk(hwnd, w!("BUTTON"), w!("Cancel"), button, s(388), s(556), s(88), s(32), ID_CANCEL, body);

        // Load current config.
        let cfg = Config::load();
        set_check(dlg(hwnd, ID_ENABLE), cfg.enabled);
        set_check(dlg(hwnd, ID_AI), cfg.llm_enabled);
        set_check(dlg(hwnd, ID_AUTOCORRECT), cfg.autocorrect_enabled);
        set_check(dlg(hwnd, ID_AUTOSTART), config::is_autostart());

        let delay_combo = dlg(hwnd, ID_AC_DELAY);
        let mut acsel = 3i32; // fallback → "after 3s"
        for (i, &(lbl, ms)) in AC_DELAYS.iter().enumerate() {
            combo_add(delay_combo, lbl);
            if ms == cfg.autocorrect_delay_ms {
                acsel = i as i32;
            }
        }
        combo_set_sel(delay_combo, acsel);

        let dialect_combo = dlg(hwnd, ID_DIALECT);
        let mut dsel = 0;
        for (i, d) in DIALECTS.iter().enumerate() {
            combo_add(dialect_combo, d);
            if d.eq_ignore_ascii_case(&cfg.harper_dialect) {
                dsel = i as i32;
            }
        }
        combo_set_sel(dialect_combo, dsel);

        let provider_combo = dlg(hwnd, ID_PROVIDER);
        let mut psel = 0;
        for (i, name) in PROVIDER_NAMES.iter().enumerate() {
            combo_add(provider_combo, name);
            if PROVIDER_IDS[i].eq_ignore_ascii_case(&cfg.provider) {
                psel = i as i32;
            }
        }
        combo_set_sel(provider_combo, psel);
        fill_models(dlg(hwnd, ID_MODEL), &cfg.provider, &cfg.model, &cfg.ollama_url);

        let running = running_apps();
        let running_combo = dlg(hwnd, ID_RUNNING);
        for (friendly, _) in &running {
            combo_add(running_combo, friendly);
        }
        if !running.is_empty() {
            combo_set_sel(running_combo, 0);
        }
        RUNNING.with(|r| *r.borrow_mut() = running);

        let list = dlg(hwnd, ID_EXCLUDED_LIST);
        let mut excluded: Vec<(String, String)> = Vec::new();
        for exe in &cfg.excluded_apps {
            let exe_l = exe.to_ascii_lowercase();
            let friendly = friendly_name(&exe_l);
            list_add(list, &friendly);
            excluded.push((friendly, exe_l));
        }
        EXCLUDED.with(|e| *e.borrow_mut() = excluded);
    }
}

unsafe fn draw_text(hdc: HDC, text: &str, rc: RECT, fmt: u32, color: u32, font: HFONT) {
    unsafe {
        let old = SelectObject(hdc, HGDIOBJ(font.0));
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, cref(color));
        let mut buf: Vec<u16> = text.encode_utf16().collect();
        let mut r = rc;
        DrawTextW(
            hdc,
            &mut buf,
            &mut r,
            windows::Win32::Graphics::Gdi::DRAW_TEXT_FORMAT(fmt),
        );
        SelectObject(hdc, old);
    }
}

unsafe fn paint_header(hwnd: HWND, skin: &Skin) {
    unsafe {
        let mut ps = PAINTSTRUCT::default();
        let hdc = BeginPaint(hwnd, &mut ps);
        let mut rc = RECT::default();
        let _ = GetClientRect(hwnd, &mut rc);

        // Body fill.
        FillRect(hdc, &rc, skin.brush_body);

        // Gradient header (indigo → purple), drawn in 2px columns.
        let hh = skin.s(64);
        let width = rc.right.max(1);
        let mut x = 0;
        while x < width {
            let t = x as f32 / width as f32;
            let lerp = |a: u32, b: u32| (a as f32 + (b as f32 - a as f32) * t) as u32;
            let col = lerp(C_INDIGO >> 16 & 0xFF, C_PURPLE >> 16 & 0xFF) << 16
                | lerp(C_INDIGO >> 8 & 0xFF, C_PURPLE >> 8 & 0xFF) << 8
                | lerp(C_INDIGO & 0xFF, C_PURPLE & 0xFF);
            let br = CreateSolidBrush(cref(col));
            let strip = RECT { left: x, top: 0, right: (x + skin.s(2)).min(width), bottom: hh };
            FillRect(hdc, &strip, br);
            let _ = DeleteObject(HGDIOBJ(br.0));
            x += skin.s(2).max(1);
        }

        let dt = (DT_LEFT.0 | DT_SINGLELINE.0 | DT_NOPREFIX.0) as u32;
        draw_text(
            hdc,
            "OGrammar",
            RECT { left: skin.s(20), top: skin.s(9), right: width, bottom: skin.s(38) },
            dt,
            0xFFFFFF,
            skin.title,
        );
        draw_text(
            hdc,
            "Grammar & spelling help, everywhere on your PC",
            RECT { left: skin.s(21), top: skin.s(40), right: width, bottom: skin.s(58) },
            dt,
            C_LAVENDER,
            skin.hint,
        );

        let _ = EndPaint(hwnd, &ps);
    }
}

unsafe fn on_add(hwnd: HWND) {
    unsafe {
        let idx = combo_sel(dlg(hwnd, ID_RUNNING));
        if idx < 0 {
            return;
        }
        let picked = RUNNING.with(|r| r.borrow().get(idx as usize).cloned());
        let Some((friendly, exe)) = picked else {
            return;
        };
        if EXCLUDED.with(|e| e.borrow().iter().any(|(_, x)| x == &exe)) {
            return;
        }
        list_add(dlg(hwnd, ID_EXCLUDED_LIST), &friendly);
        EXCLUDED.with(|e| e.borrow_mut().push((friendly, exe)));
    }
}

unsafe fn on_remove(hwnd: HWND) {
    unsafe {
        let list = dlg(hwnd, ID_EXCLUDED_LIST);
        let idx = SendMessageW(list, LB_GETCURSEL, None, None).0;
        if idx < 0 {
            return;
        }
        SendMessageW(list, LB_DELETESTRING, Some(WPARAM(idx as usize)), None);
        EXCLUDED.with(|e| {
            let mut v = e.borrow_mut();
            if (idx as usize) < v.len() {
                v.remove(idx as usize);
            }
        });
    }
}

unsafe fn save_settings(hwnd: HWND) {
    unsafe {
        let mut cfg = Config::load();
        cfg.enabled = get_check(dlg(hwnd, ID_ENABLE));
        cfg.llm_enabled = get_check(dlg(hwnd, ID_AI));
        cfg.autocorrect_enabled = get_check(dlg(hwnd, ID_AUTOCORRECT));
        let aci = combo_sel(dlg(hwnd, ID_AC_DELAY));
        if aci >= 0 && (aci as usize) < AC_DELAYS.len() {
            cfg.autocorrect_delay_ms = AC_DELAYS[aci as usize].1;
        }
        let di = combo_sel(dlg(hwnd, ID_DIALECT));
        if di >= 0 && (di as usize) < DIALECTS.len() {
            cfg.harper_dialect = DIALECTS[di as usize].to_string();
        }
        let pi = combo_sel(dlg(hwnd, ID_PROVIDER));
        if pi >= 0 && (pi as usize) < PROVIDER_IDS.len() {
            cfg.provider = PROVIDER_IDS[pi as usize].to_string();
        }
        cfg.model = get_text(dlg(hwnd, ID_MODEL)).trim().to_string();
        cfg.excluded_apps = EXCLUDED.with(|e| e.borrow().iter().map(|(_, x)| x.clone()).collect());
        let _ = cfg.save();

        let key = get_text(dlg(hwnd, ID_KEY));
        if !key.trim().is_empty() {
            let _ = config::save_api_key(key.trim());
        }
        let _ = config::set_autostart(get_check(dlg(hwnd, ID_AUTOSTART)));
        config::RELOAD_REQUESTED.store(true, Ordering::SeqCst);
    }
}

unsafe extern "system" fn wnd_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_ERASEBKGND => LRESULT(1), // body painted in WM_PAINT
            WM_PAINT => {
                let skin = skin_of(hwnd);
                if !skin.is_null() {
                    paint_header(hwnd, &*skin);
                }
                LRESULT(0)
            }
            WM_CTLCOLORSTATIC | WM_CTLCOLORBTN => {
                let skin = skin_of(hwnd);
                if skin.is_null() {
                    return DefWindowProcW(hwnd, msg, wparam, lparam);
                }
                let hdc = HDC(wparam.0 as *mut core::ffi::c_void);
                SetBkMode(hdc, TRANSPARENT);
                let id = GetDlgCtrlID(HWND(lparam.0 as *mut core::ffi::c_void));
                let color = match id {
                    ID_SECTION_AI | ID_SECTION_APPS => C_INDIGO,
                    ID_HINT | ID_PRIVACY => C_GREY,
                    _ => C_TEXT,
                };
                SetTextColor(hdc, cref(color));
                LRESULT((*skin).brush_body.0 as isize)
            }
            WM_COMMAND => {
                let id = (wparam.0 & 0xFFFF) as i32;
                let notify = ((wparam.0 >> 16) & 0xFFFF) as u32;
                match id {
                    ID_PROVIDER if notify == CBN_SELCHANGE => {
                        let pi = combo_sel(dlg(hwnd, ID_PROVIDER));
                        if pi >= 0 && (pi as usize) < PROVIDER_IDS.len() {
                            // Reload config for the current Ollama URL (so the
                            // model list can query the local server).
                            let ourl = Config::load().ollama_url;
                            fill_models(dlg(hwnd, ID_MODEL), PROVIDER_IDS[pi as usize], "", &ourl);
                        }
                    }
                    ID_ADD => on_add(hwnd),
                    ID_REMOVE => on_remove(hwnd),
                    ID_SAVE => {
                        save_settings(hwnd);
                        let _ = DestroyWindow(hwnd);
                    }
                    ID_CANCEL => {
                        let _ = DestroyWindow(hwnd);
                    }
                    _ => {}
                }
                LRESULT(0)
            }
            WM_DESTROY => {
                let ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut Skin;
                if !ptr.is_null() {
                    drop(Box::from_raw(ptr));
                    SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
                }
                PostQuitMessage(0);
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }
}
