use std::io::{self, Read};
use std::path::PathBuf;

use clap::{Parser, ValueEnum};

use crate::{DialectName, EngineOptions, SpellEngine, check_text_with_options};

#[derive(Debug, Parser)]
#[command(about = "Native Harper engine spike for OGrammar")]
pub struct Args {
    /// Text to lint. When omitted, text is read from stdin.
    #[arg(long)]
    text: Option<String>,

    /// Harper spelling dialect.
    #[arg(long, value_enum, default_value_t = CliDialect::American)]
    dialect: CliDialect,

    /// Suggestion engine for Harper-detected spelling lints.
    #[arg(long, value_enum, default_value_t = CliSpellEngine::Harper)]
    spell_engine: CliSpellEngine,

    /// Frequency dictionary path for --spell-engine symspell|combined.
    #[arg(long)]
    dictionary_path: Option<PathBuf>,

    /// Optional OGN1 n-gram model path for context re-ranking.
    #[arg(long)]
    context_model_path: Option<PathBuf>,

    /// Disable protected-text filtering for parity A/B runs.
    #[arg(long)]
    no_protect: bool,
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum CliDialect {
    American,
    British,
    Canadian,
    Australian,
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum CliSpellEngine {
    Harper,
    Symspell,
    Combined,
}

impl From<CliDialect> for DialectName {
    fn from(value: CliDialect) -> Self {
        match value {
            CliDialect::American => Self::American,
            CliDialect::British => Self::British,
            CliDialect::Canadian => Self::Canadian,
            CliDialect::Australian => Self::Australian,
        }
    }
}

impl From<CliSpellEngine> for SpellEngine {
    fn from(value: CliSpellEngine) -> Self {
        match value {
            CliSpellEngine::Harper => Self::Harper,
            CliSpellEngine::Symspell => Self::SymSpell,
            CliSpellEngine::Combined => Self::Combined,
        }
    }
}

pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    let text = match args.text {
        Some(text) => text,
        None => {
            let mut text = String::new();
            io::stdin().read_to_string(&mut text)?;
            text
        }
    };

    let issues = check_text_with_options(
        &text,
        &EngineOptions {
            dialect: args.dialect.into(),
            spell_engine: args.spell_engine.into(),
            dictionary_path: args.dictionary_path,
            context_model_path: args.context_model_path,
            protect: !args.no_protect,
        },
    );
    println!("{}", serde_json::to_string_pretty(&issues)?);

    Ok(())
}
