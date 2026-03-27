[English](./CONTRIBUTING.md) | **中文**

# 贡献指南

感谢你对 yumeDSL 的关注！本指南介绍如何搭建本地环境、运行测试和提交更改。

## 生态

| 包名                                                                | 说明                        |
|-------------------------------------------------------------------|---------------------------|
| [`yume-dsl-rich-text`](https://github.com/chiba233/yumeDSL)       | 解析器核心 — 文本到 token 树       |
| **`yume-dsl-token-walker`**                                       | 解释器核心 — token 树到输出节点（本仓库） |
| [`yume-dsl-shiki-highlight`](https://github.com/chiba233/yume-dsl-shiki-highlight) | 高亮层 — 结构树到彩色 token        |

## 环境要求

- **Node.js** >= 18
- **pnpm**（推荐）— `npm install -g pnpm`

## 开始开发

```bash
git clone https://github.com/chiba233/yume-dsl-token-walker.git
cd yumeDSL
pnpm install

# 构建
pnpm build

# 运行测试
npm test
```

## 开发流程

1. 从 `main` 创建分支：
   ```bash
   git checkout -b fix/your-description
   ```
2. 编写代码。
3. 运行测试：
   ```bash
   npm test
   ```
4. 提交代码（参见 [提交规范](#提交规范)）。
5. 发起 Pull Request。

## 提交规范

使用简短前缀说明变更类型：

| 前缀          | 用途                   |
|-------------|----------------------|
| `feat:`     | 新功能                  |
| `fix:`      | 修复 Bug               |
| `docs:`     | 仅文档变更                |
| `test:`     | 添加或更新测试              |
| `refactor:` | 既不修复 Bug 也不添加功能的代码变更 |
| `chore:`    | 构建、CI、工具链变更          |

示例：

```
fix(token-walker): 修复递归 walk 时的处理器顺序
```

## 代码规范

- **禁止 `as any`** — 应修复类型而非绕过类型检查。
- **避免 `any`** — 仅在边界处、穷尽窄类型后才可使用。
- **优先使用类型守卫和联合类型收窄**，而非类型断言。
- 保持运行时依赖最小化。本包应聚焦于 token walk / 解释逻辑，避免引入无关依赖。

## 测试

- 测试位于 `tests/` 目录。
- 修复 Bug 时，先添加能复现问题的测试用例，再编写修复代码。
- 不要在未经讨论的情况下修改现有测试 — 如果觉得测试有误，请先开 Issue。

## 报告 Bug

请使用 [Bug 报告](https://github.com/chiba233/yume-dsl-token-walker/issues/new?template=bug_report.yml) 模板，包含：

1. 受影响的包和版本
2. 最小复现代码
3. 期望行为 vs 实际行为

## 功能建议

请使用 [功能建议](https://github.com/chiba233/yume-dsl-token-walker/issues/new?template=feature_request.yml) 模板。

## 许可

提交贡献即表示你同意将代码以 [MIT 许可证](./LICENSE) 授权。
