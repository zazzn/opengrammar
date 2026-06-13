// Port of extension/src/background/issuePolicy.ts (routeLlmCorrection and its helpers).
// Behaviour is byte-for-byte identical to the TypeScript originals.

const LOW_CONTEXT_SHORT_WORD_MAX: usize = 3;
const QUICKFIX_OVERLAP_MIN: f64 = 0.82;

fn high_confidence_overrides(s: &str) -> bool {
    matches!(s, "address" | "correct" | "had" | "the")
}

// Mirror of CONTRACTION_LIKE_TYPOS regex — same word list, case-insensitive.
fn is_contraction_like_typo(s: &str) -> bool {
    let lower = s.to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "dont"
            | "doesnt"
            | "didnt"
            | "isnt"
            | "arent"
            | "wasnt"
            | "werent"
            | "cant"
            | "couldnt"
            | "shouldnt"
            | "wouldnt"
            | "wont"
            | "havent"
            | "havnt"
            | "hasnt"
            | "hadnt"
            | "im"
            | "ive"
            | "id"
            | "ill"
            | "youre"
            | "youve"
            | "youll"
            | "theyre"
            | "theyve"
            | "theyll"
            | "thats"
            | "whats"
            | "lets"
    )
}

// Strip non-alphanumeric then lowercase. Mirrors TS `bare`.
fn bare(text: &str) -> String {
    text.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

// Mirrors TS `isPlainWord`: /^[A-Za-z]+(?:'[A-Za-z]+)?$/
pub fn is_plain_word(text: &str) -> bool {
    if text.is_empty() {
        return false;
    }
    let bytes = text.as_bytes();
    let mut i = 0;
    // One or more ASCII letters
    while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
        i += 1;
    }
    if i == 0 {
        return false; // no leading letters
    }
    if i == bytes.len() {
        return true; // pure letters
    }
    // Optional: apostrophe followed by one or more ASCII letters
    if bytes[i] == b'\'' {
        i += 1;
        let start = i;
        while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
            i += 1;
        }
        if i == start {
            return false; // apostrophe with nothing after
        }
        return i == bytes.len();
    }
    false // unexpected character
}

// Mirrors TS `sortedChars`: lowercase then sort.
fn sorted_chars(text: &str) -> Vec<char> {
    let mut v: Vec<char> = text.to_ascii_lowercase().chars().collect();
    v.sort_unstable();
    v
}

// Mirrors TS `longestCommonSubsequence` (LCS length, char-by-char, rolling 2-row DP).
fn longest_common_subsequence(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let m = a.len();
    let n = b.len();
    if m == 0 || n == 0 {
        return 0;
    }
    let mut prev = vec![0usize; n + 1];
    let mut cur = vec![0usize; n + 1];
    for i in 1..=m {
        for j in 1..=n {
            cur[j] = if a[i - 1] == b[j - 1] {
                prev[j - 1] + 1
            } else {
                prev[j].max(cur[j - 1])
            };
        }
        std::mem::swap(&mut prev, &mut cur);
    }
    prev[n]
}

// Mirrors TS `charOverlap`: LCS / max(len_a, len_b), applied to lowercased chars.
fn char_overlap(a: &str, b: &str) -> f64 {
    let x = a.to_ascii_lowercase();
    let y = b.to_ascii_lowercase();
    if x.is_empty() || y.is_empty() {
        return 0.0;
    }
    let lcs = longest_common_subsequence(&x, &y);
    let max_len = x.chars().count().max(y.chars().count());
    lcs as f64 / max_len as f64
}

// Mirrors TS `levenshtein` — case-sensitive on the chars as passed.
fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let m = a.len();
    let n = b.len();
    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }
    let mut prev: Vec<usize> = (0..=n).collect();
    let mut cur = vec![0usize; n + 1];
    for i in 1..=m {
        cur[0] = i;
        for j in 1..=n {
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            cur[j] = (prev[j] + 1).min(cur[j - 1] + 1).min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut cur);
    }
    prev[n]
}

// Port of TS `spellingOptions` for the desktop (no `reason` string).
// For routeLlmCorrection other_options is always &[]; kept for completeness.
pub fn spelling_options(suggestion: &str, other_options: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    let mut add = |raw: &str| {
        let option = raw.trim();
        if option.is_empty() {
            return;
        }
        let key = option.to_ascii_lowercase();
        if seen.contains(&key) {
            return;
        }
        seen.insert(key);
        out.push(option.to_string());
    };

    add(suggestion);
    for opt in other_options {
        add(opt);
    }
    out
}

