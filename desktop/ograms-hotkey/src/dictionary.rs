//! User-curated word list + LLM-taught corrections, persisted to
//! `%APPDATA%\OGrammar\userdict.json`. Brings the desktop to parity with the
//! extension's custom dictionary / ignore + learned-corrections store: a word the
//! user "adds to dictionary" (or dismisses as a spelling false-positive) is never
//! flagged again, and a high-conviction correction the LLM taught is re-applied
//! locally with no LLM round-trip. The key normalizer is shared with the engine
//! (`ograms_engine::learned::normalize_learn_key`) so the desktop, the engine port,
//! and the extension all key these stores identically.

use std::collections::{HashMap, HashSet};

use ograms_engine::learned::normalize_learn_key;
use serde::{Deserialize, Serialize};

use crate::config::config_dir;

#[derive(Default, Serialize, Deserialize)]
pub struct UserDict {
    /// Normalized words to NEVER flag as a spelling/typo correction
    /// (Add-to-dictionary + dismissed jargon/names).
    #[serde(default)]
    pub dictionary: HashSet<String>,
    /// LLM-taught corrections: normalized typo -> replacement, applied locally so
    /// the engine fixes what the LLM taught it on the next occurrence.
    #[serde(default)]
    pub learned: HashMap<String, String>,
    /// Dismissed (kind, word) pairs to never re-flag — persisted globally so a
    /// dismissal sticks across fields + sessions, keyed by KIND+WORD (not position),
    /// matching the extension's word-keyed ignore list.
    #[serde(default)]
    pub ignored: HashSet<String>,
}

impl UserDict {
    pub fn load() -> Self {
        let path = config_dir().join("userdict.json");
        std::fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default()
    }

    pub fn save(&self) {
        let dir = config_dir();
        let _ = std::fs::create_dir_all(&dir);
        if let Ok(json) = serde_json::to_string_pretty(self) {
            let _ = std::fs::write(dir.join("userdict.json"), json);
        }
    }

    /// True if `word` is in the user's never-flag dictionary (case-insensitive).
    pub fn is_dictionary(&self, word: &str) -> bool {
        let key = normalize_learn_key(word);
        !key.is_empty() && self.dictionary.contains(&key)
    }

    /// Add a word to the never-flag dictionary (Add-to-dictionary / dismissed FP).
    pub fn add_word(&mut self, word: &str) {
        let key = normalize_learn_key(word);
        if key.len() >= 2 && self.dictionary.insert(key) {
            self.save();
        }
    }

    /// Remember an LLM/accepted correction so the local engine applies it next time.
    /// No-op for junk (too short, empty target, or a target that normalizes to the
    /// original) or when it's already stored.
    pub fn record_learned(&mut self, original: &str, suggestion: &str) {
        let key = normalize_learn_key(original);
        let to = suggestion.trim().to_string();
        if key.len() < 2 || to.is_empty() || normalize_learn_key(&to) == key {
            return;
        }
        if self.learned.get(&key).map(String::as_str) != Some(to.as_str()) {
            self.learned.insert(key, to);
            self.save();
        }
    }

    /// Key a dismissal by KIND + normalized word so re-typing the same word with the
    /// same issue kind stays dismissed, regardless of where it lands in the text.
    fn ignore_key(original: &str, kind: &str) -> String {
        format!("{kind}\u{1}{}", normalize_learn_key(original))
    }

    /// True if (word, kind) was previously dismissed (persisted, any field/session).
    pub fn is_ignored(&self, original: &str, kind: &str) -> bool {
        !normalize_learn_key(original).is_empty()
            && self.ignored.contains(&Self::ignore_key(original, kind))
    }

    /// Persist a dismissal of (word, kind) globally so it sticks across fields/sessions.
    pub fn add_ignored(&mut self, original: &str, kind: &str) {
        if normalize_learn_key(original).is_empty() {
            return;
        }
        if self.ignored.insert(Self::ignore_key(original, kind)) {
            self.save();
        }
    }
}
