[English](./README.md) | **中文**

# yume-dsl-token-walker

<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

[![npm](https://img.shields.io/npm/v/yume-dsl-token-walker)](https://www.npmjs.com/package/yume-dsl-token-walker)
[![GitHub](https://img.shields.io/badge/GitHub-chiba233%2Fyume--dsl--token--walker-181717?logo=github)](https://github.com/chiba233/yume-dsl-token-walker)

通用的、惰性的、基于 generator 的
[`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) token 树解释器。

包名叫 **token-walker** 是因为它的核心工作是逐节点*遍历* token 树。
公开 API 叫 `interpretTokens` 是因为对调用者而言，你在*解释* token 为输出——遍历只是实现细节。

你提供规则，它遍历树、yield 输出节点，然后闪开。

---

## 目录

- [生态](#生态)
- [安装](#安装)
- [快速上手](#快速上手)
- [导出一览](#导出一览)
- [示例](#示例)
    - [用 env 注入运行时上下文](#用-env-注入运行时上下文)
    - [自定义 onUnhandled](#自定义-onunhandled)
    - [在 handler 内使用 flattenText](#在-handler-内使用-flattentext)
    - [返回结构化节点](#返回结构化节点而不只是字符串)
    - [完全丢弃某类 token](#完全丢弃某类-token)
- [推荐结构](#推荐结构)
- [完整示例](#完整示例)
- [API — 核心](#api--核心)
    - [interpretTokens](#interprettokenstokens-ruleset-env)
    - [flattenText](#flattentextvalue)
- [API — 辅助工具](#api--辅助工具)
    - [createRuleset](#createrulesetruleset)
    - [fromHandlerMap](#fromhandlermaphandlers)
    - [dropToken](#droptoken)
    - [unwrapChildren](#unwrapchildren)
    - [wrapHandlers](#wraphandlershandlers-wrap)
    - [debugUnhandled](#debugunhandledformat)
    - [collectNodes](#collectnodesiterable)
- [类型定义](#类型定义)
    - [InterpretRuleset](#interpretruleset)
    - [InterpretResult](#interpretresult)
    - [ResolvedResult](#resolvedresult)
    - [UnhandledStrategy](#unhandledstrategy)
    - [InterpretHelpers](#interprethelpers)
- [错误处理](#错误处理)
    - [onError](#onerror)
    - [错误阶段](#错误阶段)
    - [记录错误但不阻止传播](#记录错误但不阻止传播)
- [安全性](#安全性)
- [更新日志](#更新日志)
- [许可证](#许可证)

---

## 生态

```
text ──▶ yume-dsl-rich-text (parse) ──▶ TextToken[] ──▶ yume-dsl-token-walker (interpret) ──▶ TNode[]
```

| 包                                                                                  | 角色                            |
|------------------------------------------------------------------------------------|-------------------------------|
| [`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL)                        | 解析器 — 文本到 token 树             |
| **`yume-dsl-token-walker`**                                                        | 解释器 — token 树到输出节点（本包）        |
| [`yume-dsl-shiki-highlight`](https://github.com/chiba233/yume-dsl-shiki-highlight) | 语法高亮 — 彩色 token 或 TextMate 语法 |

---

## 安装

```bash
npm install yume-dsl-token-walker
# 或
pnpm add yume-dsl-token-walker
```

`yume-dsl-rich-text` 是依赖项，会自动安装。

---

## 快速上手

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

## 导出一览

| 导出                  | 类别 | 说明                                                          |
|---------------------|----|-------------------------------------------------------------|
| `interpretTokens`   | 函数 | 遍历 token 树并 yield 输出节点（核心）                                  |
| `flattenText`       | 函数 | 从 token value 中提取纯文本（独立工具，不经过 `onError`）                    |
| `createRuleset`     | 辅助 | `InterpretRuleset` 的恒等函数，提供类型推断                             |
| `fromHandlerMap`    | 辅助 | 从 `Record<type, handler>` 映射构建 `interpret` 函数               |
| `dropToken`         | 辅助 | 直接丢弃 token 的 handler — 不产生任何输出                              |
| `unwrapChildren`    | 辅助 | 直接透传子节点的 handler，不加任何包装                                     |
| `wrapHandlers`      | 辅助 | 对 handler 映射表中的每个 handler 施加统一的包装变换                         |
| `debugUnhandled`    | 辅助 | 创建将未处理 token 渲染为可见占位符的 `onUnhandled` 函数                     |
| `collectNodes`      | 辅助 | `Array.from` 语法糖 — 将惰性 `Iterable<TNode>` 收集为数组              |
| `InterpretRuleset`  | 类型 | 传给 `interpretTokens` 的规则集接口                                 |
| `InterpretResult`   | 类型 | `interpret` 的返回类型（5 种变体）                                    |
| `ResolvedResult`    | 类型 | `InterpretResult` 去掉 `"unhandled"`                          |
| `InterpretHelpers`  | 类型 | 传给 `interpret` 和策略函数的辅助对象                                   |
| `UnhandledStrategy` | 类型 | `"throw" \| "flatten" \| "drop" \| function`                |
| `TokenHandler`      | 类型 | 单个 handler 函数签名的简写                                          |
| `TextResult`        | 类型 | `{ type: "text"; text: string }` — `debugUnhandled` 回调的返回类型 |

---

## 示例

### 用 `env` 注入运行时上下文

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

适合把主题、语言、权限、功能开关或渲染配置透传给解释器。

### 自定义 `onUnhandled`

默认情况下，未处理 token 会走 `"flatten"`：

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

如果你想要严格模式：

```ts
const strictRuleset = {
    createText: (text: string) => text,
    interpret: () => ({type: "unhandled" as const}),
    onUnhandled: "throw" as const,
};
```

如果你想输出调试占位：

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

常见用途：

- 线上环境平滑降级
- 测试环境对漏写 handler 直接报错
- 调试环境把未处理 token 类型直接暴露出来

### 在 handler 内使用 `flattenText`

有些时候你不想递归解释整个子树，而是只想拿到它的可读文本。

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

这类写法适合做搜索索引、摘要、aria label、纯文本导出或埋点文案。

### 返回结构化节点，而不只是字符串

`interpretTokens` 不关心 `TNode` 是什么。它可以是字符串、虚拟节点、AST 节点，或者你自己的渲染模型。

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

如果你要对接 React、Vue、Svelte、HTML AST 或自定义 renderer，这才是更自然的用法。

### 完全丢弃某类 token

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

`"drop"` 适合只承载元信息、不应该产生可见输出的 token。

---

## 推荐结构

### 小项目 — 内联 interpret

全部写在一个文件里，不需要任何 helper。

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

### 中项目 — fromHandlerMap + handlers 文件

把 handler 定义拆到单独文件，用 `createRuleset` 获得类型安全。

```
src/
  dsl/
    handlers.ts    ← handler 映射表
    ruleset.ts     ← createRuleset + fromHandlerMap
    interpret.ts   ← 调用 interpretTokens
```

```ts
// handlers.ts
import type {InterpretHelpers, ResolvedResult} from "yume-dsl-token-walker";

type Handler = (token: TextToken, helpers: InterpretHelpers<string, Env>) => ResolvedResult<string>;

// 共享包装逻辑 — 只是一个普通函数，不是库导出
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

### 大项目 — parse / interpret / render 三层分离

```
src/
  dsl/
    parser.ts      ← yume-dsl-rich-text 配置
    handlers/
      inline.ts    ← bold, italic, link, ...
      block.ts     ← info, warning, spoiler, ...
      index.ts     ← 合并后的 handler map
    ruleset.ts     ← createRuleset, env 类型
    interpret.ts   ← interpretTokens 封装
  render/
    toHtml.ts      ← TNode → HTML 字符串
    toPlainText.ts ← flattenText 做搜索 / 预览
```

核心原则：

- **`env` 只放运行时上下文** — 主题、语言、权限、功能开关。不要往 `env` 里塞业务状态。
- **Handler 是纯映射** — token 进，result 出。副作用属于 render 层。
- **一种输出格式一个 ruleset** — 如果同时需要 HTML 和纯文本，创建两个 ruleset，而不是一个里面做分支。

---

## 完整示例

完整流水线：解析 DSL 文本 → 解释为 HTML AST → 渲染为字符串。包含多种 token 类型、env 驱动的主题切换，以及双输出（富文本 +
纯文本搜索索引）。

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

// 富文本输出
const nodes = collectNodes(interpretTokens(tokens, ruleset, env));
const html = nodes.map(renderNode).join("");

// 纯文本搜索索引 — 独立调用，不需要 ruleset
const plain = flattenText(tokens);
```

这个例子展示了推荐的分层：

| 层          | 职责                   | 依赖                   |
|------------|----------------------|----------------------|
| `parser`   | 文本 → `TextToken[]`   | `yume-dsl-rich-text` |
| `handlers` | Token → interpret 结果 | token-walker 类型      |
| `ruleset`  | 组合 handler + 配置      | `handlers` + helpers |
| `render`   | `TNode[]` → 最终输出     | 你自己的节点类型             |

---

## API — 核心

### `interpretTokens(tokens, ruleset, env)`

惰性遍历 `TextToken[]` 树，通过 generator 逐个 yield `TNode`。

```ts
function* interpretTokens<TNode, TEnv>(
    tokens: TextToken[],
    ruleset: InterpretRuleset<TNode, TEnv>,
    env: TEnv,
): Generator<TNode>;
```

- 流式输出 — 节点逐个 yield，内部不缓冲
- 自引用安全 — 检测到 token 自引用时立即抛出
- 循环安全 — `flattenText` 按递归路径追踪已访问 token，共享引用安全，真正的循环会抛出

### `flattenText(value)`

辅助工具。递归提取 `string | TextToken[]` 中的纯文本。

```ts
const flattenText: (value: string | TextToken[]) => string;
```

> **边界说明：** `flattenText` 是独立导出的工具函数，**不会**经过 `onError`。只有在 `interpretTokens` 内部产生的错误才会被
`onError` 观察到。

---

## API — 辅助工具

可选的工具函数，不影响核心逻辑。按需导入。

### `createRuleset(ruleset)`

恒等函数，为 `InterpretRuleset` 提供完整的类型推断：

```ts
import {createRuleset} from "yume-dsl-token-walker";

const ruleset = createRuleset({
    createText: (text) => text,
    interpret: (token) => ({type: "unhandled"}),
});
```

### `fromHandlerMap(handlers)`

表驱动的 `interpret` — 将 token 类型映射到处理函数：

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

未匹配的 token 自动返回 `{ type: "unhandled" }`。

### `dropToken`

现成的 handler，直接丢弃 token，不产生任何输出。等价于 `() => ({ type: "drop" })`，省去样板代码：

```ts
import {fromHandlerMap, dropToken} from "yume-dsl-token-walker";

const interpret = fromHandlerMap({
    bold: (token, h) => ({type: "nodes", nodes: ["<b>", ...h.interpretChildren(token.value), "</b>"]}),
    comment: dropToken,
    metadata: dropToken,
});
```

### `unwrapChildren`

现成的 handler，解释子节点并直接透传，不加任何包装。适合结构性 token（本身不产生可见容器）：

```ts
import {fromHandlerMap, unwrapChildren} from "yume-dsl-token-walker";

const interpret = fromHandlerMap({
    bold: (token, h) => ({type: "nodes", nodes: ["<b>", ...h.interpretChildren(token.value), "</b>"]}),
    wrapper: unwrapChildren, // 只输出子节点，不加包装标签
    transparent: unwrapChildren,
});
```

### `wrapHandlers(handlers, wrap)`

对 handler 映射表中的每个 handler 施加统一的包装变换。`wrap` 回调接收 handler 的结果、token 和 helpers——返回新的
`ResolvedResult`。

`wrapHandlers` 是前处理 handler map，`fromHandlerMap` 是最终收口：

```
wrapHandlers(raw, wrap)  ──▶  handlers  ──▶  fromHandlerMap(handlers)  ──▶  interpret
```

```ts
import {fromHandlerMap, wrapHandlers, type TokenHandler} from "yume-dsl-token-walker";

const rawBlockHandlers: Record<string, TokenHandler<string>> = {
    info: (token, h) => ({type: "nodes", nodes: ["[INFO] ", ...h.interpretChildren(token.value)]}),
    warning: (token, h) => ({type: "nodes", nodes: ["[WARN] ", ...h.interpretChildren(token.value)]}),
};

// 所有 block handler 统一包一层 <div>
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

返回一个 `onUnhandled` 函数，将未处理的 token 渲染为可见占位符。适合调试、测试和 token 可视化：

```ts
import {debugUnhandled} from "yume-dsl-token-walker";

const ruleset = createRuleset({
    createText: (text) => text,
    interpret: () => ({type: "unhandled"}),
    onUnhandled: debugUnhandled(), // → "[unhandled:bold]"
});
```

### `collectNodes(iterable)`

`Array.from` 的语法糖。将惰性 `Iterable<TNode>` 收集为数组：

```ts
import {interpretTokens, collectNodes} from "yume-dsl-token-walker";

const nodes = collectNodes(interpretTokens(tokens, ruleset, env));
```

---

## 类型定义

### InterpretRuleset

传给 `interpretTokens` 的规则集：

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

| 字段            | 说明                                                    |
|---------------|-------------------------------------------------------|
| `createText`  | 将纯字符串包装为你的节点类型                                        |
| `interpret`   | 将 DSL token 映射为解释结果                                   |
| `onUnhandled` | 当 `interpret` 返回 `"unhandled"` 时的处理策略（默认：`"flatten"`） |
| `onError`     | 可选的错误观察回调，在抛出错误前调用                                    |

### InterpretResult

`interpret` 的返回类型：

```ts
type InterpretResult<TNode> =
    | { type: "nodes"; nodes: Iterable<TNode> }
    | { type: "text"; text: string }
    | { type: "flatten" }
    | { type: "unhandled" }
    | { type: "drop" };
```

| 结果            | 含义                                  |
|---------------|-------------------------------------|
| `"nodes"`     | yield 提供的节点                         |
| `"text"`      | 输出指定的文本字符串（显式）                      |
| `"flatten"`   | 将 `token.value` 展平为纯文本后输出           |
| `"unhandled"` | 该 token 没有处理器 — 交给 `onUnhandled` 策略 |
| `"drop"`      | 不输出任何内容                             |

### ResolvedResult

`InterpretResult<TNode>` 去掉 `{ type: "unhandled" }`。用作 `onUnhandled` 策略函数的返回类型。

```ts
type ResolvedResult<TNode> = Exclude<InterpretResult<TNode>, { type: "unhandled" }>;
```

### UnhandledStrategy

控制 `interpret` 返回 `{ type: "unhandled" }` 时的行为：

```ts
type UnhandledStrategy<TNode, TEnv = unknown> =
    | "throw"
    | "flatten"
    | "drop"
    | ((token: TextToken, helpers: InterpretHelpers<TNode, TEnv>) => ResolvedResult<TNode>);
```

| 策略          | 行为                                                 |
|-------------|----------------------------------------------------|
| `"throw"`   | 抛出错误                                               |
| `"flatten"` | 展平为纯文本（默认）                                         |
| `"drop"`    | 不输出                                                |
| 函数          | 自定义处理 — 必须返回 `ResolvedResult`（不允许返回 `"unhandled"`） |

### InterpretHelpers

传给 `interpret` 和策略函数的辅助对象：

```ts
interface InterpretHelpers<TNode, TEnv = unknown> {
    interpretChildren: (value: string | TextToken[]) => Iterable<TNode>;
    flattenText: (value: string | TextToken[]) => string;
    env: TEnv;
}
```

| 字段                  | 说明                                   |
|---------------------|--------------------------------------|
| `interpretChildren` | 递归解释子 token — 返回惰性 `Iterable<TNode>` |
| `flattenText`       | 从 token value 中提取纯文本                 |
| `env`               | 用户提供的环境对象，从 `interpretTokens` 透传     |

---

## 错误处理

### onError

可选的错误观察回调。在错误抛出前调用，携带上下文信息。它**不会**吞掉错误 — `onError` 返回后错误仍会被重新抛出。

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

### 错误阶段

| 阶段            | 触发场景                                                              |
|---------------|-------------------------------------------------------------------|
| `"interpret"` | `interpret()` 抛出、`onUnhandled` 策略函数抛出、或 `onUnhandled: "throw"` 触发 |
| `"flatten"`   | `flattenText` 失败（如循环引用）                                           |
| `"traversal"` | 结构错误 — 无效的 text token value、递归 token 检测                           |
| `"internal"`  | 内部异常状态（如未知的 result type）                                          |

### 记录错误但不阻止传播

`onError` 在抛出前调用，因此你可以用它来日志、上报或收集错误 — 即使错误仍然会向上传播：

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
    // errors[] 现在包含了观察到的错误
}
```

---

## 安全性

- **自引用检测**：如果处理器将 token 自身回传给 `interpretChildren`，立即抛出错误
- **循环引用检测**：`flattenText` 按递归路径追踪已访问 token（非全局），共享引用安全，真正的循环会抛出
- **错误观察**：解释流程中的错误（来自 `interpret`、`onUnhandled` 策略函数、`flattenText` 和遍历检查）均会在抛出前经过
  `onError` 回调

> **边界说明：** 导出的 `flattenText()` 是独立工具函数，**不会**经过 `onError`。只有在 `interpretTokens` 内部产生的错误才会被
`onError` 观察到。

---

## 更新日志

### 0.1.2

- 更新文档，添加生态链库。

### 0.1.1

- 新增辅助工具：`createRuleset`、`fromHandlerMap`、`dropToken`、`unwrapChildren`、`wrapHandlers`、`debugUnhandled`、
  `collectNodes`
- 新增 `TokenHandler` 类型 — handler 函数签名的简写
- `debugUnhandled` 返回窄类型 `{ type: "text"; text: string }` — 无需假泛型即可兼容任意 `TNode`
- `fromHandlerMap` 的 handler 返回类型收紧为 `ResolvedResult` — handler 内不应返回 `"unhandled"`
- 源码拆分为 `types.ts`、`interpret.ts`、`helpers.ts`（`index.ts` 统一 re-export）
- README：添加目录、导出一览表，按类别分组
- 更新 "yume-dsl-rich-text" 到 "0.1.14"，虽然此版本只是更新readme

### 0.1.0

- 新增 `onError` 错误观察回调 — 在抛出前调用，携带 `{ error, phase, token, env }` 上下文
- 错误阶段：`"interpret"`、`"flatten"`、`"traversal"`、`"internal"`
- `onUnhandled` 策略函数抛出的错误现在也会经过 `onError` 回调
- 包重命名为 `yume-dsl-token-walker`
- `renderTokens` → `interpretTokens`，`TokenRenderer` → `InterpretRuleset`
- `defer` → `unhandled`，`empty` → `drop`
- `{ type: "text"; text?: string }` 拆分为 `{ type: "text"; text: string }` + `{ type: "flatten" }`
- `strict` + `fallbackRender` 合并为 `onUnhandled` 策略枚举
- 策略函数返回类型收紧为 `ResolvedResult`（不允许返回 `"unhandled"`）
- 移除 `collectRendered`

---

## 许可证

MIT
