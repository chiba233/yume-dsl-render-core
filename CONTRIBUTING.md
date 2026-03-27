**English** | [中文](./CONTRIBUTING.zh-CN.md)

# Contributing to yumeDSL

Thanks for your interest in contributing! This guide covers how to set up the project, run tests, and submit changes.

## Ecosystem

| Package                                                           | Description                                               |
|-------------------------------------------------------------------|-----------------------------------------------------------|
| [`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL)       | Parser core — text to token tree                          |
| **`yume-dsl-token-walker`**                                       | Interpreter core — token tree to output nodes (this repo) |
| [`yume-dsl-shiki-highlight`](https://github.com/chiba233/yumeDSL) | Highlight layer — structural tree to colored tokens       |

## Prerequisites

- **Node.js** >= 18
- **pnpm** (recommended) — `npm install -g pnpm`

## Getting started

```bash
git clone https://github.com/chiba233/yumeDSL.git
cd yumeDSL
pnpm install

# Build
pnpm build

# Run tests
npm test
```

## Development workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b fix/your-description
   ```
2. Make your changes.
3. Run tests:
   ```bash
   npm test
   ```
4. Commit with a clear message (see [Commit conventions](#commit-conventions)).
5. Open a pull request.

## Commit conventions

Use a short prefix to describe the type of change:

| Prefix      | Usage                                                   |
|-------------|---------------------------------------------------------|
| `feat:`     | New feature                                             |
| `fix:`      | Bug fix                                                 |
| `docs:`     | Documentation only                                      |
| `test:`     | Adding or updating tests                                |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |
| `chore:`    | Build, CI, tooling changes                              |

Example:

```
fix(token-walker): preserve handler order during recursive walk
```

## Code guidelines

- **No `as any`** — fix the type instead of bypassing the checker.
- **Avoid `any`** — use it only at clear boundaries when narrower types are exhausted.
- **Prefer type guards and union narrowing** over type assertions.
- Keep runtime dependencies minimal. This package should stay focused on token walking and interpretation.

## Testing

- Tests live in the `tests/` directory.
- When fixing a bug, add a test case that reproduces the issue before writing the fix.
- Do not modify existing tests without discussion — if a test seems wrong, open an issue first.

## Reporting bugs

Please use the [Bug Report](https://github.com/chiba233/yumeDSL/issues/new?template=bug_report.yml) template. Include:

1. Which package and version is affected
2. Minimal reproduction code
3. Expected vs actual behavior

## Suggesting features

Use the [Feature Request](https://github.com/chiba233/yumeDSL/issues/new?template=feature_request.yml) template.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
