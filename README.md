**English** | [中文](./README.zh-CN.md)

# yume-dsl-token-walker

<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

[![npm](https://img.shields.io/npm/v/yume-dsl-token-walker)](https://www.npmjs.com/package/yume-dsl-token-walker)
[![GitHub](https://img.shields.io/badge/GitHub-chiba233%2Fyume--dsl--token--walker-181717?logo=github)](https://github.com/chiba233/yume-dsl-token-walker)
[![CI](https://github.com/chiba233/yume-dsl-token-walker/actions/workflows/publish-yume-dsl-token-walker.yml/badge.svg)](https://github.com/chiba233/yume-dsl-token-walker/actions/workflows/publish-yume-dsl-token-walker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Contributing](https://img.shields.io/badge/Contributing-guide-blue.svg)](./CONTRIBUTING.md)
[![Security](https://img.shields.io/badge/Security-policy-red.svg)](./SECURITY.md)

A generic, lazy, generator-based token tree interpreter for
[`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL).

The package is named **token-walker** because its core job is to *walk* a token tree node by node.
The public API is called `interpretTokens` because from the caller's perspective, you are *interpreting* tokens into
output — the walking is an implementation detail.

You provide rules. It walks the tree, yields output nodes, and gets out of the way.

Both **synchronous** (`Generator`) and **asynchronous** (`AsyncGenerator`) APIs are provided.
The async API is a full mirror of the sync core — same semantics, same error handling, same safety guarantees.

**Core API is stable.** Future updates will prioritize backward compatibility; breaking changes, if any, will land in
major versions with explicit migration notes.

It intentionally consumes `TextToken[]`, not structural parse nodes.
If you need syntax-aware analysis or highlighting, use `parseStructural` from `yume-dsl-rich-text` or
[`yume-dsl-shiki-highlight`](https://github.com/chiba233/yume-dsl-shiki-highlight).

For new parser setup, prefer `createParser(...)`.
If you need custom delimiters or a custom escape marker upstream, prefer `createEasySyntax(...)` and pass the resulting
`syntax` explicitly into the parser.

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
- [Synchronous API](#synchronous-api)
    - [Core](#sync-api--core)
        - [interpretText](#interprettextinput-parser-ruleset-env)
        - [interpretTokens](#interprettokenstokens-ruleset-env)
        - [flattenText](#flattentextvalue)
    - [Helpers](#sync-api--helpers)
        - [createRuleset](#createrulesetruleset)
        - [fromHandlerMap](#fromhandlermaphandlers)
        - [dropToken](#droptoken)
        - [unwrapChildren](#unwrapchildren)
        - [wrapHandlers](#wraphandlershandlers-wrap)
        - [debugUnhandled](#debugunhandledformat)
        - [collectNodes](#collectnodesiterable)
    - [Types](#sync-types)
        - [InterpretRuleset](#interpretruleset)
        - [InterpretResult](#interpretresult)
        - [ResolvedResult](#resolvedresult)
        - [UnhandledStrategy](#unhandledstrategy)
        - [InterpretHelpers](#interprethelpers)
- [Asynchronous API](#asynchronous-api)
    - [Core](#async-api--core)
        - [interpretTextAsync](#interprettextasyncinput-parser-ruleset-env)
        - [interpretTokensAsync](#interprettokensasynctokens-ruleset-env)
    - [Helpers](#async-api--helpers)
        - [fromAsyncHandlerMap](#fromasynchandlermaphandlers)
        - [wrapAsyncHandlers](#wrapasynchandlershandlers-wrap)
        - [collectNodesAsync](#collectnodesasynciterable)
    - [Types](#async-types)
        - [AsyncInterpretRuleset](#asyncinterpretruleset)
        - [AsyncInterpretResult](#asyncinterpretresult)
        - [AsyncResolvedResult](#asyncresolvedresult)
        - [AsyncUnhandledStrategy](#asyncunhandledstrategy)
        - [AsyncInterpretHelpers](#asyncinterprethelpers)
        - [Awaitable](#awaitablet)
        - [AsyncTokenHandler](#asynctokenhandler)
- [Structural Query](#structural-query)
    - [findFirst](#findfirstnodes-predicate)
    - [findAll](#findallnodes-predicate)
    - [walkStructural](#walkstructuralnodes-visitor)
    - [nodeAtOffset](#nodeatoffsetnodes-offset)
    - [enclosingNode](#enclosingnodesnodes-offset)
    - [StructuralVisitContext](#structuralvisitcontext)
    - [StructuralPredicate](#structuralpredicate)
    - [StructuralVisitor](#structuralvisitor)
- [Lint](#lint)
    - [lintStructural](#lintstructuralsource-options)
    - [applyLintFixes](#applylintfixessource-diagnostics)
    - [LintRule](#lintrule)
    - [LintContext](#lintcontext)
    - [LintOptions](#lintoptions)
    - [Diagnostic](#diagnostic)
    - [DiagnosticSeverity](#diagnosticseverity)
    - [Fix / TextEdit](#fix--textedit)
    - [ReportInfo](#reportinfo)
- [Structural Slice](#structural-slice)
    - [parseSlice](#parseslicefulltext-span-parser-tracker)
    - [ParseOverrides](#parseoverrides)
    - [ParserLike](#parserlike)
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
| [`yume-dsl-markdown-it`](https://github.com/chiba233/yume-dsl-markdown-it)         | markdown-it plugin — DSL tags inside Markdown           |

Boundary notes:

- Recommended upstream path: `createParser(...).parse(...)`.
- If you customize delimiters upstream, prefer `createEasySyntax(...)` + `createParser({ syntax, ... })`.
- `yume-dsl-token-walker` also accepts legacy `parseRichText(...)` output because the boundary is still `TextToken[]`.
- `parseStructural(...)` and `createParser(...).structural(...)` belong to syntax analysis / highlighting, not walker
  input.

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
import {createEasySyntax, createParser, createSimpleInlineHandlers} from "yume-dsl-rich-text";
import {interpretText} from "yume-dsl-token-walker";

const syntax = createEasySyntax({
    tagPrefix: "%%",
});

const parser = createParser({
    syntax,
    handlers: createSimpleInlineHandlers(["bold"]),
});

const html = Array.from(
    interpretText("Hello %%bold(world)%%", parser, {
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

For direct `TextToken[]` input, use `interpretTokens(...)`.
`parser.structural(...)` is a different layer and is not consumed by this package.
If you do not need custom syntax, omit `syntax` and use plain `createParser(...)`.

---

## Exports

All public exports at a glance:

**Synchronous**

| Export              | Kind     | Description                                                                        |
|---------------------|----------|------------------------------------------------------------------------------------|
| `interpretText`     | function | Recommended convenience API: parse DSL text with a parser, then yield output nodes |
| `interpretTokens`   | function | Walk a token tree and yield output nodes (core)                                    |
| `flattenText`       | function | Extract plain text from a token value (standalone, does not go through `onError`)  |
| `createRuleset`     | helper   | Identity function for `InterpretRuleset` type inference                            |
| `fromHandlerMap`    | helper   | Build an `interpret` function from a `Record<type, handler>` map                   |
| `dropToken`         | helper   | Handler that drops a token entirely — emits nothing                                |
| `unwrapChildren`    | helper   | Handler that passes through interpreted children without wrapping                  |
| `wrapHandlers`      | helper   | Wrap every handler in a record with a shared transformation                        |
| `debugUnhandled`    | helper   | Create an `onUnhandled` function that renders visible placeholders                 |
| `collectNodes`      | helper   | `Array.from` sugar — collect lazy `Iterable<TNode>` into an array                  |
| `InterpretRuleset`  | type     | Ruleset interface passed to `interpretTokens`                                      |
| `InterpretResult`   | type     | Return type of `interpret` (5 variants)                                            |
| `ResolvedResult`    | type     | `InterpretResult` minus `"unhandled"`                                              |
| `InterpretHelpers`  | type     | Helpers object passed to `interpret` and strategy functions                        |
| `UnhandledStrategy` | type     | `"throw" \| "flatten" \| "drop" \| function`                                       |
| `TokenHandler`      | type     | Shorthand for a single handler function signature                                  |
| `TextResult`        | type     | `{ type: "text"; text: string }` — return type of `debugUnhandled`'s callback      |
| `ParserLike`        | type     | Parser interface — `parse(input, overrides?)` returning `TextToken[]`              |

**Structural query**

| Export                   | Kind     | Description                                                                      |
|--------------------------|----------|----------------------------------------------------------------------------------|
| `findFirst`              | function | Depth-first pre-order search — first matching `StructuralNode`                   |
| `findAll`                | function | Depth-first pre-order search — all matching `StructuralNode`s                    |
| `walkStructural`         | function | Depth-first pre-order traversal — visit every node with context                  |
| `nodeAtOffset`           | function | Find deepest node at a source offset (requires `trackPositions`)                 |
| `enclosingNode`          | function | Find deepest tag node enclosing a source offset (requires `trackPositions`)      |
| `StructuralTagNode`      | type     | Tag-form node: `Extract<StructuralNode, { type: "inline" \| "raw" \| "block" }>` |
| `StructuralVisitContext` | type     | Context passed to callbacks — `parent`, `depth`, `index`                         |
| `StructuralPredicate`    | type     | Predicate function signature for `findFirst` / `findAll`                         |
| `StructuralVisitor`      | type     | Visitor function signature for `walkStructural`                                  |

**Lint**

| Export               | Kind     | Description                                                                                 |
|----------------------|----------|---------------------------------------------------------------------------------------------|
| `lintStructural`     | function | Run lint rules against DSL source — returns sorted `Diagnostic[]`                           |
| `applyLintFixes`     | function | Apply fixable diagnostics to source text — returns new string                               |
| `LintRule`           | type     | Rule interface — `id`, `severity?`, `check(ctx)`                                            |
| `LintContext`        | type     | Context passed to rule `check` — `source`, `tree`, `report`, `findFirst`, `findAll`, `walk` |
| `LintOptions`        | type     | Options for `lintStructural` — `rules`, `overrides?`, `parseOptions?`, `onRuleError?`       |
| `Diagnostic`         | type     | Lint diagnostic — `ruleId`, `severity`, `message`, `span`, `node?`, `fix?`                  |
| `DiagnosticSeverity` | type     | `"error" \| "warning" \| "info" \| "hint"`                                                  |
| `Fix`                | type     | Auto-fix — `description`, `edits: TextEdit[]`                                               |
| `TextEdit`           | type     | Source edit — `span: SourceSpan`, `newText: string`                                         |
| `ReportInfo`         | type     | Argument to `ctx.report()` — `Diagnostic` minus `ruleId`, severity optional                 |

**Structural slice**

| Export           | Kind     | Description                                                                      |
|------------------|----------|----------------------------------------------------------------------------------|
| `parseSlice`     | function | Slice a region from full text by `SourceSpan`, parse with position mapping       |
| `ParseOverrides` | type     | Options passed to `ParserLike.parse` — `trackPositions`, `baseOffset`, `tracker` |

**Asynchronous**

| Export                   | Kind     | Description                                                                  |
|--------------------------|----------|------------------------------------------------------------------------------|
| `interpretTextAsync`     | function | Async convenience API: parse DSL text with a parser, then yield output nodes |
| `interpretTokensAsync`   | function | Async walk of a token tree — yields output nodes via `AsyncGenerator`        |
| `fromAsyncHandlerMap`    | helper   | Build an async `interpret` function from a `Record<type, handler>` map       |
| `wrapAsyncHandlers`      | helper   | Wrap every async handler in a record with a shared transformation            |
| `collectNodesAsync`      | helper   | Collect an `AsyncIterable<TNode>` into an array                              |
| `AsyncInterpretRuleset`  | type     | Async ruleset interface passed to `interpretTokensAsync`                     |
| `AsyncInterpretResult`   | type     | Return type of async `interpret` — nodes may be `AsyncIterable`              |
| `AsyncResolvedResult`    | type     | `AsyncInterpretResult` minus `"unhandled"`                                   |
| `AsyncInterpretHelpers`  | type     | Async helpers — `interpretChildren` returns `AsyncIterable<TNode>`           |
| `AsyncUnhandledStrategy` | type     | Async version of `UnhandledStrategy` — callback may return `Awaitable`       |
| `AsyncTokenHandler`      | type     | Shorthand for an async handler function signature                            |
| `Awaitable`              | type     | `T \| Promise<T>` — used in async API signatures                             |

---

## Examples

### Use `env` to inject runtime context

```ts
import {createEasySyntax, createSimpleInlineHandlers, createParser} from "yume-dsl-rich-text";
import {interpretTokens} from "yume-dsl-token-walker";

const syntax = createEasySyntax({
    tagPrefix: "%%",
});

const dsl = createParser({
    syntax,
    handlers: createSimpleInlineHandlers(["bold"]),
});

const tokens = dsl.parse("Hello %%bold(world)%%");

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
import {createSimpleInlineHandlers, createParser} from "yume-dsl-rich-text";
import {interpretTokens} from "yume-dsl-token-walker";

const dsl = createParser({
    handlers: createSimpleInlineHandlers(["bold", "info"]),
});

const tokens = dsl.parse("$$info(hello $$bold(world)$$)$$");

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
    code: (token, h) => ({type: "text", text: `<code>${h.flattenText(token.value)}</code>`}),
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
theme, and dual output (rich + plain text for search).

```ts
// ── types.ts ──
type HtmlNode =
    | { kind: "text"; value: string }
    | { kind: "element"; tag: string; attrs?: Record<string, string>; children: HtmlNode[] };

interface Env {
    theme: "light" | "dark";
}

// ── parser.ts ──
import {createParser, createSimpleInlineHandlers, createPipeHandlers} from "yume-dsl-rich-text";

const parser = createParser({
    handlers: {
        ...createSimpleInlineHandlers(["bold", "italic"]),
        // link uses pipe: $$link(url | display text)$$
        ...createPipeHandlers({
            link: {inline: (args) => ({type: "link", url: args.text(0, "#"), value: args.materializedTailTokens(1)})},
        }),
    },
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
    link: (token, h) => el("a", token, h, {href: (token.url as string) ?? "#"}),
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

const input = "Hello $$bold($$italic(world)$$)$$ - $$link(https://example.com | click here)$$";
const tokens = parser.parse(input);
const env: Env = {theme: "dark"};

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

`parseStructural` is intentionally absent from this pipeline.
Use it only when you need structural syntax information, not when you want to interpret `TextToken[]` into output.

---

## Synchronous API

### Sync API — Core

#### `interpretText(input, parser, ruleset, env)`

Thin convenience wrapper around `parser.parse(input)` + `interpretTokens(...)`.

```ts
function* interpretText<TNode, TEnv>(
    input: string,
    parser: ParserLike,
    ruleset: InterpretRuleset<TNode, TEnv>,
    env: TEnv,
): Generator<TNode>;
```

Use this when you want a small derived-package helper without changing the package boundary.
It still consumes `TextToken[]` internally and does not use `parser.structural(...)`.

`ParserLike` means any object with `parse(input: string, overrides?: ParseOverrides): TextToken[]`.

#### `interpretTokens(tokens, ruleset, env)`

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
- When `trackPositions: true` is set upstream, each `token.position` carries `SourceSpan` —
  available inside handlers and forwarded to `onError`

#### `flattenText(value)`

Companion utility. Recursively extracts plain text from a `string | TextToken[]` value.

```ts
const flattenText: (value: string | TextToken[]) => string;
```

> **Boundary note:** `flattenText` is a standalone export and does **not** go through `onError`. Only errors raised
> inside `interpretTokens` are observed by `onError`.

---

### Sync API — Helpers

Optional utilities that do not affect the core. Import only what you need.

#### `createRuleset(ruleset)`

Identity function that enables full type inference for `InterpretRuleset`:

```ts
import {createRuleset} from "yume-dsl-token-walker";

const ruleset = createRuleset({
    createText: (text) => text,
    interpret: (token) => ({type: "unhandled"}),
});
```

#### `fromHandlerMap(handlers)`

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

#### `dropToken`

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

#### `unwrapChildren`

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

#### `wrapHandlers(handlers, wrap)`

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

#### `debugUnhandled(format?)`

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

#### `collectNodes(iterable)`

Sugar for `Array.from`. Collects a lazy `Iterable<TNode>` into an array:

```ts
import {interpretTokens, collectNodes} from "yume-dsl-token-walker";

const nodes = collectNodes(interpretTokens(tokens, ruleset, env));
```

---

### Sync Types

#### InterpretRuleset

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
        position?: SourceSpan;
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

#### InterpretResult

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

#### ResolvedResult

`InterpretResult<TNode>` minus `{ type: "unhandled" }`. Used as the return type for `onUnhandled` strategy functions.

```ts
type ResolvedResult<TNode> = Exclude<InterpretResult<TNode>, { type: "unhandled" }>;
```

#### UnhandledStrategy

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

#### InterpretHelpers

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

## Asynchronous API

The async API mirrors the synchronous core. Use it when your `interpret` function needs to `await` — for example,
fetching remote content, querying a database, or calling an async renderer.

Key design decisions:

- `createText` is **synchronous** — text wrapping is always a pure, fast operation
- `interpret` and `onUnhandled` strategy functions may return `Awaitable<T>` (`T | Promise<T>`)
- `interpretChildren` returns `AsyncIterable<TNode>` — consume with `for await` or `yield*` in an async generator
- `nodes` in the result may be `Iterable<TNode>` or `AsyncIterable<TNode>`
- Error handling, recursion detection, and `onError` behavior are identical to the synchronous API

### Async Quick Start

```ts
import {createParser, createSimpleInlineHandlers} from "yume-dsl-rich-text";
import {interpretTextAsync, collectNodesAsync} from "yume-dsl-token-walker";

const parser = createParser({
    handlers: createSimpleInlineHandlers(["bold"]),
});

const html = (
    await collectNodesAsync(
        interpretTextAsync("Hello $$bold(world)$$", parser, {
            createText: (text) => text,
            interpret: async (token, helpers) => {
                if (token.type === "bold") {
                    return {
                        type: "nodes",
                        nodes: (async function* () {
                            yield "<strong>";
                            yield* helpers.interpretChildren(token.value);
                            yield "</strong>";
                        })(),
                    };
                }
                return {type: "unhandled"};
            },
        }, {}),
    )
).join("");

// → "Hello <strong>world</strong>"
```

### Async API — Core

#### `interpretTextAsync(input, parser, ruleset, env)`

Async convenience wrapper around `parser.parse(input)` + `interpretTokensAsync(...)`.

```ts
async function* interpretTextAsync<TNode, TEnv>(
    input: string,
    parser: ParserLike,
    ruleset: AsyncInterpretRuleset<TNode, TEnv>,
    env: TEnv,
): AsyncGenerator<TNode>;
```

#### `interpretTokensAsync(tokens, ruleset, env)`

Lazily walks a `TextToken[]` tree and yields `TNode` values via an async generator.

```ts
async function* interpretTokensAsync<TNode, TEnv>(
    tokens: TextToken[],
    ruleset: AsyncInterpretRuleset<TNode, TEnv>,
    env: TEnv,
): AsyncGenerator<TNode>;
```

- Streaming — nodes are yielded one at a time, never buffered
- Recursion-safe — detects self-referencing tokens and throws
- Supports both sync and async iterables in `nodes` results

### Async API — Helpers

#### `fromAsyncHandlerMap(handlers)`

Async version of `fromHandlerMap`. Maps token types to async handler functions:

```ts
import {fromAsyncHandlerMap} from "yume-dsl-token-walker";

const interpret = fromAsyncHandlerMap({
    bold: async (token, helpers) => ({
        type: "nodes",
        nodes: (async function* () {
            yield "<strong>";
            yield* helpers.interpretChildren(token.value);
            yield "</strong>";
        })(),
    }),
});
```

Unmatched tokens automatically return `{ type: "unhandled" }`.

#### `wrapAsyncHandlers(handlers, wrap)`

Async version of `wrapHandlers`. Wraps every async handler with a shared transformation.
The `wrap` callback receives the awaited handler result:

```ts
import {fromAsyncHandlerMap, wrapAsyncHandlers, type AsyncTokenHandler} from "yume-dsl-token-walker";

const raw: Record<string, AsyncTokenHandler<string>> = {
    info: async (token, h) => ({
        type: "nodes", nodes: (async function* () {
            yield "[INFO] ";
            yield* h.interpretChildren(token.value);
        })()
    }),
};

const wrapped = wrapAsyncHandlers(raw, async (result, token) => {
    if (result.type !== "nodes") return result;
    return {type: "text", text: `<div class="${token.type}">${/* ... */}</div>`};
});
```

#### `collectNodesAsync(iterable)`

Collects an `AsyncIterable<TNode>` into an array:

```ts
import {interpretTokensAsync, collectNodesAsync} from "yume-dsl-token-walker";

const nodes = await collectNodesAsync(interpretTokensAsync(tokens, ruleset, env));
```

### Async Types

#### AsyncInterpretRuleset

The ruleset you pass to `interpretTokensAsync`:

```ts
interface AsyncInterpretRuleset<TNode, TEnv = unknown> {
    createText: (text: string) => TNode;
    interpret: (
        token: TextToken,
        helpers: AsyncInterpretHelpers<TNode, TEnv>,
    ) => Awaitable<AsyncInterpretResult<TNode>>;
    onUnhandled?: AsyncUnhandledStrategy<TNode, TEnv>;
    onError?: (context: {
        error: Error;
        phase: "interpret" | "flatten" | "traversal" | "internal";
        token?: TextToken;
        position?: SourceSpan;
        env: TEnv;
    }) => void;
}
```

| Field         | Description                                                                                     |
|---------------|-------------------------------------------------------------------------------------------------|
| `createText`  | Wrap a plain string into your node type — **synchronous**                                       |
| `interpret`   | Map a DSL token to an interpret result — may return `Promise`                                   |
| `onUnhandled` | What to do when `interpret` returns `"unhandled"` (default: `"flatten"`) — may return `Promise` |
| `onError`     | Optional observer called before any error is thrown                                             |

#### AsyncInterpretResult

The return type of async `interpret`:

```ts
type AsyncInterpretResult<TNode> =
    | { type: "nodes"; nodes: Iterable<TNode> | AsyncIterable<TNode> }
    | { type: "text"; text: string }
    | { type: "flatten" }
    | { type: "unhandled" }
    | { type: "drop" };
```

The `"nodes"` variant accepts both `Iterable` and `AsyncIterable`, so you can return a plain array
or an async generator.

#### AsyncResolvedResult

`AsyncInterpretResult<TNode>` minus `{ type: "unhandled" }`:

```ts
type AsyncResolvedResult<TNode> = Exclude<AsyncInterpretResult<TNode>, { type: "unhandled" }>;
```

#### AsyncUnhandledStrategy

Async version of `UnhandledStrategy` — the callback may return `Awaitable`:

```ts
type AsyncUnhandledStrategy<TNode, TEnv = unknown> =
    | "throw"
    | "flatten"
    | "drop"
    | ((
    token: TextToken,
    helpers: AsyncInterpretHelpers<TNode, TEnv>,
) => Awaitable<AsyncResolvedResult<TNode>>);
```

#### AsyncInterpretHelpers

Passed to async `interpret` and strategy functions:

```ts
interface AsyncInterpretHelpers<TNode, TEnv = unknown> {
    interpretChildren: (value: string | TextToken[]) => AsyncIterable<TNode>;
    flattenText: (value: string | TextToken[]) => string;
    env: TEnv;
}
```

| Field               | Description                                                                   |
|---------------------|-------------------------------------------------------------------------------|
| `interpretChildren` | Recursively interpret child tokens — returns `AsyncIterable<TNode>`           |
| `flattenText`       | Extract plain text from a token value — same synchronous function as sync API |
| `env`               | User-provided environment, passed through from `interpretTokensAsync`         |

#### `Awaitable<T>`

```ts
type Awaitable<T> = T | Promise<T>;
```

Used throughout async API signatures to accept both synchronous and asynchronous returns.

#### AsyncTokenHandler

Shorthand for an async handler function signature:

```ts
type AsyncTokenHandler<TNode, TEnv = unknown> = (
    token: TextToken,
    helpers: AsyncInterpretHelpers<TNode, TEnv>,
) => Awaitable<AsyncResolvedResult<TNode>>;
```

---

## Structural Query

Search and locate nodes within a `StructuralNode[]` tree. These helpers operate on the structural parse tree
from `parseStructural`, not on `TextToken[]`.

### `findFirst(nodes, predicate)`

Depth-first pre-order search. Returns the first node for which `predicate` returns `true`, or `undefined`.

```ts
const findFirst: (
    nodes: StructuralNode[],
    predicate: StructuralPredicate,
) => StructuralNode | undefined;
```

```ts
import {parseStructural} from "yume-dsl-rich-text";
import {findFirst} from "yume-dsl-token-walker";

const tree = parseStructural("Hello $$bold($$italic(world)$$)$$");
const italic = findFirst(tree, (node) => node.type === "inline" && node.tag === "italic");
// italic.tag === "italic"
```

### `findAll(nodes, predicate)`

Depth-first pre-order search. Returns all nodes for which `predicate` returns `true`.

```ts
const findAll: (
    nodes: StructuralNode[],
    predicate: StructuralPredicate,
) => StructuralNode[];
```

```ts
import {parseStructural} from "yume-dsl-rich-text";
import {findAll} from "yume-dsl-token-walker";

const tree = parseStructural("$$bold(a)$$ then $$bold(b)$$");
const bolds = findAll(tree, (node) => node.type === "inline" && node.tag === "bold");
// bolds.length === 2
```

### `nodeAtOffset(nodes, offset)`

Find the deepest (most specific) node whose source span contains the given byte offset.
Requires nodes parsed with `trackPositions: true`.

```ts
const nodeAtOffset: (
    nodes: StructuralNode[],
    offset: number,
) => StructuralNode | undefined;
```

```ts
import {parseStructural} from "yume-dsl-rich-text";
import {nodeAtOffset} from "yume-dsl-token-walker";

const input = "Hello $$bold(world)$$";
const tree = parseStructural(input, {trackPositions: true});
const node = nodeAtOffset(tree, 14); // offset 14 is inside "world"
// node.type === "text", node.value === "world"
```

Returns `undefined` if no node contains the offset or if positions were not tracked.

### `enclosingNode(nodes, offset)`

Find the deepest tag node (inline / raw / block) whose source span contains the given offset.
Unlike `nodeAtOffset`, this skips text, escape, and separator nodes — it returns only structurally
meaningful "enclosing" tag nodes.

The return type is `StructuralTagNode | undefined` — already narrowed so you can access
`.tag`, `.children`, `.args`, etc. without an extra type guard.

```ts
const enclosingNode: (
    nodes: StructuralNode[],
    offset: number,
) => StructuralTagNode | undefined;
```

```ts
import {parseStructural} from "yume-dsl-rich-text";
import {enclosingNode} from "yume-dsl-token-walker";

const input = "Hello $$bold(world)$$";
const tree = parseStructural(input, {trackPositions: true});
const tag = enclosingNode(tree, 14); // offset 14 is inside "world"
// tag.type === "inline", tag.tag === "bold"
```

Returns `undefined` if the offset is not inside any tag, or if positions were not tracked.

> **Offset semantics:** the offset must be a string index into the original source text that was
> passed to `parseStructural` — not an index into rendered, printed, or display text.
> This also applies to `nodeAtOffset`.

### StructuralVisitContext

Context passed to predicates in `findFirst` and `findAll`:

```ts
interface StructuralVisitContext {
    parent: StructuralNode | null;
    depth: number;
    index: number;
}
```

| Field    | Description                                    |
|----------|------------------------------------------------|
| `parent` | The parent node, or `null` for top-level nodes |
| `depth`  | Nesting depth (0 for top-level)                |
| `index`  | Index within the parent's child array          |

### `walkStructural(nodes, visitor)`

Depth-first pre-order traversal. Calls `visitor` for every node with full context.
Unlike `findFirst`/`findAll`, this is a pure side-effect visitor — it does not collect or return anything.

```ts
const walkStructural: (
    nodes: StructuralNode[],
    visitor: StructuralVisitor,
) => void;
```

```ts
import {parseStructural} from "yume-dsl-rich-text";
import {walkStructural} from "yume-dsl-token-walker";

const tree = parseStructural("$$bold(hello $$italic(world)$$)$$");
walkStructural(tree, (node, ctx) => {
    console.log(`${"  ".repeat(ctx.depth)}${node.type}`);
});
// inline
//   text
//   inline
//     text
```

### StructuralPredicate

Predicate function signature used by `findFirst` and `findAll`:

```ts
type StructuralPredicate = (
    node: StructuralNode,
    ctx: StructuralVisitContext,
) => boolean;
```

### StructuralVisitor

Visitor function signature used by `walkStructural` and `LintContext.walk`:

```ts
type StructuralVisitor = (
    node: StructuralNode,
    ctx: StructuralVisitContext,
) => void;
```

---

## Lint

A minimal lint framework for validating DSL source against custom rules. Rules operate on the
structural parse tree and report diagnostics with optional auto-fixes.

### Quick Start

```ts
import {lintStructural, applyLintFixes, type LintRule} from "yume-dsl-token-walker";

const noEmptyTag: LintRule = {
    id: "no-empty-tag",
    severity: "warning",
    check: (ctx) => {
        ctx.findAll(ctx.tree, (node) => {
            if (node.type === "inline" && node.children.length === 0 && node.position) {
                ctx.report({
                    message: `Empty inline tag: ${node.tag}`,
                    span: node.position,
                    node,
                    fix: {
                        description: "Remove empty tag",
                        edits: [{span: node.position, newText: ""}],
                    },
                });
            }
            return false;
        });
    },
};

const source = "Hello $$bold()$$ world";
const diagnostics = lintStructural(source, {rules: [noEmptyTag]});
// diagnostics[0].message === "Empty inline tag: bold"

const fixed = applyLintFixes(source, diagnostics);
// fixed === "Hello  world"
```

### `lintStructural(source, options)`

Run lint rules against DSL source text. Parses the source with `trackPositions: true`,
then runs each rule's `check` function. Returns all collected diagnostics sorted by source offset.

```ts
const lintStructural: (source: string, options: LintOptions) => Diagnostic[];
```

Rules that throw are isolated — the error is reported via `onRuleError` and remaining rules continue.

### `applyLintFixes(source, diagnostics)`

Apply fixable diagnostics to source text, producing a new string.

```ts
const applyLintFixes: (source: string, diagnostics: Diagnostic[]) => string;
```

Only diagnostics with a `fix` field are considered. Fixes are applied **atomically** —
if any edit within a fix overlaps with a previously accepted edit, the **entire fix** is skipped
(all-or-nothing per fix). This prevents compound fixes from leaving the source in an invalid
intermediate state.

### LintRule

```ts
interface LintRule {
    id: string;
    severity?: DiagnosticSeverity;
    check: (ctx: LintContext) => void;
}
```

| Field      | Description                                                      |
|------------|------------------------------------------------------------------|
| `id`       | Unique rule identifier (e.g. `"no-empty-tag"`)                   |
| `severity` | Default severity — can be overridden via `LintOptions.overrides` |
| `check`    | Rule implementation — use `ctx.report()` to emit diagnostics     |

### LintContext

Passed to each rule's `check` function:

```ts
interface LintContext {
    source: string;
    tree: StructuralNode[];
    report: (info: ReportInfo) => void;
    findFirst: (nodes: StructuralNode[], predicate: StructuralPredicate) => StructuralNode | undefined;
    findAll: (nodes: StructuralNode[], predicate: StructuralPredicate) => StructuralNode[];
    walk: (nodes: StructuralNode[], visitor: StructuralVisitor) => void;
}
```

| Field       | Description                                           |
|-------------|-------------------------------------------------------|
| `source`    | Original source text                                  |
| `tree`      | Structural tree (parsed with `trackPositions: true`)  |
| `report`    | Emit a diagnostic                                     |
| `findFirst` | Depth-first search — first match                      |
| `findAll`   | Depth-first search — all matches                      |
| `walk`      | Depth-first traversal — visit every node with context |

### LintOptions

```ts
interface LintOptions {
    rules: LintRule[];
    overrides?: Record<string, DiagnosticSeverity | "off">;
    parseOptions?: Omit<StructuralParseOptions, "trackPositions">;
    onRuleError?: (context: { ruleId: string; error: unknown }) => void;
}
```

| Field          | Description                                                                                                                       |
|----------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `rules`        | Rules to run                                                                                                                      |
| `overrides`    | Override severity per rule id — set to `"off"` to disable                                                                         |
| `parseOptions` | Forwarded to `parseStructural` — pass the same `handlers`, `allowForms`, `syntax`, `tagName`, `depthLimit` as your runtime parser |
| `onRuleError`  | Called when a rule throws — error is swallowed, other rules continue                                                              |

### Diagnostic

```ts
interface Diagnostic {
    ruleId: string;
    severity: DiagnosticSeverity;
    message: string;
    span: SourceSpan;
    node?: StructuralNode;
    fix?: Fix;
}
```

### DiagnosticSeverity

```ts
type DiagnosticSeverity = "error" | "warning" | "info" | "hint";
```

### Fix / TextEdit

```ts
interface Fix {
    description: string;
    edits: TextEdit[];
}

interface TextEdit {
    span: SourceSpan;
    newText: string;
}
```

Fixes follow the LSP `TextEdit` model — each edit specifies a source range to replace.
Use empty `newText` to delete, or a range with `start === end` to insert.

### ReportInfo

Argument to `ctx.report()` — same as `Diagnostic` but without `ruleId` (added by the runner)
and with `severity` optional (defaults to the rule's severity):

```ts
type ReportInfo = Omit<Diagnostic, "ruleId" | "severity"> & {
    severity?: DiagnosticSeverity;
};
```

---

## Structural Slice

Use `parseStructural` from `yume-dsl-rich-text` to pre-scan a document (fast, ~50x cheaper than `parseRichText`),
then use `parseSlice` to selectively parse only the regions you need with correct position mapping back to
the original document.

> **TL;DR** — `parseStructural` gives you the map; `parseSlice` lets you jump to any point on it
> and get fully positioned `TextToken[]` without re-parsing the whole document.

### Full pipeline example

```ts
import {createParser, createSimpleInlineHandlers, buildPositionTracker} from "yume-dsl-rich-text";
import {parseSlice, interpretTokens, collectNodes} from "yume-dsl-token-walker";

const parser = createParser({
    handlers: createSimpleInlineHandlers(["bold", "italic"]),
});

const fullText = "intro\n$$bold(hello $$italic(world)$$)$$\noutro";

// 1. Pre-scan: fast structural pass with positions
const structural = parser.structural(fullText, {trackPositions: true});

// 2. Build tracker once, reuse for all slices
const tracker = buildPositionTracker(fullText);

// 3. Pick a node and parse just that region
const boldNode = structural.find(n => n.type === "inline" && n.tag === "bold");
if (boldNode?.position) {
    const tokens = parseSlice(fullText, boldNode.position, parser, tracker);
    // tokens have correct offset/line/column relative to fullText

    // 4. Interpret as usual
    const html = collectNodes(
        interpretTokens(tokens, {
            createText: (t) => t,
            interpret: (token, helpers) => {
                if (token.type === "bold")
                    return {type: "nodes", nodes: ["<b>", ...helpers.interpretChildren(token.value), "</b>"]};
                if (token.type === "italic")
                    return {type: "nodes", nodes: ["<em>", ...helpers.interpretChildren(token.value), "</em>"]};
                return {type: "unhandled"};
            },
        }, undefined),
    ).join("");
}
```

Without `tracker`, `parseSlice` still works — `offset` is correct, but `line`/`column` are local to the slice.
With `tracker`, all three fields point back to the original document.
Build the tracker **once** with `buildPositionTracker(fullText)` — do not rebuild per slice.

### `parseSlice(fullText, span, parser, tracker?)`

Slice a region from `fullText` using a `SourceSpan`, then parse with position mapping.

```ts
const parseSlice: (
    fullText: string,
    span: SourceSpan,
    parser: ParserLike,
    tracker?: PositionTracker,
) => TextToken[];
```

| Param      | Description                                                                        |
|------------|------------------------------------------------------------------------------------|
| `fullText` | The complete source text                                                           |
| `span`     | Region to parse — typically `StructuralNode.position`                              |
| `parser`   | A parser with `parse(input, overrides?)`                                           |
| `tracker`  | Optional tracker from `buildPositionTracker(fullText)` for correct `line`/`column` |

Position tracking is always enabled. `baseOffset` is derived from `span.start.offset`.

### ParseOverrides

Options accepted by `ParserLike.parse` as the second argument:

```ts
interface ParseOverrides {
    trackPositions?: boolean;
    baseOffset?: number;
    tracker?: PositionTracker;
}
```

### ParserLike

Parser interface used by `interpretText`, `interpretTextAsync`, and `parseSlice`:

```ts
interface ParserLike {
    parse: (input: string, overrides?: ParseOverrides) => TextToken[];
}
```

`createParser(...)` from `yume-dsl-rich-text` satisfies this interface.

---

## Error Handling

### onError

Optional error observer. Called with context before the error is thrown. It does **not** suppress the error — the error
is always rethrown after `onError` returns.

`position` is forwarded from `token.position` when the upstream parser enabled source tracking via
`createParser({ trackPositions: true, ... })`. A `SourceSpan` contains `start` and `end`, each with
`offset` (zero-indexed), `line` (one-indexed), and `column` (one-indexed).
When position tracking is not enabled, `position` is `undefined`.

```ts
const parser = createParser({
    handlers: createSimpleInlineHandlers(["bold"]),
    trackPositions: true,  // ← enable source location tracking
});

const ruleset = {
    createText: (text: string) => text,
    interpret: () => ({type: "unhandled" as const}),
    onUnhandled: "throw" as const,
    onError: ({error, phase, token, position, env}) => {
        if (position) {
            console.error(
                `[${phase}] ${error.message} at line ${position.start.line}:${position.start.column}`,
                token?.type,
            );
        } else {
            console.error(`[${phase}] ${error.message}`, token?.type);
        }
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

See [CHANGELOG](./CHANGELOG.md) for the full history.

---

## License

MIT
