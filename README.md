**English** | [中文](./README.zh-CN.md)

# @yume-dsl/render-core

<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

[![npm](https://img.shields.io/npm/v/@yume-dsl/render-core)](https://www.npmjs.com/package/@yume-dsl/render-core)
[![GitHub](https://img.shields.io/badge/GitHub-chiba233%2Fyume--dsl--render--core-181717?logo=github)](https://github.com/chiba233/yume-dsl-render-core)

A generic, lazy, generator-based renderer for
[`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) token trees.

**Rendering core only.**
This package provides the traversal contract and safety guarantees.
Concrete output (HTML, Vue, React, ...) is defined by your `TokenRenderer`.

---

## Ecosystem

| Package | Role |
|---------|------|
| [`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) | Parser core — text to token tree |
| **`@yume-dsl/render-core`** | Render core — token tree to output nodes (this package) |

---

## Install

```bash
npm install @yume-dsl/render-core
# or
pnpm add @yume-dsl/render-core
```

`yume-dsl-rich-text` is a dependency and will be installed automatically.

---

## Quick Start

```ts
import { parseRichText, createSimpleInlineHandlers } from "yume-dsl-rich-text";
import { renderTokens, collectRendered } from "@yume-dsl/render-core";

const handlers = createSimpleInlineHandlers(["bold", "italic"]);
const tokens = parseRichText("$$bold(a $$italic(b)$$ c)$$", { handlers });

const html = collectRendered(
  renderTokens(tokens, {
    createText: (text) => text,
    render: (token, helpers) => {
      if (token.type === "bold")
        return { type: "tokens", tokens: ["<strong>", ...helpers.renderChildren(token.value), "</strong>"] };
      if (token.type === "italic")
        return { type: "tokens", tokens: ["<em>", ...helpers.renderChildren(token.value), "</em>"] };
      return { type: "defer" };
    },
  }, {}),
).join("");

// → "<strong>a <em>b</em> c</strong>"
```

---

## API

### `renderTokens(tokens, renderer, env)`

Lazily traverses a `TextToken[]` tree and yields `TNode` values via a generator.

```ts
function* renderTokens<TNode, TEnv>(
  tokens: TextToken[],
  renderer: TokenRenderer<TNode, TEnv>,
  env: TEnv,
): Generator<TNode>;
```

- Streaming — nodes are yielded one at a time, never buffered into an array internally
- Recursion-safe — detects self-referencing tokens and throws
- Circular-safe — detects circular `value` arrays during `flattenText` and throws

### `collectRendered(iterable)`

Convenience helper that collects an `Iterable<TNode>` into `TNode[]`.

```ts
const collectRendered: <TNode>(iterable: Iterable<TNode>) => TNode[];
```

### `flattenText(value)`

Recursively extracts plain text from a `string | TextToken[]` value.

```ts
const flattenText: (value: string | TextToken[]) => string;
```

---

## TokenRenderer

The renderer you pass to `renderTokens`:

```ts
interface TokenRenderer<TNode, TEnv = unknown> {
  createText: (text: string) => TNode;
  render: (token: TextToken, helpers: RenderHelpers<TNode, TEnv>) => RenderResult<TNode>;
  fallbackRender?: (token: TextToken, helpers: RenderHelpers<TNode, TEnv>) => RenderResult<TNode>;
  strict?: boolean;
}
```

| Field | Description |
|-------|-------------|
| `createText` | Wrap a plain string into your node type |
| `render` | Map a DSL token to render result |
| `fallbackRender` | Called when `render` returns `"defer"` |
| `strict` | If `true`, throw when no renderer handles a token (default: `false`) |

---

## RenderResult

The return type of `render` and `fallbackRender`:

```ts
type RenderResult<TNode> =
  | { type: "tokens"; tokens: Iterable<TNode> }
  | { type: "text"; text?: string }
  | { type: "defer" }
  | { type: "empty" };
```

| Result | Meaning |
|--------|---------|
| `"tokens"` | Explicit render — yield the provided nodes |
| `"text"` | Emit text — uses `text` if provided, otherwise `flattenText(token.value)` |
| `"defer"` | Pass to `fallbackRender`; if none, strict mode throws, otherwise defaults to `"text"` |
| `"empty"` | Output nothing |

---

## RenderHelpers

Passed to `render` and `fallbackRender`:

```ts
interface RenderHelpers<TNode, TEnv = unknown> {
  renderChildren: (value: string | TextToken[]) => Iterable<TNode>;
  flattenText: (value: string | TextToken[]) => string;
  env: TEnv;
}
```

| Field | Description |
|-------|-------------|
| `renderChildren` | Recursively render child tokens — returns lazy `Iterable<TNode>` |
| `flattenText` | Extract plain text from a token value |
| `env` | User-provided environment, passed through from `renderTokens` |

---

## Safety

- **Self-recursion detection**: if a renderer feeds a token back into `renderChildren` referencing itself, an error is thrown immediately
- **Circular value detection**: `flattenText` tracks visited tokens per recursion path (not globally), so shared references are safe but true cycles throw

---

## Changelog

### 0.1.0

- Initial release
- Generator-based lazy `renderTokens` traversal
- `RenderResult` with `"tokens"`, `"text"`, `"defer"`, `"empty"` semantics
- `flattenText` with per-path circular detection
- `collectRendered` convenience helper

---

## License

MIT
