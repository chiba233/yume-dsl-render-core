[English](README.md) | **中文**

# yume-dsl-token-walker

<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

[![npm](https://img.shields.io/npm/v/yume-dsl-token-walker)](https://www.npmjs.com/package/yume-dsl-token-walker)
[![GitHub](https://img.shields.io/badge/GitHub-chiba233%2Fyume--dsl--token--walker-181717?logo=github)](https://github.com/chiba233/yume-dsl-token-walker)
[![CI](https://github.com/chiba233/yume-dsl-token-walker/actions/workflows/publish-yume-dsl-token-walker.yml/badge.svg)](https://github.com/chiba233/yume-dsl-token-walker/actions/workflows/publish-yume-dsl-token-walker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Wiki](https://img.shields.io/badge/Wiki-docs-6A57D5?logo=gitbook&logoColor=white)](https://github.com/chiba233/yume-dsl-token-walker/wiki/)
[![Contributing](https://img.shields.io/badge/Contributing-guide-blue.svg)](./CONTRIBUTING.zh-CN.md)
[![Security](https://img.shields.io/badge/Security-policy-red.svg)](./SECURITY.md)

[`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) 的零依赖操作层。
Parser 给你树——这个包负责解释、查询、lint、切片。

- **不是**渲染器——是框架无关的树机器，yield 你定义的任意输出类型
- 全程惰性 `Generator` / `AsyncGenerator`——流式处理上千 token 不需要缓冲
- 递归安全、循环引用安全——检测到自引用 token 和循环在炸栈之前就拦住
- 同步 + 异步解释语义完全一致——`interpretTokens` ↔ `interpretTokensAsync` 无缝切换，不用重写规则
- 结构查询 O(n) 单次 DFS——`findFirst` 早退出，`nodeAtOffset` / `enclosingNode` 二分收窄后再走
- Lint 框架支持原子化全量自动修复——重叠 edit 按 fix 粒度拒绝，不是按单条 edit
- `parseSlice` 局部重解析——200 KB 文档里编辑一个 36 字符的标签，只解析那 36 个字符

> **200 KB 基准 (Kunpeng 920 / Node v24.14.0):** `parseStructural` ~41 ms → `nodeAtOffset` + `parseSlice` **~0.17 ms**
> （比全文重解析**快 8000x**）。解释 10,000 个 token → HTML 字符串 **~2 ms**。50 条 lint 规则扫描 200 KB 文档 **~45 ms**。

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

| 包                                                                                  | 角色                                    |
|------------------------------------------------------------------------------------|---------------------------------------|
| [`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL)                        | 解析器——文本到 token 树                      |
| **`yume-dsl-token-walker`**                                                        | 操作层——解释、查询、lint、切片（本包）                |
| [`yume-dsl-shiki-highlight`](https://github.com/chiba233/yume-dsl-shiki-highlight) | 语法高亮——token 或 TextMate grammar        |
| [`yume-dsl-markdown-it`](https://github.com/chiba233/yume-dsl-markdown-it)         | markdown-it 插件——在 Markdown 里嵌入 DSL 标签 |

---

## 快速导航

**从这里开始：**
[安装](#安装) · [快速上手](#快速上手) · [怎么选](#怎么选)

**API：**
[解释](#解释) · [异步解释](#异步解释) · [结构查询](#结构查询) · [Lint](#lint) · [结构切片](#结构切片)

**参考：**
[错误处理与安全性](#错误处理与安全性) · [导出一览](#导出一览) · [更新日志](#更新日志)

**实战教程** —— [Wiki](https://github.com/chiba233/yume-dsl-token-walker/wiki/) 上的逐步讲解：

- [从零实现博客渲染器](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Tutorial-Blog-Renderer) —— 从零到可用的
  DSL → HTML 管线
- [游戏对话引擎](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Tutorial-Game-Dialogue) —— 为视觉小说打字机构建
  shake / color / wait 指令
- [编辑器 Lint + 自动修复](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Tutorial-Editor-Lint) —— 自定义
  lint 规则、诊断、原子化自动修复

---

## 安装

```bash
npm install yume-dsl-token-walker
pnpm add yume-dsl-token-walker
```

`yume-dsl-rich-text` 是依赖，会自动安装。

---

## 快速上手

```ts
import {createParser, createSimpleInlineHandlers} from "yume-dsl-rich-text";
import {interpretText, collectNodes} from "yume-dsl-token-walker";

const parser = createParser({
    handlers: createSimpleInlineHandlers(["bold", "italic"]),
});

const html = collectNodes(
    interpretText("Hello $$bold($$italic(world)$$)$$!", parser, {
        createText: (text) => text,
        interpret: (token, helpers) => {
            if (token.type === "bold")
                return {type: "nodes", nodes: ["<b>", ...helpers.interpretChildren(token.value), "</b>"]};
            if (token.type === "italic")
                return {type: "nodes", nodes: ["<em>", ...helpers.interpretChildren(token.value), "</em>"]};
            return {type: "unhandled"};
        },
    }, undefined),
).join("");

// → "Hello <b><em>world</em></b>!"
```

已有 `TextToken[]` 的话，直接用 `interpretTokens(...)`。

### 推荐阅读顺序

1. **快速上手**（你在这里）
2. [解释](#解释) —— 核心 API、类型、辅助函数
3. [结构查询](#结构查询) —— 搜索树
4. [Lint](#lint) —— 校验 + 自动修复
5. [结构切片](#结构切片) —— 增量解析

---

## 怎么选

| 你想……                                  | 看这里                       |
|---------------------------------------|---------------------------|
| 把 `TextToken[]` 变成 HTML / VNode / 字符串 | [解释](#解释) 或 [异步解释](#异步解释) |
| 在 `StructuralNode[]` 树里搜索/定位节点        | [结构查询](#结构查询)             |
| 用自定义规则校验 DSL 源码 + 自动修复                | [Lint](#lint)             |
| 只重解析大文档的一个区域                          | [结构切片](#结构切片)             |

---

## 解释

遍历 `TextToken[]` 树，yield 任意输出节点。

### 核心 API

```ts
function* interpretText<TNode, TEnv>(
    input: string, parser: ParserLike,
    ruleset: InterpretRuleset<TNode, TEnv>, env: TEnv,
): Generator<TNode>;

function* interpretTokens<TNode, TEnv>(
    tokens: TextToken[], ruleset: InterpretRuleset<TNode, TEnv>, env: TEnv,
): Generator<TNode>;
```

`interpretText` 是 `parser.parse(input)` + `interpretTokens(...)` 的语法糖。

### InterpretResult —— 你的 handler 返回什么

| 返回值                               | 意思                | 什么时候用              |
|-----------------------------------|-------------------|--------------------|
| `{ type: "nodes", nodes: [...] }` | yield 这些节点        | 大多数情况——包裹子节点、加标签   |
| `{ type: "text", text: "..." }`   | yield 一个文本节点      | 输出一段特定文本，不递归子节点    |
| `{ type: "flatten" }`             | 展平成纯文本后 yield     | 搜索索引、aria label、预览 |
| `{ type: "drop" }`                | 什么都不 yield        | 注释、元数据             |
| `{ type: "unhandled" }`           | 交给 onUnhandled 策略 | 你不认识这个标签           |

### InterpretRuleset

```ts
interface InterpretRuleset<TNode, TEnv = unknown> {
    createText: (text: string) => TNode;
    interpret: (token: TextToken, helpers: InterpretHelpers<TNode, TEnv>) => InterpretResult<TNode>;
    onUnhandled?: UnhandledStrategy<TNode, TEnv>;
    onError?: (context: { error: Error; phase: "interpret" | "flatten" | "traversal" | "internal"; token?: TextToken; position?: SourceSpan; env: TEnv }) => void;
}
```

| 字段            | 说明                                            |
|---------------|-----------------------------------------------|
| `createText`  | 把纯字符串包装成你的节点类型                                |
| `interpret`   | 把 DSL token 映射为解释结果                           |
| `onUnhandled` | `"throw"` / `"flatten"`（默认）/ `"drop"` / 自定义函数 |
| `onError`     | 可选观察者，在错误抛出前调用                                |

### InterpretHelpers

```ts
interface InterpretHelpers<TNode, TEnv = unknown> {
    interpretChildren: (value: string | TextToken[]) => Iterable<TNode>;
    flattenText: (value: string | TextToken[]) => string;
    env: TEnv;
}
```

| 字段                  | 说明                                  |
|---------------------|-------------------------------------|
| `interpretChildren` | 递归解释子 token——返回惰性 `Iterable<TNode>` |
| `flattenText`       | 从 token value 提取纯文本                 |
| `env`               | 用户提供的环境对象，从 `interpretTokens` 透传    |

### 示例：`fromHandlerMap` + `env`

```ts
import {createRuleset, fromHandlerMap, interpretTokens, collectNodes} from "yume-dsl-token-walker";

interface Env {
    theme: "light" | "dark"
}

const ruleset = createRuleset<string, Env>({
    createText: (text) => text,
    interpret: fromHandlerMap({
        bold: (token, h) => {
            const color = h.env.theme === "dark" ? "#fff" : "#000";
            return {type: "nodes", nodes: [`<b style="color:${color}">`, ...h.interpretChildren(token.value), "</b>"]};
        },
        italic: (token, h) => ({type: "nodes", nodes: ["<em>", ...h.interpretChildren(token.value), "</em>"]}),
    }),
    onUnhandled: "flatten",
});

const html = collectNodes(interpretTokens(tokens, ruleset, {theme: "dark"})).join("");
```

### 示例：纯文本提取

```ts
import {flattenText} from "yume-dsl-token-walker";

const plain = flattenText(tokens);
// "Hello world" —— 不需要 ruleset，独立工具函数
```

用于搜索索引、aria label、RSS feed、通知预览。

### 辅助函数

| 函数                             | 说明                                          |
|--------------------------------|---------------------------------------------|
| `createRuleset(ruleset)`       | 恒等函数，提供类型推断                                 |
| `fromHandlerMap(handlers)`     | 把 `Record<type, handler>` 变成 `interpret` 函数 |
| `dropToken`                    | 现成的 handler：不产生输出                           |
| `unwrapChildren`               | 现成的 handler：直接透传子节点                         |
| `wrapHandlers(handlers, wrap)` | 给每个 handler 套统一包装                           |
| `debugUnhandled(format?)`      | `onUnhandled` 函数，输出可见占位符                    |
| `collectNodes(iterable)`       | `Array.from` 语法糖                            |

详见 [解释 API wiki](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Interpret)：三个完整 demo（HTML / 自定义
AST / 纯文本）、onUnhandled 策略、推荐项目结构，
以及[博客渲染器教程](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Tutorial-Blog-Renderer)的逐步讲解。

---

## 异步解释

和同步版语义相同——`interpret` 可以 `await`，`interpretChildren` 返回 `AsyncIterable`。

```ts
import {interpretTextAsync, collectNodesAsync} from "yume-dsl-token-walker";

const html = (
    await collectNodesAsync(
        interpretTextAsync("Hello $$bold(world)$$", parser, {
            createText: (text) => text,
            interpret: async (token, helpers) => {
                if (token.type === "bold") {
                    return {
                        type: "nodes",
                        nodes: (async function* () {
                            yield "<b>";
                            yield* helpers.interpretChildren(token.value);
                            yield "</b>";
                        })(),
                    };
                }
                return {type: "unhandled"};
            },
        }, undefined),
    )
).join("");
```

**设计要点：**

- `createText` 始终同步——文本包装是纯操作
- `interpret` 和 `onUnhandled` 策略函数可以返回 `Promise`
- `nodes` 可以是 `Iterable` 或 `AsyncIterable`

异步辅助函数：`fromAsyncHandlerMap`、`wrapAsyncHandlers`、`collectNodesAsync`。

详见 [异步解释 API wiki](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Async-Interpret) 和
[游戏对话教程](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Tutorial-Game-Dialogue)（异步获取角色立绘）。

---

## 结构查询

在 `parseStructural` 生成的 `StructuralNode[]` 树里搜索和定位节点。

### 函数

| 函数               | 签名                                                  | 说明                         |
|------------------|-----------------------------------------------------|----------------------------|
| `findFirst`      | `(nodes, predicate) => StructuralNode \| undefined` | DFS——第一个匹配，早退出             |
| `findAll`        | `(nodes, predicate) => StructuralNode[]`            | DFS——所有匹配                  |
| `walkStructural` | `(nodes, visitor) => void`                          | DFS——带上下文访问每个节点            |
| `nodeAtOffset`   | `(nodes, offset) => StructuralNode \| undefined`    | 最深节点定位                     |
| `enclosingNode`  | `(nodes, offset) => StructuralTagNode \| undefined` | 最深**标签**节点（跳过 text/escape） |

### 示例：编辑器光标定位

```ts
import {parseStructural} from "yume-dsl-rich-text";
import {enclosingNode} from "yume-dsl-token-walker";

const source = "Hello $$bold($$italic(world)$$)$$!";
const tree = parseStructural(source, {trackPositions: true});

const tag = enclosingNode(tree, 22);
// tag.tag === "italic" —— 最深的包围标签
```

### 示例：找所有 bold 标签

```ts
import {findAll} from "yume-dsl-token-walker";

const bolds = findAll(tree, (node) => node.type === "inline" && node.tag === "bold");
```

### StructuralVisitContext

```ts
interface StructuralVisitContext {
    parent: StructuralNode | null;
    depth: number;
    index: number;
}
```

详见[结构查询 wiki](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Structural-Query)：子节点遍历规则、
`nodeAtOffset` vs `enclosingNode` 对比、`walkStructural` 示例。

---

## Lint

对 DSL 源码运行自定义规则，上报诊断，原子化应用自动修复。

### 快速上手

```ts
import {lintStructural, applyLintFixes, type LintRule} from "yume-dsl-token-walker";

const noEmptyTag: LintRule = {
    id: "no-empty-tag",
    severity: "warning",
    check: (ctx) => {
        ctx.walk(ctx.tree, (node) => {
            if (node.type === "inline" && node.children.length === 0 && node.position) {
                ctx.report({
                    message: `空的 inline 标签: ${node.tag}`,
                    span: node.position,
                    node,
                    fix: {description: "删除空标签", edits: [{span: node.position, newText: ""}]},
                });
            }
        });
    },
};

const diagnostics = lintStructural("Hello $$bold()$$ world", {rules: [noEmptyTag]});
const fixed = applyLintFixes("Hello $$bold()$$ world", diagnostics);
// fixed === "Hello  world"
```

### LintOptions

```ts
interface LintOptions {
    rules: LintRule[];
    overrides?: Record<string, DiagnosticSeverity | "off">;
    parseOptions?: Omit<StructuralParseOptions, "trackPositions">;
    onRuleError?: (context: { ruleId: string; error: unknown }) => void;
    failFast?: boolean;
}
```

| 字段             | 说明                                         |
|----------------|--------------------------------------------|
| `rules`        | 要运行的规则                                     |
| `overrides`    | 按 rule id 覆盖 severity——`"off"` 禁用          |
| `parseOptions` | 透传给 `parseStructural`——传入和运行时 parser 相同的配置 |
| `onRuleError`  | 规则抛异常时调用；错误吞掉，其他规则继续                       |
| `failFast`     | `true` → 规则出错立即中止。优先级高于 `onRuleError`      |

**错误行为一览：**
- **默认：** 规则抛异常 → 吞掉，其他规则继续
- **`onRuleError`：** 规则抛异常 → 调你的回调，其他规则继续
- **`failFast: true`：** 规则抛异常 → `lintStructural` 立即重新抛出

### 关键类型

```ts
interface LintRule {
    id: string;
    severity?: DiagnosticSeverity;
    check: (ctx: LintContext) => void;
}

interface LintContext {
    source: string;
    tree: StructuralNode[];
    report: (info: ReportInfo) => void;
    findFirst;
    findAll;
    walk;
}

interface Diagnostic {
    ruleId: string;
    severity: DiagnosticSeverity;
    message: string;
    span: SourceSpan;
    node?: StructuralNode;
    fix?: Fix;
}

interface Fix {
    description: string;
    edits: TextEdit[];
}

interface TextEdit {
    span: SourceSpan;
    newText: string;
}

type DiagnosticSeverity = "error" | "warning" | "info" | "hint";
```

详见 [Lint wiki](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Lint)：多规则 lint、severity
覆盖、applyLintFixes 冲突策略，
以及[编辑器 Lint 教程](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Tutorial-Editor-Lint)的 CI 就绪管线。

---

## 结构切片

只重解析大文档的一个区域。`parseStructural` 给你地图；`parseSlice` 跳到任意一点。

```ts
import {createParser, createSimpleInlineHandlers, buildPositionTracker} from "yume-dsl-rich-text";
import {parseSlice} from "yume-dsl-token-walker";

const parser = createParser({handlers: createSimpleInlineHandlers(["bold"])});
const fullText = "intro\n$$bold(hello world)$$\noutro";

const structural = parser.structural(fullText, {trackPositions: true});
const tracker = buildPositionTracker(fullText);

const boldNode = structural.find((n) => n.type === "inline" && n.tag === "bold");
if (boldNode?.position) {
    const tokens = parseSlice(fullText, boldNode.position, parser, tracker);
    // tokens 的 offset/line/column 指向 fullText
}
```

### API

```ts
function parseSlice(fullText: string, span: SourceSpan, parser: ParserLike, tracker?: PositionTracker): TextToken[];
```

没 `tracker`：offset 正确，line/column 局部。有 `tracker`：三者都正确。
用 `buildPositionTracker(fullText)` **构建一次**——只在换行变化时重建。

### 性能（200 KB 文档）

| 步骤                            | 耗时                    |
|-------------------------------|-----------------------|
| 全量 `parseRichText`            | ~1382 ms              |
| `parseStructural` + 位置追踪      | ~41 ms（快 35x）         |
| `nodeAtOffset` + `parseSlice` | **~0.17 ms**（快 8000x） |
| `buildPositionTracker`（重建）    | ~1.06 ms（只在换行变化时）     |

详见[结构切片 wiki](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Structural-Slice)：完整增量管线 demo +
interpret 集成。

---

## 错误处理与安全性

`onError` 在错误抛出**之前**调用——观察但不吞掉：

```ts
const ruleset = {
    createText: (text: string) => text,
    interpret: () => ({type: "unhandled" as const}),
    onUnhandled: "throw" as const,
    onError: ({error, phase, position}) => {
        console.error(`[${phase}] ${error.message}`, position?.start);
    },
};
```

**错误阶段：** `"interpret"` · `"flatten"` · `"traversal"` · `"internal"`

**安全保证：**

- **自引用检测** —— token 被喂回 `interpretChildren` → 炸栈前抛出
- **循环引用检测** —— `flattenText` 按路径追踪；共享引用安全，真循环抛出
- **文本 token 校验** —— text token 的 `value` 不是字符串 → 抛出而非产出垃圾

> `flattenText()` 是独立工具，**不**经过 `onError`。

详见[错误处理 wiki](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Error-Handling)：日志 demo、错误阶段表、安全实现细节。

---

## 导出一览

| 类别       | 导出                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **同步**   | `interpretText`, `interpretTokens`, `flattenText`, `createRuleset`, `fromHandlerMap`, `dropToken`, `unwrapChildren`, `wrapHandlers`, `debugUnhandled`, `collectNodes`                                                                                                                                                                                                                                                                                                                                                                 |
| **结构查询** | `findFirst`, `findAll`, `walkStructural`, `nodeAtOffset`, `enclosingNode`                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Lint** | `lintStructural`, `applyLintFixes`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **结构切片** | `parseSlice`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **异步**   | `interpretTextAsync`, `interpretTokensAsync`, `fromAsyncHandlerMap`, `wrapAsyncHandlers`, `collectNodesAsync`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **类型**   | `InterpretRuleset`, `InterpretResult`, `ResolvedResult`, `InterpretHelpers`, `UnhandledStrategy`, `TokenHandler`, `TextResult`, `ParserLike`, `ParseOverrides`, `StructuralTagNode`, `StructuralVisitContext`, `StructuralPredicate`, `StructuralVisitor`, `LintRule`, `LintContext`, `LintOptions`, `Diagnostic`, `DiagnosticSeverity`, `Fix`, `TextEdit`, `ReportInfo`, `AsyncInterpretRuleset`, `AsyncInterpretResult`, `AsyncResolvedResult`, `AsyncInterpretHelpers`, `AsyncUnhandledStrategy`, `AsyncTokenHandler`, `Awaitable` |

详见[导出一览 wiki](https://github.com/chiba233/yume-dsl-token-walker/wiki/zh-CN-Exports)：完整签名、说明、wiki 内链。

---

## 更新日志

详见 [CHANGELOG](./CHANGELOG.zh-CN.md)。

---

## 许可证

MIT
