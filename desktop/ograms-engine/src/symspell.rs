use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::Path;

const LETTERS: &[u8] = b"abcdefghijklmnopqrstuvwxyz'";
const MAX_SUGGESTIONS: usize = 12;

#[derive(Debug)]
pub struct SymSpell {
    frequencies: HashMap<String, u64>,
}

impl SymSpell {
    pub fn from_path(path: impl AsRef<Path>) -> io::Result<Self> {
        Self::from_dictionary_text(&fs::read_to_string(path)?)
    }

    pub fn from_dictionary_text(text: &str) -> io::Result<Self> {
        let mut frequencies = HashMap::new();
        for line in text.lines() {
            let trimmed = line.trim_start_matches('\u{feff}').trim();
            if trimmed.is_empty() {
                continue;
            }

            let mut parts = trimmed.split_whitespace();
            let Some(word) = parts.next() else {
                continue;
            };
            let Some(count) = parts.next() else {
                continue;
            };
            let Ok(count) = count.parse::<u64>() else {
                continue;
            };
            frequencies.insert(word.to_ascii_lowercase(), count);
        }
        Ok(Self { frequencies })
    }

    pub fn suggestions(&self, word: &str) -> Vec<String> {
        let normalized = word.to_ascii_lowercase();
        if self.frequencies.contains_key(&normalized) {
            return Vec::new();
        }

        let mut edits_one = HashSet::new();
        for edit in edits1(&normalized) {
            if self.frequencies.contains_key(&edit) {
                edits_one.insert(edit);
            }
        }
        if !edits_one.is_empty() {
            return self.rank(word, edits_one);
        }

        let mut edits_two = HashSet::new();
        for edit in edits1(&normalized) {
            for second_edit in edits1(&edit) {
                if self.frequencies.contains_key(&second_edit) {
                    edits_two.insert(second_edit);
                }
            }
        }
        self.rank(word, edits_two)
    }

    fn rank(&self, original: &str, mut candidates: HashSet<String>) -> Vec<String> {
        candidates.remove(&original.to_ascii_lowercase());
        let mut candidates = candidates.into_iter().collect::<Vec<_>>();
        candidates.sort_by(|a, b| {
            self.frequencies
                .get(b)
                .copied()
                .unwrap_or_default()
                .cmp(&self.frequencies.get(a).copied().unwrap_or_default())
                .then_with(|| a.cmp(b))
        });
        candidates
            .into_iter()
            .take(MAX_SUGGESTIONS)
            .map(|candidate| match_case(original, &candidate))
            .collect()
    }
}

fn edits1(word: &str) -> HashSet<String> {
    let chars = word.chars().collect::<Vec<_>>();
    let mut out = HashSet::new();

    for i in 0..=chars.len() {
        if i < chars.len() {
            let mut candidate = chars.clone();
            candidate.remove(i);
            out.insert(candidate.into_iter().collect());
        }
        if i + 1 < chars.len() {
            let mut candidate = chars.clone();
            candidate.swap(i, i + 1);
            out.insert(candidate.into_iter().collect());
        }
        if i < chars.len() {
            for letter in LETTERS {
                let mut candidate = chars.clone();
                candidate[i] = *letter as char;
                out.insert(candidate.into_iter().collect());
            }
        }
        for letter in LETTERS {
            let mut candidate = chars.clone();
            candidate.insert(i, *letter as char);
            out.insert(candidate.into_iter().collect());
        }
    }

    out
}

fn match_case(original: &str, candidate: &str) -> String {
    if original == original.to_ascii_uppercase() && original.chars().any(|ch| ch.is_ascii_uppercase()) {
        return candidate.to_ascii_uppercase();
    }

    if original
        .chars()
        .next()
        .is_some_and(|first| first.is_uppercase())
    {
        let mut chars = candidate.chars();
        let Some(first) = chars.next() else {
            return String::new();
        };
        return first.to_uppercase().chain(chars).collect();
    }

    candidate.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_frequency_ranked_candidates() {
        let spell = SymSpell::from_dictionary_text("the 100\nthen 40\nten 1\n").unwrap();
        assert_eq!(spell.suggestions("teh")[0], "the");
    }

    #[test]
    fn preserves_case() {
        let spell = SymSpell::from_dictionary_text("received 100\n").unwrap();
        assert_eq!(spell.suggestions("Recieved")[0], "Received");
    }
}
