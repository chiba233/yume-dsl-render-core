# 更新日志

### 1.0.2

- 新增异步解释 API — 同步核心的完整异步镜像
- 新增核心函数：`interpretTokensAsync`、`interpretTextAsync`
- 新增辅助函数：`fromAsyncHandlerMap`、`wrapAsyncHandlers`、`collectNodesAsync`
- 新增类型：`AsyncInterpretRuleset`、`AsyncInterpretResult`、`AsyncResolvedResult`、
  `AsyncInterpretHelpers`、`AsyncUnhandledStrategy`、`AsyncTokenHandler`、`Awaitable`
- 异步 API 全程使用 `AsyncGenerator` / `AsyncIterable`，保持惰性、流式语义
- `AsyncInterpretRuleset.createText` 刻意保持同步 (`(text: string) => TNode`)；
  只有 `interpret` 和 `onUnhandled` 策略函数接受 `Awaitable` 返回值
- 错误处理、递归检测和 `onError` 行为与同步 API 完全一致
- 对现有同步导出无破坏性变更

### 1.0.1

- 更新文档以反映当前推荐的解析器配置和示例
- `onError` 回调 context 新增 `position?: SourceSpan` — 当上游解析器启用位置追踪时（`parseRichText` 配合
  `createParser({ trackPositions: true, ... })` 或等价调用），透传触发错误的 token 的源码位置
- 无破坏性变更；`position` 为可选字段，未启用位置追踪时为 `undefined`

### 1.0.0

- 稳定版发布 — API 已定型
- 更新 `yume-dsl-rich-text` 依赖至 `^1.0.1`
- 更新 `typescript` 开发依赖从 `^5.7.0` 至 `^6.0.2`

### 0.1.3

- 新增 `interpretText(input, parser, ruleset, env)` 作为派生包推荐的便利入口
- 更新文档，在 Quick Start 和 API 文档中推荐 `interpretText`
- 明确包边界：`token-walker` 消费 `TextToken[]`，结构化解析属于 `yume-dsl-rich-text` / `yume-dsl-shiki-highlight`
- 更新 `yume-dsl-rich-text` 依赖至 `^0.1.20`

### 0.1.2

- 更新文档
- 新增生态包

### 0.1.1

- 新增辅助函数：`createRuleset`、`fromHandlerMap`、`dropToken`、`unwrapChildren`、`wrapHandlers`、`debugUnhandled`、
  `collectNodes`
- 新增 `TokenHandler` 类型 — 单个 handler 函数签名的简写
- `debugUnhandled` 返回窄类型 `{ type: "text"; text: string }` — 与任意 `TNode` 兼容，无需伪泛型
- `fromHandlerMap` handler 返回类型收窄为 `ResolvedResult` — handler 不应返回 `"unhandled"`
- 拆分源码为 `types.ts`、`interpret.ts`、`helpers.ts`（`index.ts` barrel 重导出）
- README：新增目录、导出表，按类别分组
- 更新 `yume-dsl-rich-text` 至 `0.1.14`

### 0.1.0

- 新增 `onError` 观察者 — 在抛错前以 `{ error, phase, token, env }` 调用
- 错误阶段：`"interpret"`、`"flatten"`、`"traversal"`、`"internal"`
- `onUnhandled` 策略函数的异常现在被捕获并路由到 `onError`
- 包重命名为 `yume-dsl-token-walker`
- `renderTokens` → `interpretTokens`，`TokenRenderer` → `InterpretRuleset`
- `defer` → `unhandled`，`empty` → `drop`
- `{ type: "text"; text?: string }` 拆分为 `{ type: "text"; text: string }` + `{ type: "flatten" }`
- `strict` + `fallbackRender` 替换为 `onUnhandled` 策略枚举
- 策略函数返回类型收窄为 `ResolvedResult`（不可返回 `"unhandled"`）
- 移除 `collectRendered`
