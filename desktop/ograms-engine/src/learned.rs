// Port of extension/src/shared/learnedCorrections.ts.
// Behaviour is byte-for-byte identical to the TypeScript originals.

use std::collections::HashMap;
use regex::Regex;

/// A learned-correction match: char offsets into the source text.
pub struct LearnedHit {
    pub original: String,
    pub suggestion: String,
    pub start: usize,
    pub end: usize,
}

/// Mirrors TS `normalizeLearnKey`: ASCII-lowercase then strip everything except [a-z'].
pub fn normalize_learn_key(word: &str) -> String {
    word.to_ascii_lowercase()
        .chars()
        .filter(|&c| c.is_ascii_lowercase() || c == '\'')
        .collect()
}

/// Mirrors TS `matchLeadingCase`.
/// If the surface word's first character is an uppercase letter, capitalise target[0].
fn match_leading_case(surface: &str, target: &str) -> String {
    let c = surface.chars().next();
    if let Some(c) = c {
        if c.is_uppercase() && !c.is_lowercase() {
            // c is a cased uppercase letter
            if let Some(t0) = target.chars().next() {
                let mut result = t0.to_uppercase().to_string();
                let rest: String = target.chars().skip(1).collect();
                result.push_str(&rest);
                return result;
            }
        }
    }
    target.to_string()
}

/// Mirrors TS `findLearnedCorrections`.
/// Tokenizes `text` with the same regex as the TS (`[A-Za-z][A-Za-z''-]*`), normalizes
/// each token, looks it up in `learned`, and emits a `LearnedHit` when the case-matched
/// target differs from the surface form.
/// Offsets are char-based (matching TS `m.index` which is also char-based in JS strings).
pub fn find_learned_corrections(
    text: &str,
    learned: &HashMap<String, String>,
) -> Vec<LearnedHit> {
    if learned.is_empty() {
        return vec![];
    }

    // The TS regex: /[A-Za-z][A-Za-z''-]*/g
    // U+2019 RIGHT SINGLE QUOTATION MARK is included in the character class in TS;
    // here we include both U+0027 (apostrophe) and U+2019 (right single quote).
    let re = Regex::new(r"[A-Za-z][A-Za-z'\u{2019}-]*").expect("word regex is valid");

    let mut out = Vec::new();

    // Iterate over char indices so that `start` and `end` are char offsets, not byte offsets,
    // matching the JS `m.index` semantics.
    let chars: Vec<char> = text.chars().collect();
    let char_count = chars.len();

    // We need to match on the text string but record char offsets.
    // Build a byte→char offset map.
    let byte_to_char: Vec<usize> = {
        let mut map = vec![0usize; text.len() + 1];
        for (char_idx, (byte_idx, _)) in text.char_indices().enumerate() {
            map[byte_idx] = char_idx;
        }
        // Fill trailing entry
        map[text.len()] = char_count;
        map
    };

    for m in re.find_iter(text) {
        let surface = m.as_str();
        let key = normalize_learn_key(surface);
        let Some(raw) = learned.get(&key) else {
            continue;
        };
        let target = match_leading_case(surface, raw);
        if target == surface {
            continue;
        }
        let start_char = byte_to_char[m.start()];
        let end_char = start_char + surface.chars().count();
        out.push(LearnedHit {
            original: surface.to_string(),
            suggestion: target,
            start: start_char,
            end: end_char,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_learn_key_strips_punct_and_lowercases() {
        assert_eq!(normalize_learn_key("Recieved!"), "recieved");
    }

    #[test]
    fn test_normalize_learn_key_keeps_apostrophe() {
        assert_eq!(normalize_learn_key("don't"), "don't");
    }

    #[test]
    fn test_find_learned_corrections_basic() {
        let mut learned = HashMap::new();
        learned.insert("recieved".to_string(), "received".to_string());

        let hits = find_learned_corrections("I was Recieved today", &learned);
        assert_eq!(hits.len(), 1);
        let h = &hits[0];
        assert_eq!(h.original, "Recieved");
        assert_eq!(h.suggestion, "Received"); // leading-case preserved
        // "I was Recieved today"
        //  0123456789...
        // char offsets: I=0, ' '=1, w=2, a=3, s=4, ' '=5, R=6 → start=6, end=14
        assert_eq!(h.start, 6, "start char offset");
        assert_eq!(h.end, 14, "end char offset");
    }

    #[test]
    fn test_find_learned_corrections_no_hit_when_already_correct() {
        let mut learned = HashMap::new();
        learned.insert("received".to_string(), "received".to_string());

        // If surface == target after case matching, no hit emitted
        let hits = find_learned_corrections("I received it", &learned);
        assert_eq!(hits.len(), 0);
    }

    #[test]
    fn test_find_learned_corrections_empty_map() {
        let learned = HashMap::new();
        let hits = find_learned_corrections("hello world", &learned);
        assert_eq!(hits.len(), 0);
    }

    #[test]
    fn test_match_leading_case_uppercase_surface() {
        // surface starts uppercase → capitalize first char of target
        assert_eq!(match_leading_case("Hello", "world"), "World");
    }

    #[test]
    fn test_match_leading_case_lowercase_surface() {
        assert_eq!(match_leading_case("hello", "world"), "world");
    }
}
