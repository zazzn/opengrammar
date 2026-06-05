use std::sync::OnceLock;

use regex::Regex;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct ByteSpan {
    start: usize,
    end: usize,
}

pub fn protected_spans(text: &str) -> Vec<(usize, usize)> {
    let mut spans = Vec::new();

    collect_fenced_code_spans(text, &mut spans);
    collect_regex_spans(text, bb_code_re(), &mut spans);
    collect_regex_spans(text, html_code_block_re(), &mut spans);
    collect_regex_spans(text, html_tag_re(), &mut spans);
    collect_regex_spans(text, url_re(), &mut spans);
    collect_regex_spans(text, git_remote_re(), &mut spans);
    collect_regex_spans(text, ipv6_re(), &mut spans);
    collect_regex_spans(text, domain_re(), &mut spans);
    collect_regex_spans(text, host_port_re(), &mut spans);
    collect_regex_spans(text, email_re(), &mut spans);
    collect_regex_spans(text, inline_code_re(), &mut spans);
    collect_group_spans(text, markdown_url_re(), 1, &mut spans);
    collect_regex_spans(text, windows_path_re(), &mut spans);
    collect_group_spans(text, unix_path_re(), 2, &mut spans);
    collect_regex_spans(text, relative_path_re(), &mut spans);
    collect_regex_spans(text, dotted_tech_token_re(), &mut spans);
    collect_group_spans(text, special_file_re(), 2, &mut spans);
    collect_group_spans(text, package_re(), 2, &mut spans);
    collect_regex_spans(text, model_tag_re(), &mut spans);
    collect_group_spans(text, handle_re(), 2, &mut spans);
    collect_group_spans(text, hashtag_re(), 2, &mut spans);
    collect_group_spans(text, command_re(), 2, &mut spans);
    collect_regex_spans(text, config_assign_re(), &mut spans);
    collect_regex_spans(text, json_pair_re(), &mut spans);
    collect_regex_spans(text, secret_re(), &mut spans);
    collect_regex_spans(text, ticket_re(), &mut spans);
    collect_regex_spans(text, uuid_re(), &mut spans);
    collect_regex_spans(text, hash_re(), &mut spans);
    collect_regex_spans(text, version_re(), &mut spans);
    collect_regex_spans(text, measurement_re(), &mut spans);
    collect_group_spans(text, special_tech_token_re(), 2, &mut spans);
    collect_regex_spans(text, chat_slang_re(), &mut spans);
    collect_regex_spans(text, phonetic_casual_re(), &mut spans);
    collect_elongation_spans(text, &mut spans);
    collect_regex_spans(text, proper_noun_re(), &mut spans);
    collect_regex_spans(text, env_token_re(), &mut spans);
    collect_regex_spans(text, code_token_re(), &mut spans);

    merge_spans(spans)
        .into_iter()
        .map(|span| (byte_to_char(text, span.start), byte_to_char(text, span.end)))
        .collect()
}

pub fn overlaps_protected_span(start: usize, end: usize, spans: &[(usize, usize)]) -> bool {
    spans
        .iter()
        .any(|(protected_start, protected_end)| start < *protected_end && end > *protected_start)
}

fn collect_regex_spans(text: &str, regex: &Regex, spans: &mut Vec<ByteSpan>) {
    for found in regex.find_iter(text) {
        push_span(spans, found.start(), found.end(), text);
    }
}

fn collect_group_spans(text: &str, regex: &Regex, group_index: usize, spans: &mut Vec<ByteSpan>) {
    for captures in regex.captures_iter(text) {
        if let Some(found) = captures.get(group_index) {
            push_span(spans, found.start(), found.end(), text);
        }
    }
}

fn collect_fenced_code_spans(text: &str, spans: &mut Vec<ByteSpan>) {
    let bytes = text.as_bytes();
    let mut offset = 0;
    while offset < text.len() {
        let line_start = offset;
        let line_end = bytes[offset..]
            .iter()
            .position(|byte| *byte == b'\n')
            .map_or(text.len(), |position| offset + position + 1);
        let line = &text[line_start..line_end];
        let trimmed = line.trim_start();
        let indent = line.len() - trimmed.len();
        let marker = if trimmed.starts_with("```") {
            Some('`')
        } else if trimmed.starts_with("~~~") {
            Some('~')
        } else {
            None
        };

        if let Some(marker) = marker {
            let marker_len = trimmed.chars().take_while(|ch| *ch == marker).count();
            if marker_len >= 3 {
                let fence = marker.to_string().repeat(marker_len);
                let mut end = line_end;
                let mut scan = line_end;
                while scan < text.len() {
                    let close_line_end = bytes[scan..]
                        .iter()
                        .position(|byte| *byte == b'\n')
                        .map_or(text.len(), |position| scan + position + 1);
                    if text[scan..close_line_end].trim_start().starts_with(&fence) {
                        end = close_line_end;
                        break;
                    }
                    scan = close_line_end;
                }
                push_span(spans, line_start + indent, end, text);
                offset = end;
                continue;
            }
        }

        offset = line_end;
    }
}

