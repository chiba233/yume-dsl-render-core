[English](./README.md) | **中文**

# yume-dsl-token-walker

<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

[![npm](https://img.shields.io/npm/v/yume-dsl-token-walker)](https://www.npmjs.com/package/yume-dsl-token-walker)
[![GitHub](https://img.shields.io/badge/GitHub-chiba233%2Fyume--dsl--token--walker-181717?logo=github)](https://github.com/chiba233/yume-dsl-token-walker)
[![CI](https://github.com/chiba233/yume-dsl-token-walker/actions/workflows/publish-yume-dsl-token-walker.yml/badge.svg)](https://github.com/chiba233/yume-dsl-token-walker/actions/workflows/publish-yume-dsl-token-walker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Contributing](https://img.shields.io/badge/贡献指南-guide-blue.svg)](./CONTRIBUTING.zh-CN.md)
[![Security](https://img.shields.io/badge/安全策略-policy-red.svg)](./SECURITY.md)

通用的、惰性的、基于 generator 的
[`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) token 树解释器。

包名叫 **token-walker** 是因为它的核心工作是逐节点*遍历* token 树。
公开 API 叫 `interpretTokens` 是因为对调用者而言，你在*解释* token 为输出——遍历只是实现细节。

你提供规则，它遍历树、yield 输出节点，然后闪开。

同时提供**同步** (`Generator`) 和**异步** (`AsyncGenerator`) 两套 API。
异步 API 是同步核心的完整镜像——相同语义、相同错误处理、相同安全保证。

**核心 API 已稳定。** 后续更新以向后兼容为优先；如有破坏性变更，将在主版本号升级时附带明确的迁移说明。

它刻意只消费 `TextToken[]`，不处理 structural parse node。
如果你需要带语法感知的结构分析或高亮，请使用 `yume-dsl-rich-text` 的 `parseStructural`，或者
[`yume-dsl-shiki-highlight`](https://github.com/chiba233/yume-dsl-shiki-highlight)。

新的 parser 配置建议优先使用 `createParser(...)`。
如果上游需要自定义定界符或转义标记，优先使用 `createEasySyntax(...)`，再把生成的 `syntax` 显式传给 parser。

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
- [同步 API](#同步-api)
    - [核心](#同步-api--核心)
        - [interpretText](#interprettextinput-parser-ruleset-env)
        - [interpretTokens](#interprettokenstokens-ruleset-env)
        - [flattenText](#flattentextvalue)
    - [辅助工具](#同步-api--辅助工具)
        - [createRuleset](#createrulesetruleset)
        - [fromHandlerMap](#fromhandlermaphandlers)
        - [dropToken](#droptoken)
        - [unwrapChildren](#unwrapchildren)
        - [wrapHandlers](#wraphandlershandlers-wrap)
        - [debugUnhandled](#debugunhandledformat)
        - [collectNodes](#collectnodesiterable)
    - [类型定义](#同步类型定义)
        - [InterpretRuleset](#interpretruleset)
        - [InterpretResult](#interpretresult)
        - [ResolvedResult](#resolvedresult)
        - [UnhandledStrategy](#unhandledstrategy)
        - [InterpretHelpers](#interprethelpers)
- [异步 API](#异步-api)
    - [核心](#异步-api--核心)
        - [interpretTextAsync](#interprettextasyncinput-parser-ruleset-env)
        - [interpretTokensAsync](#interprettokensasynctokens-ruleset-env)
    - [辅助工具](#异步-api--辅助工具)
        - [fromAsyncHandlerMap](#fromasynchandlermaphandlers)
        - [wrapAsyncHandlers](#wrapasynchandlershandlers-wrap)
        - [collectNodesAsync](#collectnodesasynciterable)
    - [类型定义](#异步类型定义)
        - [AsyncInterpretRuleset](#asyncinterpretruleset)
        - [AsyncInterpretResult](#asyncinterpretresult)
        - [AsyncResolvedResult](#asyncresolvedresult)
        - [AsyncUnhandledStrategy](#asyncunhandledstrategy)
        - [AsyncInterpretHelpers](#asyncinterprethelpers)
        - [Awaitable](#awaitablet)
        - [AsyncTokenHandler](#asynctokenhandler)
- [结构切片](#结构切片)
    - [parseSlice](#parseslicefulltext-span-parser-tracker)
    - [ParseOverrides](#parseoverrides)
    - [ParserLike](#parserlike)
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

边界说明：

- 推荐的上游路径是 `createParser(...).parse(...)`。
- 如果你要自定义定界符，优先使用 `createEasySyntax(...)` + `createParser({ syntax, ... })`。
- `yume-dsl-token-walker` 也能消费旧的 `parseRichText(...)` 输出，因为它的边界始终是 `TextToken[]`。
- `parseStructural(...)` 和 `createParser(...).structural(...)` 属于语法分析 / 高亮路径，不属于 walker 输入。

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

如果你手里已经有 `TextToken[]`，就直接用 `interpretTokens(...)`。
`parser.structural(...)` 属于另一层能力，不是本包输入。
如果你不需要自定义语法，直接省略 `syntax`，使用普通的 `createParser(...)` 即可。

---

## 导出一览

**同步**

| 导出                  | 类别 | 说明                                                          |
|---------------------|----|-------------------------------------------------------------|
| `interpretText`     | 函数 | 推荐的便利入口：先用 parser 解析 DSL 文本，再 yield 输出节点                    |
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
| `ParserLike`        | 类型 | 解析器接口 — `parse(input, overrides?)` 返回 `TextToken[]`         |

**结构切片**

| 导出               | 类别 | 说明                                                                  |
|------------------|----|---------------------------------------------------------------------|
| `parseSlice`     | 函数 | 按 `SourceSpan` 从完整文本中切片解析，自动映射位置                                    |
| `ParseOverrides` | 类型 | 传给 `ParserLike.parse` 的选项 — `trackPositions`、`baseOffset`、`tracker` |

**异步**

| 导出                       | 类别 | 说明                                                         |
|--------------------------|----|------------------------------------------------------------|
| `interpretTextAsync`     | 函数 | 异步便利入口：先用 parser 解析 DSL 文本，再通过 `AsyncGenerator` yield 输出节点 |
| `interpretTokensAsync`   | 函数 | 异步遍历 token 树 — 通过 `AsyncGenerator` yield 输出节点              |
| `fromAsyncHandlerMap`    | 辅助 | 从 `Record<type, handler>` 映射构建异步 `interpret` 函数            |
| `wrapAsyncHandlers`      | 辅助 | 对异步 handler 映射表中的每个 handler 施加统一的包装变换                      |
| `collectNodesAsync`      | 辅助 | 将 `AsyncIterable<TNode>` 收集为数组                             |
| `AsyncInterpretRuleset`  | 类型 | 传给 `interpretTokensAsync` 的异步规则集接口                         |
| `AsyncInterpretResult`   | 类型 | 异步 `interpret` 的返回类型 — `nodes` 可以是 `AsyncIterable`         |
| `AsyncResolvedResult`    | 类型 | `AsyncInterpretResult` 去掉 `"unhandled"`                    |
| `AsyncInterpretHelpers`  | 类型 | 异步辅助对象 — `interpretChildren` 返回 `AsyncIterable<TNode>`     |
| `AsyncUnhandledStrategy` | 类型 | `UnhandledStrategy` 的异步版本 — 回调可返回 `Awaitable`              |
| `AsyncTokenHandler`      | 类型 | 异步 handler 函数签名的简写                                         |
| `Awaitable`              | 类型 | `T \| Promise<T>` — 用于异步 API 签名                            |

---

## 示例

### 用 `env` 注入运行时上下文

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
    theme: "light" | "dark";
}

// ── parser.ts ──
import {createParser, createSimpleInlineHandlers, createPipeHandlers} from "yume-dsl-rich-text";

const parser = createParser({
    handlers: {
        ...createSimpleInlineHandlers(["bold", "italic"]),
        // link 使用 pipe：$$link(url | 显示文本)$$
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

const input = "Hello $$bold($$italic(world)$$)$$ - $$link(https://example.com | 点击这里)$$";
const tokens = parser.parse(input);
const env: Env = {theme: "dark"};

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

这个流水线里刻意不包含 `parseStructural`。
只有在你需要结构化语法信息时才使用它，而不是在把 `TextToken[]` 解释成输出节点时使用。

---

## 同步 API

### 同步 API — 核心

#### `interpretText(input, parser, ruleset, env)`

一个很薄的便利封装，本质是 `parser.parse(input)` + `interpretTokens(...)`。

```ts
function* interpretText<TNode, TEnv>(
    input: string,
    parser: ParserLike,
    ruleset: InterpretRuleset<TNode, TEnv>,
    env: TEnv,
): Generator<TNode>;
```

适合派生包或应用层减少一行样板代码，但不会改变包边界。
它内部仍然只消费 `TextToken[]`，不会使用 `parser.structural(...)`。

`ParserLike` 指任何带有 `parse(input: string, overrides?: ParseOverrides): TextToken[]` 的对象。

#### `interpretTokens(tokens, ruleset, env)`

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
- 当上游设置 `trackPositions: true` 时，每个 `token.position` 携带 `SourceSpan` —
  在 handler 内可直接访问，同时透传至 `onError`

#### `flattenText(value)`

辅助工具。递归提取 `string | TextToken[]` 中的纯文本。

```ts
const flattenText: (value: string | TextToken[]) => string;
```

> **边界说明：** `flattenText` 是独立导出的工具函数，**不会**经过 `onError`。只有在 `interpretTokens` 内部产生的错误才会被
`onError` 观察到。

---

### 同步 API — 辅助工具

可选的工具函数，不影响核心逻辑。按需导入。

#### `createRuleset(ruleset)`

恒等函数，为 `InterpretRuleset` 提供完整的类型推断：

```ts
import {createRuleset} from "yume-dsl-token-walker";

const ruleset = createRuleset({
    createText: (text) => text,
    interpret: (token) => ({type: "unhandled"}),
});
```

#### `fromHandlerMap(handlers)`

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

#### `dropToken`

现成的 handler，直接丢弃 token，不产生任何输出。等价于 `() => ({ type: "drop" })`，省去样板代码：

```ts
import {fromHandlerMap, dropToken} from "yume-dsl-token-walker";

const interpret = fromHandlerMap({
    bold: (token, h) => ({type: "nodes", nodes: ["<b>", ...h.interpretChildren(token.value), "</b>"]}),
    comment: dropToken,
    metadata: dropToken,
});
```

#### `unwrapChildren`

现成的 handler，解释子节点并直接透传，不加任何包装。适合结构性 token（本身不产生可见容器）：

```ts
import {fromHandlerMap, unwrapChildren} from "yume-dsl-token-walker";

const interpret = fromHandlerMap({
    bold: (token, h) => ({type: "nodes", nodes: ["<b>", ...h.interpretChildren(token.value), "</b>"]}),
    wrapper: unwrapChildren, // 只输出子节点，不加包装标签
    transparent: unwrapChildren,
});
```

#### `wrapHandlers(handlers, wrap)`

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

#### `debugUnhandled(format?)`

返回一个 `onUnhandled` 函数，将未处理的 token 渲染为可见占位符。适合调试、测试和 token 可视化：

```ts
import {debugUnhandled} from "yume-dsl-token-walker";

const ruleset = createRuleset({
    createText: (text) => text,
    interpret: () => ({type: "unhandled"}),
    onUnhandled: debugUnhandled(), // → "[unhandled:bold]"
});
```

#### `collectNodes(iterable)`

`Array.from` 的语法糖。将惰性 `Iterable<TNode>` 收集为数组：

```ts
import {interpretTokens, collectNodes} from "yume-dsl-token-walker";

const nodes = collectNodes(interpretTokens(tokens, ruleset, env));
```

---

### 同步类型定义

#### InterpretRuleset

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
        position?: SourceSpan;
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

#### InterpretResult

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

#### ResolvedResult

`InterpretResult<TNode>` 去掉 `{ type: "unhandled" }`。用作 `onUnhandled` 策略函数的返回类型。

```ts
type ResolvedResult<TNode> = Exclude<InterpretResult<TNode>, { type: "unhandled" }>;
```

#### UnhandledStrategy

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

#### InterpretHelpers

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

## 异步 API

异步 API 是同步核心的镜像。当你的 `interpret` 函数需要 `await` 时使用——例如拉取远程内容、查询数据库或调用异步渲染器。

核心设计决策：

- `createText` 是**同步的** — 文本包装始终是纯粹的、快速的操作
- `interpret` 和 `onUnhandled` 策略函数可返回 `Awaitable<T>`（`T | Promise<T>`）
- `interpretChildren` 返回 `AsyncIterable<TNode>` — 用 `for await` 或在 async generator 中用 `yield*` 消费
- 结果中的 `nodes` 可以是 `Iterable<TNode>` 或 `AsyncIterable<TNode>`
- 错误处理、递归检测和 `onError` 行为与同步 API 完全一致

### 异步快速上手

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

### 异步 API — 核心

#### `interpretTextAsync(input, parser, ruleset, env)`

异步便利封装，本质是 `parser.parse(input)` + `interpretTokensAsync(...)`。

```ts
async function* interpretTextAsync<TNode, TEnv>(
    input: string,
    parser: ParserLike,
    ruleset: AsyncInterpretRuleset<TNode, TEnv>,
    env: TEnv,
): AsyncGenerator<TNode>;
```

#### `interpretTokensAsync(tokens, ruleset, env)`

异步惰性遍历 `TextToken[]` 树，通过 async generator 逐个 yield `TNode`。

```ts
async function* interpretTokensAsync<TNode, TEnv>(
    tokens: TextToken[],
    ruleset: AsyncInterpretRuleset<TNode, TEnv>,
    env: TEnv,
): AsyncGenerator<TNode>;
```

- 流式输出 — 节点逐个 yield，内部不缓冲
- 自引用安全 — 检测到 token 自引用时立即抛出
- 同时支持同步和异步 iterable 的 `nodes` 结果

### 异步 API — 辅助工具

#### `fromAsyncHandlerMap(handlers)`

`fromHandlerMap` 的异步版本。将 token 类型映射到异步处理函数：

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

未匹配的 token 自动返回 `{ type: "unhandled" }`。

#### `wrapAsyncHandlers(handlers, wrap)`

`wrapHandlers` 的异步版本。对异步 handler 施加统一包装变换。
`wrap` 回调接收的是 await 后的 handler 结果：

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

将 `AsyncIterable<TNode>` 收集为数组：

```ts
import {interpretTokensAsync, collectNodesAsync} from "yume-dsl-token-walker";

const nodes = await collectNodesAsync(interpretTokensAsync(tokens, ruleset, env));
```

### 异步类型定义

#### AsyncInterpretRuleset

传给 `interpretTokensAsync` 的规则集：

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

| 字段            | 说明                                                                   |
|---------------|----------------------------------------------------------------------|
| `createText`  | 将纯字符串包装为你的节点类型 — **同步**                                              |
| `interpret`   | 将 DSL token 映射为解释结果 — 可返回 `Promise`                                  |
| `onUnhandled` | 当 `interpret` 返回 `"unhandled"` 时的处理策略（默认：`"flatten"`）— 可返回 `Promise` |
| `onError`     | 可选的错误观察回调，在抛出错误前调用                                                   |

#### AsyncInterpretResult

异步 `interpret` 的返回类型：

```ts
type AsyncInterpretResult<TNode> =
    | { type: "nodes"; nodes: Iterable<TNode> | AsyncIterable<TNode> }
    | { type: "text"; text: string }
    | { type: "flatten" }
    | { type: "unhandled" }
    | { type: "drop" };
```

`"nodes"` 变体同时接受 `Iterable` 和 `AsyncIterable`，所以你可以返回普通数组或 async generator。

#### AsyncResolvedResult

`AsyncInterpretResult<TNode>` 去掉 `{ type: "unhandled" }`：

```ts
type AsyncResolvedResult<TNode> = Exclude<AsyncInterpretResult<TNode>, { type: "unhandled" }>;
```

#### AsyncUnhandledStrategy

`UnhandledStrategy` 的异步版本 — 回调可返回 `Awaitable`：

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

传给异步 `interpret` 和策略函数的辅助对象：

```ts
interface AsyncInterpretHelpers<TNode, TEnv = unknown> {
    interpretChildren: (value: string | TextToken[]) => AsyncIterable<TNode>;
    flattenText: (value: string | TextToken[]) => string;
    env: TEnv;
}
```

| 字段                  | 说明                                       |
|---------------------|------------------------------------------|
| `interpretChildren` | 递归解释子 token — 返回 `AsyncIterable<TNode>`  |
| `flattenText`       | 从 token value 中提取纯文本 — 与同步 API 使用同一个同步函数 |
| `env`               | 用户提供的环境对象，从 `interpretTokensAsync` 透传    |

#### `Awaitable<T>`

```ts
type Awaitable<T> = T | Promise<T>;
```

贯穿异步 API 签名，允许同步和异步返回值混用。

#### AsyncTokenHandler

异步 handler 函数签名的简写：

```ts
type AsyncTokenHandler<TNode, TEnv = unknown> = (
    token: TextToken,
    helpers: AsyncInterpretHelpers<TNode, TEnv>,
) => Awaitable<AsyncResolvedResult<TNode>>;
```

---

## 结构切片

用 `yume-dsl-rich-text` 的 `parseStructural` 预扫描文档（快，比 `parseRichText` 便宜约 50 倍），
然后用 `parseSlice` 按需只解析你关心的区域，位置自动映射回原始文档。

> **一句话** — `parseStructural` 给你地图；`parseSlice` 让你跳到地图上任意一点，
> 拿到带正确位置的 `TextToken[]`，不用重新解析整个文档。

### 完整管线示例

```ts
import {createParser, createSimpleInlineHandlers, buildPositionTracker} from "yume-dsl-rich-text";
import {parseSlice, interpretTokens, collectNodes} from "yume-dsl-token-walker";

const parser = createParser({
    handlers: createSimpleInlineHandlers(["bold", "italic"]),
});

const fullText = "intro\n$$bold(hello $$italic(world)$$)$$\noutro";

// 1. 预扫描：快速结构扫描 + 位置
const structural = parser.structural(fullText, {trackPositions: true});

// 2. 构建一次 tracker，所有切片复用
const tracker = buildPositionTracker(fullText);

// 3. 选一个节点，只解析那个区域
const boldNode = structural.find(n => n.type === "inline" && n.tag === "bold");
if (boldNode?.position) {
    const tokens = parseSlice(fullText, boldNode.position, parser, tracker);
    // tokens 的 offset/line/column 全部指向 fullText

    // 4. 照常 interpret
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

不传 `tracker` 时 `parseSlice` 仍然可用——`offset` 正确，但 `line`/`column` 基于切片本地计算。
传了 `tracker` 后三个字段全部指回原始文档。
用 `buildPositionTracker(fullText)` **构建一次**——不要对每个 slice 重建。

### `parseSlice(fullText, span, parser, tracker?)`

按 `SourceSpan` 从完整文本中切片，然后带位置映射解析。

```ts
const parseSlice: (
    fullText: string,
    span: SourceSpan,
    parser: ParserLike,
    tracker?: PositionTracker,
) => TextToken[];
```

| 参数         | 说明                                                           |
|------------|--------------------------------------------------------------|
| `fullText` | 完整的源文本                                                       |
| `span`     | 要解析的区域 — 通常来自 `StructuralNode.position`                      |
| `parser`   | 带 `parse(input, overrides?)` 的解析器                            |
| `tracker`  | 可选，来自 `buildPositionTracker(fullText)`，用于正确的 `line`/`column` |

位置追踪始终开启。`baseOffset` 从 `span.start.offset` 自动派生。

### ParseOverrides

`ParserLike.parse` 第二参数接受的选项：

```ts
interface ParseOverrides {
    trackPositions?: boolean;
    baseOffset?: number;
    tracker?: PositionTracker;
}
```

### ParserLike

`interpretText`、`interpretTextAsync` 和 `parseSlice` 使用的解析器接口：

```ts
interface ParserLike {
    parse: (input: string, overrides?: ParseOverrides) => TextToken[];
}
```

`yume-dsl-rich-text` 的 `createParser(...)` 满足此接口。

---

## 错误处理

### onError

可选的错误观察回调。在错误抛出前调用，携带上下文信息。它**不会**吞掉错误 — `onError` 返回后错误仍会被重新抛出。

`position` 透传自 `token.position`，需要上游 parser 开启源码位置追踪：
`createParser({ trackPositions: true, ... })`。`SourceSpan` 包含 `start` 和 `end`，各自带有
`offset`（从 0 开始）、`line`（从 1 开始）和 `column`（从 1 开始）。
未开启位置追踪时 `position` 为 `undefined`。

```ts
const parser = createParser({
    handlers: createSimpleInlineHandlers(["bold"]),
    trackPositions: true,  // ← 开启源码位置追踪
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

详见 [更新日志](./CHANGELOG.zh-CN.md)。

---

## 许可证

MIT
