# 更新日志

### 1.0.7

- 修复：消除深层嵌套 token 树上的栈溢出——`flattenText`、`dfs`
  （`findFirst` / `findAll` / `walkStructural` 的底层）、`nodeAtOffset`、`nodePathAtOffset`、
  `enclosingNode` 从递归改为显式栈迭代。嵌套深度仅受堆内存限制，
  与 `yume-dsl-rich-text` 1.1.2 的深嵌套能力对齐
- 文档：性能数据同步 `yume-dsl-rich-text` 1.1.2
  （`parseRichText` ~24 ms，`parseStructural` ~21 ms，200 KB）

### 1.0.6

- 新增：`nodePathAtOffset(nodes, offset)` —— 返回从根到最深命中节点的完整路径
  （`StructuralNode[]`）。第一个元素是最外层匹配，最后一个是最深层（与 `nodeAtOffset` 相同）。
  适用于编辑器面包屑、上下文补全、嵌套层级显示
- 文档：性能数据同步 `yume-dsl-rich-text` 1.1.1（`parseRichText` 200 KB ~33 ms）；
  `parseSlice` 叙事从"拯救慢全量解析"调整为"光标局部增量重解析"

### 1.0.5

- 新增：`LintOptions.failFast` —— 为 `true` 时，规则抛异常立即中止 `lintStructural`，
  抛出包装后的错误（包含 rule id 和原始 `.cause`）。优先级高于 `onRuleError`。默认 `false`
- 新增：内部 `wrapRuleError` 辅助函数，为 `failFast` 抛出的错误保留 cause 链
- 修复：`applyLintFixes` 排序策略 —— 两个 fix 起点相同时，范围更宽的 edit（end offset 更大）
  现在优先，而非任意排序

### 1.0.4

- 新增 `StructuralNode[]` 树的结构查询工具：
  - `findFirst(nodes, predicate)` — 深度优先先序搜索，返回第一个匹配
  - `findAll(nodes, predicate)` — 深度优先先序搜索，返回所有匹配
  - `walkStructural(nodes, visitor)` — 深度优先先序遍历，带上下文访问每个节点
  - `nodeAtOffset(nodes, offset)` — 按源码偏移查找最深节点（需 `trackPositions`）
  - `enclosingNode(nodes, offset)` — 按源码偏移查找最深的包围 tag 节点（需 `trackPositions`）
  - `StructuralTagNode` 类型 — inline / raw / block 节点的收窄联合；
    `enclosingNode` 返回 `StructuralTagNode | undefined`，调用者可直接访问 `.tag` 无需额外类型守卫
  - `StructuralVisitContext` / `StructuralPredicate` / `StructuralVisitor` 类型
  - 内部重构：`findFirst`、`findAll`、`walkStructural` 共享同一个支持 early-exit 的 DFS 引擎
- 新增 lint 框架：
  - `lintStructural(source, options)` — 对结构解析树运行规则，返回按偏移排序的 `Diagnostic[]`
  - `applyLintFixes(source, diagnostics)` — 将可修复的诊断应用到源码，以原子方式按 fix 粒度
    处理（先来先赢冲突策略；内部 edit 自重叠的异常 fix 被整体拒绝）
  - `LintRule` 接口：`id`、`severity?`、`check(ctx)`
  - `LintContext` 提供 `source`、`tree`、`report()`、`findFirst`、`findAll`、`walk`
  - `LintOptions` 接受 `parseOptions`（透传给 `parseStructural`——传入与运行时 parser 相同的
    `handlers`、`allowForms`、`syntax`、`tagName`、`depthLimit`）、`overrides`、`onRuleError`
  - 规则错误隔离——抛异常的规则被 catch，通过 `onRuleError` 上报，其余规则继续
  - 类型：`Diagnostic`、`DiagnosticSeverity`、`Fix`、`TextEdit`、`ReportInfo`

### 1.0.3

- 更新文档

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
- 新增辅助函数：`parseSlice(fullText, span, parser, tracker?)` — 按 `SourceSpan`（例如来自
  `parseStructural`）从完整文本中切片解析，自动设置 `baseOffset`，可选传入 `tracker` 实现
  完整的位置映射回原始文档
- 新增类型：`ParseOverrides` — `ParserLike.parse` 第二参数接受的选项
  （`trackPositions`、`baseOffset`、`tracker`）
- `ParserLike.parse` 现在接受可选的第二参数 `overrides?: ParseOverrides`
  （向后兼容——不传 overrides 的现有代码不受影响）
- 更新 `yume-dsl-rich-text` 依赖至 `^1.0.7`（需要 `>=1.0.6` 才能使用 `baseOffset`/`tracker` 支持）
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
