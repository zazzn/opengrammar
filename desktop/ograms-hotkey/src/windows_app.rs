use std::error::Error;
use std::fmt;
use std::mem::size_of;
use std::ptr::copy_nonoverlapping;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use ograms_engine::llm::{self, LlmConfig, LlmIssue, RewriteTone};
use ograms_engine::{EngineOptions, apply_safe_corrections, lint};
use serde_json::json;
use uiautomation::UIAutomation;
use uiautomation::core::UIElement;
use uiautomation::events::{CustomEventHandlerFn, UIEventHandler, UIEventType};
use uiautomation::patterns::{UITextPattern, UITextRange, UIValuePattern};
use uiautomation::types::{TextPatternRangeEndpoint, TextUnit, TreeScope};
use windows::Win32::Foundation::{
    CloseHandle, GlobalFree, HANDLE, HGLOBAL, HWND, LPARAM, RECT, WPARAM,
};
use windows::Win32::System::Com::SAFEARRAY;
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardData, IsClipboardFormatAvailable,
    OpenClipboard, SetClipboardData,
};
use windows::Win32::System::Memory::{
    GMEM_MOVEABLE, GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock,
};
use windows::Win32::System::Ole::{
    CF_UNICODETEXT, SafeArrayDestroy, SafeArrayGetDim, SafeArrayGetElement, SafeArrayGetLBound,
    SafeArrayGetUBound, SafeArrayGetVartype,
};
use windows::Win32::System::Threading::{
    GetCurrentThreadId, OpenProcess, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
    QueryFullProcessImageNameW,
};
use windows::Win32::System::Variant::VT_R8;
use windows::Win32::UI::Accessibility::{HWINEVENTHOOK, SetWinEventHook, UnhookWinEvent};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    HOT_KEY_MODIFIERS, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBD_EVENT_FLAGS, KEYBDINPUT,
    KEYEVENTF_KEYUP, MOD_ALT, MOD_CONTROL, MOD_SHIFT, RegisterHotKey, SendInput, UnregisterHotKey,
    VIRTUAL_KEY, VK_CONTROL, VK_V,
};
use windows::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, EVENT_OBJECT_FOCUS, GetForegroundWindow, GetMessageW, GetWindowRect, KillTimer,
    MB_ICONERROR, MB_ICONINFORMATION, MB_OK, MSG, MessageBoxW, PostThreadMessageW, SetTimer,
    TranslateMessage,
    WINEVENT_OUTOFCONTEXT, WM_APP, WM_HOTKEY, WM_TIMER,
};
use windows::Win32::UI::HiDpi::{
    DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, SetProcessDpiAwarenessContext,
};
use windows::core::{PCWSTR, PWSTR};

use crate::autocorrect;
use crate::config::{self, Config};
use crate::overlay::{Overlay, OverlayRect, WM_OVERLAY_CLICK};
use crate::pill;
use crate::suggestion;
use crate::tray;

const HOTKEY_ID: i32 = 1;
const POLL_TIMER_ID: usize = 2;
const WM_FOCUS_CHANGED: u32 = WM_APP + 1;
const WM_TEXT_CHANGED: u32 = WM_APP + 2;
const WM_LLM_RESULT: u32 = WM_APP + 3;
const WM_REWRITE_RESULT: u32 = WM_APP + 4;
const POLL_INTERVAL: Duration = Duration::from_millis(450);
const DEBOUNCE_DELAY: Duration = Duration::from_millis(600);
// Autocorrect's idle delay is user-configurable (Settings → "Autocorrect" delay
// dropdown); see `Config::autocorrect_delay()`. It is always longer than the fast
// underline pass so autocorrect never fires mid-typing (which would move the caret
// onto the corrected word and let the next keystrokes overwrite it).
static MAIN_THREAD_ID: AtomicU32 = AtomicU32::new(0);
// Monotonic generation for proactive LLM requests; a worker's result is dropped
// if the counter moved on (text changed / focus changed) while it was in flight.
static LLM_SEQ: AtomicU64 = AtomicU64::new(0);
// Generation for pill rewrites; a stale rewrite result is dropped if superseded.
static REWRITE_SEQ: AtomicU64 = AtomicU64::new(0);
// Blue dotted "context" layer color (premultiplied opaque ARGB), matching the
// extension's #3b82f6 AI-suggestion underline.
const LLM_ARGB: u32 = 0xFF3B_82F6;

// Tried in order; the first one the OS lets us register wins. Ctrl+Alt+J is
// preferred for the desktop app, with older MVP combos kept as fallbacks.
const HOTKEY_CANDIDATES: &[HotkeyConfig] = &[
    HotkeyConfig {
        modifiers: HOT_KEY_MODIFIERS(MOD_CONTROL.0 | MOD_ALT.0),
        key: b'J' as u32,
        label: "Ctrl+Alt+J",
    },
    HotkeyConfig {
        modifiers: HOT_KEY_MODIFIERS(MOD_CONTROL.0 | MOD_ALT.0),
        key: b'G' as u32,
        label: "Ctrl+Alt+G",
    },
    HotkeyConfig {
        modifiers: HOT_KEY_MODIFIERS(MOD_CONTROL.0 | MOD_ALT.0),
        key: b'H' as u32,
        label: "Ctrl+Alt+H",
    },
    HotkeyConfig {
        modifiers: HOT_KEY_MODIFIERS(MOD_CONTROL.0 | MOD_SHIFT.0),
        key: b'G' as u32,
        label: "Ctrl+Shift+G",
    },
];
const CLIPBOARD_RESTORE_DELAY: Duration = Duration::from_millis(250);

#[derive(Clone, Copy, Debug)]
struct HotkeyConfig {
    modifiers: HOT_KEY_MODIFIERS,
    key: u32,
    label: &'static str,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ApplyMode {
    SetValue,
    Clipboard,
}

#[derive(Debug)]
enum FocusText {
    Value(String),
    TextSelection { text: String, range: UITextRange },
    TextDocument { text: String, range: UITextRange },
}

impl FocusText {
    fn text(&self) -> &str {
        match self {
            Self::Value(text)
            | Self::TextSelection { text, .. }
            | Self::TextDocument { text, .. } => text,
        }
    }
}

#[derive(Clone, Debug)]
struct MonitorConfig {
    monitor: bool,
    once: bool,
    quiet: bool,
    settings_only: bool,
}

impl MonitorConfig {
    fn from_args() -> Self {
        let mut config = Self {
            monitor: true,
            once: false,
            quiet: false,
            settings_only: false,
        };

        for arg in std::env::args().skip(1) {
            match arg.as_str() {
                "--once" => {
                    config.once = true;
                    config.monitor = false;
                }
                "--no-monitor" => config.monitor = false,
                "--quiet" => config.quiet = true,
                "--settings" => config.settings_only = true,
                _ => eprintln!("unknown argument ignored: {arg}"),
            }
        }

        config
    }
}

/// One underline kept for redraw: its text offsets (so rects can be recomputed
/// when the window moves) plus its draw style.
#[derive(Clone, Debug)]
struct DrawnIssue {
    char_start: usize,
    char_end: usize,
    utf16_start: usize,
    utf16_end: usize,
    argb: u32,
    dashed: bool,
    /// The flagged text, candidate replacements (first = primary), the "why"
    /// reason, and the card kicker label — for the suggestion card.
    original: String,
    candidates: Vec<String>,
    reason: String,
    kicker: String,
}

#[derive(Debug)]
struct TrackedTarget {
    element: UIElement,
    app: String,
    last_snapshot: String,
    last_linted_text: Option<String>,
    /// Text the LLM tier last ran on (memoize: never re-send identical text).
    last_llm_text: Option<String>,
    /// All currently-drawn issues (Harper solid + LLM dotted) with their offsets,
    /// retained so we can (a) merge the LLM result (dedup by span; Harper wins)
    /// and (b) recompute their rects when the host window moves/resizes.
    drawn: Vec<DrawnIssue>,
    /// Issues the user dismissed in THIS field, keyed by (flagged text, kicker)
    /// so they stay dismissed across re-lints even as edits shift their offsets.
    /// Reset when focus leaves the field (the TrackedTarget is dropped).
    dismissed: Vec<(String, String)>,
    /// Fixes autocorrect applied in this field very recently, so a reappearance
    /// of the original can be recognised as a user revert (→ learn to stop).
    recent_autofixes: Vec<autocorrect::AppliedFix>,
    /// The exact overlay rects last drawn (screen coords). On a window MOVE we
    /// shift these by the window's delta rather than re-querying the text rects —
    /// some controls (modern Notepad's RichEdit) report stale text rects after a
    /// move, so re-querying would leave the underlines stranded.
    last_rects: Vec<OverlayRect>,
    /// Where the "Rewrite" pill's bottom-right is anchored (screen coords), so it
    /// can be shifted with the window on a move. None when no pill is shown.
    last_pill_anchor: Option<(i32, i32)>,
    /// Foreground-window rect at last draw, to detect the window moving.
    last_window_rect: Option<(i32, i32, i32, i32)>,
    dirty_since: Option<Instant>,
    /// Wall-clock of the last detected edit. Autocorrect only fires once this is
    /// `AUTOCORRECT_IDLE` old (a deliberate pause), so it never applies a fix
    /// mid-keystroke and yanks the caret onto the corrected word.
    last_edit_at: Option<Instant>,
    /// When `Some`, autocorrect is "armed": high-confidence fixes for the current
    /// `drawn` set are pending and will be applied by the deferred pass once the
    /// user goes idle. Holds the previously-linted text — the diff baseline that
    /// tells autocorrect which span is freshly typed. Cleared on apply or new edit.
    autocorrect_baseline: Option<String>,
    text_event: Option<TextEventSubscription>,
}

