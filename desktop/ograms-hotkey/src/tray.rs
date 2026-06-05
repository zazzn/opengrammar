//! System-tray presence + control (pure Win32 `Shell_NotifyIcon`, no deps).
//!
//! A hidden popup window receives the tray callback message; right/left click
//! opens a context menu (Pause/Resume, Settings, Quit) via `TrackPopupMenu` with
//! `TPM_RETURNCMD` (so we read the chosen id synchronously — no WM_COMMAND
//! plumbing). State is shared with the monitor through two atomics so the worker
//! loop stays authoritative. The icon is generated at runtime (a colored dot per
//! state) so we ship no .ico resource. Re-adds itself on Explorer restart
//! (`TaskbarCreated`).

use std::error::Error;
use std::ffi::c_void;
use std::mem::size_of;
use std::sync::atomic::{AtomicBool, Ordering};

use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BI_RGB, BITMAPINFO, BITMAPINFOHEADER, CreateBitmap, CreateDIBSection, DIB_RGB_COLORS,
    DeleteObject, HBITMAP, HGDIOBJ,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
use windows::Win32::UI::Shell::{
    NIF_ICON, NIF_MESSAGE, NIF_TIP, NIM_ADD, NIM_DELETE, NIM_MODIFY, NOTIFYICONDATAW,
    Shell_NotifyIconW,
};
use windows::Win32::UI::WindowsAndMessaging::{
    AppendMenuW, CreateIconIndirect, CreatePopupMenu, CreateWindowExW, DefWindowProcW, DestroyMenu,
    DestroyWindow, GWLP_USERDATA, GetCursorPos, GetForegroundWindow, GetWindowLongPtrW,
    GetWindowThreadProcessId, HICON, ICONINFO, MF_SEPARATOR, MF_STRING, PostMessageW,
    PostQuitMessage, RegisterClassW, RegisterWindowMessageW, SetForegroundWindow,
    SetWindowLongPtrW, TPM_RETURNCMD, TPM_RIGHTBUTTON, TrackPopupMenu, WM_APP, WM_CONTEXTMENU,
    WM_LBUTTONUP, WM_NULL, WM_RBUTTONUP, WNDCLASSW, WS_EX_TOOLWINDOW, WS_POPUP,
};
use windows::core::{PCWSTR, w};

/// Set by the tray Pause/Resume item; the monitor skips all work while true.
pub static PAUSED: AtomicBool = AtomicBool::new(false);

const WM_TRAYCALLBACK: u32 = WM_APP + 10;
const TRAY_UID: u32 = 1;

const ID_PAUSE: i32 = 1;
const ID_SETTINGS: i32 = 2;
const ID_QUIT: i32 = 3;

/// Tray visual state. The icon is a colored dot; tooltip text matches.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum TrayState {
    Active,
    Paused,
    Checking,
    NoField,
    Error,
}

impl TrayState {
    fn index(self) -> usize {
        match self {
            Self::Active => 0,
            Self::Paused => 1,
            Self::Checking => 2,
            Self::NoField => 3,
            Self::Error => 4,
        }
    }

    fn tip(self) -> PCWSTR {
        match self {
            Self::Active => w!("OGrammar — on. Watching your text."),
            Self::Paused => w!("OGrammar — paused. Click to resume."),
            Self::Checking => w!("OGrammar — checking…"),
            Self::NoField => w!("OGrammar — on. No text field in focus."),
            Self::Error => w!("OGrammar — needs attention."),
        }
    }
}

pub struct Tray {
    hwnd: HWND,
    icons: [HICON; 5],
    state: TrayState,
    taskbar_created: u32,
}

