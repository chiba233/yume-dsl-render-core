**English** | [中文](./README.zh-CN.md)

# yume-dsl-token-walker

<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

[![npm](https://img.shields.io/npm/v/yume-dsl-token-walker)](https://www.npmjs.com/package/yume-dsl-token-walker)
[![GitHub](https://img.shields.io/badge/GitHub-chiba233%2Fyume--dsl--token--walker-181717?logo=github)](https://github.com/chiba233/yume-dsl-token-walker)

A generic, lazy, generator-based token tree interpreter for
[`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL).

You provide rules. It walks the tree, yields output nodes, and gets out of the way.

---

## Ecosystem

| Package                                                     | Role                                                    |
|-------------------------------------------------------------|---------------------------------------------------------|
| [`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) | Parser — text to token tree                             |
| **`yume-dsl-token-walker`**                                 | Interpreter — token tree to output nodes (this package) |

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
import { parseRichText, createSimpleInlineHandlers } from "yume-dsl-rich-text";
import { interpretTokens } from "yume-dsl-token-walker";

const handlers = createSimpleInlineHandlers(["bold", "italic"]);
const tokens = parseRichText("$$bold(a $$italic(b)$$ c)$$", { handlers });

const html = Array.from(
  interpretTokens(tokens, {
    createText: (text) => text,
    interpret: (token, helpers) => {
      if (token.type === "bold")
        return { type: "nodes", nodes: ["<strong>", ...helpers.interpretChildren(token.value), "</strong>"] };
      if (token.type === "italic")
        return { type: "nodes", nodes: ["<em>", ...helpers.interpretChildren(token.value), "</em>"] };
      return { type: "unhandled" };
    },
  }, {}),
).join("");

// → "<strong>a <em>b</em> c</strong>"
```

---

## More Examples

### Use `env` to inject runtime context

```ts
import { createSimpleInlineHandlers, createParser } from "yume-dsl-rich-text";
import { interpretTokens } from "yume-dsl-token-walker";

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

                    return { type: "unhandled" };
                  },
                },
                { tone: "soft" },
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
                  interpret: () => ({ type: "unhandled" }),
                },
                undefined,
        ),
).join("");
```

For stricter behavior:

```ts
const strictRuleset = {
  createText: (text: string) => text,
  interpret: () => ({ type: "unhandled" as const }),
  onUnhandled: "throw" as const,
};
```

For custom fallback output:

```ts
const debugRuleset = {
  createText: (text: string) => text,
  interpret: () => ({ type: "unhandled" as const }),
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
import { createSimpleInlineHandlers, createSimpleBlockHandlers, createParser } from "yume-dsl-rich-text";
import { interpretTokens } from "yume-dsl-token-walker";

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

                    return { type: "unhandled" };
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
                  createText: (text) => ({ kind: "text", value: text }),
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

                    return { type: "unhandled" };
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
                      return { type: "drop" };
                    }

                    return { type: "unhandled" };
                  },
                  onUnhandled: "flatten",
                },
                undefined,
        ),
).join("");
```

Use `"drop"` when a token is metadata-only and should produce no output.

---

## API

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

---

## InterpretRuleset

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

---

## InterpretResult

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

---

## UnhandledStrategy

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

`ResolvedResult<TNode>` = `InterpretResult<TNode>` minus `{ type: "unhandled" }`.

---

## onError

Optional error observer. Called with context before the error is thrown. It does **not** suppress the error — the error
is always rethrown after `onError` returns.

```ts
const ruleset = {
  createText: (text: string) => text,
  interpret: () => ({ type: "unhandled" as const }),
  onUnhandled: "throw" as const,
  onError: ({ error, phase, token, env }) => {
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
    return { type: "unhandled" as const };
  },
  onError: ({ error }) => {
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

## InterpretHelpers

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

## Safety

- **Self-recursion detection**: if a handler feeds a token back into `interpretChildren` referencing itself, an error is
  thrown immediately
- **Circular value detection**: `flattenText` tracks visited tokens per recursion path (not globally), so shared
  references are safe but true cycles throw
- **Error observation**: all errors (from `interpret`, `onUnhandled` strategy functions, `flattenText`, and traversal
  checks) are routed through `onError` before being thrown

---

## Changelog

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
