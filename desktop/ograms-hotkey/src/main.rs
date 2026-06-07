// Release builds use the Windows (GUI) subsystem so launching the app never
// spawns a console window. Debug builds stay on the console subsystem so dev
// logging (eprintln!) remains visible while developing.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod autocorrect;
#[cfg(windows)]
mod config;
#[cfg(windows)]
mod diff;
#[cfg(windows)]
mod overlay;
#[cfg(windows)]
mod pill;
#[cfg(windows)]
mod settings;
#[cfg(windows)]
mod suggestion;
#[cfg(windows)]
mod tray;
#[cfg(windows)]
mod windows_app;

#[cfg(windows)]
fn main() {
    if let Err(error) = windows_app::run() {
        // A release (windows-subsystem) build has no console, so a bare eprintln!
        // would vanish — surface fatal startup errors in a dialog as well.
        let msg = format!("ograms-hotkey failed to start: {error}");
        eprintln!("{msg}");
        windows_app::fatal_error(&msg);
    }
}

#[cfg(not(windows))]
fn main() {
    println!("ograms-hotkey is Windows-only. Build and run it on Windows.");
}

