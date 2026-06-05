//! Proactive LLM ("context checking" / sentence-review) tier — a faithful Rust
//! port of the OGrammar extension's LLM pipeline (background/index.ts +
//! content/index.ts `buildLlmIssues`). Same OpenAI-compatible request, same
//! verbatim prompt, same `normalizeCorrectionResult` / `applySafeCorrections` /
//! `correctionsFromDiff` / `buildLlmIssues` logic, same protected-span filtering.
//! This is what brings the desktop to parity with the extension's LLM layer.
//!
//! Offset model: we work in CHAR offsets (matching the engine's existing
//! codepoint offsets and `protected::protected_spans`), and convert to UTF-16 at
//! the boundary (`LlmIssue::utf16_*`) because the overlay's UIA TextPattern math
//! is in UTF-16 code units. For BMP/prose text (the overwhelming common case)
//! char == UTF-16, matching the extension's JS string semantics.

use serde::Serialize;
use serde_json::Value;

use crate::protected::protected_spans;

/// Default network timeout for one completion (mirrors the extension's 180s).
pub const DEFAULT_TIMEOUT_MS: u64 = 180_000;

/// Verbatim system prompt, ported 1:1 from background/index.ts (the proactive
/// `correctText` path). Do not reword — output quality is calibrated to it.
pub const SYSTEM_PROMPT: &str = "You are a precise proofreading engine. Fix only real, objective mistakes: spelling, grammar, punctuation, capitalization, and word-form errors. Do NOT rewrite for style, tone, or clarity, and do NOT change casual wording or slang. Leave every item in protectedFragments EXACTLY as written — technical terms, part numbers, model names, URLs, file paths, code, IDs, version strings, @handles, and placeholders like [[OG_PROTECTED_1]] must never change. Return JSON ONLY with this shape: {\"correctedText\":string,\"shouldShow\":boolean,\"protectedSpansPreserved\":boolean,\"corrections\":[{\"original\":string,\"replacement\":string,\"start\":number,\"end\":number,\"type\":\"spelling|grammar|punctuation|capitalization|word-form\",\"confidence\":\"high|medium|low\"}]}. The \"corrections\" array lists each individual fix — give the EXACT original substring, its replacement, and the character start/end offsets of that substring in the input text; return an empty array if there are no real mistakes. Set correctedText to the fully corrected text.";

/// Resolved OpenAI-compatible endpoint + credentials for one provider.
#[derive(Clone, Debug)]
pub struct LlmConfig {
    /// e.g. `https://api.deepseek.com/v1` (no trailing `/chat/completions`).
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub timeout_ms: u64,
}

/// A single proactive-LLM issue, ready to merge with Harper issues and draw as
/// the blue dotted "context" underline layer.
#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct LlmIssue {
    pub start: usize,
    pub end: usize,
    pub utf16_start: usize,
    pub utf16_end: usize,
    pub original: String,
    pub suggestion: String,
    /// "spelling" | "grammar" (extension `llmTypeToIssueType`).
    pub issue_type: String,
    pub confidence: f32,
    pub reason: String,
}

/// One model correction with RESOLVED char offsets (after `applySafeCorrections`
/// or `correctionsFromDiff`). `start`/`end` are `None` only on raw input.
#[derive(Clone, Debug, PartialEq)]
pub struct Correction {
    pub original: String,
    pub replacement: String,
    pub start: Option<usize>,
    pub end: Option<usize>,
    pub kind: String,
    pub confidence: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct NormalizedResult {
    pub corrected: String,
    pub corrections: Vec<Correction>,
    pub should_show: bool,
}

#[derive(Debug)]
pub struct LlmError(pub String);

impl std::fmt::Display for LlmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for LlmError {}

// ---------------------------------------------------------------------------
// char helpers (canonical offset space)
// ---------------------------------------------------------------------------

#[inline]
fn is_alnum(c: char) -> bool {
    c.is_ascii_alphanumeric()
}

/// Word-char class for `isWordBoundary` ([A-Za-z0-9_], includes underscore).
#[inline]
fn is_word_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

/// `^[A-Za-z0-9']+$` — the extension's "wordish" test.
fn is_wordish(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '\'')
}

