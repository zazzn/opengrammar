//! Live smoke test for the proactive-LLM tier. Reads creds from env so no key
//! is ever hard-coded:
//!   OG_LLM_KEY   (required)   provider API key
//!   OG_LLM_BASE  (optional)   default https://api.deepseek.com/v1
//!   OG_LLM_MODEL (optional)   default deepseek-chat
//! Usage: OG_LLM_KEY=… cargo run --example llm_smoke -- "text to check"

use ograms_engine::llm::{DEFAULT_TIMEOUT_MS, LlmConfig, llm_review};

fn main() {
    let key = std::env::var("OG_LLM_KEY").unwrap_or_default();
    if key.is_empty() {
        eprintln!("set OG_LLM_KEY");
        std::process::exit(2);
    }
    let base = std::env::var("OG_LLM_BASE").unwrap_or_else(|_| "https://api.deepseek.com/v1".into());
    let model = std::env::var("OG_LLM_MODEL").unwrap_or_else(|_| "deepseek-chat".into());
    let text = std::env::args().nth(1).unwrap_or_else(|| {
        "I dont want to loose the game. Their going too the store with there freinds.".into()
    });

    let cfg = LlmConfig {
        base_url: base,
        api_key: key,
        model: model.clone(),
        timeout_ms: DEFAULT_TIMEOUT_MS,
    };

    println!("model={model}  text={text:?}");
    match llm_review(&text, &cfg) {
        Ok(issues) => {
            println!("{} LLM issue(s):", issues.len());
            for i in &issues {
                println!(
                    "  [{}] {:?} -> {:?}  conf {:.2}  char {}..{}  utf16 {}..{}",
                    i.issue_type,
                    i.original,
                    i.suggestion,
                    i.confidence,
                    i.start,
                    i.end,
                    i.utf16_start,
                    i.utf16_end
                );
            }
        }
        Err(e) => {
            eprintln!("ERROR: {e}");
            std::process::exit(1);
        }
    }
}