fn collect_elongation_spans(text: &str, spans: &mut Vec<ByteSpan>) {
    for found in Regex::new(r"\b[A-Za-z]+\b").expect("valid regex").find_iter(text) {
        let mut previous = None;
        let mut run = 0;
        for ch in found.as_str().chars() {
            if Some(ch.to_ascii_lowercase()) == previous {
                run += 1;
            } else {
                previous = Some(ch.to_ascii_lowercase());
                run = 1;
            }
            if run >= 3 {
                push_span(spans, found.start(), found.end(), text);
                break;
            }
        }
    }
}

fn push_span(spans: &mut Vec<ByteSpan>, start: usize, mut end: usize, text: &str) {
    while end > start {
        let Some(ch) = text[..end].chars().next_back() else {
            break;
        };
        if !matches!(ch, '.' | ',' | ';' | ':' | '!' | '?' | ')' | '}' | ']') {
            break;
        }
        end -= ch.len_utf8();
    }

    if end > start {
        spans.push(ByteSpan { start, end });
    }
}

fn merge_spans(spans: Vec<ByteSpan>) -> Vec<ByteSpan> {
    let mut sorted = spans
        .into_iter()
        .filter(|span| span.end > span.start)
        .collect::<Vec<_>>();
    sorted.sort_by(|a, b| a.start.cmp(&b.start).then_with(|| b.end.cmp(&a.end)));

    let mut merged: Vec<ByteSpan> = Vec::new();
    for span in sorted {
        let Some(last) = merged.last_mut() else {
            merged.push(span);
            continue;
        };
        if span.start > last.end {
            merged.push(span);
        } else if span.end > last.end {
            last.end = span.end;
        }
    }
    merged
}

fn byte_to_char(text: &str, byte_offset: usize) -> usize {
    text[..byte_offset].chars().count()
}

fn regex(cell: &'static OnceLock<Regex>, pattern: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pattern).expect("valid protected-text regex"))
}

macro_rules! regex_fn {
    ($name:ident, $pattern:expr) => {
        fn $name() -> &'static Regex {
            static CELL: OnceLock<Regex> = OnceLock::new();
            regex(&CELL, $pattern)
        }
    };
}

