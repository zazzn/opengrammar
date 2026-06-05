//! Ollama model discovery + writing-suitability ranking for the desktop Settings
//! "Model" dropdown — informed by `docs/25-local-llm-model-benchmark.md`.
//!
//! Like the extension, we query the LOCAL Ollama server for the user's INSTALLED
//! models, hide ones unsuited to prose correction, and rank the rest so the best
//! writing model is offered first. When nothing usable is installed (or Ollama
//! isn't running) we fall back to a curated, benchmark-proven RECOMMENDED list so
//! the user knows what to `ollama pull`.
//!
//! TRANSPORT CAVEAT (kept in sync with the benchmark doc): the desktop sends LLM
//! requests over the OpenAI-compatible `/v1/chat/completions` path. The Qwen
//! "thinking" tags (`qwen3.5:*`, `qwen3:latest`, `qwen3:<n>b` without `-instruct`)
//! return EMPTY `message.content` on that path (their text lands in the reasoning
//! field), so they are unusable here and are hidden. The extension avoids this by
//! using Ollama's native `/api/chat` path; porting that to the desktop would let
//! `qwen3.5:4b` (the benchmark's overall local best) be recommended too — tracked
//! as a follow-up.

/// Curated, benchmark-proven writing models that work on the desktop's `/v1`
/// transport (best first). Shown when none are installed / Ollama is unreachable,
/// and appended after any installed models so the user can see what to pull.
/// Source: docs/25 (masked + clean GPU runs).
pub const RECOMMENDED: &[&str] = &[
    "qwen3:4b-instruct", // best local default: 113/123 masked, ~700ms, /v1-safe
    "qwen2.5:7b",        // strongest masked /v1-safe quality (121/123), slower
    "llama3.2:3b",       // fast, solid (95/123)
    "qwen2.5:3b",        // fast alternate (93/123)
    "gemma3:4b",         // alternate
];

/// Category exclusions (code / embedding / vision / math / safety / rerankers) +
/// the `/v1`-incompatible Qwen thinking tags (see the transport caveat above).
fn is_excluded(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    const BAD: &[&str] = &[
        "coder", "code", "embed", "vision", "-vl", "math", "guard", "moderation", "rerank",
        "nomic", "clip", "whisper", "llava",
    ];
    if BAD.iter().any(|b| n.contains(b)) {
        return true;
    }
    // Thinking-style Qwen tags → empty content on the OpenAI-compatible path.
    if n.starts_with("qwen3.5") || n.starts_with("qwen3:latest") {
        return true;
    }
    if n.starts_with("qwen3:") && !n.contains("instruct") {
        return true;
    }
    false
}

/// Writing-suitability rank (higher = better) for `/v1`-safe models, from the
/// benchmark. Unknown-but-allowed models get a small positive rank so they still
/// appear (after the curated ones).
fn writing_rank(name: &str) -> i32 {
    let n = name.to_ascii_lowercase();
    let s = |p: &str| n.starts_with(p);
    if s("qwen3:4b-instruct") {
        100
    } else if s("qwen2.5:7b") {
        96
    } else if s("qwen2.5:14b") {
        90
    } else if s("llama3.2:3b") {
        88
    } else if s("qwen2.5:3b") {
        86
    } else if s("gemma3:4b") {
        84
    } else if s("gemma2:9b") {
        82
    } else if s("llama3.1:8b-instruct") {
        78
    } else if s("llama3.1:8b") {
        74
    } else if s("mistral:7b") {
        70
    } else if s("gemma2:2b") {
        45
    } else {
        10
    }
}

/// Filter out non-writing / incompatible models and rank the rest (best first).
pub fn rank_writing_models(installed: &[String]) -> Vec<String> {
    let mut v: Vec<String> = installed
        .iter()
        .filter(|m| !is_excluded(m))
        .cloned()
        .collect();
    v.sort_by(|a, b| writing_rank(b).cmp(&writing_rank(a)).then_with(|| a.cmp(b)));
    v
}

/// Query the local Ollama server (`GET {base}/api/tags`) for installed model
/// names. Returns an empty Vec on any error. Uses a short timeout — but callers
/// must still run this OFF the UI thread (the Settings window spawns a worker).
#[cfg(feature = "net")]
pub fn installed_models(base_url: &str) -> Vec<String> {
    use std::time::Duration;
    // base_url may be the OpenAI-compat URL ("…:11434/v1"); the tags API is on
    // the Ollama root, so strip a trailing "/v1".
    let base = base_url.trim_end_matches('/');
    let base = base.strip_suffix("/v1").unwrap_or(base);
    let url = format!("{base}/api/tags");
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_millis(1500))
        .build();
    let Ok(resp) = agent.get(&url).call() else {
        return Vec::new();
    };
    let Ok(text) = resp.into_string() else {
        return Vec::new();
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
        return Vec::new();
    };
    v.get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(not(feature = "net"))]
pub fn installed_models(_base_url: &str) -> Vec<String> {
    Vec::new()
}

/// The list for the Settings "Model" dropdown: installed writing models (best
/// first), then any recommended not installed (so the user can see what to pull).
/// Does the network fetch — call OFF the UI thread.
pub fn dropdown_models(base_url: &str) -> Vec<String> {
    let mut out = rank_writing_models(&installed_models(base_url));
    for r in RECOMMENDED {
        if !out.iter().any(|m| m == r) {
            out.push((*r).to_string());
        }
    }
    out
}
