**English** | [中文](./README.zh-CN.md)

# yume-dsl-token-walker

<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

[![npm](https://img.shields.io/npm/v/yume-dsl-token-walker)](https://www.npmjs.com/package/yume-dsl-token-walker)
[![GitHub](https://img.shields.io/badge/GitHub-chiba233%2Fyume--dsl--token--walker-181717?logo=github)](https://github.com/chiba233/yume-dsl-token-walker)

A generic, lazy, generator-based token tree interpreter for
[`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL).

The package is named **token-walker** because its core job is to *walk* a token tree node by node.
The public API is called `interpretTokens` because from the caller's perspective, you are *interpreting* tokens into
output — the walking is an implementation detail.

You provide rules. It walks the tree, yields output nodes, and gets out of the way.

---

## Table of Contents

- [Ecosystem](#ecosystem)
- [Install](#install)
- [Quick Start](#quick-start)
- [Exports](#exports)
- [Examples](#examples)
    - [Use env to inject runtime context](#use-env-to-inject-runtime-context)
    - [Customize onUnhandled](#customize-onunhandled)
    - [Use flattenText inside a handler](#use-flattentext-inside-a-handler)
    - [Return structured nodes](#return-structured-nodes-instead-of-strings)
    - [Drop a token entirely](#drop-a-token-entirely)
- [Recommended Structure](#recommended-structure)
- [Real-world Example](#real-world-example)
- [API — Core](#api--core)
    - [interpretTokens](#interprettokenstokens-ruleset-env)
    - [flattenText](#flattentextvalue)
- [API — Helpers](#api--helpers)
    - [createRuleset](#createrulesetruleset)
    - [fromHandlerMap](#fromhandlermaphandlers)
    - [dropToken](#droptoken)
    - [unwrapChildren](#unwrapchildren)
    - [wrapHandlers](#wraphandlershandlers-wrap)
    - [debugUnhandled](#debugunhandledformat)
    - [collectNodes](#collectnodesiterable)
- [Types](#types)
    - [InterpretRuleset](#interpretruleset)
    - [InterpretResult](#interpretresult)
    - [ResolvedResult](#resolvedresult)
    - [UnhandledStrategy](#unhandledstrategy)
    - [InterpretHelpers](#interprethelpers)
- [Error Handling](#error-handling)
    - [onError](#onerror)
    - [Error phases](#error-phases)
    - [Logging errors without stopping iteration](#logging-errors-without-stopping-iteration)
- [Safety](#safety)
- [Changelog](#changelog)
- [License](#license)

---

## Ecosystem

```
text ──▶ yume-dsl-rich-text (parse) ──▶ TextToken[] ──▶ yume-dsl-token-walker (interpret) ──▶ TNode[]
```

| Package                                                                            | Role                                                    |
|------------------------------------------------------------------------------------|---------------------------------------------------------|
| [`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL)                        | Parser — text to token tree                             |
| **`yume-dsl-token-walker`**                                                        | Interpreter — token tree to output nodes (this package) |
| [`yume-dsl-shiki-highlight`](https://github.com/chiba233/yume-dsl-shiki-highlight) | Syntax highlighting — tokens or TextMate grammar        |

---

## Install

```bash
npm install yume-dsl-token-walker
# or
pnpm add yume-dsl-token-walker
```

`yume-dsl-rich-text` is a dependency and will be installed automatically.

---

## Quick Start

```ts
import {parseRichText, createSimpleInlineHandlers} from "yume-dsl-rich-text";
import {interpretTokens} from "yume-dsl-token-walker";

const handlers = createSimpleInlineHandlers(["bold"]);
const tokens = parseRichText("Hello $$bold(world)$$", {handlers});

const html = Array.from(
    interpretTokens(tokens, {
        createText: (text) => text,
        interpret: (token, helpers) => {
            if (token.type === "bold")
                return {type: "nodes", nodes: ["<strong>", ...helpers.interpretChildren(token.value), "</strong>"]};
            return {type: "unhandled"};
        },
    }, {}),
).join("");

// → "Hello <strong>world</strong>"
```

---

## Exports

All public exports at a glance:

| Export              | Kind     | Description                                                                       |
|---------------------|----------|-----------------------------------------------------------------------------------|
| `interpretTokens`   | function | Walk a token tree and yield output nodes (core)                                   |
| `flattenText`       | function | Extract plain text from a token value (standalone, does not go through `onError`) |
| `createRuleset`     | helper   | Identity function for `InterpretRuleset` type inference                           |
| `fromHandlerMap`    | helper   | Build an `interpret` function from a `Record<type, handler>` map                  |
| `dropToken`         | helper   | Handler that drops a token entirely — emits nothing                               |
| `unwrapChildren`    | helper   | Handler that passes through interpreted children without wrapping                 |
| `wrapHandlers`      | helper   | Wrap every handler in a record with a shared transformation                       |
| `debugUnhandled`    | helper   | Create an `onUnhandled` function that renders visible placeholders                |
| `collectNodes`      | helper   | `Array.from` sugar — collect lazy `Iterable<TNode>` into an array                 |
| `InterpretRuleset`  | type     | Ruleset interface passed to `interpretTokens`                                     |
| `InterpretResult`   | type     | Return type of `interpret` (5 variants)                                           |
| `ResolvedResult`    | type     | `InterpretResult` minus `"unhandled"`                                             |
| `InterpretHelpers`  | type     | Helpers object passed to `interpret` and strategy functions                       |
| `UnhandledStrategy` | type     | `"throw" \| "flatten" \| "drop" \| function`                                      |
| `TokenHandler`      | type     | Shorthand for a single handler function signature                                 |
| `TextResult`        | type     | `{ type: "text"; text: string }` — return type of `debugUnhandled`'s callback     |

---

## Examples

### Use `env` to inject runtime context

```ts
import {createSimpleInlineHandlers, createParser} from "yume-dsl-rich-text";
import {interpretTokens} from "yume-dsl-token-walker";

const dsl = createParser({
    handlers: createSimpleInlineHandlers(["bold"]),
});

const tokens = dsl.parse("Hello $$bold(world)$$");

const result = Array.from(
    interpretTokens(
        tokens,
        {
            createText: (text) => text,
            interpret: (token, helpers) => {
                if (token.type === "bold") {
                    return {
                        type: "nodes",
                        nodes: [
                            `<strong data-tone="${helpers.env.tone}">`,
                            ...helpers.interpretChildren(token.value),
                            "</strong>",
                        ],
                    };
                }

                return {type: "unhandled"};
            },
        },
        {tone: "soft"},
    ),
).join("");

// "Hello <strong data-tone=\"soft\">world</strong>"
```

Use this when your output depends on theme, locale, permissions, feature flags, or renderer config.

### Customize `onUnhandled`

By default, unhandled tokens fall back to `"flatten"`:

```ts
const result = Array.from(
    interpretTokens(
        tokens,
        {
            createText: (text) => text,
            interpret: () => ({type: "unhandled"}),
        },
        undefined,
    ),
).join("");
```

For stricter behavior:

```ts
const strictRuleset = {
    createText: (text: string) => text,
    interpret: () => ({type: "unhandled" as const}),
    onUnhandled: "throw" as const,
};
```

For custom fallback output:

```ts
const debugRuleset = {
    createText: (text: string) => text,
    interpret: () => ({type: "unhandled" as const}),
    onUnhandled: (token: { type: string }) => ({
        type: "text" as const,
        text: `[unhandled:${token.type}]`,
    }),
};
```

This is useful when:

- production should silently flatten unsupported tags
- tests should fail fast on missing handlers
- debug builds should expose unhandled token types

### Use `flattenText` inside a handler

Sometimes you do not want to recursively interpret a subtree. You just want its readable text.

```ts
import {createSimpleInlineHandlers, createSimpleBlockHandlers, createParser} from "yume-dsl-rich-text";
import {interpretTokens} from "yume-dsl-token-walker";

const dsl = createParser({
    handlers: {
        ...createSimpleInlineHandlers(["bold"]),
        ...createSimpleBlockHandlers(["info"]),
    },
    blockTags: ["info"],
});

const tokens = dsl.parse("$$info(Title | hello $$bold(world)$$)$$");

const result = Array.from(
    interpretTokens(
        tokens,
        {
            createText: (text) => text,
            interpret: (token, helpers) => {
                if (token.type === "info") {
                    return {
                        type: "text",
                        text: `[INFO] ${helpers.flattenText(token.value)}`,
                    };
                }

                if (token.type === "bold") {
                    return {
                        type: "nodes",
                        nodes: ["<strong>", ...helpers.interpretChildren(token.value), "</strong>"],
                    };
                }

                return {type: "unhandled"};
            },
        },
        undefined,
    ),
).join("");

// "[INFO] hello world"
```

Use `flattenText` when building search indexes, aria labels, previews, plain-text exports, or analytics labels.

### Return structured nodes instead of strings

`interpretTokens` does not care what `TNode` is. It can be strings, virtual nodes, AST nodes, or your own render model.

```ts
type HtmlNode =
    | { kind: "text"; value: string }
    | { kind: "element"; tag: string; children: HtmlNode[] };

const nodes = Array.from(
    interpretTokens<HtmlNode, void>(
        tokens,
        {
            createText: (text) => ({kind: "text", value: text}),
            interpret: (token, helpers) => {
                if (token.type === "bold") {
                    return {
                        type: "nodes",
                        nodes: [
                            {
                                kind: "element",
                                tag: "strong",
                                children: Array.from(helpers.interpretChildren(token.value)),
                            },
                        ],
                    };
                }

                return {type: "unhandled"};
            },
        },
        undefined,
    ),
);
```

This is the intended shape if you want to bridge the token tree into React, Vue, Svelte, HTML AST, or your own renderer.

### Drop a token entirely

```ts
const result = Array.from(
    interpretTokens(
        tokens,
        {
            createText: (text) => text,
            interpret: (token) => {
                if (token.type === "comment") {
                    return {type: "drop"};
                }

                return {type: "unhandled"};
            },
            onUnhandled: "flatten",
        },
        undefined,
    ),
).join("");
```

Use `"drop"` when a token is metadata-only and should produce no output.

---

## Recommended Structure

### Small project — inline interpret

Write everything in one file. No helpers needed.

```ts
const result = collectNodes(
    interpretTokens(tokens, {
        createText: (t) => t,
        interpret: (token, helpers) => {
            if (token.type === "bold")
                return {type: "nodes", nodes: ["<b>", ...helpers.interpretChildren(token.value), "</b>"]};
            return {type: "unhandled"};
        },
    }, {}),
);
```

### Medium project — fromHandlerMap + handlers file

Split handler definitions into their own file. Use `createRuleset` for type safety.

```
src/
  dsl/
    handlers.ts    ← handler map
    ruleset.ts     ← createRuleset + fromHandlerMap
    interpret.ts   ← call interpretTokens
```

```ts
// handlers.ts
import type {InterpretHelpers, ResolvedResult} from "yume-dsl-token-walker";

type Handler = (token: TextToken, helpers: InterpretHelpers<string, Env>) => ResolvedResult<string>;

// shared wrapping logic — just a plain function, not a library export
const wrapTag = (tag: string, token: TextToken, helpers: InterpretHelpers<string, Env>): ResolvedResult<string> => ({
    type: "nodes",
    nodes: [`<${tag}>`, ...helpers.interpretChildren(token.value), `</${tag}>`],
});

export const handlers: Record<string, Handler> = {
    bold: (token, h) => wrapTag("strong", token, h),
    italic: (token, h) => wrapTag("em", token, h),
    code: (token) => ({type: "text", text: `<code>${token.value}</code>`}),
    comment: () => ({type: "drop"}),
};
```

```ts
// ruleset.ts
import {createRuleset, fromHandlerMap, debugUnhandled} from "yume-dsl-token-walker";
import {handlers} from "./handlers";

export const ruleset = createRuleset({
    createText: (text) => text,
    interpret: fromHandlerMap(handlers),
    onUnhandled: process.env.NODE_ENV === "production" ? "flatten" : debugUnhandled(),
});
```

### Large project — parse / interpret / render layers

```
src/
  dsl/
    parser.ts      ← yume-dsl-rich-text setup
    handlers/
      inline.ts    ← bold, italic, link, ...
      block.ts     ← info, warning, spoiler, ...
      index.ts     ← merged handler map
    ruleset.ts     ← createRuleset, env type
    interpret.ts   ← interpretTokens wrapper
  render/
    toHtml.ts      ← TNode → HTML string
    toPlainText.ts ← flattenText for search / preview
```

Key principles:

- **`env` is for runtime context only** — theme, locale, permissions, feature flags. Do not put business state in `env`.
- **Handlers are pure mappings** — token in, result out. Side effects belong in the render layer.
- **One ruleset per output format** — if you need both HTML and plain text, create two rulesets rather than one that
  switches.

---

## Real-world Example

A complete pipeline: parse DSL text → interpret to HTML AST → render to string. With multiple token types, env-driven
locale, and dual output (rich + plain text for search).

```ts
// ── types.ts ──
type HtmlNode =
    | { kind: "text"; value: string }
    | { kind: "element"; tag: string; attrs?: Record<string, string>; children: HtmlNode[] };

interface Env {
    locale: "en" | "zh";
    theme: "light" | "dark";
}

// ── parser.ts ──
import {createParser, createSimpleInlineHandlers} from "yume-dsl-rich-text";

const parser = createParser({
    handlers: createSimpleInlineHandlers(["bold", "italic", "link", "color"]),
});

// ── handlers.ts ──
import type {TextToken} from "yume-dsl-rich-text";
import type {InterpretHelpers, ResolvedResult} from "yume-dsl-token-walker";

type H = InterpretHelpers<HtmlNode, Env>;

const el = (tag: string, token: TextToken, h: H, attrs?: Record<string, string>): ResolvedResult<HtmlNode> => ({
    type: "nodes",
    nodes: [{kind: "element", tag, attrs, children: Array.from(h.interpretChildren(token.value))}],
});

const handlers: Record<string, (token: TextToken, h: H) => ResolvedResult<HtmlNode>> = {
    bold: (token, h) => el("strong", token, h),
    italic: (token, h) => el("em", token, h),
    link: (token, h) => el("a", token, h, {href: token.props?.href ?? "#"}),
    color: (token, h) => el("span", token, h, {
        style: `color: ${h.env.theme === "dark" ? "var(--c-light)" : token.props?.value ?? "inherit"}`,
    }),
};

// ── ruleset.ts ──
import {createRuleset, fromHandlerMap} from "yume-dsl-token-walker";

const ruleset = createRuleset<HtmlNode, Env>({
    createText: (text) => ({kind: "text", value: text}),
    interpret: fromHandlerMap(handlers),
    onUnhandled: "flatten",
    onError: ({error, phase, token}) => {
        console.warn(`[dsl:${phase}] ${error.message}`, token?.type);
    },
});

// ── render.ts ──
const renderNode = (node: HtmlNode): string => {
    if (node.kind === "text") return node.value;
    const attrs = node.attrs
        ? " " + Object.entries(node.attrs).map(([k, v]) => `${k}="${v}"`).join(" ")
        : "";
    return `<${node.tag}${attrs}>${node.children.map(renderNode).join("")}</${node.tag}>`;
};

// ── usage ──
import {interpretTokens, collectNodes, flattenText} from "yume-dsl-token-walker";

const input = "Hello $$bold($$italic(world)$$)$$ — $$link(click here){href=https://example.com}$$";
const tokens = parser.parse(input);
const env: Env = {locale: "zh", theme: "dark"};

// rich output
const nodes = collectNodes(interpretTokens(tokens, ruleset, env));
const html = nodes.map(renderNode).join("");

// plain text for search index — standalone, no ruleset needed
const plain = flattenText(tokens);
```

This shows the recommended separation:

| Layer      | Responsibility            | Depends on              |
|------------|---------------------------|-------------------------|
| `parser`   | Text → `TextToken[]`      | `yume-dsl-rich-text`    |
| `handlers` | Token → interpret result  | token-walker types only |
| `ruleset`  | Compose handlers + config | `handlers` + helpers    |
| `render`   | `TNode[]` → final output  | your own node type      |

---

## API — Core

### `interpretTokens(tokens, ruleset, env)`

Lazily walks a `TextToken[]` tree and yields `TNode` values via a generator.

```ts
function* interpretTokens<TNode, TEnv>(
    tokens: TextToken[],
    ruleset: InterpretRuleset<TNode, TEnv>,
    env: TEnv,
): Generator<TNode>;
```

- Streaming — nodes are yielded one at a time, never buffered
- Recursion-safe — detects self-referencing tokens and throws
- Circular-safe — detects circular `value` arrays during `flattenText` and throws

### `flattenText(value)`

Companion utility. Recursively extracts plain text from a `string | TextToken[]` value.

```ts
const flattenText: (value: string | TextToken[]) => string;
```

> **Boundary note:** `flattenText` is a standalone export and does **not** go through `onError`. Only errors raised
> inside `interpretTokens` are observed by `onError`.

---

## API — Helpers

Optional utilities that do not affect the core. Import only what you need.

### `createRuleset(ruleset)`

Identity function that enables full type inference for `InterpretRuleset`:

```ts
import {createRuleset} from "yume-dsl-token-walker";

const ruleset = createRuleset({
    createText: (text) => text,
    interpret: (token) => ({type: "unhandled"}),
});
```

### `fromHandlerMap(handlers)`

Table-driven `interpret` — maps token types to handler functions:

```ts
import {createRuleset, fromHandlerMap} from "yume-dsl-token-walker";

const ruleset = createRuleset({
    createText: (text) => text,
    interpret: fromHandlerMap({
        bold: (token, helpers) => ({
            type: "nodes",
            nodes: ["<strong>", ...helpers.interpretChildren(token.value), "</strong>"],
        }),
        italic: (token, helpers) => ({
            type: "nodes",
            nodes: ["<em>", ...helpers.interpretChildren(token.value), "</em>"],
        }),
    }),
});
```

Unmatched tokens automatically return `{ type: "unhandled" }`.

### `dropToken`

A ready-made handler that drops a token entirely — emits nothing. Equivalent to `() => ({ type: "drop" })` but saves
the boilerplate:

```ts
import {fromHandlerMap, dropToken} from "yume-dsl-token-walker";

const interpret = fromHandlerMap({
    bold: (token, h) => ({type: "nodes", nodes: ["<b>", ...h.interpretChildren(token.value), "</b>"]}),
    comment: dropToken,
    metadata: dropToken,
});
```

### `unwrapChildren`

A ready-made handler that interprets children and passes them through without wrapping. Use it for tokens that are
structural but produce no visible container:

```ts
import {fromHandlerMap, unwrapChildren} from "yume-dsl-token-walker";

const interpret = fromHandlerMap({
    bold: (token, h) => ({type: "nodes", nodes: ["<b>", ...h.interpretChildren(token.value), "</b>"]}),
    wrapper: unwrapChildren, // just emit children, no wrapper tag
    transparent: unwrapChildren,
});
```

### `wrapHandlers(handlers, wrap)`

Wraps every handler in a record with a shared transformation. The `wrap` callback receives the handler's result, the
token, and helpers — return a new `ResolvedResult`.

`wrapHandlers` preprocesses the handler map; `fromHandlerMap` is the final step that produces the `interpret` function:

```
wrapHandlers(raw, wrap)  ──▶  handlers  ──▶  fromHandlerMap(handlers)  ──▶  interpret
```

```ts
import {fromHandlerMap, wrapHandlers, type TokenHandler} from "yume-dsl-token-walker";

const rawBlockHandlers: Record<string, TokenHandler<string>> = {
    info: (token, h) => ({type: "nodes", nodes: ["[INFO] ", ...h.interpretChildren(token.value)]}),
    warning: (token, h) => ({type: "nodes", nodes: ["[WARN] ", ...h.interpretChildren(token.value)]}),
};

// wrap all block handlers with a shared <div> container
const blockHandlers = wrapHandlers(rawBlockHandlers, (result, token) => {
    if (result.type !== "nodes") return result;
    return {
        type: "nodes",
        nodes: [`<div class="block-${token.type}">`, ...result.nodes, "</div>"],
    };
});

const interpret = fromHandlerMap({
    ...inlineHandlers,
    ...blockHandlers,
});
```

### `debugUnhandled(format?)`

Returns an `onUnhandled` function that renders unhandled tokens as visible placeholders. Useful for debugging, testing,
and token visualization:

```ts
import {debugUnhandled} from "yume-dsl-token-walker";

const ruleset = createRuleset({
    createText: (text) => text,
    interpret: () => ({type: "unhandled"}),
    onUnhandled: debugUnhandled(), // → "[unhandled:bold]"
});
```

### `collectNodes(iterable)`

Sugar for `Array.from`. Collects a lazy `Iterable<TNode>` into an array:

```ts
import {interpretTokens, collectNodes} from "yume-dsl-token-walker";

const nodes = collectNodes(interpretTokens(tokens, ruleset, env));
```

---

## Types

### InterpretRuleset

The ruleset you pass to `interpretTokens`:

```ts
interface InterpretRuleset<TNode, TEnv = unknown> {
    createText: (text: string) => TNode;
    interpret: (token: TextToken, helpers: InterpretHelpers<TNode, TEnv>) => InterpretResult<TNode>;
    onUnhandled?: UnhandledStrategy<TNode, TEnv>;
    onError?: (context: {
        error: Error;
        phase: "interpret" | "flatten" | "traversal" | "internal";
        token?: TextToken;
        env: TEnv;
    }) => void;
}
```

| Field         | Description                                                              |
|---------------|--------------------------------------------------------------------------|
| `createText`  | Wrap a plain string into your node type                                  |
| `interpret`   | Map a DSL token to an interpret result                                   |
| `onUnhandled` | What to do when `interpret` returns `"unhandled"` (default: `"flatten"`) |
| `onError`     | Optional observer called before any error is thrown                      |

### InterpretResult

The return type of `interpret`:

```ts
type InterpretResult<TNode> =
    | { type: "nodes"; nodes: Iterable<TNode> }
    | { type: "text"; text: string }
    | { type: "flatten" }
    | { type: "unhandled" }
    | { type: "drop" };
```

| Result        | Meaning                                                        |
|---------------|----------------------------------------------------------------|
| `"nodes"`     | Yield the provided nodes                                       |
| `"text"`      | Emit a specific text string (explicit)                         |
| `"flatten"`   | Flatten `token.value` to plain text and emit                   |
| `"unhandled"` | This token has no handler — delegate to `onUnhandled` strategy |
| `"drop"`      | Emit nothing                                                   |

### ResolvedResult

`InterpretResult<TNode>` minus `{ type: "unhandled" }`. Used as the return type for `onUnhandled` strategy functions.

```ts
type ResolvedResult<TNode> = Exclude<InterpretResult<TNode>, { type: "unhandled" }>;
```

### UnhandledStrategy

Controls what happens when `interpret` returns `{ type: "unhandled" }`:

```ts
type UnhandledStrategy<TNode, TEnv = unknown> =
    | "throw"
    | "flatten"
    | "drop"
    | ((token: TextToken, helpers: InterpretHelpers<TNode, TEnv>) => ResolvedResult<TNode>);
```

| Strategy    | Behavior                                                                      |
|-------------|-------------------------------------------------------------------------------|
| `"throw"`   | Throw an error                                                                |
| `"flatten"` | Flatten to plain text (default)                                               |
| `"drop"`    | Emit nothing                                                                  |
| function    | Custom resolution — must return a `ResolvedResult` (no `"unhandled"` allowed) |

### InterpretHelpers

Passed to `interpret` and strategy functions:

```ts
interface InterpretHelpers<TNode, TEnv = unknown> {
    interpretChildren: (value: string | TextToken[]) => Iterable<TNode>;
    flattenText: (value: string | TextToken[]) => string;
    env: TEnv;
}
```

| Field               | Description                                                         |
|---------------------|---------------------------------------------------------------------|
| `interpretChildren` | Recursively interpret child tokens — returns lazy `Iterable<TNode>` |
| `flattenText`       | Extract plain text from a token value                               |
| `env`               | User-provided environment, passed through from `interpretTokens`    |

---

## Error Handling

### onError

Optional error observer. Called with context before the error is thrown. It does **not** suppress the error — the error
is always rethrown after `onError` returns.

```ts
const ruleset = {
    createText: (text: string) => text,
    interpret: () => ({type: "unhandled" as const}),
    onUnhandled: "throw" as const,
    onError: ({error, phase, token, env}) => {
        console.error(`[${phase}] ${error.message}`, token?.type);
    },
};
```

### Error phases

| Phase         | Trigger                                                                                       |
|---------------|-----------------------------------------------------------------------------------------------|
| `"interpret"` | `interpret()` throws, `onUnhandled` strategy function throws, or `onUnhandled: "throw"` fires |
| `"flatten"`   | `flattenText` fails (e.g. circular value)                                                     |
| `"traversal"` | Structural error — invalid text token value, recursive token detected                         |
| `"internal"`  | Unexpected internal state (e.g. unknown result type)                                          |

### Logging errors without stopping iteration

Since `onError` is called before the throw, you can use it to log, report, or collect errors — even though the error
will still propagate:

```ts
const errors: Error[] = [];

const ruleset = {
    createText: (text: string) => text,
    interpret: (token: TextToken) => {
        if (token.type === "bold") throw new Error("boom");
        return {type: "unhandled" as const};
    },
    onError: ({error}) => {
        errors.push(error);
    },
};

try {
    Array.from(interpretTokens(tokens, ruleset, undefined));
} catch {
    // errors[] now contains the observed error
}
```

---

## Safety

- **Self-recursion detection**: if a handler feeds a token back into `interpretChildren` referencing itself, an error is
  thrown immediately
- **Circular value detection**: `flattenText` tracks visited tokens per recursion path (not globally), so shared
  references are safe but true cycles throw
- **Error observation**: errors that occur during the interpretation flow (`interpret`, `onUnhandled` strategy
  functions, `flattenText`, and traversal checks) are routed through `onError` before being thrown

> **Boundary note:** the exported `flattenText()` utility is a standalone function and does **not** go through
`onError`. Only errors raised inside `interpretTokens` are observed by `onError`.

---

## Changelog

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

---

## License

MIT