#[derive(Debug)]
struct TextEventSubscription {
    handler: UIEventHandler,
}

struct MonitorState<'a> {
    automation: &'a UIAutomation,
    config: Config,
    target: Option<TrackedTarget>,
    overlay: Option<Overlay>,
    was_paused: bool,
    /// Persistent learned "never autocorrect this" ledger (revert learning).
    autocorrect_ledger: autocorrect::RejectionLedger,
    /// A rewrite the user is previewing: (original field text, proposed rewrite).
    /// Applied only when they click Apply and the text is still `original`.
    pending_rewrite: Option<(String, String)>,
}

/// Worker→main-thread payload for a finished proactive LLM review. Boxed and
/// passed as the WM_LLM_RESULT lParam; the main thread owns it after receipt.
struct LlmResultMsg {
    seq: u64,
    text: String,
    issues: Vec<LlmIssue>,
}

/// Worker→main payload for a finished pill rewrite. The monitor shows `rewritten`
/// in a preview; it's only applied (replacing `original`) if the user clicks Apply
/// and the text is unchanged. Empty `rewritten` means "no change / failed".
struct RewriteResultMsg {
    seq: u64,
    original: String,
    rewritten: String,
    tone: RewriteTone,
}

#[derive(Clone, Debug)]
struct ScreenRect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[derive(Debug)]
struct IssueRects {
    rects: Vec<ScreenRect>,
    note: Option<String>,
}

#[derive(Debug)]
struct AppError(String);

