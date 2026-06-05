# Using OGrammar — User Guide

A complete guide to the **OGrammar browser extension's** features. For OS-wide use on
Windows, see [OGrammar Desktop](31-desktop-app.md); both products share the same engine.

---

## Contents

1. [Getting started](#getting-started)
2. [How checking works](#how-checking-works)
3. [Reviewing and applying fixes](#reviewing-and-applying-fixes)
4. [Autocorrect](#autocorrect)
5. [Tone rewriting](#tone-rewriting)
6. [Writing statistics](#writing-statistics)
7. [Custom dictionary](#custom-dictionary)
8. [Writing preferences](#writing-preferences)
9. [Site-specific settings](#site-specific-settings)
10. [Tips](#tips)

---

## Getting started

1. **Install the extension** — see [04-browser-extension-setup.md](04-browser-extension-setup.md).
2. **(Optional) add an AI key** — Options → choose a provider, paste your key, pick a
   model. Skip this to use the local engine only.
3. **Test it** — open a text box and type `i recieved teh package`. A red underline
   appears under the mistakes.

---

## How checking works

OGrammar uses a **two-tier engine**:

1. **Harper (local, instant).** The on-device [Harper](https://writewithharper.com)
   engine checks spelling, grammar, punctuation, capitalization, and style. It runs
   100% in your browser — no network, no key.
2. **LLM tier (optional, bring-your-own-key).** If you add a provider key, OGrammar also
   runs context/sentence-level review. Its findings are **merged with Harper's and
   de-duplicated — Harper wins on overlap** — and shown as a separate layer.

There is **no backend** and no built-in rule file; Harper replaced the old rule-based
engine. See [GRAMMAR_RULES.md](../GRAMMAR_RULES.md) for the rule philosophy.

### Underline colors

| Color | Source | Meaning |
|-------|--------|---------|
| **Red (solid)** | Harper (local) | Spelling / grammar / punctuation / capitalization / style |
| **Blue (dotted)** | LLM tier (optional) | Context / sentence-level suggestions |

### When it checks

As you type, OGrammar checks shortly after you pause (a brief debounce), in inputs,
textareas, and rich/contenteditable editors — Gmail, Google Docs, Notion, and most web
text boxes. It does not run on non-editable text, PDFs, or images.

---

## Reviewing and applying fixes

Click any underlined text to open its card:

```
┌─────────────────────────────┐
│ 🔴 Spelling                 │
│                             │
│ recieved → received         │
│                             │
│ Common misspelling.         │
│                             │
│ [Apply] [Ignore] [+ Dict]   │
└─────────────────────────────┘
```

- **Apply** — replace the text with the suggestion.
- **Ignore** — dismiss this instance.
- **Add to dictionary** — never flag this word again (see [Custom dictionary](#custom-dictionary)).

High-confidence mechanical fixes (capitalization, punctuation, small-edit spelling) are
offered as one-click **quick-fixes**. Contextual changes from the LLM tier are shown as
non-destructive suggestions you review before applying.

---

## Autocorrect

*(Opt-in — off by default.)* When enabled in Options, OGrammar auto-applies **only
high-confidence** fixes to text you've **just typed** (caret at the end) — never the word
you're mid-typing, never older text. Grammar, style, and multi-option fixes are never
auto-applied.

**Revert-learning:** if you undo an autocorrect, that exact `word → correction` is added
to a persistent "never autocorrect this" list (stored via `chrome.storage.sync`, so it
follows you across signed-in profiles).

---

## Tone rewriting

Rewrite selected text in a different tone (formal, casual, professional, concise, and
more). Requires an AI provider.

1. Select text in an editable field on any page.
2. A small **rewrite bubble** appears near the selection — click it.
3. Choose a tone, review the result, then **Apply**.

See [10-tone-rewriting.md](10-tone-rewriting.md) for the full guide and examples.

---

## Writing statistics

OGrammar computes readability and vocabulary metrics for your text — word/sentence/
paragraph counts, Flesch Reading Ease, Flesch-Kincaid grade, reading/speaking time, and
vocabulary diversity. View them from the popup or Options.

See [11-writing-statistics.md](11-writing-statistics.md) for what each metric means.

---

## Custom dictionary

Add words OGrammar should never flag — names, brands, technical terms, jargon.

- **From a card:** click an underlined word → **Add to dictionary**.
- **In Options:** Options → **Custom dictionary** → add words, or **import** a list
  (one word per line) and **export** for backup.

---

## Writing preferences

Sometimes you only want typos caught, or you want to silence style nits. In Options →
**Writing preferences**, toggle which categories are active:

- **Grammar** — subject-verb agreement, pronouns, irregular verbs
- **Spelling** — typos and confused words
- **Punctuation** — commas, apostrophes, hyphens, spacing
- **Style & tone** — passive voice, formality, wordy phrasing
- **Clarity** — readability and redundancy

Disabling a category stops those checks everywhere immediately.

---

## Site-specific settings

Control OGrammar per website:

- **Quick disable:** click the icon → toggle **Enable on this site**.
- **In Options:** Options → **Site settings** → add a domain (e.g. `twitter.com`) and
  set it enabled/disabled.

Good candidates to disable: code editors, sites with custom/canvas text inputs, or places
where you write casually.

---

## Tips

- **Start key-free.** Harper alone catches spelling, grammar, and punctuation offline.
  Add an AI key when you want context-level review or tone rewriting.
- **Build your dictionary early.** Add names and technical terms so they stop getting
  flagged.
- **Use writing preferences** to match the site — strict for documents, typos-only for
  chat.
- **Want coverage outside the browser?** Install the [desktop app](31-desktop-app.md);
  it checks native Windows apps and yields browser windows to this extension.

---

## Related

- [Browser setup](04-browser-extension-setup.md)
- [AI providers](07-ai-providers.md)
- [Tone rewriting](10-tone-rewriting.md)
- [Writing statistics](11-writing-statistics.md)
- [Troubleshooting](18-troubleshooting.md)