regex_fn!(bb_code_re, r"(?is)\[(?:code|pre)]([\s\S]*?)\[/(?:code|pre)]");
regex_fn!(html_code_block_re, r"(?is)<(?:code|pre|script|style)\b[^>]*>[\s\S]*?</(?:code|pre|script|style)>");
regex_fn!(html_tag_re, r#"</?[A-Za-z][A-Za-z0-9:-]*(?:\s+[A-Za-z_:][A-Za-z0-9_:.-]*(?:=(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*/?>"#);
regex_fn!(url_re, r#"(?i)\b(?:(?:https?|ftp|ssh)://|www\.)[^\s<>"'`]+|\b(?:mailto|tel):[^\s<>"'`]+|\b(?:localhost|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?(?:/[^\s<>"'`]*)?"#);
regex_fn!(git_remote_re, r"\bgit@[A-Za-z0-9.-]+:[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?\b");
regex_fn!(ipv6_re, r#"(?i)\[(?:[A-F0-9]{0,4}:){2,7}[A-F0-9]{0,4}](?::\d+)?(?:/[^\s<>"'`]*)?"#);
regex_fn!(domain_re, r#"(?i)\b(?:[a-z0-9-]+\.)+[a-z]{2,24}(?::\d+)?(?:/[^\s<>"'`]*)?"#);
regex_fn!(host_port_re, r"\b[A-Za-z0-9.-]+:\d{2,5}\b");
regex_fn!(email_re, r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b");
regex_fn!(inline_code_re, r"`[^`\n]+`");
regex_fn!(markdown_url_re, r"!?\[[^\]]*]\(([^)\s]+)\)");
regex_fn!(windows_path_re, r#"\b[A-Za-z]:\\[^\s<>"'`]+"#);
regex_fn!(unix_path_re, r#"(^|[\s(\[{"'])((?:/[A-Za-z0-9._-]+)+/?[A-Za-z0-9._-]*(?:\.[A-Za-z0-9._-]+)?)"#);
regex_fn!(relative_path_re, r"\b(?:\.{1,2}/)?(?:[A-Za-z0-9._-]+/)+[A-Za-z0-9._-]+\b");
regex_fn!(dotted_tech_token_re, r#"(?i)\b[A-Za-z0-9_-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|markdown|html|css|scss|sass|yml|yaml|toml|env|txt|csv|tsv|xml|sql|sqlite|db|png|jpg|jpeg|webp|avif|gif|svg|pdf|zip|gz|tgz|log|lock|wasm|py|rb|go|rs|java|kt|php|sh|bash|zsh|fish|ps1|bat|cmd)\b(?:/[^\s<>"'`]*)?"#);
regex_fn!(special_file_re, r#"(^|[\s(\[{"'])(\.env(?:\.[A-Za-z0-9_-]+)*|\.gitignore|\.npmrc|Dockerfile|Containerfile|Makefile|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig\.json|vite\.config\.[cm]?[jt]s|tailwind\.config\.[cm]?[jt]s)\b"#);
regex_fn!(package_re, r#"(^|[\s(\[{"'])((?:@[A-Za-z0-9_.-]+/)?[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+(?:@[A-Za-z0-9_.:-]+)?|node:[A-Za-z0-9_./-]+|[A-Za-z0-9_.-]+@[vV]?\d+(?:\.\d+){1,}(?:[-+][A-Za-z0-9.-]+)?)"#);
regex_fn!(model_tag_re, r"(?i)\b(?:qwen\d(?:\.\d+)?(?:-[A-Za-z0-9_.-]+)?|llama\d(?:\.\d+)?(?:-[A-Za-z0-9_.-]+)?|gemma\d?(?:-[A-Za-z0-9_.-]+)?|mistral(?:-[A-Za-z0-9_.-]+)?|mixtral(?:-[A-Za-z0-9_.-]+)?|phi\d(?:\.\d+)?(?:-[A-Za-z0-9_.-]+)?|deepseek(?:-[A-Za-z0-9_.-]+)?|codellama(?:-[A-Za-z0-9_.-]+)?|starcoder2?(?:-[A-Za-z0-9_.-]+)?)(?::[A-Za-z0-9_.-]+)?\b");
regex_fn!(handle_re, r"(^|[\s(\[{])(@[A-Za-z0-9_.-]+)");
regex_fn!(hashtag_re, r"(^|[\s(\[{])(#[A-Za-z][A-Za-z0-9_-]*)");
regex_fn!(command_re, r#"(?m)(^|[\n;]|[$>]\s*|\b(?:[Rr]un|[Tt]ry)\s+)((?:[A-Z_][A-Z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s+)*(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?[A-Za-z0-9:_-]+(?:\s+--?\S+)*|(?:npx|git|docker|docker-compose|kubectl|ssh|scp|sudo|systemctl|journalctl|ollama|python(?:3)?|pip(?:3)?|uv|node|deno|cargo|go|make)\s+[^\n`<>,;]*|curl\s+[^\n`<>,;]+))"#);
regex_fn!(config_assign_re, r#"\b(?:[A-Z][A-Z0-9_]{2,}|[a-z][a-z0-9_-]*(?:_?(?:url|uri|token|key|secret|password|model|path|host|port|base|endpoint|id|env|config|dir|file|name))|[a-z]+_[a-z0-9_]+)\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[A-Za-z0-9_./:@?=&%+#-]+)"#);
regex_fn!(json_pair_re, r#""[^"\n]{1,80}"\s*:\s*(?:"[^"\n]*"|-?\d+(?:\.\d+)?|true|false|null)"#);
regex_fn!(secret_re, r"\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sha256:[A-Fa-f0-9]{32,}|[A-Fa-f0-9]{32,})\b");
regex_fn!(ticket_re, r"\b(?:[A-Z][A-Z0-9]{1,10}-\d{1,8}|(?:PR|MR|Issue|Ticket|INV|Order|Case)\s*#?\s*\d{1,12}|#\d{1,8})\b");
regex_fn!(uuid_re, r"(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b");
regex_fn!(hash_re, r"(?i)\b[a-f0-9]{12,}\b");
regex_fn!(version_re, r"\bv?\d+(?:\.\d+){1,}(?:[-+][A-Za-z0-9.-]+)?\b");
regex_fn!(measurement_re, r"(?i)\b(?:\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:hp|whp|bhp|psi|bar|rpm|mph|kph|kmh|gb|mb|kb|tb|ms|sec|s|kg|g|lb|lbs|oz|mm|cm|m|km|in|ft|yd|v|w|kw|mah|hz|khz|mhz|ghz|%|°c|°f)|0x[A-Fa-f0-9]+|[A-Z]?\d+[A-Z]{1,4}|[A-Z]{1,4}\d+[A-Z0-9]*|[A-Z]{1,4}(?:-[A-Z0-9]{1,4})+)\b");
regex_fn!(special_tech_token_re, r#"(^|[\s(\[{"'])(C\+\+|C#)($|[\s.,;:!?)}\]>"'])"#);
regex_fn!(chat_slang_re, r"(?i)\b(?:lol|lmao|lmfao|rofl|haha|hahaha|hehe|omg|wtf|btw|imo|imho|idk|tbh|fyi|brb|irl|gg|np|thx|ty|rn|smh|ngl|fr|afaik|fwiw|asap|dm|pm|jk|ikr|nvm|tldr|tl;dr|noob|whadda|whaddya|whatcha|watcha|whatchu|gonna|gotta|wanna|kinda|sorta|dunno|lemme|gimme|yall|ya|cuz|sup|bro|bruh|yo|finna|periodt|lowkey|deadass|imma|ight|wyd|istg)\b|y'all|ain't");
regex_fn!(phonetic_casual_re, r"(?i)\b(?:wha+d+(?:a|ya|da)+|wha+d+u+p+|wha+t?cha+|wha+t?chu+|go+n+a+|got+a+|wan+a+|kin+da+|sor+ta+|du+n+o+|lem+e+|gim+e+|y['’]?all|ain['’]?t)\b");
regex_fn!(proper_noun_re, r"\b(?:OpenGrammar|OGrammar|Grammarly|Obsidian|Ollama|RouteLLM|Abacus|GitHub|GitLab|Discord|Reddit|Chrome|Harper|TypeScript|JavaScript|Node\.js|React|Vite)\b");
regex_fn!(env_token_re, r"\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b");
regex_fn!(code_token_re, r"\b(?:[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+|[A-Za-z]+[A-Z][A-Za-z0-9]*|[A-Za-z]+[0-9]+[A-Za-z0-9]*|[A-Za-z0-9]*[0-9]+[A-Za-z]+[A-Za-z0-9]*)\b");

#[cfg(test)]
mod tests {
    use super::*;

    fn protected_texts(text: &str) -> Vec<String> {
        protected_spans(text)
            .into_iter()
            .map(|(start, end)| text.chars().skip(start).take(end - start).collect())
            .collect()
    }

    #[test]
    fn finds_representative_protected_spans() {
        let spans = protected_texts(
            "Run sudo systemctl restart ollama for https://example.com/a, /tmp/app.json, sk-abc1234567890abcdef, getAdress, and periodt.",
        );

        // Coverage-based spec: every sensitive token must be inside SOME protected
        // span (overlapping spans get merged, so a token may be subsumed by a larger
        // command span rather than standalone — that's fine, it's still protected).
        // The inline command/prose boundary is best-effort (regex can't distinguish a
        // service-name arg from a following English word), so we assert the command
        // core is covered AND that the command span no longer swallows to end-of-line.
        let covered = |needle: &str| spans.iter().any(|span| span.contains(needle));
        assert!(covered("systemctl restart ollama"), "{spans:#?}");
        assert!(covered("https://example.com/a"), "{spans:#?}");
        assert!(covered("/tmp/app.json"), "{spans:#?}");
        assert!(covered("sk-abc1234567890abcdef"), "{spans:#?}");
        assert!(covered("getAdress"), "{spans:#?}");
        assert!(covered("periodt"), "{spans:#?}");
        // anti-over-greed: the command span must not run all the way to the trailing slang.
        assert!(!spans.iter().any(|span| span.contains("systemctl") && span.contains("periodt")), "{spans:#?}");
    }
}