// Mirrors TS `isPunctuationOrCaseOnly`.
pub fn is_punctuation_or_case_only(original: &str, suggestion: &str) -> bool {
    !suggestion.is_empty() && original != suggestion && bare(original) == bare(suggestion)
}

// Mirrors TS `isMechanicalCaseOrPunct`.
pub fn is_mechanical_case_or_punct(original: &str, suggestion: &str) -> bool {
    if suggestion.is_empty() || original == suggestion || bare(original) != bare(suggestion) {
        return false;
    }

    // No letter past index 0 in suggestion may differ from original by capitalisation.
    let letters_o: Vec<char> = original.chars().filter(|c| c.is_ascii_alphabetic()).collect();
    let letters_s: Vec<char> = suggestion.chars().filter(|c| c.is_ascii_alphabetic()).collect();
    for i in 1..letters_s.len() {
        let cs = letters_s[i];
        let co = letters_o.get(i).copied();
        if Some(cs) != co && cs.is_ascii_uppercase() {
            return false;
        }
    }

    // Non-alphanumeric deltas must be confined to apostrophe (U+0027 and U+2019) and space.
    let mut counts: std::collections::HashMap<char, i32> = std::collections::HashMap::new();
    for ch in original.chars().filter(|c| !c.is_ascii_alphanumeric()) {
        *counts.entry(ch).or_insert(0) += 1;
    }
    for ch in suggestion.chars().filter(|c| !c.is_ascii_alphanumeric()) {
        *counts.entry(ch).or_insert(0) -= 1;
    }
    for (ch, delta) in &counts {
        if *delta != 0 && *ch != '\'' && *ch != '\u{2019}' && *ch != ' ' {
            return false;
        }
    }
    true
}

// Mirrors TS `isHighConfidenceSpelling`.
// `other_options` — for LLM routing always &[].
pub fn is_high_confidence_spelling(original: &str, suggestion: &str, other_options: &[String]) -> bool {
    let original = original.trim();
    let suggestion = suggestion.trim();
    if original.is_empty() || suggestion.is_empty() || original == suggestion {
        return false;
    }
    if !is_plain_word(original) || !is_plain_word(suggestion) {
        return false;
    }
    // /^[A-Z0-9]{2,}$/ — all-caps abbreviation guard
    if original.len() >= 2
        && original
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
    {
        return false;
    }

    let orig_lower = original.to_ascii_lowercase();
    let sugg_lower = suggestion.to_ascii_lowercase();
    let distance = levenshtein(&orig_lower, &sugg_lower);

    if high_confidence_overrides(&sugg_lower)
        && original.chars().count() >= LOW_CONTEXT_SHORT_WORD_MAX
        && distance <= 2
    {
        return true;
    }

    if original.chars().count() <= LOW_CONTEXT_SHORT_WORD_MAX {
        return false;
    }

    if is_contraction_like_typo(original) && !suggestion.contains('\'') {
        return false;
    }
    if is_contraction_like_typo(original) && suggestion.contains('\'') && distance <= 1 {
        return true;
    }

    let transposition = sorted_chars(original) == sorted_chars(suggestion);

    // Build spelling option list mirroring TS spellingOptions (suggestion first, deduplicated).
    let orig_key = original.to_ascii_lowercase();
    let options: Vec<String> = {
        let mut seen = std::collections::HashSet::new();
        let mut deduped: Vec<String> = Vec::new();
        for raw in std::iter::once(suggestion.to_string()).chain(other_options.iter().cloned()) {
            let key = raw.to_ascii_lowercase();
            if key == orig_key || seen.contains(&key) {
                continue;
            }
            seen.insert(key);
            deduped.push(raw);
        }
        deduped
    };
    let option_count = options.len();

    if !transposition {
        // Capitalized token whose fix changes more than case → unknown proper noun
        let is_title_case_orig = original
            .chars()
            .next()
            .map(|c| c.is_ascii_uppercase())
            .unwrap_or(false)
            && original.chars().skip(1).all(|c| c.is_ascii_lowercase());
        if is_title_case_orig && bare(original) != bare(suggestion) {
            return false;
        }

        if char_overlap(original, suggestion) < QUICKFIX_OVERLAP_MIN {
            return false;
        }

        if option_count > 1 {
            let has_rival = options
                .iter()
                .skip(1)
                .any(|o| levenshtein(&orig_lower, &o.to_ascii_lowercase()) <= distance);
            if has_rival {
                return false;
            }
        }
    }

    let orig_len = original.chars().count();
    if transposition && orig_len >= 5 {
        return true;
    }
    if distance <= 2 && orig_len >= 5 {
        return true;
    }
    if distance <= 3 && orig_len >= 7 && option_count <= 3 {
        return true;
    }
    false
}

