use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use harper_core::linting::{LintGroup, Linter, Suggestion};
use harper_core::parsers::PlainEnglish;
use harper_core::spell::FstDictionary;
use harper_core::{Dialect, Document, remove_overlaps};
use serde::Serialize;

use crate::context::{NgramModel, rank_candidates, rank_spell_candidates};
use crate::protected::{overlaps_protected_span, protected_spans};
use crate::symspell::SymSpell;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DialectName {
    American,
    British,
    Canadian,
    Australian,
}

impl DialectName {
    pub fn to_harper(self) -> Dialect {
        match self {
            Self::American => Dialect::American,
            Self::British => Dialect::British,
            Self::Canadian => Dialect::Canadian,
            Self::Australian => Dialect::Australian,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SpellEngine {
    Harper,
    SymSpell,
    Combined,
}

#[derive(Clone, Debug)]
pub struct EngineOptions {
    pub dialect: DialectName,
    pub spell_engine: SpellEngine,
    pub dictionary_path: Option<PathBuf>,
    pub context_model_path: Option<PathBuf>,
    pub protect: bool,
}

impl Default for EngineOptions {
    fn default() -> Self {
        Self {
            dialect: DialectName::American,
            spell_engine: SpellEngine::Harper,
            dictionary_path: None,
            context_model_path: None,
            protect: true,
        }
    }
}

#[derive(Clone, Debug, Serialize, Eq, PartialEq)]
pub struct Issue {
    pub start: usize,
    pub end: usize,
    pub utf16_start: usize,
    pub utf16_end: usize,
    pub original: String,
    pub suggestions: Vec<String>,
    pub lint_kind: String,
    pub message: String,
}

pub fn check_text(text: &str, dialect: DialectName) -> Vec<Issue> {
    check_text_with_options(
        text,
        &EngineOptions {
            dialect,
            ..EngineOptions::default()
        },
    )
}

pub fn lint(text: &str, opts: &EngineOptions) -> Vec<Issue> {
    check_text_with_options(text, opts)
}

pub fn apply_safe_corrections(text: &str, issues: &[Issue]) -> String {
    let mut edits = issues
        .iter()
        .filter_map(safe_auto_fix)
        .collect::<Vec<_>>();
    edits.sort_by(|left, right| {
        right
            .start
            .cmp(&left.start)
            .then_with(|| right.end.cmp(&left.end))
    });

    let char_to_byte = build_char_to_byte(text);
    let mut corrected = text.to_string();
    for edit in edits {
        let Some(&byte_start) = char_to_byte.get(edit.start) else {
            continue;
        };
        let Some(&byte_end) = char_to_byte.get(edit.end) else {
            continue;
        };
        if byte_start <= byte_end && byte_end <= corrected.len() {
            corrected.replace_range(byte_start..byte_end, edit.replacement);
        }
    }
    corrected
}

pub fn count_safe_corrections(issues: &[Issue]) -> usize {
    issues.iter().filter(|issue| safe_auto_fix(issue).is_some()).count()
}

/// Cache the loaded SymSpell dictionary by path so the 82k-word frequency list
/// is parsed ONCE, not on every lint — `check_text_with_options` runs on the
/// inline, per-keystroke path. Mirrors the extension's module-level freq cache.
fn cached_symspell(path: &Path) -> Option<Arc<SymSpell>> {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, Option<Arc<SymSpell>>>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(entry) = guard.get(path) {
        return entry.clone();
    }
    let loaded = SymSpell::from_path(path).ok().map(Arc::new);
    guard.insert(path.to_path_buf(), loaded.clone());
    loaded
}

/// Same one-time caching for the OGN1 n-gram context model.
fn cached_ngram(path: &Path) -> Option<Arc<NgramModel>> {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, Option<Arc<NgramModel>>>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(entry) = guard.get(path) {
        return entry.clone();
    }
    let loaded = NgramModel::from_path(path).ok().map(Arc::new);
    guard.insert(path.to_path_buf(), loaded.clone());
    loaded
}

pub fn check_text_with_options(text: &str, options: &EngineOptions) -> Vec<Issue> {
    if text.trim().is_empty() {
        return Vec::new();
    }

    let symspell = match options.spell_engine {
        SpellEngine::Harper => None,
        SpellEngine::SymSpell | SpellEngine::Combined => {
            options.dictionary_path.as_deref().and_then(cached_symspell)
        }
    };
    let context_model = options
        .context_model_path
        .as_deref()
        .and_then(cached_ngram);

    let parser = PlainEnglish;
    let document = Document::new_curated(text, &parser);
    let dict = FstDictionary::curated();
    let mut linter = LintGroup::new_curated(dict, options.dialect.to_harper());
    configure_like_extension(&mut linter);

    let source: Vec<char> = text.chars().collect();
    let cp_to_utf16 = build_cp_to_utf16(text);
    let protected = if options.protect {
        protected_spans(text)
    } else {
        Vec::new()
    };
    let mut lints = linter.lint(&document);
    remove_overlaps(&mut lints);

    let mut issues = lints
        .into_iter()
        .filter_map(|lint| {
            if lint.suggestions.is_empty() {
                return None;
            }

            let start = lint.span.start;
            let end = lint.span.end;
            if end <= start || end > source.len() {
                return None;
            }
            if overlaps_protected_span(start, end, &protected) {
                return None;
            }

            let original = source[start..end].iter().collect::<String>();
            let lint_kind = lint.lint_kind.to_string();
            let is_spelling = is_spelling_lint(&lint_kind);
            let mut suggestions = lint
                .suggestions
                .iter()
                .map(|suggestion| suggestion_text(suggestion, &original))
                .filter(|suggestion| suggestion != &original)
                .collect::<Vec<_>>();

            let mut message = lint.message;
            apply_common_spelling_overrides(&original, &mut suggestions, &mut message);
            dedup_preserving_order(&mut suggestions);
            blend_spell_suggestions(
                text,
                start,
                end,
                &original,
                is_spelling,
                options.spell_engine,
                symspell.as_deref(),
                context_model.as_deref(),
                &mut suggestions,
                &mut message,
            );
            dedup_preserving_order(&mut suggestions);
            if suggestions.is_empty() {
                return None;
            }

            Some(Issue {
                start,
                end,
                utf16_start: cp_to_utf16(start),
                utf16_end: cp_to_utf16(end),
                original,
                suggestions,
                lint_kind,
                message,
            })
        })
        .collect::<Vec<_>>();

    // Capitalize the start of sentences Harper MISSES. Harper only flags the first
    // sentence (+ the pronoun "i"); 2nd+ sentences after `. ! ?` go unflagged. Emit
    // those as mechanical single-letter "Capitalization" fixes so the autocorrect pass
    // (safe_auto_fix) applies them. Skip a boundary overlapping an existing issue (so
    // Harper's first-sentence flag isn't duplicated) or a protected span.
    for (idx, upper) in sentence_cap_positions(&source) {
        let end = idx + 1;
        if issues.iter().any(|i| idx < i.end && i.start < end) {
            continue;
        }
        if overlaps_protected_span(idx, end, &protected) {
            continue;
        }
        issues.push(Issue {
            start: idx,
            end,
            utf16_start: cp_to_utf16(idx),
            utf16_end: cp_to_utf16(end),
            original: source[idx].to_string(),
            suggestions: vec![upper.to_string()],
            lint_kind: "Capitalization".to_string(),
            message: "This sentence does not start with a capital letter.".to_string(),
        });
    }
    issues
}

#[derive(Clone, Copy, Debug)]
struct SafeEdit<'a> {
    start: usize,
    end: usize,
    replacement: &'a str,
}

fn safe_auto_fix(issue: &Issue) -> Option<SafeEdit<'_>> {
    if !is_safe_spelling_or_typo_lint(&issue.lint_kind) || issue.suggestions.len() != 1 {
        return None;
    }

    let replacement = issue.suggestions.first()?;
    if replacement.is_empty() || replacement.contains('\n') || replacement == &issue.original {
        return None;
    }

    Some(SafeEdit {
        start: issue.start,
        end: issue.end,
        replacement,
    })
}

fn is_safe_spelling_or_typo_lint(lint_kind: &str) -> bool {
    let lint_kind = lint_kind.to_ascii_lowercase();
    lint_kind.contains("spell") || lint_kind.contains("typo")
}

/// Lowercase abbreviations after which the next word should NOT be capitalized
/// (mid-sentence connectors). Titles like Dr./Mr. are intentionally absent — the
/// word after them is usually a name that SHOULD be capitalized.
const SENTENCE_CAP_SKIP: &[&str] = &["etc", "vs", "al", "ie", "eg"];

/// Indices into `source` of sentence-initial LOWERCASE letters that should be
/// capitalized: the first letter of the text, and the first letter after a `. ! ?`
/// followed by whitespace. Returns (index, uppercase_char). Conservative: a boundary
/// whose preceding token is a single letter (initials / e.g / i.e / U.S) or a known
/// mid-sentence abbreviation is skipped, and `3.14` never triggers (no space after dot).
fn sentence_cap_positions(source: &[char]) -> Vec<(usize, char)> {
    let n = source.len();
    let mut out = Vec::new();
    let mut at_sentence_start = true;
    let mut idx = 0;
    while idx < n {
        let c = source[idx];
        if at_sentence_start && !c.is_whitespace() {
            if c.is_ascii_lowercase() && !preceded_by_non_boundary(source, idx) {
                out.push((idx, c.to_ascii_uppercase()));
            }
            at_sentence_start = false;
        }
        if matches!(c, '.' | '!' | '?') && idx + 1 < n && source[idx + 1].is_whitespace() {
            at_sentence_start = true;
        }
        idx += 1;
    }
    out
}

/// True if the boundary before `start` is an abbreviation / initial, not a real
/// sentence end — so the following word must NOT be capitalized.
fn preceded_by_non_boundary(source: &[char], start: usize) -> bool {
    let mut j = start;
    while j > 0 && source[j - 1].is_whitespace() {
        j -= 1;
    }
    if j == 0 {
        return false; // start of text — a genuine sentence start
    }
    while j > 0 && matches!(source[j - 1], '.' | '!' | '?') {
        j -= 1;
    }
    let mut word = Vec::new();
    let mut k = j;
    while k > 0 && source[k - 1].is_ascii_alphabetic() {
        word.push(source[k - 1].to_ascii_lowercase());
        k -= 1;
    }
    if word.len() <= 1 {
        return true; // single letter: initial (J.) or e.g / i.e / U.S style
    }
    word.reverse();
    let w: String = word.into_iter().collect();
    SENTENCE_CAP_SKIP.contains(&w.as_str())
}

fn blend_spell_suggestions(
    text: &str,
    start: usize,
    end: usize,
    original: &str,
    is_spelling: bool,
    spell_engine: SpellEngine,
    symspell: Option<&SymSpell>,
    context_model: Option<&NgramModel>,
    suggestions: &mut Vec<String>,
    message: &mut String,
) {
    if !is_spelling {
        return;
    }

    match spell_engine {
        SpellEngine::Harper => {
            *suggestions = rank_candidates(context_model, text, start, end, original, suggestions);
        }
        SpellEngine::SymSpell => {
            let Some(symspell) = symspell else {
                *suggestions = rank_candidates(context_model, text, start, end, original, suggestions);
                return;
            };
            let symspell_suggestions = symspell.suggestions(original);
            if symspell_suggestions.is_empty() {
                *suggestions = rank_candidates(context_model, text, start, end, original, suggestions);
                return;
            }
            *suggestions =
                rank_spell_candidates(context_model, text, start, end, original, &symspell_suggestions);
            if let Some(first) = suggestions.first() {
                *message = format!("Did you mean to spell `{original}` as `{first}`?");
            }
        }
        SpellEngine::Combined => {
            // Mirror the EXTENSION orchestration (harperEngine.ts + parity-harness.mjs):
            // the branch is keyed on SymSpell, NOT Harper. When SymSpell yields candidates,
            // rank a SymSpell-FIRST pool (Harper's extras appended) with rank_spell_candidates;
            // only when SymSpell is empty do we fall back to ranking Harper's own pool with
            // rank_candidates. This is what demotes Harper's word-split #1 ("clas"->"cl as"):
            // the old Harper-first + rank_candidates path bailed via the model-contains guard
            // (a space-joined "cl as" is never a unigram) and kept the split pinned at the top.
            let Some(symspell) = symspell else {
                *suggestions = rank_candidates(context_model, text, start, end, original, suggestions);
                return;
            };
            let symspell_suggestions = symspell.suggestions(original);
            if symspell_suggestions.is_empty() {
                *suggestions = rank_candidates(context_model, text, start, end, original, suggestions);
                return;
            }
            let mut pool = symspell_suggestions;
            for candidate in suggestions.iter() {
                if candidate.is_empty() || candidate.eq_ignore_ascii_case(original) {
                    continue;
                }
                if !pool.iter().any(|seen| seen.eq_ignore_ascii_case(candidate)) {
                    pool.push(candidate.clone());
                }
            }
            *suggestions = rank_spell_candidates(context_model, text, start, end, original, &pool);
            if let Some(first) = suggestions.first() {
                *message = format!("Did you mean to spell `{original}` as `{first}`?");
            }
        }
    }
}

fn is_spelling_lint(lint_kind: &str) -> bool {
    let lint_kind = lint_kind.to_ascii_lowercase();
    lint_kind.contains("spell")
        || lint_kind.contains("typo")
        || lint_kind.contains("eggcorn")
        || lint_kind.contains("malapropism")
}

fn configure_like_extension(linter: &mut LintGroup) {
    // Mirrors opengrammar/extension/src/background/harperEngine.ts.
    for (name, enabled) in [
        ("FillerWords", true),
        ("RepeatedWords", true),
        ("DiscourseMarkers", true),
        ("Readability", false),
        ("LongSentences", false),
        ("BoringWords", false),
    ] {
        linter.config.set_rule_enabled(name, enabled);
    }
}

fn suggestion_text(suggestion: &Suggestion, original: &str) -> String {
    match suggestion {
        Suggestion::ReplaceWith(chars) => chars.iter().collect(),
        Suggestion::InsertAfter(chars) => {
            let mut out = String::from(original);
            out.extend(chars.iter());
            out
        }
        Suggestion::Remove => String::new(),
    }
}

fn apply_common_spelling_overrides(
    original: &str,
    suggestions: &mut Vec<String>,
    message: &mut String,
) {
    let Some(replacement) = common_spelling_override(original) else {
        return;
    };

    if !suggestions
        .iter()
        .any(|suggestion| suggestion.eq_ignore_ascii_case(&replacement))
    {
        if let Some(first) = suggestions.first_mut() {
            *first = replacement.clone();
        } else {
            suggestions.push(replacement.clone());
        }
        *message = format!("Did you mean to spell `{original}` as `{replacement}`?");
    }
}

fn dedup_preserving_order(values: &mut Vec<String>) {
    let mut deduped = Vec::with_capacity(values.len());
    for value in values.drain(..) {
        if !deduped.iter().any(|seen| seen == &value) {
            deduped.push(value);
        }
    }
    *values = deduped;
}

fn common_spelling_override(original: &str) -> Option<String> {
    let replacement = match original.to_ascii_lowercase().as_str() {
        "adress" => "address",
        "corect" => "correct",
        "hadd" => "had",
        "teh" => "the",
        _ => return None,
    };

    if original.to_uppercase() == original {
        return Some(replacement.to_uppercase());
    }

    if original
        .chars()
        .next()
        .is_some_and(|first| first.is_uppercase())
    {
        let mut chars = replacement.chars();
        let Some(first) = chars.next() else {
            return Some(String::new());
        };
        return Some(first.to_uppercase().chain(chars).collect());
    }

    Some(replacement.to_string())
}

fn build_cp_to_utf16(text: &str) -> impl Fn(usize) -> usize {
    let mut map = Vec::new();
    let mut utf16 = 0;
    for ch in text.chars() {
        map.push(utf16);
        utf16 += ch.len_utf16();
    }
    map.push(utf16);
    let end = utf16;

    move |cp: usize| {
        if cp >= map.len() {
            end
        } else {
            map[cp]
        }
    }
}

fn build_char_to_byte(text: &str) -> Vec<usize> {
    let mut offsets = text.char_indices().map(|(offset, _)| offset).collect::<Vec<_>>();
    offsets.push(text.len());
    offsets
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_sample_misspellings() {
        let issues = check_text(
            "I recieve teh package definately tomorow.",
            DialectName::American,
        );
        let originals = issues.iter().map(|issue| issue.original.as_str()).collect::<Vec<_>>();

        assert!(originals.contains(&"recieve"), "{issues:#?}");
        assert!(originals.contains(&"teh"), "{issues:#?}");
        assert!(originals.contains(&"definately"), "{issues:#?}");
        assert!(originals.contains(&"tomorow"), "{issues:#?}");
    }

    #[test]
    fn quiet_on_clean_sentences() {
        for text in [
            "I received the package yesterday.",
            "The project is ready for review.",
            "Please send the report when you have time.",
        ] {
            let issues = check_text(text, DialectName::American);
            assert!(issues.is_empty(), "{text}: {issues:#?}");
        }
    }

    #[test]
    fn reports_utf16_offsets_for_astral_text() {
        let issues = check_text("🙂 teh", DialectName::American);
        let issue = issues
            .iter()
            .find(|issue| issue.original == "teh")
            .expect("teh should be linted");

        assert_eq!(issue.start, 2);
        assert_eq!(issue.end, 5);
        assert_eq!(issue.utf16_start, 3);
        assert_eq!(issue.utf16_end, 6);
    }

    #[test]
    fn suppresses_protected_text_false_positives() {
        for text in [
            "periodt",
            "finna",
            "Open https://example.com/getAdress now.",
            "The file is /tmp/src/app.json.",
            "Use sk-abc1234567890abcdef for the fixture.",
            "sudo systemctl restart ollama",
            "Call getAdress before rendering.",
        ] {
            let issues = check_text(text, DialectName::American);
            assert!(issues.is_empty(), "{text}: {issues:#?}");
        }
    }

    #[test]
    fn still_flags_plain_prose_misspellings() {
        let issues = check_text("Please fix teh adress in this sentence.", DialectName::American);
        let originals = issues
            .iter()
            .map(|issue| issue.original.as_str())
            .collect::<Vec<_>>();

        assert!(originals.contains(&"teh"), "{issues:#?}");
        assert!(originals.contains(&"adress"), "{issues:#?}");
    }

    #[test]
    fn applies_only_single_suggestion_spelling_and_typo_fixes() {
        let text = "Fix teh sentence.";
        let issues = vec![
            Issue {
                start: 4,
                end: 7,
                utf16_start: 4,
                utf16_end: 7,
                original: "teh".to_string(),
                suggestions: vec!["the".to_string()],
                lint_kind: "MisspelledWord".to_string(),
                message: String::new(),
            },
            Issue {
                start: 8,
                end: 16,
                utf16_start: 8,
                utf16_end: 16,
                original: "sentence".to_string(),
                suggestions: vec!["sentences".to_string()],
                lint_kind: "Grammar".to_string(),
                message: String::new(),
            },
        ];

        assert_eq!(apply_safe_corrections(text, &issues), "Fix the sentence.");
    }
}
