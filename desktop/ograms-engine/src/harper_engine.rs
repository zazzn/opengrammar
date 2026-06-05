use std::path::PathBuf;

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

pub fn check_text_with_options(text: &str, options: &EngineOptions) -> Vec<Issue> {
    if text.trim().is_empty() {
        return Vec::new();
    }

    let symspell = match options.spell_engine {
        SpellEngine::Harper => None,
        SpellEngine::SymSpell | SpellEngine::Combined => options
            .dictionary_path
            .as_ref()
            .and_then(|path| SymSpell::from_path(path).ok()),
    };
    let context_model = options
        .context_model_path
        .as_ref()
        .and_then(|path| NgramModel::from_path(path).ok());

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

    lints
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
                symspell.as_ref(),
                context_model.as_ref(),
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
        .collect()
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
            let Some(symspell) = symspell else {
                *suggestions = rank_candidates(context_model, text, start, end, original, suggestions);
                return;
            };
            let symspell_suggestions = symspell.suggestions(original);
            if symspell_suggestions.is_empty() {
                *suggestions = rank_candidates(context_model, text, start, end, original, suggestions);
                return;
            }

            if suggestions.is_empty() {
                *suggestions =
                    rank_spell_candidates(context_model, text, start, end, original, &symspell_suggestions);
                if let Some(first) = suggestions.first() {
                    *message = format!("Did you mean to spell `{original}` as `{first}`?");
                }
                return;
            }

            let mut blended = suggestions.clone();
            for candidate in symspell_suggestions {
                if !blended
                    .iter()
                    .any(|seen| seen.eq_ignore_ascii_case(&candidate))
                {
                    blended.push(candidate);
                }
            }
            *suggestions = rank_candidates(context_model, text, start, end, original, &blended);
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
