[English](./README.md) | **中文**

# @yume-dsl/render-core

<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

[![npm](https://img.shields.io/npm/v/@yume-dsl/render-core)](https://www.npmjs.com/package/@yume-dsl/render-core)
[![GitHub](https://img.shields.io/badge/GitHub-chiba233%2Fyume--dsl--render--core-181717?logo=github)](https://github.com/chiba233/yume-dsl-render-core)

通用的、惰性的、基于 generator 的
[`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) token 树渲染器。

**仅包含渲染核心。**
本包提供遍历契约和安全保障。
具体输出（HTML、Vue、React 等）由你的 `TokenRenderer` 定义。

---

## 生态

| 包 | 角色 |
|---|------|
| [`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) | 解析器核心 — 文本到 token 树 |
| **`@yume-dsl/render-core`** | 渲染核心 — token 树到输出节点（本包） |

---

## 安装

```bash
npm install @yume-dsl/render-core
# 或
pnpm add @yume-dsl/render-core
```

`yume-dsl-rich-text` 是依赖项，会自动安装。

---

## 快速上手

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

惰性遍历 `TextToken[]` 树，通过 generator 逐个 yield `TNode`。

```ts
function* renderTokens<TNode, TEnv>(
  tokens: TextToken[],
  renderer: TokenRenderer<TNode, TEnv>,
  env: TEnv,
): Generator<TNode>;
```

- 流式输出 — 节点逐个 yield，内部不会缓冲为数组
- 自引用安全 — 检测到 token 自引用时立即抛出
- 循环安全 — `flattenText` 按递归路径（而非全局）追踪已访问 token，共享引用安全，真正的循环会抛出

### `collectRendered(iterable)`

便利函数，将 `Iterable<TNode>` 收集为 `TNode[]`。

```ts
const collectRendered: <TNode>(iterable: Iterable<TNode>) => TNode[];
```

### `flattenText(value)`

递归提取 `string | TextToken[]` 中的纯文本。

```ts
const flattenText: (value: string | TextToken[]) => string;
```

---

## TokenRenderer

传给 `renderTokens` 的渲染器：

```ts
interface TokenRenderer<TNode, TEnv = unknown> {
  createText: (text: string) => TNode;
  render: (token: TextToken, helpers: RenderHelpers<TNode, TEnv>) => RenderResult<TNode>;
  fallbackRender?: (token: TextToken, helpers: RenderHelpers<TNode, TEnv>) => RenderResult<TNode>;
  strict?: boolean;
}
```

| 字段 | 说明 |
|------|------|
| `createText` | 将纯字符串包装为你的节点类型 |
| `render` | 将 DSL token 映射为渲染结果 |
| `fallbackRender` | 当 `render` 返回 `"defer"` 时调用 |
| `strict` | 为 `true` 时，没有 renderer 处理的 token 会抛出错误（默认：`false`） |

---

## RenderResult

`render` 和 `fallbackRender` 的返回类型：

```ts
type RenderResult<TNode> =
  | { type: "tokens"; tokens: Iterable<TNode> }
  | { type: "text"; text?: string }
  | { type: "defer" }
  | { type: "empty" };
```

| 结果 | 含义 |
|------|------|
| `"tokens"` | 显式渲染 — yield 提供的节点 |
| `"text"` | 输出文本 — 有 `text` 字段时使用该值，否则 `flattenText(token.value)` |
| `"defer"` | 传递给 `fallbackRender`；若无 fallback，strict 模式抛出，否则默认为 `"text"` |
| `"empty"` | 不输出任何内容 |

---

## RenderHelpers

传给 `render` 和 `fallbackRender` 的辅助对象：

```ts
interface RenderHelpers<TNode, TEnv = unknown> {
  renderChildren: (value: string | TextToken[]) => Iterable<TNode>;
  flattenText: (value: string | TextToken[]) => string;
  env: TEnv;
}
```

| 字段 | 说明 |
|------|------|
| `renderChildren` | 递归渲染子 token — 返回惰性 `Iterable<TNode>` |
| `flattenText` | 从 token value 中提取纯文本 |
| `env` | 用户提供的环境对象，从 `renderTokens` 透传 |

---

## 安全性

- **自引用检测**：如果 renderer 将 token 自身回传给 `renderChildren`，立即抛出错误
- **循环引用检测**：`flattenText` 按递归路径追踪已访问 token（非全局），共享引用安全，真正的循环会抛出

---

## 更新日志

### 0.1.0

- 首次发布
- 基于 generator 的惰性 `renderTokens` 遍历
- `RenderResult` 支持 `"tokens"`、`"text"`、`"defer"`、`"empty"` 语义
- `flattenText` 按路径检测循环引用
- `collectRendered` 便利函数

---

## 许可证

MIT
