//! Bundled spell-engine data — the frequency dictionary + OGN1 n-gram model —
//! embedded in the binary and materialised to `config_dir()` on first run, so the
//! desktop runs the SAME Harper + SymSpell + n-gram pipeline as the extension
//! (see docs/33: with sentence context, C=67.4% vs Harper-only 42%).
//!
//! The bytes are the extension's source of truth (opengrammar/extension/public),
//! embedded via `include_bytes!` so there are no external files to ship and
//! nothing can go missing. The engine loads the dict/model BY PATH, so we write
//! them to `config_dir()` once and hand back the paths.

use std::path::PathBuf;
use std::sync::OnceLock;

use ograms_engine::{DialectName, EngineOptions, SpellEngine};

use crate::config::config_dir;

// One source of truth: exactly the files the extension ships.
const FREQ_DICT: &[u8] =
    include_bytes!("../../../opengrammar/extension/public/dict/frequency_dictionary_en_82_765.txt");
const NGRAM_MODEL: &[u8] =
    include_bytes!("../../../opengrammar/extension/public/ngram/model.bin");

/// Materialise the embedded data under `config_dir()` exactly once and cache the
/// resulting paths. Either entry is `None` if its write failed — the caller then
/// degrades that part of the pipeline (no dictionary ⇒ fall back to Harper-only).
fn engine_data_paths() -> &'static (Option<PathBuf>, Option<PathBuf>) {
    static PATHS: OnceLock<(Option<PathBuf>, Option<PathBuf>)> = OnceLock::new();
    PATHS.get_or_init(|| {
        (
            materialise("dict/frequency_dictionary_en_82_765.txt", FREQ_DICT),
            materialise("ngram/model.bin", NGRAM_MODEL),
        )
    })
}

/// Write `bytes` to `config_dir()/rel` if it is missing or a different size,
/// returning the path on success.
fn materialise(rel: &str, bytes: &[u8]) -> Option<PathBuf> {
    let path = config_dir().join(rel);
    let up_to_date = std::fs::metadata(&path)
        .map(|meta| meta.len() == bytes.len() as u64)
        .unwrap_or(false);
    if up_to_date {
        return Some(path);
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok()?;
    }
    std::fs::write(&path, bytes).ok()?;
    Some(path)
}

/// `EngineOptions` for the desktop: the full Harper + SymSpell + n-gram pipeline
/// (matching the extension), falling back to Harper-only if the dictionary could
/// not be materialised. The loaded dict/model are cached in the engine, so this
/// is cheap to call on the per-keystroke inline path.
pub fn engine_options(dialect: DialectName) -> EngineOptions {
    let (dict, model) = engine_data_paths();
    EngineOptions {
        dialect,
        spell_engine: if dict.is_some() {
            SpellEngine::Combined
        } else {
            SpellEngine::Harper
        },
        dictionary_path: dict.clone(),
        context_model_path: model.clone(),
        protect: true,
    }
}
