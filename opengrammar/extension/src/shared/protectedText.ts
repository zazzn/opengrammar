import type { Issue } from '../types';

export type ProtectedSpanReason =
  | 'url'
  | 'email'
  | 'handle'
  | 'hashtag'
  | 'path'
  | 'inline-code'
  | 'code-block'
  | 'markup'
  | 'markdown-url'
  | 'package'
  | 'command'
  | 'config'
  | 'secret'
  | 'version-or-id'
  | 'measurement'
  | 'chat-slang'
  | 'proper-noun'
  | 'code-token';

export interface ProtectedSpan {
  start: number;
  end: number;
  reason: ProtectedSpanReason;
}

export interface ProtectedMaskFragment {
  placeholder: string;
  value: string;
  reason: ProtectedSpanReason;
}

export interface ProtectedTextMask {
  originalText: string;
  maskedText: string;
  fragments: ProtectedMaskFragment[];
}

type MutableSpan = ProtectedSpan;

const FENCED_CODE_RE = /(?:^|\n)(`{3,}|~{3,})[\s\S]*?\n\1/g;
const BB_CODE_RE = /\[(?:code|pre)]([\s\S]*?)\[\/(?:code|pre)]/gi;
const HTML_CODE_BLOCK_RE = /<(?:code|pre|script|style)\b[^>]*>[\s\S]*?<\/(?:code|pre|script|style)>/gi;
const HTML_TAG_RE = /<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[A-Za-z_:][A-Za-z0-9_:.-]*(?:=(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/g;
const URL_RE = /\b(?:(?:https?|ftp|ssh):\/\/|www\.)[^\s<>"'`]+|\b(?:mailto|tel):[^\s<>"'`]+|\b(?:localhost|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?(?:\/[^\s<>"'`]*)?/gi;
const GIT_REMOTE_RE = /\bgit@[A-Za-z0-9.-]+:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\b/g;
const IPV6_RE = /\[(?:[A-F0-9]{0,4}:){2,7}[A-F0-9]{0,4}](?::\d+)?(?:\/[^\s<>"'`]*)?/gi;
const DOMAIN_RE = /\b(?:[a-z0-9-]+\.)+[a-z]{2,24}(?::\d+)?(?:\/[^\s<>"'`]*)?/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const INLINE_CODE_RE = /`[^`\n]+`/g;
const MARKDOWN_URL_RE = /!?\[[^\]]*]\(([^)\s]+)\)/g;
const WINDOWS_PATH_RE = /\b[A-Za-z]:\\[^\s<>"'`]+/g;
const UNIX_PATH_RE = /(^|[\s([{"'])((?:\/[A-Za-z0-9._-]+)+\/?[A-Za-z0-9._-]*(?:\.[A-Za-z0-9._-]+)?)/g;
const RELATIVE_PATH_RE = /\b(?:\.{1,2}\/)?(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+\b/g;
const DOTTED_TECH_TOKEN_RE = /\b[A-Za-z0-9_-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|markdown|html|css|scss|sass|yml|yaml|toml|env|txt|csv|tsv|xml|sql|sqlite|db|png|jpg|jpeg|webp|avif|gif|svg|pdf|zip|gz|tgz|log|lock|wasm|py|rb|go|rs|java|kt|php|sh|bash|zsh|fish|ps1|bat|cmd)\b(?:\/[^\s<>"'`]*)?/gi;
const SPECIAL_FILE_RE = /(^|[\s([{"'])(\.env(?:\.[A-Za-z0-9_-]+)*|\.gitignore|\.npmrc|Dockerfile|Containerfile|Makefile|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig\.json|vite\.config\.[cm]?[jt]s|tailwind\.config\.[cm]?[jt]s)\b/g;
const PACKAGE_RE = /(^|[\s([{"'])((?:@[A-Za-z0-9_.-]+\/)?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+(?:@[A-Za-z0-9_.:-]+)?|node:[A-Za-z0-9_./-]+|[A-Za-z0-9_.-]+@[vV]?\d+(?:\.\d+){1,}(?:[-+][A-Za-z0-9.-]+)?)/g;
const MODEL_TAG_RE = /\b(?:qwen\d(?:\.\d+)?(?:-[A-Za-z0-9_.-]+)?|llama\d(?:\.\d+)?(?:-[A-Za-z0-9_.-]+)?|gemma\d?(?:-[A-Za-z0-9_.-]+)?|mistral(?:-[A-Za-z0-9_.-]+)?|mixtral(?:-[A-Za-z0-9_.-]+)?|phi\d(?:\.\d+)?(?:-[A-Za-z0-9_.-]+)?|deepseek(?:-[A-Za-z0-9_.-]+)?|codellama(?:-[A-Za-z0-9_.-]+)?|starcoder2?(?:-[A-Za-z0-9_.-]+)?)(?::[A-Za-z0-9_.-]+)?\b/gi;
const HANDLE_RE = /(^|[\s([{])(@[A-Za-z0-9_.-]+)/g;
const HASHTAG_RE = /(^|[\s([{])(#[A-Za-z][A-Za-z0-9_-]*)/g;
const COMMAND_RE = /(^|[\n;]|[$>]\s*|\b(?:[Rr]un|[Tt]ry)\s+)((?:[A-Z_][A-Z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]+)\s+)*(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?[A-Za-z0-9:_-]+(?:\s+--?\S+)*|(?:npx|git|docker|docker-compose|kubectl|ssh|scp|ollama|python(?:3)?|pip(?:3)?|uv|node|deno|cargo|go|make)\s+[^\n`<>]*|curl\s+[^\n`<>]+))/g;
const CONFIG_ASSIGN_RE = /\b(?:[A-Z][A-Z0-9_]{2,}|[a-z][a-z0-9_-]*(?:_?(?:url|uri|token|key|secret|password|model|path|host|port|base|endpoint|id|env|config|dir|file|name))|[a-z]+_[a-z0-9_]+)\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[A-Za-z0-9_./:@?=&%+#-]+)/g;
const JSON_PAIR_RE = /"[^"\n]{1,80}"\s*:\s*(?:"[^"\n]*"|-?\d+(?:\.\d+)?|true|false|null)/g;
const SECRET_RE = /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sha256:[A-Fa-f0-9]{32,}|[A-Fa-f0-9]{32,})\b/g;
const TICKET_RE = /\b(?:[A-Z][A-Z0-9]{1,10}-\d{1,8}|(?:PR|MR|Issue|Ticket|INV|Order|Case)\s*#?\s*\d{1,12}|#\d{1,8})\b/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const HASH_RE = /\b[a-f0-9]{12,}\b/gi;
const VERSION_RE = /\bv?\d+(?:\.\d+){1,}(?:[-+][A-Za-z0-9.-]+)?\b/g;
const MEASUREMENT_RE = /\b(?:\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:hp|whp|bhp|psi|bar|rpm|mph|kph|kmh|gb|mb|kb|tb|ms|sec|s|kg|g|lb|lbs|oz|mm|cm|m|km|in|ft|yd|v|w|kw|mah|hz|khz|mhz|ghz|%|°c|°f)|0x[A-Fa-f0-9]+|[A-Z]?\d+[A-Z]{1,4}|[A-Z]{1,4}\d+[A-Z0-9]*|[A-Z]{1,4}(?:-[A-Z0-9]{1,4})+)\b/g;
const SPECIAL_TECH_TOKEN_RE = /(^|[\s([{"'])(C\+\+|C#)(?=$|[\s.,;:!?)}\]>"'])/g;
const CHAT_SLANG_RE = /\b(?:lol|lmao|lmfao|rofl|haha|hahaha|hehe|omg|wtf|btw|imo|imho|idk|tbh|fyi|brb|irl|gg|np|thx|ty|rn|smh|ngl|fr|afaik|fwiw|asap|dm|pm|jk|ikr|nvm|tldr|tl;dr|noob|whadda|whaddya|whatcha|watcha|whatchu|gonna|gotta|wanna|kinda|sorta|dunno|lemme|gimme|yall|ya|cuz|sup|bro|bruh|yo)\b|y'all|ain't/gi;
const PHONETIC_CASUAL_RE = /\b(?:wha+d+(?:a|ya|da)+|wha+d+u+p+|wha+t?cha+|wha+t?chu+|go+n+a+|got+a+|wan+a+|kin+da+|sor+ta+|du+n+o+|lem+e+|gim+e+|y['’]?all|ain['’]?t)\b/gi;
const PROPER_NOUN_RE = /\b(?:OpenGrammar|OGrammar|Grammarly|Obsidian|Ollama|RouteLLM|Abacus|GitHub|GitLab|Discord|Reddit|Chrome|Harper|TypeScript|JavaScript|Node\.js|React|Vite)\b/g;
const ENV_TOKEN_RE = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g;
const CODE_TOKEN_RE = /\b(?:[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+|[A-Za-z]+[A-Z][A-Za-z0-9]*|[A-Za-z]+[0-9]+[A-Za-z0-9]*|[A-Za-z0-9]*[0-9]+[A-Za-z]+[A-Za-z0-9]*)\b/g;

export function findProtectedSpans(text: string): ProtectedSpan[] {
  const spans: MutableSpan[] = [];

  collectRegexSpans(text, FENCED_CODE_RE, 'code-block', spans);
  collectRegexSpans(text, BB_CODE_RE, 'code-block', spans);
  collectRegexSpans(text, HTML_CODE_BLOCK_RE, 'code-block', spans);
  collectRegexSpans(text, HTML_TAG_RE, 'markup', spans);
  collectRegexSpans(text, URL_RE, 'url', spans);
  collectRegexSpans(text, GIT_REMOTE_RE, 'url', spans);
  collectRegexSpans(text, IPV6_RE, 'url', spans);
  collectRegexSpans(text, DOMAIN_RE, 'url', spans);
  collectRegexSpans(text, EMAIL_RE, 'email', spans);
  collectRegexSpans(text, INLINE_CODE_RE, 'inline-code', spans);
  collectGroupSpans(text, MARKDOWN_URL_RE, 1, 'markdown-url', spans);
  collectRegexSpans(text, WINDOWS_PATH_RE, 'path', spans);
  collectGroupSpans(text, UNIX_PATH_RE, 2, 'path', spans);
  collectRegexSpans(text, RELATIVE_PATH_RE, 'path', spans);
  collectRegexSpans(text, DOTTED_TECH_TOKEN_RE, 'path', spans);
  collectGroupSpans(text, SPECIAL_FILE_RE, 2, 'path', spans);
  collectGroupSpans(text, PACKAGE_RE, 2, 'package', spans);
  collectRegexSpans(text, MODEL_TAG_RE, 'code-token', spans);
  collectGroupSpans(text, HANDLE_RE, 2, 'handle', spans);
  collectGroupSpans(text, HASHTAG_RE, 2, 'hashtag', spans);
  collectGroupSpans(text, COMMAND_RE, 2, 'command', spans);
  collectRegexSpans(text, CONFIG_ASSIGN_RE, 'config', spans);
  collectRegexSpans(text, JSON_PAIR_RE, 'config', spans);
  collectRegexSpans(text, SECRET_RE, 'secret', spans);
  collectRegexSpans(text, TICKET_RE, 'version-or-id', spans);
  collectRegexSpans(text, UUID_RE, 'version-or-id', spans);
  collectRegexSpans(text, HASH_RE, 'version-or-id', spans);
  collectRegexSpans(text, VERSION_RE, 'version-or-id', spans);
  collectRegexSpans(text, MEASUREMENT_RE, 'measurement', spans);
  collectGroupSpans(text, SPECIAL_TECH_TOKEN_RE, 2, 'measurement', spans);
  collectRegexSpans(text, CHAT_SLANG_RE, 'chat-slang', spans);
  collectRegexSpans(text, PHONETIC_CASUAL_RE, 'chat-slang', spans);
  collectRegexSpans(text, PROPER_NOUN_RE, 'proper-noun', spans);
  collectRegexSpans(text, ENV_TOKEN_RE, 'code-token', spans);
  collectRegexSpans(text, CODE_TOKEN_RE, 'code-token', spans);

  return mergeSpans(spans);
}

export function maskProtectedText(text: string): ProtectedTextMask {
  const spans = findProtectedSpans(text);
  if (spans.length === 0) {
    return { originalText: text, maskedText: text, fragments: [] };
  }

  let maskedText = '';
  let cursor = 0;
  const fragments: ProtectedMaskFragment[] = [];

  spans.forEach((span, index) => {
    const placeholder = `[[OG_PROTECTED_${index + 1}]]`;
    maskedText += text.slice(cursor, span.start);
    maskedText += placeholder;
    fragments.push({
      placeholder,
      value: text.slice(span.start, span.end),
      reason: span.reason,
    });
    cursor = span.end;
  });

  maskedText += text.slice(cursor);
  return { originalText: text, maskedText, fragments };
}

export function restoreProtectedText(text: string, mask: ProtectedTextMask): string {
  return mask.fragments.reduce(
    (restored, fragment) => restored.split(fragment.placeholder).join(fragment.value),
    text,
  );
}

export function preservesProtectedPlaceholders(text: string, mask: ProtectedTextMask): boolean {
  return mask.fragments.every((fragment) => text.includes(fragment.placeholder));
}

export function filterIssuesInProtectedSpans<T extends Pick<Issue, 'offset' | 'length'>>(
  issues: T[],
  spans: ProtectedSpan[],
): T[] {
  if (issues.length === 0 || spans.length === 0) return issues;
  return issues.filter((issue) => !isIssueInProtectedSpan(issue, spans));
}

export function isProtectedNonProseText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  return findProtectedSpans(trimmed).some((span) => span.start === 0 && span.end >= trimmed.length);
}

function isIssueInProtectedSpan(
  issue: Pick<Issue, 'offset' | 'length'>,
  spans: ProtectedSpan[],
): boolean {
  const start = issue.offset;
  const end = issue.offset + issue.length;
  return spans.some((span) => start < span.end && end > span.start);
}

function collectRegexSpans(
  text: string,
  regex: RegExp,
  reason: ProtectedSpanReason,
  spans: MutableSpan[],
) {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    pushSpan(spans, match.index, match.index + match[0].length, reason, text);
    if (match[0].length === 0) regex.lastIndex++;
  }
}

function collectGroupSpans(
  text: string,
  regex: RegExp,
  groupIndex: number,
  reason: ProtectedSpanReason,
  spans: MutableSpan[],
) {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const value = match[groupIndex];
    if (!value) continue;
    const groupStart = match[0].indexOf(value);
    if (groupStart === -1) continue;
    const start = match.index + groupStart;
    pushSpan(spans, start, start + value.length, reason, text);
    if (match[0].length === 0) regex.lastIndex++;
  }
}

function pushSpan(
  spans: MutableSpan[],
  start: number,
  end: number,
  reason: ProtectedSpanReason,
  text: string,
) {
  while (end > start && /[.,;:!?)}\]]/.test(text[end - 1] || '')) end--;
  if (end > start) spans.push({ start, end, reason });
}

function mergeSpans(spans: MutableSpan[]): ProtectedSpan[] {
  if (spans.length === 0) return [];

  const sorted = spans
    .filter((span) => span.start >= 0 && span.end > span.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const merged: ProtectedSpan[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (!last || span.start > last.end) {
      merged.push({ ...span });
      continue;
    }
    if (span.end > last.end) last.end = span.end;
  }
  return merged;
}