impl AppError {
    fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl Error for AppError {}

pub fn run() -> Result<(), Box<dyn Error>> {
    let config = MonitorConfig::from_args();
    // Per-Monitor-V2 DPI awareness so UIA bounding rects and the overlay window
    // share one physical-pixel coordinate space.
    unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
    // `--settings`: just open the settings window (e.g. a Start-menu shortcut).
    if config.settings_only {
        crate::settings::run_blocking();
        return Ok(());
    }

    let automation = UIAutomation::new()?;

    if config.once {
        print_current_overlay_json(&automation)?;
        return Ok(());
    }

    MAIN_THREAD_ID.store(unsafe { GetCurrentThreadId() }, Ordering::SeqCst);
    let active = register_hotkey()?;
    let startup = format!(
        "OGrammar is running.\n\nFocus any text field, then press  {}  to proofread and fix it.{}",
        active.label,
        if config.monitor {
            "\n\nContinuous monitoring is enabled; JSON issue snapshots are printed to stdout."
        } else {
            "\n\nContinuous monitoring is disabled (--no-monitor)."
        }
    );
    println!("{startup}");
    // Show the startup popup on a DETACHED thread so it doesn't block the message
    // loop — monitoring + the hotkey must be live immediately, not after the user
    // dismisses the dialog (MessageBoxW is modal to its own thread). --quiet skips
    // it (for headless/automated runs, where the popup would steal focus).
    if !config.quiet {
        let startup_msg = startup.clone();
        thread::spawn(move || feedback(&startup_msg));
    }

    let focus_hook = if config.monitor {
        Some(FocusHook::install()?)
    } else {
        None
    };
    let poll_timer = if config.monitor {
        Some(PollTimer::start()?)
    } else {
        None
    };
    let mut monitor = MonitorState::new(&automation, Config::load());
    if config.monitor {
        match Overlay::new() {
            Ok(overlay) => {
                monitor.overlay = Some(overlay);
                // Register the overlay's self-pointer so its window proc can
                // hit-test underline clicks now that it sits in its final slot.
                if let Some(overlay) = &monitor.overlay {
                    overlay.install_hit_testing();
                }
            }
            Err(error) => eprintln!("overlay unavailable, underlines disabled: {error}"),
        }
        monitor.refresh_focus();
    }

    // System-tray presence: a state icon + Pause/Settings/Quit menu. Kept alive
    // for the message loop's lifetime; its Drop removes the icon. The hidden
    // tray window's messages are dispatched by the loop's default arm.
    let _tray = if config.monitor {
        match tray::Tray::new() {
            Ok(tray) => Some(tray),
            Err(error) => {
                eprintln!("system tray unavailable: {error}");
                None
            }
        }
    } else {
        None
    };

    let mut msg = MSG::default();
    loop {
        let result = unsafe { GetMessageW(&mut msg, None, 0, 0) };
        if result.0 == -1 {
            drop(monitor);
            drop(poll_timer);
            drop(focus_hook);
            unregister_hotkey();
            return Err(Box::new(AppError::new("GetMessageW failed")));
        }
        if !result.as_bool() {
            break;
        }

        if msg.message == WM_HOTKEY && msg.wParam.0 as i32 == HOTKEY_ID {
            handle_hotkey(&automation);
        } else if config.monitor && msg.message == WM_FOCUS_CHANGED {
            monitor.refresh_focus();
        } else if config.monitor && msg.message == WM_TEXT_CHANGED {
            monitor.mark_dirty();
        } else if config.monitor && msg.message == WM_TIMER {
            // SetTimer(NULL, ...) assigns its OWN timer id (return value) and
            // ignores POLL_TIMER_ID, so we can't match on wParam. This thread owns
            // exactly one timer (the poll timer), so any WM_TIMER is ours.
            monitor.poll_and_maybe_lint();
        } else if msg.message == WM_LLM_RESULT {
            // A proactive LLM worker finished. Reconstruct + free the boxed
            // payload, then merge it into the current Harper layer.
            let boxed = unsafe { Box::from_raw(msg.lParam.0 as *mut LlmResultMsg) };
            monitor.apply_llm_result(*boxed);
        } else if msg.message == WM_OVERLAY_CLICK {
            // User clicked an underline — open the suggestion card.
            monitor.on_overlay_click(msg.wParam.0);
        } else if msg.message == suggestion::WM_OVERLAY_APPLY {
            monitor.apply_clicked(msg.wParam.0, msg.lParam.0 as usize);
        } else if msg.message == suggestion::WM_OVERLAY_DISMISS {
            monitor.dismiss_clicked(msg.wParam.0);
        } else if msg.message == suggestion::WM_CARD_LIGHT_DISMISS {
            // A click landed outside the open card — close it (light dismiss).
            suggestion::close();
        } else if msg.message == WM_REWRITE_RESULT {
            let boxed = unsafe { Box::from_raw(msg.lParam.0 as *mut RewriteResultMsg) };
            monitor.on_rewrite_ready(*boxed);
        } else if msg.message == pill::WM_PILL_CLICK {
            monitor.on_pill_click();
        } else if msg.message == pill::WM_PILL_TONE {
            if msg.wParam.0 == usize::MAX {
                pill::close_menu(); // light-dismiss sentinel
            } else {
                monitor.on_tone_chosen(msg.lParam.0 as usize);
            }
        } else if msg.message == pill::WM_PILL_APPLY {
            monitor.on_rewrite_apply();
        } else {
            unsafe {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
    }

    drop(monitor);
    drop(poll_timer);
    drop(focus_hook);
    unregister_hotkey();
    Ok(())
}

fn register_hotkey() -> Result<&'static HotkeyConfig, Box<dyn Error>> {
    let mut last_err: Option<String> = None;
    for hk in HOTKEY_CANDIDATES {
        match unsafe { RegisterHotKey(None, HOTKEY_ID, hk.modifiers, hk.key) } {
            Ok(()) => return Ok(hk),
            Err(error) => last_err = Some(error.to_string()),
        }
    }
    Err(Box::new(AppError::new(format!(
        "Could not register a global hotkey; all candidates are in use by other apps. Last error: {}",
        last_err.unwrap_or_default()
    ))))
}

impl<'a> MonitorState<'a> {
    fn new(automation: &'a UIAutomation, config: Config) -> Self {
        Self {
            automation,
            config,
            target: None,
            overlay: None,
            was_paused: false,
            autocorrect_ledger: autocorrect::RejectionLedger::load(),
            pending_rewrite: None,
        }
    }

    fn refresh_focus(&mut self) {
        if !self.config.enabled || tray::PAUSED.load(Ordering::SeqCst) {
            return;
        }
        let element = match self.automation.get_focused_element() {
            Ok(element) => element,
            Err(error) => {
                eprintln!("get_focused_element on focus change failed: {error}");
                self.clear_target();
                return;
            }
        };

        if element.is_password().unwrap_or(false) || !is_readable_text_element(&element) {
            self.clear_target();
            return;
        }

        // Per-app exclusion: yield browser surfaces to the extension and never
        // touch apps the user listed — skip them entirely (no Harper, no LLM).
        if let Ok(pid) = element.get_process_id() {
            if let Some(image) = process_image_name(pid as u32) {
                if self.config.is_app_excluded(&image) {
                    self.clear_target();
                    return;
                }
            }
        }

        if let Some(existing) = &self.target {
            if self
                .automation
                .compare_elements(&existing.element, &element)
                .unwrap_or(false)
            {
                return;
            }
        }

        self.clear_target();
        let app = describe_element(&element);
        let snapshot = read_element_text_lossy(&element);
        let text_event = subscribe_text_changed(self.automation, &element);
        self.target = Some(TrackedTarget {
            element,
            app,
            last_snapshot: snapshot,
            last_linted_text: None,
            last_llm_text: None,
            drawn: Vec::new(),
            dismissed: Vec::new(),
            recent_autofixes: Vec::new(),
            last_rects: Vec::new(),
            last_pill_anchor: None,
            last_window_rect: None,
            dirty_since: Some(Instant::now()),
            last_edit_at: None,
            autocorrect_baseline: None,
            text_event,
        });
    }

    fn mark_dirty(&mut self) {
        if let Some(target) = &mut self.target {
            let now = Instant::now();
            target.dirty_since = Some(now);
            target.last_edit_at = Some(now);
            target.autocorrect_baseline = None; // new edit → disarm; the re-lint re-arms
        }
    }

    fn poll_and_maybe_lint(&mut self) {
        // Settings saved → hot-reload config and re-lint with the new options.
        if config::RELOAD_REQUESTED.swap(false, Ordering::SeqCst) {
            self.config = Config::load();
            if let Some(target) = &mut self.target {
                target.last_linted_text = None;
                target.last_llm_text = None;
                target.dirty_since = Some(Instant::now());
            }
        }

        // Inactive (disabled in settings, or paused via the tray): clear once, idle.
        let active = self.config.enabled && !tray::PAUSED.load(Ordering::SeqCst);
        if !active {
            if !self.was_paused {
                if let Some(overlay) = &self.overlay {
                    overlay.clear();
                }
                pill::close();
                self.was_paused = true;
            }
            return;
        }
        // Just (re)activated: force a re-lint of the current field.
        if self.was_paused {
            self.was_paused = false;
            if let Some(target) = &mut self.target {
                target.last_linted_text = None;
                target.last_llm_text = None;
                target.dirty_since = Some(Instant::now());
            }
        }

        // Reposition: if the host window moved since the last draw, shift the
        // underlines by the same delta so they track the text. We use the live
        // Win32 window rect for the delta (never stale), NOT a re-query of the
        // control's text rects — modern Notepad's RichEdit returns stale text
        // rects after a move, which would strand the underlines.
        if let Some(target) = self.target.as_mut() {
            if !target.last_rects.is_empty() {
                if let (Some(cur), Some(prev)) =
                    (current_foreground_rect(), target.last_window_rect)
                {
                    if cur != prev {
                        let dx = (cur.0 - prev.0) as f64;
                        let dy = (cur.1 - prev.1) as f64;
                        for r in target.last_rects.iter_mut() {
                            r.x += dx;
                            r.y += dy;
                        }
                        target.last_window_rect = Some(cur);
                        if let Some(overlay) = &self.overlay {
                            overlay.set_rects(&target.last_rects);
                        }
                        if let Some((px, py)) = target.last_pill_anchor {
                            let np = (px + dx as i32, py + dy as i32);
                            target.last_pill_anchor = Some(np);
                            pill::show_pill(np.0, np.1);
                        }
                    }
                }
            }
        }

        let Some(target) = &mut self.target else {
            return;
        };

        let text = read_element_text_lossy(&target.element);
        if text != target.last_snapshot {
            target.last_snapshot = text;
            target.dirty_since = Some(Instant::now());
            target.last_edit_at = Some(Instant::now());
            target.autocorrect_baseline = None; // new edit → disarm; the re-lint re-arms
            return;
        }

        // Deferred autocorrect (opt-in): the field has been stable since the last
        // edit. Only now — after a deliberate pause (AUTOCORRECT_IDLE), longer than
        // the underline debounce — do we silently apply the high-confidence fixes
        // armed by the last lint. Because this never runs at the fast debounce, the
        // user has genuinely stopped typing, so moving and restoring the caret
        // can't collide with their keystrokes. If a fix lands, skip the rest.
        let ac_delay = self.config.autocorrect_delay();
        if self.config.autocorrect_enabled
            && target.autocorrect_baseline.is_some()
            && target
                .last_edit_at
                .is_some_and(|t| t.elapsed() >= ac_delay)
        {
            let baseline = target.autocorrect_baseline.take();
            let drawn = target.drawn.clone();
            if try_autocorrect(
                &mut self.autocorrect_ledger,
                target,
                baseline.as_deref(),
                &drawn,
            ) {
                return;
            }
        }

        let Some(dirty_since) = target.dirty_since else {
            return;
        };
        if dirty_since.elapsed() < DEBOUNCE_DELAY {
            return;
        }
        target.dirty_since = None;

        if target
            .last_linted_text
            .as_ref()
            .is_some_and(|last| last == &target.last_snapshot)
        {
            return;
        }
        // Remember the previously-linted text so autocorrect can tell which part
        // is freshly typed (it only auto-applies to new edits, never old text).
        let prev_linted = target.last_linted_text.take();
        target.last_linted_text = Some(target.last_snapshot.clone());

        // Harper tier (local, instant): lint, draw the red solid layer now.
        let opts = EngineOptions {
            dialect: self.config.dialect(),
            ..EngineOptions::default()
        };
        let (rects, drawn) = lint_to_overlay(
            &target.element,
            &target.app,
            &target.last_snapshot,
            &opts,
            &target.dismissed,
        );

        // Revert learning runs on EVERY lint (independent of caret position): if
        // the field now exactly matches a recent pre-autofix snapshot, the user
        // undid that fix — record it so we never auto-apply that fix again.
        if self.config.autocorrect_enabled {
            for (orig, repl) in autocorrect::take_reverted(
                &mut target.recent_autofixes,
                &target.last_snapshot,
                Instant::now(),
            ) {
                self.autocorrect_ledger.suppress(&orig, &repl);
            }
        }

        // Arm autocorrect: stash the diff baseline (the previously-linted text) so
        // the deferred pass — which runs on a later poll, only after the user has
        // paused for AUTOCORRECT_IDLE — can silently apply the high-confidence
        // fixes in `drawn`. We deliberately do NOT apply here at the fast underline
        // debounce: that fired while the user was still typing and moved the caret
        // onto the corrected word, letting the next keystrokes overwrite it.
        target.autocorrect_baseline = if self.config.autocorrect_enabled {
            prev_linted
        } else {
            None
        };

        target.drawn = drawn;
        target.last_rects = rects;
        if let Some(overlay) = &self.overlay {
            overlay.set_rects(&target.last_rects);
        }
        target.last_window_rect = current_foreground_rect();

        // Proactive LLM tier (cloud, async): schedule a context check after the
        // Harper layer lands — once per distinct text (memoized), only when the
        // LLM is enabled + configured. The worker posts WM_LLM_RESULT back.
        if self.config.llm_enabled
            && llm::proactive_text_eligible(&target.last_snapshot)
            && target.last_llm_text.as_deref() != Some(target.last_snapshot.as_str())
        {
            if let Some(cfg) = self.config.llm_config() {
                target.last_llm_text = Some(target.last_snapshot.clone());
                spawn_llm_review(target.last_snapshot.clone(), cfg);
            }
        }

        // Show/refresh the "Rewrite" pill at the field's bottom-right corner.
        target.last_pill_anchor =
            show_field_pill(&self.config, &target.element, &target.last_snapshot);
    }

    /// Merge a finished proactive-LLM result into the live overlay: drop issues
    /// that overlap a Harper span (Harper wins — `mergeLlmIssues`), draw the rest
    /// as the blue dotted "context" layer on top of the retained Harper layer.
    fn apply_llm_result(&mut self, msg: LlmResultMsg) {
        if msg.seq != LLM_SEQ.load(Ordering::SeqCst) {
            return; // a newer request superseded this one
        }
        let Some(target) = &mut self.target else {
            return;
        };
        if target.last_snapshot != msg.text {
            return; // text changed since the request was issued
        }

        // mergeLlmIssues: append each LLM issue that doesn't overlap a Harper
        // span (Harper wins), then recompute + redraw the whole layer.
        for issue in &msg.issues {
            // Honor a prior dismissal of this AI suggestion in this field.
            if target
                .dismissed
                .iter()
                .any(|(orig, kind)| orig == &issue.original && kind == "AI suggestion")
            {
                continue;
            }
            let overlaps_harper = target
                .drawn
                .iter()
                .any(|d| !d.dashed && issue.start < d.char_end && d.char_start < issue.end);
            if overlaps_harper {
                continue;
            }
            target.drawn.push(DrawnIssue {
                char_start: issue.start,
                char_end: issue.end,
                utf16_start: issue.utf16_start,
                utf16_end: issue.utf16_end,
                argb: LLM_ARGB,
                dashed: true,
                original: issue.original.clone(),
                candidates: vec![issue.suggestion.clone()],
                reason: issue.reason.clone(),
                kicker: "AI suggestion".to_string(),
            });
        }
        target.last_rects = rects_for_drawn(&target.element, &target.drawn);
        if let Some(overlay) = &self.overlay {
            overlay.set_rects(&target.last_rects);
        }
        target.last_window_rect = current_foreground_rect();
    }

    /// User clicked an underline: show the (non-modal) suggestion card under the
    /// flagged word. Accept/Dismiss come back as WM_OVERLAY_APPLY/DISMISS.
    fn on_overlay_click(&mut self, index: usize) {
        let Some(target) = self.target.as_ref() else {
            return;
        };
        let Some(issue) = target.drawn.get(index) else {
            return;
        };
        let primary = issue.candidates.first().map(String::as_str).unwrap_or("");
        if primary.trim().is_empty() || primary == issue.original {
            return;
        }
        let (mut ax, mut ay, mut atop) = (0i32, 0i32, 0i32);
        let rects = compute_issue_rects(&target.element, issue.utf16_start, issue.utf16_end);
        if let Some(rect) = rects.rects.first() {
            ax = rect.x.round() as i32;
            ay = (rect.y + rect.h).round() as i32 + 3;
            atop = rect.y.round() as i32;
        }
        suggestion::show(
            index,
            &issue.original,
            &issue.candidates,
            &issue.reason,
            &issue.kicker,
            issue.dashed,
            ax,
            ay,
            atop,
        );
    }

    /// Accept clicked on the card: apply the chosen candidate, then clear (the
    /// next poll re-lints the new text cleanly).
    fn apply_clicked(&mut self, index: usize, cand_idx: usize) {
        suggestion::close();
        let applied = {
            let Some(target) = self.target.as_ref() else {
                return;
            };
            let Some(issue) = target.drawn.get(index) else {
                return;
            };
            let Some(suggestion) = issue.candidates.get(cand_idx) else {
                return;
            };
            apply_single_fix(&target.element, issue, suggestion)
        };
        if applied {
            if let Some(target) = self.target.as_mut() {
                target.drawn.clear();
                target.last_linted_text = None;
            }
            if let Some(overlay) = &self.overlay {
                overlay.clear();
            }
        }
    }

    /// Dismiss clicked on the card: drop that underline AND remember it (by
    /// flagged text + kicker) so a re-lint after the next edit doesn't bring it
    /// straight back — matching the extension's per-field "ignore" behavior.
    fn dismiss_clicked(&mut self, index: usize) {
        suggestion::close();
        if let Some(target) = self.target.as_mut() {
            if let Some(issue) = target.drawn.get(index) {
                let key = (issue.original.clone(), issue.kicker.clone());
                if !target.dismissed.contains(&key) {
                    target.dismissed.push(key);
                }
            }
            if index < target.drawn.len() {
                target.drawn.remove(index);
            }
        }
        if let Some(target) = self.target.as_mut() {
            target.last_rects = rects_for_drawn(&target.element, &target.drawn);
            if let Some(overlay) = &self.overlay {
                overlay.set_rects(&target.last_rects);
            }
        }
    }

    /// "Rewrite" pill clicked — open the tone menu just above the pill.
    fn on_pill_click(&self) {
        if let Some((ax, ay)) = self.target.as_ref().and_then(|t| t.last_pill_anchor) {
            // Anchor is the pill's bottom-right; place the menu above-left of it.
            // show_menu clamps to the monitor work area, so approximate is fine.
            pill::show_menu(ax - 180, ay - 200);
        }
    }

    /// A tone was chosen in the menu — kick off an LLM rewrite of the field text.
    fn on_tone_chosen(&mut self, tone_idx: usize) {
        pill::close_menu();
        let Some(tone) = RewriteTone::from_index(tone_idx) else {
            return;
        };
        let Some(cfg) = self.config.llm_config() else {
            return;
        };
        let Some(target) = self.target.as_ref() else {
            return;
        };
        let text = read_element_text_lossy(&target.element);
        if text.trim().is_empty() {
            return;
        }
        if let Some((ax, ay)) = target.last_pill_anchor {
            pill::show_working(ax - 150, ay - 60);
        }
        spawn_rewrite(text, tone, cfg);
    }

    /// A pill rewrite finished — show it in a PREVIEW (Apply/Cancel). Nothing is
    /// applied yet; the user sees the proposed text first.
    fn on_rewrite_ready(&mut self, msg: RewriteResultMsg) {
        if msg.seq != REWRITE_SEQ.load(Ordering::SeqCst) {
            return;
        }
        pill::close_working();
        let anchor = self.target.as_ref().and_then(|t| t.last_pill_anchor);
        if msg.rewritten.trim().is_empty() {
            // Model returned nothing usable / no change — give the user feedback
            // instead of silently doing nothing.
            if let Some((ax, ay)) = anchor {
                pill::show_notice(ax - 200, ay - 60, "No changes suggested");
            }
            return;
        }
        self.pending_rewrite = Some((msg.original, msg.rewritten.clone()));
        if let Some((ax, ay)) = anchor {
            pill::show_preview(ax - 380, ay - 240, &msg.rewritten, msg.tone.label());
        }
    }

    /// Apply clicked in the preview: now replace the field with the rewrite (only
    /// if the text is unchanged since the request), then clear so it re-lints.
    fn on_rewrite_apply(&mut self) {
        pill::close_preview();
        let Some((original, rewritten)) = self.pending_rewrite.take() else {
            return;
        };
        let applied = {
            let Some(target) = self.target.as_ref() else {
                return;
            };
            if read_element_text_lossy(&target.element) != original {
                return; // edited since the request — don't clobber
            }
            apply_full_rewrite(&target.element, &rewritten)
        };
        if applied {
            if let Some(target) = self.target.as_mut() {
                target.drawn.clear();
                target.last_rects.clear();
                target.last_linted_text = None;
                target.last_llm_text = None;
                target.dirty_since = Some(Instant::now());
            }
            if let Some(overlay) = &self.overlay {
                overlay.clear();
            }
        }
    }

    fn clear_target(&mut self) {
        // Close any open suggestion card + rewrite pill and erase underlines so
        // they never linger over the wrong field.
        suggestion::close();
        pill::close();
        if let Some(overlay) = &self.overlay {
            overlay.clear();
        }
        if let Some(mut target) = self.target.take() {
            if let Some(subscription) = target.text_event.take() {
                if let Err(error) = self.automation.remove_automation_event_handler(
                    UIEventType::Text_TextChanged,
                    &target.element,
                    &subscription.handler,
                ) {
                    eprintln!("remove Text_TextChanged handler failed: {error}");
                }
            }
        }
    }
}

impl Drop for MonitorState<'_> {
    fn drop(&mut self) {
        self.clear_target();
    }
}

struct FocusHook(HWINEVENTHOOK);

impl FocusHook {
    fn install() -> Result<Self, Box<dyn Error>> {
        let hook = unsafe {
            SetWinEventHook(
                EVENT_OBJECT_FOCUS,
                EVENT_OBJECT_FOCUS,
                None,
                Some(focus_event_callback),
                0,
                0,
                WINEVENT_OUTOFCONTEXT,
            )
        };
        if hook.is_invalid() {
            return Err(Box::new(AppError::new(
                "SetWinEventHook(EVENT_OBJECT_FOCUS) failed",
            )));
        }
        Ok(Self(hook))
    }
}

impl Drop for FocusHook {
    fn drop(&mut self) {
        unsafe {
            let _ = UnhookWinEvent(self.0);
        }
    }
}

struct PollTimer(usize);

impl PollTimer {
    fn start() -> Result<Self, Box<dyn Error>> {
        // hwnd=NULL → Windows assigns its own timer id and returns it; keep that
        // for KillTimer (POLL_TIMER_ID is ignored by SetTimer in this mode).
        let id = unsafe { SetTimer(None, POLL_TIMER_ID, POLL_INTERVAL.as_millis() as u32, None) };
        if id == 0 {
            return Err(Box::new(AppError::new(
                "SetTimer for monitor polling failed",
            )));
        }
        Ok(Self(id))
    }
}

impl Drop for PollTimer {
    fn drop(&mut self) {
        unsafe {
            let _ = KillTimer(None, self.0);
        }
    }
}

unsafe extern "system" fn focus_event_callback(
    _hook: HWINEVENTHOOK,
    _event: u32,
    _hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _event_thread: u32,
    _event_time: u32,
) {
    post_monitor_message(WM_FOCUS_CHANGED);
}

fn subscribe_text_changed(
    automation: &UIAutomation,
    element: &UIElement,
) -> Option<TextEventSubscription> {
    let thread_id = MAIN_THREAD_ID.load(Ordering::SeqCst);
    let handler_fn: Box<CustomEventHandlerFn> = Box::new(move |_sender, event_type| {
        if event_type == UIEventType::Text_TextChanged && thread_id != 0 {
            unsafe {
                let _ = PostThreadMessageW(thread_id, WM_TEXT_CHANGED, WPARAM(0), LPARAM(0));
            }
        }
        Ok(())
    });
    let handler = UIEventHandler::from(handler_fn);

    match automation.add_automation_event_handler(
        UIEventType::Text_TextChanged,
        element,
        TreeScope::Element,
        None,
        &handler,
    ) {
        Ok(()) => Some(TextEventSubscription { handler }),
        Err(error) => {
            eprintln!("Text_TextChanged subscription unavailable; polling fallback active: {error}");
            None
        }
    }
}

fn post_monitor_message(message: u32) {
    let thread_id = MAIN_THREAD_ID.load(Ordering::SeqCst);
    if thread_id != 0 {
        unsafe {
            let _ = PostThreadMessageW(thread_id, message, WPARAM(0), LPARAM(0));
        }
    }
}

/// Process image base name (e.g. "chrome.exe") for a pid — used by the per-app
/// exclusion check. Returns None if the process can't be opened/queried.
fn process_image_name(pid: u32) -> Option<String> {
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
            PWSTR(buf.as_mut_ptr()),
            &mut size,
        );
        let _ = CloseHandle(handle);
        result.ok()?;
        let path = String::from_utf16_lossy(&buf[..size as usize]);
        path.rsplit(['\\', '/']).next().map(|s| s.to_string())
    }
}

