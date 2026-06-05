# Contributing to OpenGrammar

First off, thank you for considering contributing to OpenGrammar! It's people like you that make OpenGrammar such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct.

## How Can I Contribute?

### Reporting Bugs

- **Check if it has already been reported** by searching through GitHub issues.
- If you can't find an open issue addressing the problem, **open a new one** using the Bug Report template.

### Suggesting Enhancements

- **Check if it has already been suggested** by searching through GitHub issues.
- **Open a new issue** using the Feature Request template.

### Pull Requests

1. **Fork the repository** and create your branch.
2. **Make your changes** in the relevant product (see below).
3. **Ensure checks pass**: extension → `bun x tsc --noEmit`; desktop → `cargo build` + `cargo test`.
4. **Keep the engine at parity** — if you change the LLM prompt/routing/protected-text rules,
   mirror the change in *both* the extension (`background/llmClient.ts`, `issuePolicy.ts`,
   `shared/protectedText.ts`) and the desktop engine (`ograms-engine/src/llm.rs`).
5. **Issue a Pull Request** with a clear description.

## Development Setup

OGrammar is **two products** — see **[docs/13-architecture.md](docs/13-architecture.md)** and
**[docs/14-development.md](docs/14-development.md)** for the full guide.

**Browser extension** (TypeScript; we use **Bun**):
```bash
cd opengrammar/extension
bun install
bun run dev        # or: bun run build ; bun x tsc --noEmit
# Optional backend:
cd ../backend && bun install && bun dev
```

**Desktop app** (Rust, Windows):
```powershell
cd desktop
cargo build --release -p ograms-hotkey
cargo test -p ograms-engine -p ograms-hotkey
```

## Community

If you have questions or want to discuss ideas, feel free to open a GitHub Discussion!
