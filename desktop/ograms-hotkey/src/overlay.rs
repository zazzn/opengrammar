//! A layered, always-on-top overlay window that draws an underline under each
//! issue rectangle the monitor produces, and lets the user CLICK an underline
//! to open the suggestion card.
//!
//! One layered popup spans the whole virtual screen, backed by a 32-bit
//! premultiplied-ARGB DIB pushed with `UpdateLayeredWindow` (ULW_ALPHA) — so it's
//! fully transparent except for the underlines. It is NOT `WS_EX_TRANSPARENT`;
//! instead `WM_NCHITTEST` returns `HTTRANSPARENT` everywhere EXCEPT over an
//! underline strip (where it returns `HTCLIENT`), so clicks pass straight through
//! to the app except on a suggestion underline. `WS_EX_NOACTIVATE` keeps the
//! focused text field focused when an underline is clicked.

use std::cell::RefCell;
use std::error::Error;

use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, POINT, SIZE, WPARAM};
use windows::Win32::Graphics::Gdi::{
    AC_SRC_ALPHA, AC_SRC_OVER, BI_RGB, BITMAPINFO, BITMAPINFOHEADER, BLENDFUNCTION,
    CreateCompatibleDC, CreateDIBSection, DIB_RGB_COLORS, DeleteDC, DeleteObject, GetDC, HBITMAP,
    HDC, HGDIOBJ, ReleaseDC, SelectObject,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, GWLP_USERDATA, GetCursorPos, GetSystemMetrics,
    GetWindowLongPtrW, HTCLIENT, HTTRANSPARENT, PostThreadMessageW, RegisterClassW,
    SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SW_SHOWNOACTIVATE,
    SetWindowLongPtrW, ShowWindow, ULW_ALPHA, UpdateLayeredWindow, WM_APP, WM_LBUTTONUP,
    WM_NCHITTEST, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
    WS_POPUP,
};
use windows::core::w;

/// Posted to the UI thread (wParam = drawn-issue index) when the user clicks an
/// underline. The monitor opens the suggestion card.
pub const WM_OVERLAY_CLICK: u32 = WM_APP + 20;

/// A single underline to draw, in physical/virtual-screen pixels.
#[derive(Clone, Copy, Debug)]
pub struct OverlayRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    /// Premultiplied-ARGB color (0xAARRGGBB). Opaque colors only here.
    pub argb: u32,
    /// Dotted (true) for the LLM/context layer; solid (false) for Harper.
    pub dashed: bool,
    /// Index into the monitor's `drawn` list — identifies which issue this is.
    pub issue_index: usize,
}

unsafe extern "system" fn wnd_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    unsafe {
        match msg {
            WM_NCHITTEST => {
                let overlay = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *const Overlay;
                if overlay.is_null() {
                    return LRESULT(HTTRANSPARENT as isize);
                }
                let x = (lparam.0 & 0xFFFF) as i16 as i32;
                let y = ((lparam.0 >> 16) & 0xFFFF) as i16 as i32;
                if (*overlay).hit_test(x, y).is_some() {
                    LRESULT(HTCLIENT as isize)
                } else {
                    // Everything that's not an underline strip passes through.
                    LRESULT(HTTRANSPARENT as isize)
                }
            }
            WM_LBUTTONUP => {
                let overlay = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *const Overlay;
                if !overlay.is_null() {
                    let mut pt = POINT::default();
                    let _ = GetCursorPos(&mut pt);
                    if let Some(index) = (*overlay).hit_test(pt.x, pt.y) {
                        let tid = GetCurrentThreadId();
                        let _ = PostThreadMessageW(tid, WM_OVERLAY_CLICK, WPARAM(index), LPARAM(0));
                    }
                }
                LRESULT(0)
            }
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }
}

pub struct Overlay {
    hwnd: HWND,
    mem_dc: HDC,
    dib: HBITMAP,
    bits: *mut u32,
    origin_x: i32,
    origin_y: i32,
    width: i32,
    height: i32,
    /// Current underlines, for hit-testing clicks (RefCell: single-threaded).
    hit_rects: RefCell<Vec<OverlayRect>>,
}

impl Overlay {
    pub fn new() -> Result<Self, Box<dyn Error>> {
        unsafe {
            let origin_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let origin_y = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let width = GetSystemMetrics(SM_CXVIRTUALSCREEN).max(1);
            let height = GetSystemMetrics(SM_CYVIRTUALSCREEN).max(1);

            let hinstance = GetModuleHandleW(None)?;
            let class_name = w!("OGrammarOverlayClass");
            let wc = WNDCLASSW {
                lpfnWndProc: Some(wnd_proc),
                hInstance: hinstance.into(),
                lpszClassName: class_name,
                ..Default::default()
            };
            RegisterClassW(&wc);

            // NOTE: no WS_EX_TRANSPARENT — hit-testing is done in WM_NCHITTEST so
            // only underline strips capture clicks.
            let hwnd = CreateWindowExW(
                WS_EX_LAYERED | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW | WS_EX_TOPMOST,
                class_name,
                w!("OGrammar Overlay"),
                WS_POPUP,
                origin_x,
                origin_y,
                width,
                height,
                None,
                None,
                Some(hinstance.into()),
                None,
            )?;

            let mut bmi = BITMAPINFO::default();
            bmi.bmiHeader = BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            };
            let mut bits_ptr: *mut core::ffi::c_void = std::ptr::null_mut();
            let dib = CreateDIBSection(None, &bmi, DIB_RGB_COLORS, &mut bits_ptr, None, 0)?;
            let mem_dc = CreateCompatibleDC(None);
            SelectObject(mem_dc, HGDIOBJ(dib.0));

            let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);

