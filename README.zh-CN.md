[English](./README.md) | **中文**

# yume-dsl-token-walker

<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

[![npm](https://img.shields.io/npm/v/yume-dsl-token-walker)](https://www.npmjs.com/package/yume-dsl-token-walker)
[![GitHub](https://img.shields.io/badge/GitHub-chiba233%2Fyume--dsl--token--walker-181717?logo=github)](https://github.com/chiba233/yume-dsl-token-walker)
[![CI](https://github.com/chiba233/yume-dsl-token-walker/actions/workflows/publish-yume-dsl-token-walker.yml/badge.svg)](https://github.com/chiba233/yume-dsl-token-walker/actions/workflows/publish-yume-dsl-token-walker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Contributing](https://img.shields.io/badge/贡献指南-guide-blue.svg)](./CONTRIBUTING.zh-CN.md)
[![Security](https://img.shields.io/badge/安全策略-policy-red.svg)](./SECURITY.md)

[`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) 的操作层。
Parser 给你树——这个包对树做事。

- **[解释](#同步-api)** — 用规则集遍历 `TextToken[]` 树，yield 任意输出节点；
  惰性 generator，同步 + 异步，递归安全
- **[查询](#结构查询)** — [`findFirst`](#findfirstnodes-predicate) / [`findAll`](#findallnodes-predicate) /
  [`walkStructural`](#walkstructuralnodes-visitor) / [`nodeAtOffset`](#nodeatoffsetnodes-offset) /
  [`enclosingNode`](#enclosingnodesnodes-offset) 在 `StructuralNode[]` 树上操作
- **[Lint](#lint)** — [`lintStructural`](#lintstructuralsource-options) 对结构树运行自定义规则，
  上报带可选自动修复的 [`Diagnostic`](#diagnostic)；
  [`applyLintFixes`](#applylintfixessource-diagnostics) 以原子方式应用修复
- **[切片](#结构切片)** — [`parseSlice`](#parseslicefulltext-span-parser-tracker) 局部重解析，
  位置自动映射，无需全文重解析

**核心 API 已稳定。** 如有破坏性变更，将在主版本号升级时附带迁移说明。

## 生态

```
text ──▶ yume-dsl-rich-text (parse) ──▶ TextToken[] / StructuralNode[]
                                              │
                                  yume-dsl-token-walker
                                   ├─ interpret  (TextToken[] → TNode[])
                                   ├─ query      (StructuralNode[] 搜索)
                                   ├─ lint       (StructuralNode[] 校验)
                                   └─ slice      (区域重解析)
```

| 包                                                                                  | 职责                                          |
|------------------------------------------------------------------------------------|---------------------------------------------|
| [`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL)                        | 解析器 — 文本到 token 树                           |
| **`yume-dsl-token-walker`**                                                        | 操作层 — 解释、查询、lint、切片（本包）                     |
| [`yume-dsl-shiki-highlight`](https://github.com/chiba233/yume-dsl-shiki-highlight) | 语法高亮 — token 着色或 TextMate 语法                |
| [`yume-dsl-markdown-it`](https://github.com/chiba233/yume-dsl-markdown-it)         | markdown-it 插件 — 在 Markdown 中嵌入 DSL 标签      |

---

## 目录

- [安装](#安装)
- [快速上手](#快速上手)
- [导出一览](#导出一览)
- [示例](#示例)
- [推荐结构](#推荐结构)
- [完整示例](#完整示例)
- [同步 API](#同步-api)
- [异步 API](#异步-api)
- [结构查询](#结构查询)
- [Lint](#lint)
- [结构切片](#结构切片)
- [错误处理](#错误处理)
- [安全性](#安全性)
- [更新日志](#更新日志)
- [许可证](#许可证)

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
如果你不需要自定义语法，直接省略 `syntax`，使用普通的 `createParser(...)` 即可。

---

## 从哪开始看

| 你想做的事                                     | 去看                                        |
|---------------------------------------------|---------------------------------------------|
| 把 `TextToken[]` 变成 HTML / VNode / 字符串     | [同步 API](#同步-api) 或 [异步 API](#异步-api)     |
| 在 `StructuralNode[]` 树上搜索 / 定位节点          | [结构查询](#结构查询)                               |
| 用自定义规则校验 DSL 源码 + 自动修复                     | [Lint](#lint)                                |
| 局部重解析某个区域，不重新 parse 全文                     | [结构切片](#结构切片)                               |

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

**结构查询**

| 导出                       | 类别 | 说明                                                                         |
|--------------------------|----|----------------------------------------------------------------------------|
| `findFirst`              | 函数 | 深度优先先序搜索 — 返回第一个匹配的 `StructuralNode`                                       |
| `findAll`                | 函数 | 深度优先先序搜索 — 返回所有匹配的 `StructuralNode`                                        |
| `walkStructural`         | 函数 | 深度优先先序遍历 — 带上下文访问每个节点                                                      |
| `nodeAtOffset`           | 函数 | 按源码偏移查找最深节点（需 `trackPositions`）                                            |
| `enclosingNode`          | 函数 | 按源码偏移查找最深的 tag 节点（需 `trackPositions`）                                      |
| `StructuralTagNode`      | 类型 | Tag 形式节点：`Extract<StructuralNode, { type: "inline" \| "raw" \| "block" }>` |
| `StructuralVisitContext` | 类型 | 传给回调的上下文 — `parent`、`depth`、`index`                                        |
| `StructuralPredicate`    | 类型 | `findFirst` / `findAll` 的谓词函数签名                                            |
| `StructuralVisitor`      | 类型 | `walkStructural` 的访问者函数签名                                                  |

**Lint**

| 导出                   | 类别 | 说明                                                                         |
|----------------------|----|----------------------------------------------------------------------------|
| `lintStructural`     | 函数 | 对 DSL 源码运行 lint 规则 — 返回按偏移排序的 `Diagnostic[]`                               |
| `applyLintFixes`     | 函数 | 将可修复的诊断应用到源码 — 返回新字符串                                                      |
| `LintRule`           | 类型 | 规则接口 — `id`、`severity?`、`check(ctx)`                                       |
| `LintContext`        | 类型 | 传给规则 `check` 的上下文 — `source`、`tree`、`report`、`findFirst`、`findAll`、`walk`  |
| `LintOptions`        | 类型 | `lintStructural` 的选项 — `rules`、`overrides?`、`parseOptions?`、`onRuleError?` |
| `Diagnostic`         | 类型 | 诊断结果 — `ruleId`、`severity`、`message`、`span`、`node?`、`fix?`                 |
| `DiagnosticSeverity` | 类型 | `"error" \| "warning" \| "info" \| "hint"`                                 |
| `Fix`                | 类型 | 自动修复 — `description`、`edits: TextEdit[]`                                   |
| `TextEdit`           | 类型 | 源码编辑 — `span: SourceSpan`、`newText: string`                                |
| `ReportInfo`         | 类型 | `ctx.report()` 的参数 — `Diagnostic` 去掉 `ruleId`，`severity` 可选                |

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

## 结构查询

在 `StructuralNode[]` 树中搜索和定位节点。这些辅助函数操作的是来自 `parseStructural` 的结构解析树，
而不是 `TextToken[]`。

### `findFirst(nodes, predicate)`

深度优先先序搜索。返回第一个使 `predicate` 返回 `true` 的节点，或 `undefined`。

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

深度优先先序搜索。返回所有使 `predicate` 返回 `true` 的节点。

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

查找源码 span 包含给定偏移量的最深节点。
需要以 `trackPositions: true` 解析的节点。

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
const node = nodeAtOffset(tree, 14); // 偏移量 14 在 "world" 内部
// node.type === "text", node.value === "world"
```

如果没有节点包含该偏移量，或未启用位置追踪，返回 `undefined`。

### `enclosingNode(nodes, offset)`

查找源码 span 包含给定偏移量的最深 tag 节点（inline / raw / block）。
与 `nodeAtOffset` 不同，它跳过 text、escape 和 separator 节点 —
只返回结构上有意义的"包围" tag 节点。

返回类型为 `StructuralTagNode | undefined` — 已收窄，可直接访问
`.tag`、`.children`、`.args` 等字段，无需额外类型守卫。

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
const tag = enclosingNode(tree, 14); // 偏移量 14 在 "world" 内部
// tag.type === "inline", tag.tag === "bold"
```

如果偏移量不在任何 tag 内部，或未启用位置追踪，返回 `undefined`。

> **偏移量语义：** offset 必须是传给 `parseStructural` 的**原始源码文本**的字符串索引，
> 而不是渲染后、打印后或展示文本中的索引。此约定同样适用于 `nodeAtOffset`。

### `walkStructural(nodes, visitor)`

深度优先先序遍历。对每个节点调用 `visitor`，提供完整上下文。
与 `findFirst`/`findAll` 不同，这是一个纯副作用访问器——不收集也不返回任何值。

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

### StructuralVisitContext

传给回调的上下文：

```ts
interface StructuralVisitContext {
    parent: StructuralNode | null;
    depth: number;
    index: number;
}
```

| 字段       | 说明                |
|----------|-------------------|
| `parent` | 父节点，顶层节点时为 `null` |
| `depth`  | 嵌套深度（顶层为 0）       |
| `index`  | 在父节点子数组中的索引       |

### StructuralPredicate

`findFirst` 和 `findAll` 使用的谓词函数签名：

```ts
type StructuralPredicate = (
    node: StructuralNode,
    ctx: StructuralVisitContext,
) => boolean;
```

### StructuralVisitor

`walkStructural` 和 `LintContext.walk` 使用的访问者函数签名：

```ts
type StructuralVisitor = (
    node: StructuralNode,
    ctx: StructuralVisitContext,
) => void;
```

---

## Lint

面向 DSL 源码的最小 lint 框架。规则在结构解析树上运行，上报诊断结果并支持可选的自动修复。

### 快速上手

```ts
import {lintStructural, applyLintFixes, type LintRule} from "yume-dsl-token-walker";

const noEmptyTag: LintRule = {
    id: "no-empty-tag",
    severity: "warning",
    check: (ctx) => {
        ctx.findAll(ctx.tree, (node) => {
            if (node.type === "inline" && node.children.length === 0 && node.position) {
                ctx.report({
                    message: `空的 inline 标签: ${node.tag}`,
                    span: node.position,
                    node,
                    fix: {
                        description: "删除空标签",
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
// diagnostics[0].message === "空的 inline 标签: bold"

const fixed = applyLintFixes(source, diagnostics);
// fixed === "Hello  world"
```

### `lintStructural(source, options)`

对 DSL 源码运行 lint 规则。以 `trackPositions: true` 解析源码，
然后运行每个规则的 `check` 函数。返回按源码偏移排序的诊断列表。

```ts
const lintStructural: (source: string, options: LintOptions) => Diagnostic[];
```

抛异常的规则会被隔离——错误通过 `onRuleError` 上报，其余规则继续运行。

### `applyLintFixes(source, diagnostics)`

将可修复的诊断应用到源码，产出新字符串。

```ts
const applyLintFixes: (source: string, diagnostics: Diagnostic[]) => string;
```

只处理带 `fix` 字段的诊断。修复以**原子方式**应用——
如果某个 fix 中的任一 edit 与之前已接受的 edit 重叠，则**整个 fix** 被跳过
（每个 fix 要么全部应用，要么全部丢弃）。这防止复合修复将源码留在无效的中间状态。

### LintRule

```ts
interface LintRule {
    id: string;
    severity?: DiagnosticSeverity;
    check: (ctx: LintContext) => void;
}
```

| 字段         | 说明                                     |
|------------|----------------------------------------|
| `id`       | 唯一规则标识符（如 `"no-empty-tag"`）            |
| `severity` | 默认严重程度——可通过 `LintOptions.overrides` 覆盖 |
| `check`    | 规则实现——用 `ctx.report()` 发出诊断            |

### LintContext

传给每个规则 `check` 函数的上下文：

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

| 字段          | 说明                               |
|-------------|----------------------------------|
| `source`    | 原始源码文本                           |
| `tree`      | 结构树（以 `trackPositions: true` 解析） |
| `report`    | 发出诊断                             |
| `findFirst` | 深度优先搜索 — 第一个匹配                   |
| `findAll`   | 深度优先搜索 — 所有匹配                    |
| `walk`      | 深度优先遍历 — 带上下文访问每个节点              |

### LintOptions

```ts
interface LintOptions {
    rules: LintRule[];
    overrides?: Record<string, DiagnosticSeverity | "off">;
    parseOptions?: Omit<StructuralParseOptions, "trackPositions">;
    onRuleError?: (context: { ruleId: string; error: unknown }) => void;
}
```

| 字段             | 说明                                                                                               |
|----------------|--------------------------------------------------------------------------------------------------|
| `rules`        | 要运行的规则                                                                                           |
| `overrides`    | 按规则 id 覆盖严重程度——设为 `"off"` 可禁用                                                                    |
| `parseOptions` | 透传给 `parseStructural`——传入与运行时 parser 相同的 `handlers`、`allowForms`、`syntax`、`tagName`、`depthLimit` |
| `onRuleError`  | 规则抛异常时调用——错误被吞掉，其余规则继续                                                                           |

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

Fix 遵循 LSP `TextEdit` 模型——每个 edit 指定要替换的源码范围。
用空 `newText` 删除，或用 `start === end` 的范围插入。

### ReportInfo

`ctx.report()` 的参数——与 `Diagnostic` 相同，但去掉 `ruleId`（由 runner 添加），
`severity` 可选（默认使用规则的 severity）：

```ts
type ReportInfo = Omit<Diagnostic, "ruleId" | "severity"> & {
    severity?: DiagnosticSeverity;
};
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

### 性能

基于 ~200 KB 文档实测（210K 字符，2562 个 token，含 1281 个真实标签节点）。
测试环境：鲲鹏 920 aarch64 / Node v24.14.0 — 3 轮 × 每轮 5 次，取均值。

| 步骤 | 耗时 | 说明 |
|------|------|------|
| 全量 `parseRichText` | ~1382 ms | 200 KB 完整 handler 管线 |
| 全量 `parseStructural` + 追踪 | ~40.9 ms | 比 parseRichText 快 ~35 倍 |
| `nodeAtOffset` 定位 | ~0.14 ms | 遍历缓存的结构树 |
| **`parseSlice` 增量解析** | **~0.025 ms** | **只解析 36 字符的编辑节点** |
| `buildPositionTracker` 重建 | ~1.06 ms | 仅换行变动时需要 |

增量路径（定位 + 切片）≈ **0.17 ms** — 对比全量 parseRichText **快约 8000 倍**。
`parseSlice` 的耗时与切片大小成正比，与文档大小无关。

> 完整分析与代码示例：
> [源码位置追踪 — 增量解析实战](https://github.com/chiba233/yumeDSL/wiki/zh-CN-%E6%BA%90%E7%A0%81%E4%BD%8D%E7%BD%AE%E8%BF%BD%E8%B8%AA#%E5%A2%9E%E9%87%8F%E8%A7%A3%E6%9E%90%E5%AE%9E%E6%88%98parseslice-%E5%88%B0%E5%BA%95%E6%9C%89%E5%A4%9A%E5%BF%AB)

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