/// Extension `isWordBoundary(text, index)`: out-of-range is a boundary; else the
/// char at `index` must not be a word char.
fn is_word_boundary(chars: &[char], index: i64) -> bool {
    if index < 0 || index as usize >= chars.len() {
        return true;
    }
    !is_word_char(chars[index as usize])
}

fn char_substr(chars: &[char], start: usize, end: usize) -> String {
    if start >= end || start >= chars.len() {
        return String::new();
    }
    chars[start..end.min(chars.len())].iter().collect()
}

/// First index `>= from` where `needle` occurs in `hay` (char slices).
fn char_index_of(hay: &[char], needle: &[char], from: usize) -> Option<usize> {
    if needle.is_empty() {
        return Some(from.min(hay.len()));
    }
    if from > hay.len() || needle.len() > hay.len() {
        return None;
    }
    let last = hay.len() - needle.len();
    (from..=last).find(|&i| &hay[i..i + needle.len()] == needle)
}

/// UTF-16 code-unit offset of char index `ci`.
fn char_to_utf16(chars: &[char], ci: usize) -> usize {
    chars[..ci.min(chars.len())]
        .iter()
        .map(|c| c.len_utf16())
        .sum()
}

fn overlaps(a_start: usize, a_end: usize, b_start: usize, b_end: usize) -> bool {
    a_start < b_end && b_start < a_end
}

// ---------------------------------------------------------------------------
// protected fragments
// ---------------------------------------------------------------------------

/// Verbatim protected substrings (trimmed length > 1) — the `protectedFragments`
/// sent in the prompt and the preservation set for the diff fallback.
pub fn protected_fragment_list(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    protected_spans(text)
        .into_iter()
        .map(|(s, e)| char_substr(&chars, s, e))
        .filter(|frag| frag.trim().chars().count() > 1)
        .collect()
}

fn preserves_protected_fragments(text: &str, candidate: &str) -> bool {
    protected_fragment_list(text)
        .iter()
        .all(|frag| candidate.contains(frag.as_str()))
}

// ---------------------------------------------------------------------------
// conservative-correction guard (background isConservativeCorrection)
// ---------------------------------------------------------------------------

