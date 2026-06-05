//! Embed a Win32 application manifest so the GUI uses modern Common-Controls v6
//! visual styles and declares Per-Monitor-V2 DPI awareness. Build-time only.

fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        use embed_manifest::manifest::DpiAwareness;
        use embed_manifest::{embed_manifest, new_manifest};
        embed_manifest(new_manifest("OGrammar.Desktop").dpi_awareness(DpiAwareness::PerMonitorV2))
            .expect("unable to embed application manifest");
    }
    println!("cargo:rerun-if-changed=build.rs");
}
