#[cfg(windows)]
mod autocorrect;
#[cfg(windows)]
mod config;
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
        eprintln!("ograms-hotkey failed to start: {error}");
    }
}

#[cfg(not(windows))]
fn main() {
    println!("ograms-hotkey is Windows-only. Build and run it on Windows.");
}