fn word_tokens_lower(s: &str) -> Vec<String> {
    // Mirrors /[A-Za-z0-9']+/g, lowercased.
    let mut out = Vec::new();
    let mut cur = String::new();
    for c in s.chars() {
        if c.is_ascii_alphanumeric() || c == '\'' {
            cur.extend(c.to_lowercase());
        } else if !cur.is_empty() {
            out.push(std::mem::take(&mut cur));
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

fn token_change_ratio(original: &str, candidate: &str) -> f64 {
    let ow = word_tokens_lower(original);
    let cw = word_tokens_lower(candidate);
    if ow.is_empty() {
        return if candidate.trim().is_empty() { 0.0 } else { 1.0 };
    }
    let max_len = ow.len().max(cw.len());
    // word LCS length
    let mut prev = vec![0usize; cw.len() + 1];
    let mut cur = vec![0usize; cw.len() + 1];
    for i in 1..=ow.len() {
        for j in 1..=cw.len() {
            cur[j] = if ow[i - 1] == cw[j - 1] {
                prev[j - 1] + 1
            } else {
                prev[j].max(cur[j - 1])
            };
        }
        std::mem::swap(&mut prev, &mut cur);
        cur.iter_mut().for_each(|x| *x = 0);
    }
    let same = prev[cw.len()];
    (max_len - same) as f64 / (max_len.max(1)) as f64
}

fn is_conservative_correction(original: &str, candidate: &str) -> bool {
    let o = original.trim();
    let c = candidate.trim();
    if c.is_empty() || o == c {
        return true;
    }
    let oc = o.chars().count() as f64;
    let cc = c.chars().count() as f64;
    if cc > (80.0_f64).max(oc * 1.8) {
        return false;
    }
    if cc < (1.0_f64).max(oc * 0.45) {
        return false;
    }
    let original_words = word_tokens_lower(o).len();
    let ratio = token_change_ratio(o, c);
    let max_ratio = if original_words <= 8 { 0.65 } else { 0.48 };
    ratio <= max_ratio
}

// ---------------------------------------------------------------------------
// applySafeCorrections (background) — apply model edits, protected-span-safe,
// stamping resolved char offsets onto the returned corrections.
// ---------------------------------------------------------------------------

fn apply_safe_corrections(
    text: &str,
    corrections: &[Correction],
    spans: &[(usize, usize)],
) -> (String, Vec<Correction>) {
    let chars: Vec<char> = text.chars().collect();
    let mut edits: Vec<(usize, usize, String, Correction)> = Vec::new();

    for c in corrections {
        let original = c.original.trim();
        let replacement = c.replacement.clone();
        if original.is_empty() || original == replacement {
            continue;
        }
        let needle: Vec<char> = original.chars().collect();
        let olen = needle.len();
        let wordish = is_wordish(original);

        // First occurrence whose boundary is OK and which is not inside a
        // protected span. (Regex lookarounds in JS only yield boundary matches;
        // we replicate that by skipping non-boundary positions entirely.)
        let mut from = 0usize;
        while let Some(idx) = char_index_of(&chars, &needle, from) {
            let end = idx + olen;
            let boundary_ok = !wordish
                || ((idx == 0 || !is_alnum(chars[idx - 1]))
                    && (end >= chars.len() || !is_alnum(chars[end])));
            if boundary_ok {
                let in_protected = spans.iter().any(|(s, e)| overlaps(idx, end, *s, *e));
                if !in_protected {
                    edits.push((idx, end, replacement.clone(), c.clone()));
                    break;
                }
            }
            from = idx + olen.max(1);
        }
    }

    // Apply right-to-left, skipping overlaps with already-applied edits.
    edits.sort_by(|a, b| b.0.cmp(&a.0));
    let mut out = chars.clone();
    let mut used: Vec<(usize, usize)> = Vec::new();
    let mut applied: Vec<Correction> = Vec::new();
    for (start, end, replacement, c) in edits {
        if used.iter().any(|(s, e)| overlaps(start, end, *s, *e)) {
            continue;
        }
        out.splice(start..end, replacement.chars());
        used.push((start, end));
        applied.push(Correction {
            start: Some(start),
            end: Some(end),
            ..c
        });
    }
    (out.into_iter().collect(), applied)
}

// ---------------------------------------------------------------------------
// correctionsFromDiff (background) — word-LCS alignment fallback.
// ---------------------------------------------------------------------------

struct Tok {
    text: String,
    start: usize,
    end: usize,
}

fn tokenize_nonspace(chars: &[char]) -> Vec<Tok> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i].is_whitespace() {
            i += 1;
            continue;
        }
        let start = i;
        while i < chars.len() && !chars[i].is_whitespace() {
            i += 1;
        }
        out.push(Tok {
            text: chars[start..i].iter().collect(),
            start,
            end: i,
        });
    }
    out
}