/// Run the proactive LLM review on a worker thread (HTTP is blocking) and post
/// the result back to the UI thread as WM_LLM_RESULT, so every UIA/overlay touch
/// stays on the apartment that owns it. Stale results are dropped via `seq`.
fn spawn_llm_review(text: String, cfg: LlmConfig) {
    let seq = LLM_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
    let main_thread = MAIN_THREAD_ID.load(Ordering::SeqCst);
    if main_thread == 0 {
        return;
    }
    thread::spawn(move || {
        let issues = match llm::llm_review(&text, &cfg) {
            Ok(issues) => issues,
            Err(error) => {
                eprintln!("proactive LLM review failed: {error}");
                return;
            }
        };
        if issues.is_empty() {
            return; // model abstained / no context-only issues; keep Harper layer
        }
        let payload = Box::new(LlmResultMsg { seq, text, issues });
        let ptr = Box::into_raw(payload) as isize;
        unsafe {
            if PostThreadMessageW(main_thread, WM_LLM_RESULT, WPARAM(0), LPARAM(ptr)).is_err() {
                drop(Box::from_raw(ptr as *mut LlmResultMsg));
            }
        }
    });
}

/// Run a pill rewrite on a worker thread (HTTP is blocking) and post the result
/// back to the UI thread as WM_REWRITE_RESULT. Stale results are dropped via seq.
fn spawn_rewrite(text: String, tone: RewriteTone, cfg: LlmConfig) {
    let seq = REWRITE_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
    let main_thread = MAIN_THREAD_ID.load(Ordering::SeqCst);
    if main_thread == 0 {
        return;
    }
    thread::spawn(move || {
        // Empty string signals "no change / failed" so the UI can clear the
        // "Rewriting…" bubble instead of leaving it spinning forever.
        let rewritten = match llm::llm_rewrite(&text, tone, &cfg) {
            Ok(Some(rewritten)) => rewritten,
            Ok(None) => String::new(),
            Err(error) => {
                eprintln!("pill rewrite failed: {error}");
                String::new()
            }
        };
        let payload = Box::new(RewriteResultMsg {
            seq,
            original: text,
            rewritten,
            tone,
        });
        let ptr = Box::into_raw(payload) as isize;
        unsafe {
            if PostThreadMessageW(main_thread, WM_REWRITE_RESULT, WPARAM(0), LPARAM(ptr)).is_err() {
                drop(Box::from_raw(ptr as *mut RewriteResultMsg));
            }
        }
    });
}

