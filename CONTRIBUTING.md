# Contributing to OGrammar

First off, thank you for considering contributing to OGrammar! It's people like you that make OGrammar such a great tool.

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
2. **Make your changes** in the extension (see below).
3. **Ensure checks pass**: `bun x tsc --noEmit`.
4. **Issue a Pull Request** with a clear description.

## Development Setup

See **[docs/13-architecture.md](docs/13-architecture.md)** and
**[docs/14-development.md](docs/14-development.md)** for the full guide.

**Browser extension** (TypeScript; we use **Bun**):
```bash
cd opengrammar/extension
bun install
bun run dev        # or: bun run build ; bun x tsc --noEmit
```

## Community

If you have questions or want to discuss ideas, feel free to open a GitHub Discussion!