fn corrections_from_diff(text: &str, corrected: &str, spans: &[(usize, usize)]) -> Vec<Correction> {
    let ochars: Vec<char> = text.chars().collect();
    let o = tokenize_nonspace(&ochars);
    let cchars: Vec<char> = corrected.chars().collect();
    let c: Vec<String> = tokenize_nonspace(&cchars)
        .into_iter()
        .map(|t| t.text)
        .collect();
    let n = o.len();
    let p = c.len();
    if n == 0 {
        return Vec::new();
    }
    // bottom-up LCS table sized (n+1)x(p+1); dp[i][j] over suffixes (matches JS).
    let mut dp = vec![vec![0usize; p + 1]; n + 1];
    for i in (0..n).rev() {
        for j in (0..p).rev() {
            dp[i][j] = if o[i].text == c[j] {
                dp[i + 1][j + 1] + 1
            } else {
                dp[i + 1][j].max(dp[i][j + 1])
            };
        }
    }
    let mut out = Vec::new();
    let mut i = 0;
    let mut j = 0;
    while i < n || j < p {
        if i < n && j < p && o[i].text == c[j] {
            i += 1;
            j += 1;
            continue;
        }
        let mut dels: Vec<&Tok> = Vec::new();
        let mut ins: Vec<String> = Vec::new();
        while (i < n || j < p) && !(i < n && j < p && o[i].text == c[j]) {
            if j >= p {
                dels.push(&o[i]);
                i += 1;
            } else if i >= n {
                ins.push(c[j].clone());
                j += 1;
            } else if dp[i + 1][j] >= dp[i][j + 1] {
                dels.push(&o[i]);
                i += 1;
            } else {
                ins.push(c[j].clone());
                j += 1;
            }
        }
        if !dels.is_empty() && !ins.is_empty() {
            let start = dels[0].start;
            let end = dels[dels.len() - 1].end;
            let orig = char_substr(&ochars, start, end);
            let repl = ins.join(" ");
            if !orig.is_empty()
                && !repl.is_empty()
                && orig != repl
                && end - start <= 120
                && repl.chars().count() <= 120
                && !spans.iter().any(|(s, e)| overlaps(start, end, *s, *e))
            {
                out.push(Correction {
                    original: orig,
                    replacement: repl,
                    start: Some(start),
                    end: Some(end),
                    kind: "grammar".to_string(),
                    confidence: "high".to_string(),
                });
            }
        }
    }
    out
}

// ---------------------------------------------------------------------------
// JSON salvage + normalize (background extractJsonObject / normalizeCorrectionResult)
// ---------------------------------------------------------------------------

fn extract_json_object(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        return Some(trimmed.to_string());
    }
    // ```json … ``` fence
    if let Some(open) = trimmed.find("```") {
        let after = &trimmed[open + 3..];
        let after = after.strip_prefix("json").unwrap_or(after);
        if let Some(close) = after.find("```") {
            let inner = after[..close].trim();
            if inner.starts_with('{') {
                return Some(inner.to_string());
            }
        }
    }
    let start = trimmed.find('{');
    let end = trimmed.rfind('}');
    match (start, end) {
        (Some(s), Some(e)) if e > s => Some(trimmed[s..=e].to_string()),
        _ => None,
    }
}

fn parse_correction_payload(raw: &str) -> Option<Value> {
    let json = extract_json_object(raw)?;
    let parsed: Value = serde_json::from_str(&json).ok()?;
    if parsed.is_object() { Some(parsed) } else { None }
}