impl Tray {
    pub fn new() -> Result<Box<Self>, Box<dyn Error>> {
        unsafe {
            let hinstance = GetModuleHandleW(None)?;
            let class_name = w!("OGrammarTrayClass");
            let wc = WNDCLASSW {
                lpfnWndProc: Some(tray_wnd_proc),
                hInstance: hinstance.into(),
                lpszClassName: class_name,
                ..Default::default()
            };
            RegisterClassW(&wc);

            let hwnd = CreateWindowExW(
                WS_EX_TOOLWINDOW,
                class_name,
                w!("OGrammar"),
                WS_POPUP,
                0,
                0,
                0,
                0,
                None,
                None,
                Some(hinstance.into()),
                None,
            )?;

            let taskbar_created = RegisterWindowMessageW(w!("TaskbarCreated"));
            let icons = [
                make_dot_icon(0x22_C55E), // Active  — green
                make_dot_icon(0x9C_A3AF), // Paused  — grey
                make_dot_icon(0x3B_82F6), // Checking — blue
                make_dot_icon(0x6B_7280), // NoField — dim grey
                make_dot_icon(0xEF_4444), // Error   — red
            ];

            let mut tray = Box::new(Self {
                hwnd,
                icons,
                state: TrayState::Active,
                taskbar_created,
            });
            let ptr = tray.as_mut() as *mut Self;
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, ptr as isize);
            tray.add_icon();
            Ok(tray)
        }
    }

    fn base_nid(&self) -> NOTIFYICONDATAW {
        let mut nid = NOTIFYICONDATAW {
            cbSize: size_of::<NOTIFYICONDATAW>() as u32,
            hWnd: self.hwnd,
            uID: TRAY_UID,
            ..Default::default()
        };
        nid.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
        nid.uCallbackMessage = WM_TRAYCALLBACK;
        nid.hIcon = self.icons[self.state.index()];
        copy_tip(&mut nid.szTip, self.state.tip());
        nid
    }

    fn add_icon(&self) {
        let nid = self.base_nid();
        unsafe {
            let _ = Shell_NotifyIconW(NIM_ADD, &nid);
        }
    }

    pub fn set_state(&mut self, state: TrayState) {
        if self.state == state {
            return;
        }
        self.state = state;
        let nid = self.base_nid();
        unsafe {
            let _ = Shell_NotifyIconW(NIM_MODIFY, &nid);
        }
    }

    fn remove_icon(&self) {
        let nid = NOTIFYICONDATAW {
            cbSize: size_of::<NOTIFYICONDATAW>() as u32,
            hWnd: self.hwnd,
            uID: TRAY_UID,
            ..Default::default()
        };
        unsafe {
            let _ = Shell_NotifyIconW(NIM_DELETE, &nid);
        }
    }

    /// Show the context menu and return the chosen command id (0 = dismissed).
    fn show_menu(&self) -> i32 {
        unsafe {
            let Ok(menu) = CreatePopupMenu() else {
                return 0;
            };
            let pause_label = if PAUSED.load(Ordering::SeqCst) {
                w!("Resume OGrammar")
            } else {
                w!("Pause OGrammar")
            };
            let _ = AppendMenuW(menu, MF_STRING, ID_PAUSE as usize, pause_label);
            let _ = AppendMenuW(menu, MF_STRING, ID_SETTINGS as usize, w!("Settings…"));
            let _ = AppendMenuW(menu, MF_SEPARATOR, 0, PCWSTR::null());
            let _ = AppendMenuW(menu, MF_STRING, ID_QUIT as usize, w!("Quit OGrammar"));

            let mut pt = POINT::default();
            let _ = GetCursorPos(&mut pt);
            // Reliably bring our hidden owner window to the foreground so the menu
            // actually displays: attach our input queue to the current foreground
            // thread (bypasses the foreground lock), SetForegroundWindow, detach.
            let fg = GetForegroundWindow();
            let fg_thread = GetWindowThreadProcessId(fg, None);
            let our_thread = GetCurrentThreadId();
            let attach = fg_thread != 0 && fg_thread != our_thread;
            if attach {
                let _ = AttachThreadInput(our_thread, fg_thread, true);
            }
            let _ = SetForegroundWindow(self.hwnd);
            let cmd = TrackPopupMenu(
                menu,
                TPM_RIGHTBUTTON | TPM_RETURNCMD,
                pt.x,
                pt.y,
                Some(0),
                self.hwnd,
                None,
            );
            // KB Q135788: post WM_NULL so the menu dismisses correctly when the
            // user clicks elsewhere (otherwise the next click is swallowed).
            let _ = PostMessageW(Some(self.hwnd), WM_NULL, WPARAM(0), LPARAM(0));
            if attach {
                let _ = AttachThreadInput(our_thread, fg_thread, false);
            }
            let _ = DestroyMenu(menu);
            cmd.0
        }
    }

    fn handle_command(&mut self, cmd: i32) {
        match cmd {
            ID_PAUSE => {
                let now_paused = !PAUSED.load(Ordering::SeqCst);
                PAUSED.store(now_paused, Ordering::SeqCst);
                self.set_state(if now_paused {
                    TrayState::Paused
                } else {
                    TrayState::Active
                });
            }
            ID_SETTINGS => {
                crate::settings::open();
            }
            ID_QUIT => {
                self.remove_icon();
                unsafe { PostQuitMessage(0) };
            }
            _ => {}
        }
    }
}

