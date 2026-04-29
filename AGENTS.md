# MyndBBS - 项目 AGENTS.md

全局 AGENTS.md 中的全部规则（DDD、工作单元、注释链路、测试要求等）在此项目中同样适用。
本文件仅补充项目特有信息。

## 项目概要

pnpm monorepo（pnpm 10.33.0），3 个包：

| 包 | 路径 | 技术栈 |
|---|---|---|
| backend | packages/backend | Express + Prisma (PostgreSQL) + Redis |
| frontend | packages/frontend | Next.js 16 (App Router) + Tailwind v4 |
| @myndbbs/shared | packages/shared | 共享 TS 类型/常量/校验 |

## 关键命令

```bash
pnpm install                           # 安装依赖
pnpm --filter backend dev              # 启动后端（nodemon + ts-node）
pnpm --filter frontend dev             # 启动前端（Next.js dev）
pnpm test                              # 运行全部测试
pnpm --filter backend test             # 后端测试（先 build → node --test → jest）
pnpm --filter frontend test            # 前端单元/集成测试
pnpm --filter frontend test:e2e        # Playwright E2E
pnpm --filter frontend lint            # 前端 lint
pnpm lint                              # 全部包 lint
pnpm format                            # Prettier 格式化
```

## 测试注意事项

- **后端测试分成两步**：`pnpm run build`（先编译 + 生成 Prisma client）→ `node --test tests/*.test.js` → `jest`。build 步骤不可省略。
- **前端测试**：`node --test --test-isolation=none tests/*.test.mjs`。`--test-isolation=none` 不可省略。
- **前端 E2E**：使用 `127.0.0.1:3101` 端口，通过 `playwright.config.ts` 自动启动 dev server。
- **共享包 (@myndbbs/shared)**：纯类型/常量/校验，无独立测试命令。
- 测试文件统一放在各包 `tests/` 目录内。

## 后端架构

```
src/
├── routes/        # Express 路由定义（薄层，仅路由映射）
├── controllers/   # 请求/响应处理
├── application/   # 应用服务，按限界上下文分包
├── domain/        # 领域实体/值对象/领域服务，按限界上下文分包
├── infrastructure/# 仓储实现、外部适配器
├── queries/       # 查询服务
├── middleware/    # Express 中间件
├── i18n/          # i18next 配置
├── locales/       # en/zh 错误消息
└── generated/     # Prisma 生成 client（已 gitignored）
```

**限界上下文（Bounded Context）**：`identity`、`community`、`messaging`、`notification`、`provisioning`、`system`、`shared`

**架构原则**：遵循 DDD 分层，业务规则放入 `domain/`，用例编排放入 `application/`，禁止在 controllers/routes 中写业务逻辑。涉及多个仓储时通过 Unit of Work 管理事务。

## 前端架构

```
src/
├── app/           # Next.js App Router 页面
├── components/    # React 组件
├── i18n/          # 国际化配置 + 字典文件
├── lib/           # API 客户端、hooks、工具函数
└── types/         # 前端特定 TS 类型
```

- 优先 RSC，需要浏览器 API 的组件显式声明 `'use client'`
- CSP nonce 在 `src/app/proxy.ts`（即 middleware）中动态生成
- `/api/*` 和 `/uploads/*` 通过 `next.config.ts` rewrites 代理到后端

## 代码风格约束

- TypeScript strict 模式全栈启用
- 后端额外：`exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`
- ESLint 禁止 `any`，圈复杂度 ≤ 10，函数 ≤ 50 行
- Prettier：无分号、单引号、尾逗号、100 字符宽、2 空格缩进
- 命名：PascalCase（组件/文件）、camelCase（函数/变量）、UPPER_SNAKE_CASE（全局常量）

## 环境变量

- 后端：`packages/backend/.env`（从 `.env.example` 复制）
- 前端：`packages/frontend/.env.local` 或 `.env`
- `.env` 文件禁止提交

## Git 排除清单（不可提交）

根 `.gitignore` 已覆盖：
- `node_modules/`、`.env`、`.env.*`（保留 `.env.example`）
- `.next`、`dist`、`out`、`build`、coverage 目录
- `*.db`、`*.db-journal`（SQLite 数据库）
- `packages/backend/src/generated/`（Prisma 生成代码）
- `docs/`（文档目录）
- `reports/`（测试报告 / 静态检查报告目录）
- `scripts/uploads/`、`uploads/`
- `.tsbuildinfo`、`.eslintcache`
- `package-lock.json`（pnpm 使用 `pnpm-lock.yaml`）

新增文件时注意不提交上述类型的内容。