fn corrections_from_value(parsed: &Value) -> Vec<Correction> {
    parsed
        .get("corrections")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .map(|item| Correction {
                    original: item
                        .get("original")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    replacement: item
                        .get("replacement")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    start: None,
                    end: None,
                    kind: item
                        .get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    confidence: item
                        .get("confidence")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Port of `normalizeCorrectionResult` (default no-mask path). Masking is off by
/// default in the extension UI, so the legacy masking branch is intentionally
/// omitted.
pub fn normalize_correction_result(text: &str, raw: &str) -> NormalizedResult {
    let parsed = parse_correction_payload(raw);

    // shouldShow === false → abstain.
    if let Some(p) = &parsed {
        if p.get("shouldShow") == Some(&Value::Bool(false)) {
            return NormalizedResult {
                corrected: text.to_string(),
                corrections: Vec::new(),
                should_show: false,
            };
        }
    }

    let spans = protected_spans(text);
    let corrections = parsed
        .as_ref()
        .map(corrections_from_value)
        .unwrap_or_default();

    if !corrections.is_empty() {
        let (corrected, applied) = apply_safe_corrections(text, &corrections, &spans);
        let should_show = corrected.trim() != text.trim();
        return NormalizedResult {
            corrected,
            corrections: applied,
            should_show,
        };
    }

    // No structured edits → fall back to the model's full correctedText, gated.
    let proposed = parsed
        .as_ref()
        .and_then(|p| p.get("correctedText"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if !proposed.is_empty()
        && proposed != text.trim()
        && preserves_protected_fragments(text, &proposed)
        && is_conservative_correction(text, &proposed)
    {
        let derived = corrections_from_diff(text, &proposed, &spans);
        return NormalizedResult {
            corrected: proposed,
            corrections: derived,
            should_show: true,
        };
    }

    NormalizedResult {
        corrected: text.to_string(),
        corrections: Vec::new(),
        should_show: false,
    }
}

// ---------------------------------------------------------------------------
// buildLlmIssues (content) — corrections → LlmIssue[]
// ---------------------------------------------------------------------------

fn llm_type_to_issue_type(kind: &str) -> &'static str {
    if kind == "spelling" || kind == "word-form" {
        "spelling"
    } else {
        "grammar"
    }
}

fn confidence_score(confidence: &str) -> f32 {
    match confidence {
        "high" => 0.95,
        "medium" => 0.78,
        _ => 0.55,
    }
}

fn find_correction_offset(
    chars: &[char],
    needle: &[char],
    used: &[(usize, usize)],
) -> Option<usize> {
    let original: String = needle.iter().collect();
    let wordish = is_wordish(&original);
    let mut from = 0usize;
    while from <= chars.len() {
        let idx = char_index_of(chars, needle, from)?;
        let end = idx + needle.len();
        let boundary_ok = !wordish
            || (is_word_boundary(chars, idx as i64 - 1) && is_word_boundary(chars, end as i64));
        let unused = !used.iter().any(|(s, e)| overlaps(idx, end, *s, *e));
        if boundary_ok && unused {
            return Some(idx);
        }
        from = idx + needle.len().max(1);
    }
    None
}

/// Port of `buildLlmIssues`. Drops low-confidence, resolves offsets (model's own
/// if they line up, else first-unused boundary match), produces blue-layer issues.
pub fn build_llm_issues(text: &str, corrections: &[Correction]) -> Vec<LlmIssue> {
    let chars: Vec<char> = text.chars().collect();
    let mut used: Vec<(usize, usize)> = Vec::new();
    let mut issues: Vec<LlmIssue> = Vec::new();

    for c in corrections {
        if c.confidence == "low" {
            continue;
        }
        let original = c.original.trim();
        let suggestion = c.replacement.trim();
        if original.is_empty() || suggestion.is_empty() || original == suggestion {
            continue;
        }
        let needle: Vec<char> = original.chars().collect();
        let olen = needle.len();

        let offset = match c.start {
            Some(st)
                if char_substr(&chars, st, st + olen) == original
                    && !used.iter().any(|(s, e)| overlaps(st, st + olen, *s, *e)) =>
            {
                Some(st)
            }
            _ => find_correction_offset(&chars, &needle, &used),
        };
        let Some(offset) = offset else { continue };
        let end = offset + olen;
        used.push((offset, end));

        issues.push(LlmIssue {
            start: offset,
            end,
            utf16_start: char_to_utf16(&chars, offset),
            utf16_end: char_to_utf16(&chars, end),
            original: original.to_string(),
            suggestion: suggestion.to_string(),
            issue_type: llm_type_to_issue_type(&c.kind).to_string(),
            confidence: confidence_score(&c.confidence),
            reason: format!("Sentence review suggests {original} -> {suggestion}."),
        });
    }
    issues
}

// ---------------------------------------------------------------------------
// proactive eligibility (content shouldRunProactiveLlm + a basic non-prose gate)
// ---------------------------------------------------------------------------

pub const PROACTIVE_MIN_WORDS: usize = 6;
pub const PROACTIVE_MAX_CHARS: usize = 3500;

/// Desktop port of `shouldRunProactiveLlm` + `looksNonProse` (the DOM input-type
/// gate is browser-only and omitted). True if the text is worth a context check.
pub fn proactive_text_eligible(text: &str) -> bool {
    let trimmed = text.trim();
    let len = trimmed.chars().count();
    if len < 20 || len > PROACTIVE_MAX_CHARS {
        return false;
    }
    let words = trimmed.split_whitespace().count();
    if words < PROACTIVE_MIN_WORDS {
        return false;
    }
    // looksNonProse: text with NO whitespace that looks like a URL/path/email.
    if !trimmed.contains(char::is_whitespace) {
        let lower = trimmed.to_ascii_lowercase();
        if lower.contains("://")
            || lower.contains('@')
            || trimmed.starts_with('/')
            || trimmed.starts_with('\\')
        {
            return false;
        }
    }
    true
}

// ---------------------------------------------------------------------------
// transport + top-level review (network)
// ---------------------------------------------------------------------------

/// Remove `<think>…</think>` reasoning blocks and Qwen control directives.
pub fn strip_reasoning(s: &str) -> String {
    use regex::Regex;
    use std::sync::OnceLock;
    static THINK_BLOCK: OnceLock<Regex> = OnceLock::new();
    static THINK_TAG: OnceLock<Regex> = OnceLock::new();
    static THINK_DIR: OnceLock<Regex> = OnceLock::new();
    static WS: OnceLock<Regex> = OnceLock::new();
    if s.is_empty() {
        return s.to_string();
    }
    let block = THINK_BLOCK.get_or_init(|| Regex::new(r"(?is)<think\b[^>]*>.*?</think>").unwrap());
    let tag = THINK_TAG.get_or_init(|| Regex::new(r"(?i)</?think\b[^>]*>").unwrap());
    let dir = THINK_DIR.get_or_init(|| Regex::new(r"(?i)/(?:no_)?think\b").unwrap());
    let ws = WS.get_or_init(|| Regex::new(r"\s{2,}").unwrap());
    let out = block.replace_all(s, "");
    let out = tag.replace_all(&out, "");
    let out = dir.replace_all(&out, "");
    let out = ws.replace_all(&out, " ");
    out.trim().to_string()
}

#[cfg(feature = "net")]
fn max_tokens_for(text: &str) -> usize {
    let len = text.chars().count();
    std::cmp::min(4000, len.div_ceil(2) + 600)
}

/// Build the (system, user) message pair for `text` (user = JSON with the
/// protected fragments, matching the extension).
pub fn build_messages(text: &str) -> (String, String) {
    let user = serde_json::json!({
        "text": text,
        "protectedFragments": protected_fragment_list(text),
    })
    .to_string();
    (SYSTEM_PROMPT.to_string(), user)
}

/// One OpenAI-compatible chat completion. Returns the (reasoning-stripped)
/// assistant message content. Network feature only.
#[cfg(feature = "net")]
pub fn chat_completion(
    cfg: &LlmConfig,
    system: &str,
    user: &str,
    max_tokens: usize,
) -> Result<String, LlmError> {
    use std::time::Duration;

    // Qwen3 thinking-suppression (withQwenNoThink).
    let system_owned;
    let system_final: &str = if regex::Regex::new(r"(?i)\bqwen3\b")
        .unwrap()
        .is_match(&cfg.model)
    {
        system_owned = format!("/no_think\n{system}");
        &system_owned
    } else {
        system
    };

    let body = serde_json::json!({
        "model": cfg.model,
        "messages": [
            { "role": "system", "content": system_final },
            { "role": "user", "content": user },
        ],
        "temperature": 0,
        "max_tokens": max_tokens,
    })
    .to_string();

    let url = format!("{}/chat/completions", cfg.base_url.trim_end_matches('/'));
    let bearer = if cfg.api_key.is_empty() {
        "ollama".to_string()
    } else {
        cfg.api_key.clone()
    };
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_millis(cfg.timeout_ms))
        .build();

    let resp = agent
        .post(&url)
        .set("Content-Type", "application/json")
        .set("Authorization", &format!("Bearer {bearer}"))
        .send_string(&body);

    let text = match resp {
        Ok(r) => r
            .into_string()
            .map_err(|e| LlmError(format!("read body: {e}")))?,
        Err(ureq::Error::Status(code, r)) => {
            let detail = r.into_string().unwrap_or_default();
            let detail: String = detail.chars().take(200).collect();
            return Err(LlmError(format!("LLM HTTP {code}: {detail}")));
        }
        Err(e) => return Err(LlmError(format!("LLM request failed: {e}"))),
    };

    let v: Value = serde_json::from_str(&text).map_err(|e| LlmError(format!("parse: {e}")))?;
    let content = v
        .pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .unwrap_or("");
    Ok(strip_reasoning(content))
}

/// Full proactive review: one completion → normalize → blue-layer issues.
/// Returns an empty vec when the model abstains (`shouldShow:false`). Network
/// feature only.
#[cfg(feature = "net")]
pub fn llm_review(text: &str, cfg: &LlmConfig) -> Result<Vec<LlmIssue>, LlmError> {
    let (system, user) = build_messages(text);
    let raw = chat_completion(cfg, &system, &user, max_tokens_for(text))?;
    let norm = normalize_correction_result(text, &raw);
    if !norm.should_show {
        return Ok(Vec::new());
    }
    Ok(build_llm_issues(text, &norm.corrections))
}

/// Full-field "fix everything" correction: one completion → the model's
/// corrected text (protected-span-safe). Returns None if there's nothing to fix.
/// Used by the proofread hotkey to apply spelling+grammar+context in one go.
#[cfg(feature = "net")]
pub fn llm_correct_text(text: &str, cfg: &LlmConfig) -> Result<Option<String>, LlmError> {
    let (system, user) = build_messages(text);
    let raw = chat_completion(cfg, &system, &user, max_tokens_for(text))?;
    let norm = normalize_correction_result(text, &raw);
    if norm.should_show && !norm.corrected.trim().is_empty() && norm.corrected.trim() != text.trim()
    {
        Ok(Some(norm.corrected))
    } else {
        Ok(None)
    }
}

/// A tone the "✦ Rewrite" pill can rewrite the user's text into (the desktop
/// analogue of the extension's tone rewrites).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RewriteTone {
    Polish,
    Formalize,
    Casual,
}

impl RewriteTone {
    /// Map a 0-based menu index to a tone (Polish, Formalize, Casual).
    pub fn from_index(index: usize) -> Option<Self> {
        match index {
            0 => Some(Self::Polish),
            1 => Some(Self::Formalize),
            2 => Some(Self::Casual),
            _ => None,
        }
    }

    /// Menu label.
    pub fn label(self) -> &'static str {
        match self {
            Self::Polish => "Polish",
            Self::Formalize => "Formalize",
            Self::Casual => "Casual",
        }
    }

    fn instruction(self) -> &'static str {
        match self {
            Self::Polish => "Rewrite the text so it reads clearly and correctly, fixing grammar, spelling, and awkward phrasing while keeping the original meaning, language, and approximate length.",
            Self::Formalize => "Rewrite the text in a polished, professional, formal tone suitable for business or academic writing. Keep the original meaning and language; avoid slang and contractions.",
            Self::Casual => "Rewrite the text in a relaxed, friendly, conversational tone, like a casual message to a friend, while keeping the original meaning and language.",
        }
    }
}