/// Route a single LLM-proposed correction.
/// Mirrors `routeLlmCorrection` in extension/src/background/issuePolicy.ts exactly.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum LlmRoute {
    QuickFix,
    SentenceReview,
}

pub fn route_llm_correction(original: &str, suggestion: &str) -> LlmRoute {
    let o = original.trim();
    let s = suggestion.trim();
    if s.is_empty() || s == o {
        return LlmRoute::SentenceReview;
    }
    // Case/punctuation-only change (bare forms equal): only a genuinely MECHANICAL
    // edit (sentence-initial caps, contraction apostrophes) is safe to auto-apply.
    // Decide SOLELY here — the spelling path treats same-letters-different-case
    // (websocket->WebSocket, Datadog->DataDog brand re-casing) as a transposition and
    // would wrongly auto-apply it.
    if bare(o) == bare(s) {
        return if is_mechanical_case_or_punct(o, s) {
            LlmRoute::QuickFix
        } else {
            LlmRoute::SentenceReview
        };
    }
    if is_plain_word(o) && is_plain_word(s) && is_high_confidence_spelling(o, s, &[]) {
        return LlmRoute::QuickFix;
    }
    LlmRoute::SentenceReview
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_teh_the_quickfix() {
        assert_eq!(route_llm_correction("teh", "the"), LlmRoute::QuickFix);
    }

    #[test]
    fn test_their_there_sentence_review() {
        assert_eq!(route_llm_correction("their", "there"), LlmRoute::SentenceReview);
    }

    #[test]
    fn test_halarious_hilarious_quickfix() {
        assert_eq!(route_llm_correction("halarious", "hilarious"), LlmRoute::QuickFix);
    }

    #[test]
    fn test_i_to_i_upper_quickfix() {
        assert_eq!(route_llm_correction("i", "I"), LlmRoute::QuickFix);
    }

    // "websocket"→"WebSocket" is a case-only change (bare forms equal) with an INTERNAL
    // capital — that is brand re-casing, NOT a mechanical sentence-initial cap, so it must
    // NOT silently auto-apply. The bare-equal guard in route_llm_correction (mirrored in
    // the TS routeLlmCorrection) routes it to SentenceReview. Without that guard the
    // spelling path's transposition check (same sorted chars) wrongly returned QuickFix.
    #[test]
    fn test_websocket_internal_caps_sentence_review() {
        assert_eq!(route_llm_correction("websocket", "WebSocket"), LlmRoute::SentenceReview);
    }

    #[test]
    fn test_dont_apostrophe_quickfix() {
        assert_eq!(route_llm_correction("dont", "don't"), LlmRoute::QuickFix);
    }

    #[test]
    fn test_honestly_comma_sentence_review() {
        assert_eq!(route_llm_correction("Honestly", "Honestly,"), LlmRoute::SentenceReview);
    }

    #[test]
    fn test_kubelet_sublet_sentence_review() {
        assert_eq!(route_llm_correction("kubelet", "sublet"), LlmRoute::SentenceReview);
    }

    #[test]
    fn test_is_mechanical_case_or_punct_please() {
        assert!(is_mechanical_case_or_punct("please", "Please"));
    }

    #[test]
    fn test_is_mechanical_case_or_punct_websocket() {
        assert!(!is_mechanical_case_or_punct("websocket", "WebSocket"));
    }

    #[test]
    fn test_char_overlap_their_there() {
        let overlap = char_overlap("their", "there");
        assert!((overlap - 0.80).abs() < 0.005, "expected ~0.80 got {overlap}");
    }

    #[test]
    fn test_char_overlap_kubelet_sublet() {
        let overlap = char_overlap("kubelet", "sublet");
        assert!(overlap < QUICKFIX_OVERLAP_MIN, "expected <0.82 got {overlap}");
    }
}