fn unregister_hotkey() {
    if let Err(error) = unsafe { UnregisterHotKey(None, HOTKEY_ID) } {
        eprintln!("failed to unregister hotkey: {error}");
    }
}

fn handle_hotkey(automation: &UIAutomation) {
    match run_once(automation) {
        Ok(message) => {
            println!("{message}");
            feedback(&message);
        }
        Err(error) => {
            let message = format!("{error}");
            eprintln!("{message}");
            feedback(&message);
        }
    }
}

fn run_once(automation: &UIAutomation) -> Result<String, Box<dyn Error>> {
    let element = automation.get_focused_element()?;
    if element.is_password().unwrap_or(false) {
        return Ok("OGrammar skipped this password field.".to_string());
    }

    let focus_text = match read_focused_text(&element) {
        Some(text) => text,
        None => return Ok("Couldn't read this field (try selecting text).".to_string()),
    };
    let text = focus_text.text().to_string();

    if text.trim().is_empty() {
        return Ok("Couldn't read this field (try selecting text).".to_string());
    }

    let config = Config::load();
    let options = EngineOptions {
        dialect: config.dialect(),
        ..EngineOptions::default()
    };
    let issues = lint(&text, &options);
    // Start with Harper's safe local spelling fixes.
    let mut corrected = apply_safe_corrections(&text, &issues);
    let mut source = "spelling & grammar";

    // If the AI tier is enabled + configured, use its fuller correction (it also
    // fixes grammar/context/capitalization, i.e. everything underlined).
    if let Some(llm_cfg) = config.llm_config() {
        match ograms_engine::llm::llm_correct_text(&text, &llm_cfg) {
            Ok(Some(ai)) => {
                corrected = ai;
                source = "AI";
            }
            Ok(None) => {}
            Err(error) => eprintln!("hotkey AI correction failed: {error}"),
        }
    }

    if corrected == text {
        return Ok("No issues found.".to_string());
    }

    let mode = apply_correction(&element, &focus_text, &corrected)?;
    println!("ApplyMode::{mode:?}: applied corrected text ({source})");
    Ok(format!("OGrammar applied {source} fixes."))
}

fn print_current_overlay_json(automation: &UIAutomation) -> Result<(), Box<dyn Error>> {
    let element = automation.get_focused_element()?;
    if element.is_password().unwrap_or(false) {
        print_overlay_json("focused", "", Vec::new());
        return Ok(());
    }

    let text = read_element_text_lossy(&element);
    let _ = lint_to_overlay(
        &element,
        &describe_element(&element),
        &text,
        &EngineOptions::default(),
        &[],
    );
    Ok(())
}