/// Rewrite `text` in the requested tone via the LLM. Returns the rewritten text,
/// or None if the model returned nothing usable / unchanged. Network only.
#[cfg(feature = "net")]
pub fn llm_rewrite(
    text: &str,
    tone: RewriteTone,
    cfg: &LlmConfig,
) -> Result<Option<String>, LlmError> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let system = format!(
        "You are a writing assistant. {} Return ONLY the rewritten text — no preamble, quotation marks, labels, or explanation.",
        tone.instruction()
    );
    let max_tokens = (text.chars().count() * 2 + 200).clamp(256, 4000);
    let raw = chat_completion(cfg, &system, text, max_tokens)?;
    let out = strip_reasoning(&raw).trim().trim_matches('"').trim().to_string();
    if out.is_empty() || out == trimmed {
        Ok(None)
    } else {
        Ok(Some(out))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn structured_corrections_resolve_offsets_and_build_issues() {
        let text = "I dont want to loose the game.";
        let raw = r#"{"correctedText":"I don't want to lose the game.","shouldShow":true,"corrections":[{"original":"dont","replacement":"don't","start":2,"end":6,"type":"spelling","confidence":"high"},{"original":"loose","replacement":"lose","start":15,"end":20,"type":"grammar","confidence":"medium"}]}"#;
        let norm = normalize_correction_result(text, raw);
        assert!(norm.should_show);
        let issues = build_llm_issues(text, &norm.corrections);
        assert_eq!(issues.len(), 2);
        let dont = issues.iter().find(|i| i.original == "dont").unwrap();
        assert_eq!(dont.start, 2);
        assert_eq!(dont.end, 6);
        assert_eq!(dont.suggestion, "don't");
        assert_eq!(dont.issue_type, "spelling");
        let loose = issues.iter().find(|i| i.original == "loose").unwrap();
        assert_eq!(loose.suggestion, "lose");
        assert_eq!(loose.issue_type, "grammar");
        assert!((loose.confidence - 0.78).abs() < 1e-6);
    }

    #[test]
    fn diff_fallback_when_corrections_empty() {
        let text = "Their going too the store with there freinds today.";
        let raw = r#"{"correctedText":"They're going to the store with their friends today.","shouldShow":true,"corrections":[]}"#;
        let norm = normalize_correction_result(text, raw);
        assert!(norm.should_show, "diff fallback should fire");
        assert!(
            !norm.corrections.is_empty(),
            "should derive corrections from the diff"
        );
        let issues = build_llm_issues(text, &norm.corrections);
        assert!(
            issues.iter().any(|i| i.original.contains("freinds")),
            "expected a freinds->friends issue, got {issues:?}"
        );
    }

    #[test]
    fn should_show_false_abstains() {
        let text = "This sentence is perfectly fine and needs no edits at all.";
        let raw = r#"{"correctedText":"This sentence is perfectly fine and needs no edits at all.","shouldShow":false,"corrections":[]}"#;
        let norm = normalize_correction_result(text, raw);
        assert!(!norm.should_show);
        assert!(build_llm_issues(text, &norm.corrections).is_empty());
    }

    #[test]
    fn low_confidence_is_dropped() {
        let text = "I went to the stoor yesterday afternoon.";
        let raw = r#"{"correctedText":"I went to the store yesterday afternoon.","shouldShow":true,"corrections":[{"original":"stoor","replacement":"store","start":14,"end":19,"type":"spelling","confidence":"low"}]}"#;
        let norm = normalize_correction_result(text, raw);
        // applySafeCorrections still applies it (corrected changes), but
        // buildLlmIssues drops low-confidence so no underline is drawn.
        let issues = build_llm_issues(text, &norm.corrections);
        assert!(issues.is_empty(), "low-confidence must not underline");
    }

    #[test]
    fn fenced_json_is_salvaged() {
        let text = "We was happy with the results overall here.";
        let raw = "```json\n{\"correctedText\":\"We were happy with the results overall here.\",\"shouldShow\":true,\"corrections\":[{\"original\":\"was\",\"replacement\":\"were\",\"start\":3,\"end\":6,\"type\":\"grammar\",\"confidence\":\"high\"}]}\n```";
        let norm = normalize_correction_result(text, raw);
        assert!(norm.should_show);
        let issues = build_llm_issues(text, &norm.corrections);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].suggestion, "were");
    }

    #[test]
    fn protected_fragment_blocks_overbroad_diff() {
        // The model rewrote a protected URL away → diff fallback must abstain.
        let text = "Check https://example.com/Api/v2 for the documantation details.";
        let raw = r#"{"correctedText":"Check the site for the documentation details.","shouldShow":true,"corrections":[]}"#;
        let norm = normalize_correction_result(text, raw);
        assert!(
            !norm.should_show,
            "must abstain when a protected fragment is not preserved"
        );
    }

    #[test]
    fn eligibility_thresholds() {
        assert!(!proactive_text_eligible("too short"));
        assert!(!proactive_text_eligible("https://example.com/some/very/long/path/here/page"));
        assert!(proactive_text_eligible(
            "this is a normal prose sentence that should be eligible"
        ));
    }
}