            Ok(Self {
                hwnd,
                mem_dc,
                dib,
                bits: bits_ptr as *mut u32,
                origin_x,
                origin_y,
                width,
                height,
                hit_rects: RefCell::new(Vec::new()),
            })
        }
    }

    /// Register a stable self-pointer so the window proc can hit-test. Call once
    /// after the Overlay has reached its final (non-moving) location.
    pub fn install_hit_testing(&self) {
        unsafe {
            SetWindowLongPtrW(self.hwnd, GWLP_USERDATA, self as *const Self as isize);
        }
    }

    /// Which issue index (if any) is under the point. The ENTIRE flagged word's
    /// box (plus a few px of padding) is clickable — a big, forgiving target —
    /// so you don't have to pinpoint the thin underline. Trade-off: a click on a
    /// flagged word opens its card instead of positioning the caret inside it.
    fn hit_test(&self, x: i32, y: i32) -> Option<usize> {
        let (px, py) = (x as f64, y as f64);
        for r in self.hit_rects.borrow().iter() {
            if px >= r.x - 2.0
                && px < r.x + r.w + 2.0
                && py >= r.y - 2.0
                && py <= r.y + r.h + 4.0
            {
                return Some(r.issue_index);
            }
        }
        None
    }

    fn fill_transparent(&self) {
        if self.bits.is_null() {
            return;
        }
        let count = (self.width as usize) * (self.height as usize);
        unsafe {
            std::ptr::write_bytes(self.bits, 0, count);
        }
    }

    fn plot(&self, sx: i32, sy: i32, argb: u32) {
        let bx = sx - self.origin_x;
        let by = sy - self.origin_y;
        if bx < 0 || by < 0 || bx >= self.width || by >= self.height {
            return;
        }
        let idx = (by as usize) * (self.width as usize) + (bx as usize);
        unsafe {
            *self.bits.add(idx) = argb;
        }
    }

    /// Draw the underlines, remember them for hit-testing, and push the layer.
    pub fn set_rects(&self, rects: &[OverlayRect]) {
        *self.hit_rects.borrow_mut() = rects.to_vec();
        self.fill_transparent();
        for r in rects {
            // A layered window lets clicks fall through any pixel whose alpha is
            // 0, so without this only the opaque underline pixels would capture
            // clicks (you'd have to hit the thin line). Paint the whole word box
            // (matching hit_test's padded bounds) with a near-invisible alpha so
            // the ENTIRE word catches clicks while still looking transparent.
            let hx0 = (r.x - 2.0).round() as i32;
            let hx1 = (r.x + r.w + 2.0).round() as i32;
            let hy0 = (r.y - 2.0).round() as i32;
            let hy1 = (r.y + r.h + 4.0).round() as i32;
            for sy in hy0..hy1 {
                for sx in hx0..hx1 {
                    self.plot(sx, sy, 0x0100_0000);
                }
            }
            let x0 = r.x.round() as i32;
            let x1 = (r.x + r.w).round() as i32;
            let thickness = if r.dashed { 2 } else { 3 };
            let base_y = (r.y + r.h - thickness as f64).round() as i32;
            for ty in 0..thickness {
                for sx in x0..x1 {
                    if r.dashed && ((sx - x0).rem_euclid(4)) >= 2 {
                        continue;
                    }
                    self.plot(sx, base_y + ty, r.argb);
                }
            }
        }
        self.present();
    }

    pub fn clear(&self) {
        self.hit_rects.borrow_mut().clear();
        self.fill_transparent();
        self.present();
    }

    fn present(&self) {
        unsafe {
            let screen_dc = GetDC(None);
            let mut pos = POINT {
                x: self.origin_x,
                y: self.origin_y,
            };
            let mut size = SIZE {
                cx: self.width,
                cy: self.height,
            };
            let mut src = POINT { x: 0, y: 0 };
            let blend = BLENDFUNCTION {
                BlendOp: AC_SRC_OVER as u8,
                BlendFlags: 0,
                SourceConstantAlpha: 255,
                AlphaFormat: AC_SRC_ALPHA as u8,
            };
            let _ = UpdateLayeredWindow(
                self.hwnd,
                Some(screen_dc),
                Some(&mut pos),
                Some(&mut size),
                Some(self.mem_dc),
                Some(&mut src),
                COLORREF(0),
                Some(&blend),
                ULW_ALPHA,
            );
            ReleaseDC(None, screen_dc);
        }
    }
}

impl Drop for Overlay {
    fn drop(&mut self) {
        unsafe {
            let _ = DeleteDC(self.mem_dc);
            let _ = DeleteObject(HGDIOBJ(self.dib.0));
            let _ = DestroyWindow(self.hwnd);
        }
    }
}
