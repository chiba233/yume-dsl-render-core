[English](./README.md) | **中文**

# yume-dsl-token-walker

<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />

[![npm](https://img.shields.io/npm/v/yume-dsl-token-walker)](https://www.npmjs.com/package/yume-dsl-token-walker)
[![GitHub](https://img.shields.io/badge/GitHub-chiba233%2Fyume--dsl--token--walker-181717?logo=github)](https://github.com/chiba233/yume-dsl-token-walker)

通用的、惰性的、基于 generator 的
[`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) token 树解释器。

你提供规则，它遍历树、yield 输出节点，然后闪开。

---

## 生态

| 包                                                           | 角色                     |
|-------------------------------------------------------------|------------------------|
| [`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL) | 解析器 — 文本到 token 树      |
| **`yume-dsl-token-walker`**                                 | 解释器 — token 树到输出节点（本包） |

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

## 更多示例

### 用 `env` 注入运行时上下文

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

适合把主题、语言、权限、功能开关或渲染配置透传给解释器。

### 自定义 `onUnhandled`

默认情况下，未处理 token 会走 `"flatten"`：

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

如果你想要严格模式：

```ts
const strictRuleset = {
  createText: (text: string) => text,
  interpret: () => ({ type: "unhandled" as const }),
  onUnhandled: "throw" as const,
};
```

如果你想输出调试占位：

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

常见用途：

- 线上环境平滑降级
- 测试环境对漏写 handler 直接报错
- 调试环境把未处理 token 类型直接暴露出来

### 在 handler 内使用 `flattenText`

有些时候你不想递归解释整个子树，而是只想拿到它的可读文本。

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

`"drop"` 适合只承载元信息、不应该产生可见输出的 token。

---

## API

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

---

## InterpretRuleset

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

---

## InterpretResult

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

---

## UnhandledStrategy

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

`ResolvedResult<TNode>` = `InterpretResult<TNode>` 去掉 `{ type: "unhandled" }`。

---

## onError

可选的错误观察回调。在错误抛出前调用，携带上下文信息。它**不会**吞掉错误 — `onError` 返回后错误仍会被重新抛出。

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
    return { type: "unhandled" as const };
  },
  onError: ({ error }) => {
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

## InterpretHelpers

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

## 安全性

- **自引用检测**：如果处理器将 token 自身回传给 `interpretChildren`，立即抛出错误
- **循环引用检测**：`flattenText` 按递归路径追踪已访问 token（非全局），共享引用安全，真正的循环会抛出
- **错误观察**：所有错误（来自 `interpret`、`onUnhandled` 策略函数、`flattenText` 和遍历检查）均会在抛出前经过 `onError` 回调

---

## 更新日志

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
