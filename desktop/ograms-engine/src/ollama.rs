//! Ollama model discovery + writing-suitability ranking for the desktop Settings
//! "Model" dropdown — kept at parity with the extension's `shared/ollamaModels.ts`.
//!
//! Like the extension, we query the LOCAL Ollama server for the user's INSTALLED
//! models, hide ones unsuited to prose correction (code / embedding / vision /
//! math / safety), and rank the rest so the best writing model is offered first.
//! When nothing usable is installed (or Ollama isn't running) we fall back to a
//! curated list of recommended models so the user knows what to `ollama pull`.

/// Curated writing models we recommend (best first). Shown when none are
/// installed / Ollama is unreachable, and appended after any installed models so
/// the user can see what to pull. (Only widely-available Ollama tags.)
pub const RECOMMENDED: &[&str] = &[
    "qwen2.5:7b",
    "llama3.2:3b",
    "gemma2:9b",
    "llama3.1:8b",
    "qwen2.5:3b",
    "mistral:7b",
];

/// True for models unsuited to writing correction (code, embedding, vision,
/// math, safety/moderation, rerankers). Mirrors the extension's exclusion list.
fn is_excluded(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    const BAD: &[&str] = &[
        "coder", "code", "embed", "vision", "-vl", "math", "guard", "moderation", "rerank",
        "nomic", "clip", "whisper", "llava",
    ];
    BAD.iter().any(|b| n.contains(b))
}

/// Writing-suitability rank (higher = better), mirroring the extension's
/// `WRITING_RANKS`. Unknown-but-allowed models get a small positive rank so they
/// still appear (after the curated ones).
fn writing_rank(name: &str) -> i32 {
    let n = name.to_ascii_lowercase();
    let s = |p: &str| n.starts_with(p);
    if s("qwen3.5:4b") {
        100
    } else if s("qwen2.5:7b") {
        96
    } else if s("qwen3:latest") || s("qwen3:4b-instruct") {
        92
    } else if s("qwen3.5:2b") || s("qwen2.5:3b") {
        88
    } else if s("llama3.2:3b") || s("qwen2.5:14b") {
        86
    } else if s("gemma2:9b") {
        82
    } else if s("gemma3:4b") {
        80
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

/// Filter out non-writing models and rank the rest (best first).
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
/// names. Returns an empty Vec on any error (Ollama not running, timeout, parse).
/// Uses a short timeout so the Settings UI never hangs if Ollama is down.
#[cfg(feature = "net")]
pub fn installed_models(base_url: &str) -> Vec<String> {
    use std::time::Duration;
    // base_url may be the OpenAI-compat URL ("…:11434/v1"); the tags API is on
    // the Ollama root, so strip a trailing "/v1".
    let base = base_url.trim_end_matches('/');
    let base = base.strip_suffix("/v1").unwrap_or(base);
    let url = format!("{base}/api/tags");
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_millis(900))
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

/// The list to put in the desktop Settings "Model" dropdown for Ollama:
/// the user's installed writing models (best first), then any recommended models
/// not already installed (so they can see what to pull). The box stays editable,
/// so a user can always type any model tag.
pub fn dropdown_models(base_url: &str) -> Vec<String> {
    let mut out = rank_writing_models(&installed_models(base_url));
    for r in RECOMMENDED {
        if !out.iter().any(|m| m == r) {
            out.push((*r).to_string());
        }
    }
    out
}