/// Lint the text, log the JSON snapshot, AND return the screen rectangles (with
/// per-kind color) for the overlay to draw.
fn lint_to_overlay(
    element: &UIElement,
    app: &str,
    text: &str,
    options: &EngineOptions,
    dismissed: &[(String, String)],
) -> (Vec<OverlayRect>, Vec<DrawnIssue>) {
    let issues = lint(text, options);
    let mut overlay_rects: Vec<OverlayRect> = Vec::new();
    let mut drawn: Vec<DrawnIssue> = Vec::new();
    let mut payload_issues: Vec<serde_json::Value> = Vec::new();
    for issue in &issues {
        let kicker = kicker_for_kind(issue.lint_kind.as_str());
        // Suppress anything the user dismissed in this field (same flagged text
        // + kicker), so it doesn't reappear when an edit triggers a re-lint.
        if dismissed
            .iter()
            .any(|(orig, kind)| orig == &issue.original && kind == kicker)
        {
            continue;
        }
        let argb = argb_for_kind(issue.lint_kind.as_str());
        let idx = drawn.len();
        drawn.push(DrawnIssue {
            char_start: issue.start,
            char_end: issue.end,
            utf16_start: issue.utf16_start,
            utf16_end: issue.utf16_end,
            argb,
            dashed: false,
            original: issue.original.clone(),
            candidates: issue.suggestions.clone(),
            reason: issue.message.clone(),
            kicker: kicker.to_string(),
        });
        let issue_rects = compute_issue_rects(element, issue.utf16_start, issue.utf16_end);
        for rect in &issue_rects.rects {
            overlay_rects.push(OverlayRect {
                x: rect.x,
                y: rect.y,
                w: rect.w,
                h: rect.h,
                argb,
                dashed: false,
                issue_index: idx,
            });
        }
        let rects = issue_rects
            .rects
            .iter()
            .map(|rect| {
                json!({
                    "x": rect.x,
                    "y": rect.y,
                    "w": rect.w,
                    "h": rect.h,
                })
            })
            .collect::<Vec<_>>();
        payload_issues.push(json!({
            "original": issue.original.as_str(),
            "suggestion": issue.suggestions.first().cloned().unwrap_or_default(),
            "lint_kind": issue.lint_kind.as_str(),
            "utf16_start": issue.utf16_start,
            "utf16_end": issue.utf16_end,
            "rects": rects,
            "note": issue_rects.note,
        }));
    }

    print_overlay_json(app, text, payload_issues);
    (overlay_rects, drawn)
}

/// Recompute overlay rects for the retained issues at the element's CURRENT
/// on-screen position — used after the host window moves/resizes so underlines
/// track the text instead of lingering at stale coordinates.
fn rects_for_drawn(element: &UIElement, drawn: &[DrawnIssue]) -> Vec<OverlayRect> {
    let mut out = Vec::new();
    for (idx, d) in drawn.iter().enumerate() {
        let issue_rects = compute_issue_rects(element, d.utf16_start, d.utf16_end);
        for rect in &issue_rects.rects {
            out.push(OverlayRect {
                x: rect.x,
                y: rect.y,
                w: rect.w,
                h: rect.h,
                argb: d.argb,
                dashed: d.dashed,
                issue_index: idx,
            });
        }
    }
    out
}

/// The foreground window's screen rect (left, top, right, bottom) — used to
/// detect the tracked window moving or resizing between polls.
fn current_foreground_rect() -> Option<(i32, i32, i32, i32)> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        let mut r = RECT::default();
        if GetWindowRect(hwnd, &mut r).is_ok() {
            Some((r.left, r.top, r.right, r.bottom))
        } else {
            None
        }
    }
}

/// Show the "Rewrite" pill at the focused field's bottom-right when the AI tier
/// is available and the text is worth rewriting; hide it otherwise. Returns the
/// pill's anchor (screen coords) so it can be shifted on a window move.
fn show_field_pill(config: &Config, element: &UIElement, text: &str) -> Option<(i32, i32)> {
    if config.llm_config().is_none() || !llm::proactive_text_eligible(text) {
        pill::close();
        return None;
    }
    let Ok(rect) = element.get_bounding_rectangle() else {
        pill::close();
        return None;
    };
    let anchor = (rect.get_right() - 10, rect.get_bottom() - 10);
    pill::show_pill(anchor.0, anchor.1);
    Some(anchor)
}

/// Replace the ENTIRE field text with `new_text` (used by the rewrite pill).
fn apply_full_rewrite(element: &UIElement, new_text: &str) -> bool {
    let _ = element.set_focus();
    // Prefer a precise ValuePattern set.
    if let Ok(value) = element.get_pattern::<UIValuePattern>() {
        if value.set_value(new_text).is_ok() {
            return true;
        }
    }
    // Otherwise select the whole document and paste over it.
    if let Ok(text_pattern) = element.get_pattern::<UITextPattern>() {
        if let Ok(document) = text_pattern.get_document_range() {
            if document.select().is_ok() && paste_replacement(new_text).is_ok() {
                return true;
            }
        }
    }
    false
}

/// The caret's character offset from the document start (best-effort, via the
/// TextPattern selection). Used by autocorrect to know what the user just typed
/// and to avoid rewriting the word the caret is inside.
fn caret_char_offset(element: &UIElement) -> Option<usize> {
    let text_pattern = element.get_pattern::<UITextPattern>().ok()?;
    let caret = text_pattern.get_selection().ok()?.into_iter().next()?;
    let document = text_pattern.get_document_range().ok()?;
    let range = document.clone();
    // range = [document start, caret start]
    range
        .move_endpoint_by_range(
            TextPatternRangeEndpoint::End,
            &caret,
            TextPatternRangeEndpoint::Start,
        )
        .ok()?;
    let before = range.get_text(-1).ok()?;
    Some(before.chars().count())
}

/// Place the caret at the very end of the document (collapsed selection) — used
/// after autocorrect edits earlier text, so the user keeps typing where they were.
fn set_caret_to_end(element: &UIElement) {
    if let Ok(text_pattern) = element.get_pattern::<UITextPattern>() {
        if let Ok(document) = text_pattern.get_document_range() {
            let range = document.clone();
            if range
                .move_endpoint_by_range(
                    TextPatternRangeEndpoint::Start,
                    &document,
                    TextPatternRangeEndpoint::End,
                )
                .is_ok()
            {
                let _ = range.select();
            }
        }
    }
}

/// Autocorrect tier: auto-apply high-confidence fixes to the freshly-typed part
/// of the field. Returns true if it edited the field (caller skips drawing and
/// lets the next poll re-lint). Honors revert-learning: a user undo of one of our
/// fixes adds that token to the persistent "never autocorrect" ledger.
fn try_autocorrect(
    ledger: &mut autocorrect::RejectionLedger,
    target: &mut TrackedTarget,
    prev_linted: Option<&str>,
    drawn: &[DrawnIssue],
) -> bool {
    // Need a prior lint to diff against — never auto-edit pre-existing text on
    // first sight; only correct what the user is actively typing.
    let Some(prev) = prev_linted else {
        return false;
    };
    let Some(caret) = caret_char_offset(&target.element) else {
        return false;
    };
    let text = target.last_snapshot.clone();
    let chars: Vec<char> = text.chars().collect();
    let total = chars.len();
    // Only when typing forward: the caret is at the end (only whitespace after).
    if chars[caret.min(total)..].iter().any(|c| !c.is_whitespace()) {
        return false;
    }
    // First index where the text diverged from the previous lint = start of the
    // freshly-edited region.
    let first_diff = prev
        .chars()
        .zip(text.chars())
        .take_while(|(a, b)| a == b)
        .count();
    let now = Instant::now();

    // Pick eligible fixes: high-confidence, a completed word (boundary after it)
    // in the freshly-typed region and strictly before the caret, not suppressed.
    // (Revert learning runs separately in the poll loop, on every lint.)
    let mut chosen: Vec<DrawnIssue> = Vec::new();
    for d in drawn {
        if d.dashed {
            continue; // the LLM/context layer never auto-applies
        }
        let Some(suggestion) = d.candidates.first() else {
            continue;
        };
        if !autocorrect::is_auto_applicable(&d.kicker, &d.original, suggestion) {
            continue;
        }
        if d.char_end > caret || d.char_end <= first_diff {
            continue; // at/after the caret, or not freshly typed
        }
        if chars
            .get(d.char_end)
            .map(|c| c.is_alphanumeric())
            .unwrap_or(false)
        {
            continue; // word isn't finished with a boundary yet
        }
        if ledger.is_suppressed(&d.original, suggestion) {
            continue;
        }
        chosen.push(d.clone());
    }
    if chosen.is_empty() {
        return false;
    }

    // Apply right-to-left so each fix's offsets stay valid, then restore the caret.
    chosen.sort_by(|a, b| b.char_start.cmp(&a.char_start));
    let mut applied = false;
    for issue in &chosen {
        let Some(suggestion) = issue.candidates.first() else {
            continue;
        };
        if apply_single_fix(&target.element, issue, suggestion) {
            autocorrect::record_applied(
                &mut target.recent_autofixes,
                &text,
                &issue.original,
                suggestion,
                now,
            );
            applied = true;
        }
    }
    if applied {
        set_caret_to_end(&target.element);
        // Re-lint the corrected text cleanly on the next poll.
        target.last_snapshot = read_element_text_lossy(&target.element);
        target.last_linted_text = None;
        target.drawn.clear();
        target.dirty_since = Some(Instant::now());
    }
    applied
}