impl Drop for Tray {
    fn drop(&mut self) {
        self.remove_icon();
        unsafe {
            for icon in self.icons {
                let _ = windows::Win32::UI::WindowsAndMessaging::DestroyIcon(icon);
            }
            let _ = DestroyWindow(self.hwnd);
        }
    }
}

unsafe extern "system" fn tray_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    unsafe {
        let tray = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut Tray;

        if msg == WM_TRAYCALLBACK {
            if !tray.is_null() {
                let event = (lparam.0 as u32) & 0xFFFF;
                if event == WM_RBUTTONUP || event == WM_CONTEXTMENU || event == WM_LBUTTONUP {
                    let cmd = (*tray).show_menu();
                    if cmd != 0 {
                        (*tray).handle_command(cmd);
                    }
                }
            }
            return LRESULT(0);
        }

        if !tray.is_null() && msg == (*tray).taskbar_created {
            // Explorer restarted — re-add our icon.
            (*tray).add_icon();
            return LRESULT(0);
        }

        DefWindowProcW(hwnd, msg, wparam, lparam)
    }
}

/// Copy a wide string into a fixed `szTip`/`szInfo` buffer, NUL-terminated.
fn copy_tip(dst: &mut [u16], src: PCWSTR) {
    let s = unsafe { src.as_wide() };
    let n = s.len().min(dst.len().saturating_sub(1));
    dst[..n].copy_from_slice(&s[..n]);
    dst[n] = 0;
}

/// Build a 32×32 alpha icon that's a filled circle of `rgb` (0xRRGGBB). The DIB
/// alpha channel carries the shape; the AND mask is all-zero.
fn make_dot_icon(rgb: u32) -> HICON {
    const N: i32 = 32;
    unsafe {
        let mut bmi = BITMAPINFO::default();
        bmi.bmiHeader = BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: N,
            biHeight: -N, // top-down
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        };
        let mut bits: *mut c_void = std::ptr::null_mut();
        let color: HBITMAP = match CreateDIBSection(None, &bmi, DIB_RGB_COLORS, &mut bits, None, 0) {
            Ok(b) => b,
            Err(_) => return HICON::default(),
        };
        let pixels = bits as *mut u32;
        let cx = 16.0_f32;
        let cy = 16.0_f32;
        let r = 13.0_f32;
        for y in 0..N {
            for x in 0..N {
                let dx = x as f32 + 0.5 - cx;
                let dy = y as f32 + 0.5 - cy;
                let inside = dx * dx + dy * dy <= r * r;
                let p = if inside { 0xFF00_0000 | rgb } else { 0 };
                *pixels.add((y * N + x) as usize) = p;
            }
        }
        // All-zero AND mask (1bpp, WORD-aligned rows). 32px → 4 bytes/row × 32.
        let mask_bits = vec![0u8; 4 * N as usize];
        let mask: HBITMAP = CreateBitmap(N, N, 1, 1, Some(mask_bits.as_ptr() as *const c_void));

        let ii = ICONINFO {
            fIcon: true.into(),
            xHotspot: 0,
            yHotspot: 0,
            hbmMask: mask,
            hbmColor: color,
        };
        let icon = CreateIconIndirect(&ii).unwrap_or_default();
        let _ = DeleteObject(HGDIOBJ(color.0));
        let _ = DeleteObject(HGDIOBJ(mask.0));
        icon
    }
}
