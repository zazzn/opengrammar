//! Opt-in autocorrect: auto-apply only HIGH-CONFIDENCE fixes as the user types,
//! with iOS-style "revert learning" — if the user undoes an auto-fix, that exact
//! token is never auto-corrected again (it stays underlined, like iOS dropping
//! the blue auto-replace underline but keeping the red spell-check one).
//!
//! Design distilled from how iOS autocorrect actually works:
//!  * Only a safe subset auto-applies (capitalization, small single-word typos);
//!    grammar/style/word-choice and multi-candidate fixes only ever underline.
//!  * Commit happens at a word boundary — never rewrite the word under the caret.
//!  * Rejections are learned per-token and persisted (the local keyboard
//!    dictionary analogue); a "Reset learned words" action clears them.

use std::collections::HashSet;
use std::fs;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use crate::config::config_dir;

/// How long after we auto-apply a fix a reappearance of the original counts as a
/// deliberate revert (vs. the user simply typing the same typo again much later).
const REVERT_WINDOW: Duration = Duration::from_secs(25);

/// A fix we just auto-applied, kept briefly so we can recognise a user revert.
/// We remember the EXACT field text from before the fix: an undo restores that
/// precise text, whereas merely typing the same typo again produces different
/// surrounding text — so this never misfires on a repeated typo.
#[derive(Clone, Debug)]
pub struct AppliedFix {
    pub pre_text: String,
    pub original: String,
    pub replacement: String,
    pub at: Instant,
}

/// Persistent, per-user ledger of corrections the user reverted. Keyed by the
/// exact `original\u{1}replacement` pair so reverting "teh→the" doesn't disable a
/// different legitimate correction of the same token. Mirrors iOS's local,
/// non-synced learned dictionary.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct RejectionLedger {
    rejected: HashSet<String>,
}

fn key(original: &str, replacement: &str) -> String {
    format!("{original}\u{1}{replacement}")
}

impl RejectionLedger {
    pub fn load() -> Self {
        let path = config_dir().join("autocorrect_exceptions.json");
        let Ok(bytes) = fs::read(&path) else {
            return Self::default();
        };
        let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&bytes);
        serde_json::from_slice(bytes).unwrap_or_default()
    }

    pub fn save(&self) {
        let dir = config_dir();
        if fs::create_dir_all(&dir).is_err() {
            return;
        }
        if let Ok(json) = serde_json::to_string_pretty(self) {
            let _ = fs::write(dir.join("autocorrect_exceptions.json"), json);
        }
    }

    pub fn is_suppressed(&self, original: &str, replacement: &str) -> bool {
        self.rejected.contains(&key(original, replacement))
    }

    /// Record a reverted correction and persist immediately. Returns true if it
    /// was newly added.
    pub fn suppress(&mut self, original: &str, replacement: &str) -> bool {
        let added = self.rejected.insert(key(original, replacement));
        if added {
            self.save();
        }
        added
    }

    pub fn clear(&mut self) {
        self.rejected.clear();
        self.save();
    }
}

/// Levenshtein edit distance, capped — used to keep auto-applied spelling fixes
/// to near neighbours of what was typed (a real typo, not a wild guess).
fn edit_distance(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    let mut cur = vec![0usize; b.len() + 1];
    for (i, ca) in a.iter().enumerate() {
        cur[0] = i + 1;
        for (j, cb) in b.iter().enumerate() {
            let cost = if ca == cb { 0 } else { 1 };
            cur[j + 1] = (prev[j] + cost).min(prev[j + 1] + 1).min(cur[j] + 1);
        }
        std::mem::swap(&mut prev, &mut cur);
    }
    prev[b.len()]
}

/// A token whose casing looks intentional (ALL-CAPS acronym, internal capital
/// like "iMac", or containing digits) — never spell-autocorrect these.
fn looks_intentional(token: &str) -> bool {
    let chars: Vec<char> = token.chars().collect();
    if chars.iter().any(|c| c.is_ascii_digit()) {
        return true;
    }
    let has_upper = chars.iter().any(|c| c.is_uppercase());
    let all_caps = has_upper && !chars.iter().any(|c| c.is_lowercase());
    let internal_caps = chars.iter().skip(1).any(|c| c.is_uppercase());
    all_caps || internal_caps
}

/// True if `suggestion` introduces an uppercase letter PAST the first character
/// that `original` lacks — i.e. brand / proper-noun re-casing (Datadog→DataDog,
/// websocket→WebSocket, iphone→iPhone). Harper's capitalization lint can't be
/// trusted for these (it "corrects" already-correct brand names), so we never
/// auto-apply them; a plain sentence-initial capital (i→I, please→Please) is fine.
/// Mirrors the extension's `isMechanicalCaseOrPunct` guard in `issuePolicy.ts`.
fn adds_internal_capital(original: &str, suggestion: &str) -> bool {
    let o: Vec<char> = original.chars().collect();
    suggestion
        .chars()
        .enumerate()
        .skip(1)
        .any(|(i, cs)| cs.is_uppercase() && o.get(i).is_none_or(|&co| co != cs))
}