/// Apply ONE issue's suggestion: select its exact range via the TextPattern and
/// paste the replacement (or splice it for ValuePattern-only fields). Verifies
/// the flagged text is still present first, so it never edits stale text.
fn apply_single_fix(element: &UIElement, issue: &DrawnIssue, suggestion: &str) -> bool {
    let text = read_element_text_lossy(element);
    let chars: Vec<char> = text.chars().collect();
    if issue.char_start > issue.char_end || issue.char_end > chars.len() {
        return false;
    }
    let current: String = chars[issue.char_start..issue.char_end].iter().collect();
    if current != issue.original {
        return false; // text shifted since lint — skip rather than corrupt it
    }

    // Focus the field FIRST. Focusing *after* selecting collapses the selection
    // to the caret (usually the end), which made the paste land at the end of the
    // text instead of replacing the word — the "appended to the end" bug.
    let _ = element.set_focus();

    // Preferred: select the exact range and paste the fix into it — but only
    // after CONFIRMING the range actually covers the flagged word. If the offset
    // math lands the range elsewhere (e.g. a control whose Character unit isn't
    // UTF-16), we must NOT paste, or the correction would be inserted at the
    // caret and the original left in place ("teh" → "teh … the").
    if let Ok(text_pattern) = element.get_pattern::<UITextPattern>() {
        if let Ok(document) = text_pattern.get_document_range() {
            let range = document.clone();
            let positioned = range
                .move_endpoint_by_range(
                    TextPatternRangeEndpoint::End,
                    &document,
                    TextPatternRangeEndpoint::Start,
                )
                .and_then(|_| {
                    range.move_endpoint_by_unit(
                        TextPatternRangeEndpoint::End,
                        TextUnit::Character,
                        issue.utf16_end as i32,
                    )
                })
                .and_then(|_| {
                    range.move_endpoint_by_unit(
                        TextPatternRangeEndpoint::Start,
                        TextUnit::Character,
                        issue.utf16_start as i32,
                    )
                })
                .is_ok();
            let covers_word = positioned
                && range
                    .get_text(-1)
                    .map(|t| t == issue.original)
                    .unwrap_or(false);
            if covers_word && range.select().is_ok() && paste_replacement(suggestion).is_ok() {
                return true;
            }
        }
    }

    // Fallback (also used when the range couldn't be verified above): splice the
    // new value directly — precise, and can never append.
    if let Ok(value) = element.get_pattern::<UIValuePattern>() {
        let new_value: String = chars[..issue.char_start].iter().collect::<String>()
            + suggestion
            + &chars[issue.char_end..].iter().collect::<String>();
        if value.set_value(&new_value).is_ok() {
            return true;
        }
    }
    false
}

/// Replace the current selection in the focused field by pasting `text`, then
/// restore the user's clipboard.
fn paste_replacement(text: &str) -> Result<(), Box<dyn Error>> {
    let previous = ClipboardSnapshot::capture()?;
    set_clipboard_text(text)?;
    send_ctrl_v()?;
    thread::sleep(CLIPBOARD_RESTORE_DELAY);
    previous.restore()?;
    Ok(())
}

/// Premultiplied opaque ARGB (0xAARRGGBB) for the overlay underline by lint kind.
fn argb_for_kind(kind: &str) -> u32 {
    match kind {
        "Spelling" | "Typo" | "Grammar" | "Punctuation" | "Capitalization" | "WordForm" => {
            0xFFE5_3935 // correctness red
        }
        _ => 0xFF6B_7280, // softer grey for style/clarity/other
    }
}

/// Card kicker label for a Harper lint kind (LLM issues use "AI suggestion").
fn kicker_for_kind(kind: &str) -> &'static str {
    match kind {
        "Spelling" | "Typo" => "Spelling",
        "Grammar" => "Grammar",
        "Punctuation" => "Punctuation",
        "Capitalization" => "Capitalization",
        "WordForm" => "Word form",
        _ => "Style",
    }
}

fn print_overlay_json(app: &str, text: &str, issues: Vec<serde_json::Value>) {
    println!(
        "{}",
        json!({
            "ts": timestamp_millis(),
            "app": app,
            "text_len": text.encode_utf16().count(),
            "issues": issues,
        })
    );
}

fn compute_issue_rects(element: &UIElement, utf16_start: usize, utf16_end: usize) -> IssueRects {
    if utf16_end <= utf16_start {
        return IssueRects {
            rects: Vec::new(),
            note: Some("invalid or empty issue span".to_string()),
        };
    }

    let Ok(text_pattern) = element.get_pattern::<UITextPattern>() else {
        return IssueRects {
            rects: Vec::new(),
            note: Some("TextPattern unavailable; control may expose only ValuePattern".to_string()),
        };
    };
    let Ok(document) = text_pattern.get_document_range() else {
        return IssueRects {
            rects: Vec::new(),
            note: Some("TextPattern.get_document_range failed".to_string()),
        };
    };

    let range = document.clone();
    if let Err(error) = range.move_endpoint_by_range(
        TextPatternRangeEndpoint::End,
        &document,
        TextPatternRangeEndpoint::Start,
    ) {
        return IssueRects {
            rects: Vec::new(),
            note: Some(format!("MoveEndpointByRange(end=document start) failed: {error}")),
        };
    }
    if let Err(error) = range.move_endpoint_by_unit(
        TextPatternRangeEndpoint::End,
        TextUnit::Character,
        utf16_end as i32,
    ) {
        return IssueRects {
            rects: Vec::new(),
            note: Some(format!("MoveEndpointByUnit(end after reset) failed: {error}")),
        };
    }
    if let Err(error) = range.move_endpoint_by_unit(
        TextPatternRangeEndpoint::Start,
        TextUnit::Character,
        utf16_start as i32,
    ) {
        return IssueRects {
            rects: Vec::new(),
            note: Some(format!("MoveEndpointByUnit(start) failed: {error}")),
        };
    }

    match bounding_rectangles(&range) {
        Ok(rects) if rects.is_empty() => IssueRects {
            rects,
            note: Some("GetBoundingRectangles returned no visible rectangles".to_string()),
        },
        Ok(rects) => IssueRects { rects, note: None },
        Err(error) => IssueRects {
            rects: Vec::new(),
            note: Some(format!("GetBoundingRectangles failed: {error}")),
        },
    }
}

fn bounding_rectangles(range: &UITextRange) -> Result<Vec<ScreenRect>, Box<dyn Error>> {
    let raw: *mut SAFEARRAY = unsafe { range.as_ref().GetBoundingRectangles()? };
    if raw.is_null() {
        return Ok(Vec::new());
    }

    let _guard = SafeArrayGuard(raw);
    let dim = unsafe { SafeArrayGetDim(raw) };
    if dim != 1 {
        return Err(Box::new(AppError::new(format!(
            "expected 1D SAFEARRAY, got {dim}D"
        ))));
    }
    let vt = unsafe { SafeArrayGetVartype(raw)? };
    if vt != VT_R8 {
        return Err(Box::new(AppError::new(format!(
            "expected VT_R8 SAFEARRAY, got {:?}",
            vt
        ))));
    }

    let lower = unsafe { SafeArrayGetLBound(raw, 1)? };
    let upper = unsafe { SafeArrayGetUBound(raw, 1)? };
    if upper < lower {
        return Ok(Vec::new());
    }

    let mut values = Vec::with_capacity((upper - lower + 1) as usize);
    for index in lower..=upper {
        let mut value = 0.0_f64;
        unsafe {
            SafeArrayGetElement(raw, &index, &mut value as *mut f64 as _)?;
        }
        values.push(value);
    }

    Ok(values
        .chunks_exact(4)
        .filter_map(|quad| {
            let w = quad[2];
            let h = quad[3];
            (w > 0.0 && h > 0.0).then_some(ScreenRect {
                x: quad[0],
                y: quad[1],
                w,
                h,
            })
        })
        .collect())
}

struct SafeArrayGuard(*mut SAFEARRAY);

impl Drop for SafeArrayGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = SafeArrayDestroy(self.0);
        }
    }
}

fn is_readable_text_element(element: &UIElement) -> bool {
    element.get_pattern::<UIValuePattern>().is_ok()
        || element.get_pattern::<UITextPattern>().is_ok()
}

fn read_element_text_lossy(element: &UIElement) -> String {
    if let Ok(value) = element.get_pattern::<UIValuePattern>() {
        if let Ok(text) = value.get_value() {
            return text;
        }
    }

    if let Ok(text_pattern) = element.get_pattern::<UITextPattern>() {
        if let Ok(range) = text_pattern.get_document_range() {
            if let Ok(text) = range.get_text(-1) {
                return text;
            }
        }
    }

    String::new()
}

fn describe_element(element: &UIElement) -> String {
    let name = element.get_name().unwrap_or_default();
    let class_name = element.get_classname().unwrap_or_default();
    let process_id = element.get_process_id().unwrap_or_default();

    match (name.is_empty(), class_name.is_empty()) {
        (false, false) => format!("{name} ({class_name}, pid {process_id})"),
        (false, true) => format!("{name} (pid {process_id})"),
        (true, false) => format!("{class_name} (pid {process_id})"),
        (true, true) => format!("pid {process_id}"),
    }
}

fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn read_focused_text(element: &UIElement) -> Option<FocusText> {
    if let Ok(value) = element.get_pattern::<UIValuePattern>() {
        match value.get_value() {
            Ok(text) if !text.trim().is_empty() => return Some(FocusText::Value(text)),
            Ok(_) => {}
            Err(error) => eprintln!("ValuePattern.get_value failed: {error}"),
        }
    }

    if let Ok(text_pattern) = element.get_pattern::<UITextPattern>() {
        if let Ok(selection) = text_pattern.get_selection() {
            for range in selection {
                match range.get_text(-1) {
                    Ok(text) if !text.trim().is_empty() => {
                        return Some(FocusText::TextSelection { text, range });
                    }
                    Ok(_) => {}
                    Err(error) => eprintln!("TextPattern selection get_text failed: {error}"),
                }
            }
        }

        match text_pattern.get_document_range() {
            Ok(range) => match range.get_text(-1) {
                Ok(text) if !text.trim().is_empty() => {
                    return Some(FocusText::TextDocument { text, range });
                }
                Ok(_) => {}
                Err(error) => eprintln!("TextPattern.get_text failed: {error}"),
            },
            Err(error) => eprintln!("TextPattern.get_document_range failed: {error}"),
        }
    }

    None
}

fn apply_correction(
    element: &UIElement,
    focus_text: &FocusText,
    corrected: &str,
) -> Result<ApplyMode, Box<dyn Error>> {
    if matches!(focus_text, FocusText::Value(_)) {
        if let Ok(value) = element.get_pattern::<UIValuePattern>() {
            match value.set_value(corrected) {
                Ok(()) => return Ok(ApplyMode::SetValue),
                Err(error) => {
                    eprintln!("ValuePattern.set_value failed, falling back to clipboard: {error}")
                }
            }
        }
    }

    clipboard_paste(element, focus_text, corrected)?;
    Ok(ApplyMode::Clipboard)
}

fn clipboard_paste(
    element: &UIElement,
    focus_text: &FocusText,
    corrected: &str,
) -> Result<(), Box<dyn Error>> {
    if let Err(error) = element.set_focus() {
        eprintln!("set_focus before clipboard paste failed: {error}");
    }
    select_text_for_clipboard_replace(focus_text);

    let previous = ClipboardSnapshot::capture()?;
    set_clipboard_text(corrected)?;
    send_ctrl_v()?;
    thread::sleep(CLIPBOARD_RESTORE_DELAY);
    previous.restore()?;
    Ok(())
}

fn select_text_for_clipboard_replace(focus_text: &FocusText) {
    match focus_text {
        FocusText::Value(_) => {
            if let Err(error) = send_ctrl_a() {
                eprintln!("Ctrl+A before clipboard paste failed: {error}");
            }
        }
        FocusText::TextSelection { range, .. } => {
            if let Err(error) = range.select() {
                eprintln!("TextRange.select for current selection failed: {error}");
            }
        }
        FocusText::TextDocument { range, .. } => {
            if let Err(error) = range.select() {
                eprintln!("TextRange.select before clipboard paste failed: {error}");
            }
        }
    }
}

fn feedback(message: &str) {
    let wide_message = to_wide(message);
    let wide_title = to_wide("OGrammar");
    unsafe {
        MessageBoxW(
            None,
            PCWSTR(wide_message.as_ptr()),
            PCWSTR(wide_title.as_ptr()),
            MB_OK | MB_ICONINFORMATION,
        );
    }
}

/// Show a fatal-error dialog. Used for startup failures: a release build runs on
/// the windows subsystem with no console, so `eprintln!` alone would be invisible.
pub fn fatal_error(message: &str) {
    let wide_message = to_wide(message);
    let wide_title = to_wide("OGrammar");
    unsafe {
        MessageBoxW(
            None,
            PCWSTR(wide_message.as_ptr()),
            PCWSTR(wide_title.as_ptr()),
            MB_OK | MB_ICONERROR,
        );
    }
}

#[derive(Debug)]
enum ClipboardSnapshot {
    Text(String),
    EmptyOrUnavailable,
}

impl ClipboardSnapshot {
    fn capture() -> Result<Self, Box<dyn Error>> {
        let _clipboard = OpenClipboardGuard::open()?;
        if unsafe { IsClipboardFormatAvailable(CF_UNICODETEXT.0 as u32) }.is_err() {
            return Ok(Self::EmptyOrUnavailable);
        }

        let handle = unsafe { GetClipboardData(CF_UNICODETEXT.0 as u32)? };
        let text = read_hglobal_utf16(handle)?;
        Ok(Self::Text(text))
    }

    fn restore(self) -> Result<(), Box<dyn Error>> {
        match self {
            Self::Text(text) => set_clipboard_text(&text),
            Self::EmptyOrUnavailable => {
                let _clipboard = OpenClipboardGuard::open()?;
                unsafe { EmptyClipboard()? };
                Ok(())
            }
        }
    }
}

struct OpenClipboardGuard;

impl OpenClipboardGuard {
    fn open() -> Result<Self, Box<dyn Error>> {
        unsafe { OpenClipboard(None)? };
        Ok(Self)
    }
}

impl Drop for OpenClipboardGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseClipboard();
        }
    }
}

fn read_hglobal_utf16(handle: HANDLE) -> Result<String, Box<dyn Error>> {
    let hglobal = HGLOBAL(handle.0);
    let size_bytes = unsafe { GlobalSize(hglobal) };
    if size_bytes == 0 {
        return Ok(String::new());
    }

    let ptr = unsafe { GlobalLock(hglobal) } as *const u16;
    if ptr.is_null() {
        return Err(Box::new(AppError::new("GlobalLock failed for clipboard data")));
    }

    let len = size_bytes / size_of::<u16>();
    let slice = unsafe { std::slice::from_raw_parts(ptr, len) };
    let nul = slice.iter().position(|ch| *ch == 0).unwrap_or(slice.len());
    let text = String::from_utf16_lossy(&slice[..nul]);
    unsafe {
        let _ = GlobalUnlock(hglobal);
    }
    Ok(text)
}

fn set_clipboard_text(text: &str) -> Result<(), Box<dyn Error>> {
    let mut wide = text.encode_utf16().collect::<Vec<_>>();
    wide.push(0);
    let size_bytes = wide.len() * size_of::<u16>();

    let hglobal = unsafe { GlobalAlloc(GMEM_MOVEABLE, size_bytes)? };
    let ptr = unsafe { GlobalLock(hglobal) } as *mut u16;
    if ptr.is_null() {
        unsafe {
            let _ = GlobalFree(Some(hglobal));
        }
        return Err(Box::new(AppError::new("GlobalLock failed for clipboard write")));
    }

    unsafe {
        copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
        let _ = GlobalUnlock(hglobal);
    }

    let _clipboard = match OpenClipboardGuard::open() {
        Ok(clipboard) => clipboard,
        Err(error) => {
            unsafe {
                let _ = GlobalFree(Some(hglobal));
            }
            return Err(error);
        }
    };
    unsafe {
        if EmptyClipboard().is_err() {
            let _ = GlobalFree(Some(hglobal));
            return Err(Box::new(AppError::new("EmptyClipboard failed")));
        }
        if SetClipboardData(CF_UNICODETEXT.0 as u32, Some(HANDLE(hglobal.0))).is_err() {
            let _ = GlobalFree(Some(hglobal));
            return Err(Box::new(AppError::new("SetClipboardData failed")));
        }
    }

    Ok(())
}

fn send_ctrl_v() -> Result<(), Box<dyn Error>> {
    send_chord(VK_CONTROL, VK_V)
}

fn send_ctrl_a() -> Result<(), Box<dyn Error>> {
    send_chord(VK_CONTROL, VIRTUAL_KEY(b'A' as u16))
}

fn send_chord(modifier: VIRTUAL_KEY, key: VIRTUAL_KEY) -> Result<(), Box<dyn Error>> {
    let inputs = [
        keyboard_input(modifier, KEYBD_EVENT_FLAGS(0)),
        keyboard_input(key, KEYBD_EVENT_FLAGS(0)),
        keyboard_input(key, KEYEVENTF_KEYUP),
        keyboard_input(modifier, KEYEVENTF_KEYUP),
    ];
    let sent = unsafe { SendInput(&inputs, size_of::<INPUT>() as i32) };
    if sent as usize != inputs.len() {
        return Err(Box::new(AppError::new(format!(
            "SendInput sent {sent} of {} keyboard events",
            inputs.len()
        ))));
    }
    Ok(())
}

fn keyboard_input(key: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: key,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

fn to_wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}
