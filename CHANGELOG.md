# Changelog

### 1.0.2

- Added async interpretation API — a full async mirror of the synchronous core
- New core functions: `interpretTokensAsync`, `interpretTextAsync`
- New helper functions: `fromAsyncHandlerMap`, `wrapAsyncHandlers`, `collectNodesAsync`
- New types: `AsyncInterpretRuleset`, `AsyncInterpretResult`, `AsyncResolvedResult`,
  `AsyncInterpretHelpers`, `AsyncUnhandledStrategy`, `AsyncTokenHandler`, `Awaitable`
- Async API uses `AsyncGenerator` / `AsyncIterable` throughout — preserves lazy, streaming semantics
- `AsyncInterpretRuleset.createText` is intentionally synchronous (`(text: string) => TNode`);
  only `interpret` and `onUnhandled` strategy functions accept `Awaitable` returns
- Error handling, recursion detection, and `onError` behavior are identical to the synchronous API
- No breaking changes to existing synchronous exports

### 1.0.1

- Updated the documentation to reflect the current recommended parser setup and examples
- `onError` callback context now includes `position?: SourceSpan` — surfaces the source location of the
    token that triggered the error, when position tracking is enabled in the upstream parser
    (`createParser({ trackPositions: true, ... })` or equivalent)
- No breaking changes; `position` is optional and `undefined` when position tracking is not enabled

### 1.0.0

- Stable release — API is finalized
- Updated `yume-dsl-rich-text` dependency to `^1.0.1`
- Updated `typescript` dev dependency from `^5.7.0` to `^6.0.2`

### 0.1.3

- Added `interpretText(input, parser, ruleset, env)` as the recommended convenience entry for derived-package usage
- Updated documentation to promote `interpretText` in Quick Start and API docs
- Clarified package boundaries: `token-walker` consumes `TextToken[]`, while structural parsing belongs to
  `yume-dsl-rich-text` / `yume-dsl-shiki-highlight`
- Updated `yume-dsl-rich-text` dependency to `^0.1.20`

### 0.1.2

- Update markdown
- add ecosystem package

### 0.1.1

- Added helpers: `createRuleset`, `fromHandlerMap`, `dropToken`, `unwrapChildren`, `wrapHandlers`, `debugUnhandled`,
  `collectNodes`
- Added `TokenHandler` type — shorthand for a single handler function signature
- `debugUnhandled` returns narrow type `{ type: "text"; text: string }` — compatible with any `TNode` without fake
  generics
- `fromHandlerMap` handler return type narrowed to `ResolvedResult` — handlers should not return `"unhandled"`
- Split source into `types.ts`, `interpret.ts`, `helpers.ts` (barrel re-export from `index.ts`)
- README: added table of contents, exports table, grouped sections by category
- Update "yume-dsl-rich-text" to "0.1.14"

### 0.1.0

- Added `onError` observer — called with `{ error, phase, token, env }` before any error is thrown
- Error phases: `"interpret"`, `"flatten"`, `"traversal"`, `"internal"`
- Errors from `onUnhandled` strategy functions are now caught and routed through `onError`
- Renamed package to `yume-dsl-token-walker`
- `renderTokens` → `interpretTokens`, `TokenRenderer` → `InterpretRuleset`
- `defer` → `unhandled`, `empty` → `drop`
- Split `{ type: "text"; text?: string }` into `{ type: "text"; text: string }` + `{ type: "flatten" }`
- Replaced `strict` + `fallbackRender` with `onUnhandled` strategy enum
- Strategy function return type narrowed to `ResolvedResult` (cannot return `"unhandled"`)
- Removed `collectRendered`