/// Should this Harper issue be AUTO-APPLIED (vs. only underlined)? Conservative:
/// capitalization fixes, and single-word spelling/typo fixes that are a small
/// edit from the original. Everything else stays click-to-fix.
pub fn is_auto_applicable(kind: &str, original: &str, suggestion: &str) -> bool {
    let suggestion = suggestion.trim();
    if suggestion.is_empty() || suggestion == original {
        return false;
    }
    match kind {
        // i→I and sentence-initial capitalization: high confidence — but NOT brand
        // re-casing (Datadog→DataDog, websocket→WebSocket), which Harper gets wrong
        // and would corrupt correct text. Matches the extension's issuePolicy guard.
        "Capitalization" => !adds_internal_capital(original, suggestion),
        // Spelling/typo: single word, small edit, not an intentional-case token.
        "Spelling" | "Typo" => {
            original.chars().count() >= 3
                && !original.contains(char::is_whitespace)
                && !suggestion.contains(char::is_whitespace)
                && !looks_intentional(original)
                && edit_distance(original, suggestion) <= 2
        }
        // Grammar, style, punctuation, word-form, anything multi-word: never.
        _ => false,
    }
}

/// Prune stale entries, then return the (original, replacement) pairs whose
/// pre-fix snapshot exactly equals `current_text` — i.e. the user undid that
/// autofix (the field is back to exactly how it was before we changed it).
/// Matching entries are consumed so a fix is only "learned" once.
pub fn take_reverted(
    recent: &mut Vec<AppliedFix>,
    current_text: &str,
    now: Instant,
) -> Vec<(String, String)> {
    recent.retain(|f| now.duration_since(f.at) <= REVERT_WINDOW);
    let mut reverted = Vec::new();
    recent.retain(|f| {
        if f.pre_text == current_text {
            reverted.push((f.original.clone(), f.replacement.clone()));
            false
        } else {
            true
        }
    });
    reverted
}

/// Remember a fix we just auto-applied (for later revert detection). `pre_text`
/// is the full field text BEFORE the fix.
pub fn record_applied(
    recent: &mut Vec<AppliedFix>,
    pre_text: &str,
    original: &str,
    suggestion: &str,
    now: Instant,
) {
    recent.push(AppliedFix {
        pre_text: pre_text.to_string(),
        original: original.to_string(),
        replacement: suggestion.to_string(),
        at: now,
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capitalization_and_small_typos_auto_apply() {
        assert!(is_auto_applicable("Capitalization", "i", "I"));
        assert!(is_auto_applicable("Capitalization", "please", "Please"));
        assert!(is_auto_applicable("Typo", "teh", "the"));
        assert!(is_auto_applicable("Spelling", "becuase", "because"));
        assert!(is_auto_applicable("Spelling", "definately", "definitely"));
    }

    #[test]
    fn risky_or_ambiguous_fixes_do_not_auto_apply() {
        // Grammar/style never auto-apply.
        assert!(!is_auto_applicable("Grammar", "their", "they're"));
        assert!(!is_auto_applicable("Style", "very good", "excellent"));
        // Intentional case (acronym / brand) left alone.
        assert!(!is_auto_applicable("Spelling", "NASA", "nasa"));
        assert!(!is_auto_applicable("Spelling", "iMac", "imac"));
        // Brand re-casing is not auto-applied (Harper mis-capitalizes correct names).
        assert!(!is_auto_applicable("Capitalization", "Datadog", "DataDog"));
        assert!(!is_auto_applicable("Capitalization", "iphone", "iPhone"));
        // Big edits aren't "high confidence".
        assert!(!is_auto_applicable("Spelling", "wat", "watermelon"));
        // No-op / empty.
        assert!(!is_auto_applicable("Typo", "the", "the"));
        assert!(!is_auto_applicable("Typo", "the", ""));
    }

    #[test]
    fn revert_is_detected_by_exact_text() {
        let now = Instant::now();
        let mut recent = Vec::new();
        // We fixed "teh " -> "the " (the pre-fix text was "teh ").
        record_applied(&mut recent, "teh ", "teh", "the", now);
        // Typing the same typo again later yields different text -> NOT a revert
        // (this is the over-suppression bug the exact-text match prevents).
        assert!(take_reverted(&mut recent, "the teh ", now).is_empty());
        // An undo restores the exact pre-fix text -> revert detected + consumed.
        let reverted = take_reverted(&mut recent, "teh ", now);
        assert_eq!(reverted, vec![("teh".to_string(), "the".to_string())]);
        assert!(take_reverted(&mut recent, "teh ", now).is_empty());
    }

    #[test]
    fn ledger_suppresses_exact_pair() {
        let mut ledger = RejectionLedger::default();
        assert!(!ledger.is_suppressed("teh", "the"));
        ledger.rejected.insert(key("teh", "the"));
        assert!(ledger.is_suppressed("teh", "the"));
        // A different replacement of the same token is independent.
        assert!(!ledger.is_suppressed("teh", "tech"));
    }
}
