# MyndBBS 项目规范与架构设计 (v1.1)

## 1. 概览与设计哲学
MyndBBS 是一个现代化、企业级的开源论坛后端及前端解决方案。本项目追求 **“优雅、稳健、可维护”** 的代码美学，坚持以下设计哲学：
- **强类型驱动**：利用 TypeScript 提供贯穿前后的 100% 类型安全。
- **关注点分离 (SoC)**：前端视图与状态分离，后端控制层与业务逻辑层分离。
- **高内聚低耦合**：模块化设计，接口契约先行。
- **防御性编程**：完善的错误边界与异常处理。

## 2. 核心技术栈架构
- **前端 (Frontend)**: Next.js (React), TypeScript, Tailwind CSS, shadcn/ui
  - 状态管理：Zustand (客户端状态) + TanStack Query (服务端状态缓存)
- **后端 (Backend)**: Node.js, Express/Koa (建议使用轻量化加 TypeScript 装饰器或中间件封装)
- **数据库与 ORM**: MySQL 8.0+, Prisma (Schema First)
- **工程化工具**: pnpm, ESLint, Prettier, Husky, lint-staged, Commitlint

## 3. 详细目录结构规范 (Monorepo)
采用 `pnpm workspace` 构建前后端共享的工作区，以确保类型和常量的唯一事实来源 (Single Source of Truth)。

```text
MyndBBS/
├── packages/
│   ├── frontend/               # Next.js 前端应用
│   │   ├── src/
│   │   │   ├── app/            # App Router 页面级路由
│   │   │   ├── components/     # UI 视图组件
│   │   │   │   ├── ui/         # 基础/通用组件 (shadcn)
│   │   │   │   └── business/   # 业务/复合组件
│   │   │   ├── hooks/          # 自定义 React Hooks
│   │   │   ├── store/          # Zustand 客户端状态
│   │   │   ├── lib/            # 工具函数与外部库封装
│   │   │   └── types/          # 前端专属类型定义
│   ├── backend/                # Node.js 后端应用
│   │   ├── src/
│   │   │   ├── routes/         # 路由定义
│   │   │   ├── controllers/    # 控制器 (处理 HTTP 请求/响应)
│   │   │   ├── services/       # 业务逻辑层 (纯粹的业务代码)
│   │   │   ├── middlewares/    # 全局/局部中间件 (鉴权、日志、错误处理)
│   │   │   ├── utils/          # 纯函数工具类
│   │   │   └── prisma/         # 数据库 Schema 与迁移
│   └── shared/                 # 前后端共享库
│       ├── types/              # 共享的 API 接口契约 (如 DTO, Entity)
│       ├── constants/          # 共享枚举与魔法字符串 (如错误码、状态枚举)
│       └── utils/              # 共享的通用验证函数
```

## 4. 命名规范 (Naming Conventions)
优雅的代码从一致的命名开始：
- **文件与目录**: 
  - 前端组件文件：`PascalCase.tsx` (如 `UserProfile.tsx`)
  - 后端与其他普通文件：`kebab-case.ts` (如 `user-service.ts`)
- **变量与函数**: `camelCase` (如 `getUserInfo`)
- **常量**: 全大写下划线 `UPPER_SNAKE_CASE` (如 `MAX_UPLOAD_SIZE`)
- **类与 TypeScript 类型 (Interface/Type/Enum)**: `PascalCase` (如 `UserDTO`)
- **布尔值变量**: 必须带有前缀 `is`, `has`, `should`, `can` (如 `isLoggedIn`)

## 5. 代码美学与严格质量规范
为保证代码的可读性和优美度，必须遵守以下严格原则（将通过 ESLint 强行约束）：
1. **消除嵌套 (Early Return)**: 
   尽量在函数开头处理错误和边界情况，避免深层的 `if-else` 嵌套。圈复杂度 (Cyclomatic Complexity) 不得超过 10。
2. **拒绝魔法数字/字符串**: 
   所有具有业务含义的数字或字符串必须提取到 `shared/constants` 中。
3. **职责单一原则 (SRP)**:
   一个函数/组件只做一件事。文件行数超过 300 行时必须进行拆分，函数行数尽量控制在 50 行以内。
4. **可选链与空值合并**:
   充分利用 TypeScript 的 `?.` 和 `??` 减少冗长的空值判断。
5. **零 `any` 容忍**:
   项目中严禁使用 `any` 类型，确实无法推断的类型应使用 `unknown` 并配合类型保护 (Type Guards)。

## 6. 前后端架构深度规范

### 6.1 前端架构
- **组件分层**: 
  将组件分为“木偶组件 (Dumb Components, 纯 UI)”和“智能组件 (Smart Components, 包含数据获取与状态)”。
- **数据获取**: 
  使用 React Server Components (RSC) 进行初始数据抓取（有利于 SEO）；交互型数据使用 TanStack Query 处理加载、缓存和轮询。

### 6.2 后端架构与 API 规范
- **三层架构**: `Route` (路由) -> `Controller` (参数校验与组装) -> `Service` (核心业务逻辑)。Service 层不能包含任何与 HTTP (req, res) 相关的对象，保证其可测试性。
- **RESTful API 设计**:
  - 资源路径使用名词复数，如 `GET /api/v1/users`
  - 使用标准的 HTTP 状态码表示结果性质（200, 201, 400, 401, 403, 404, 500）
- **统一异常处理**:
  所有错误必须抛出自定义的 `AppError`（包含业务错误码和信息），由全局错误处理中间件统一拦截并格式化为标准 JSON 响应。

### 6.3 安全与权限隔离规范
安全和权限是企业级应用的核心底线，以下规范必须严格遵守：
- **认证与鉴权 (Authentication & Authorization)**:
  - 采用 **JWT** 或 **Secure HttpOnly Cookies** 进行会话管理。
  - 采用 **基于角色的访问控制 (RBAC)**，并结合细粒度的 **属性访问控制 (ABAC)** (例如：普通用户只能编辑自己的帖子，版主可以编辑版块内的帖子)。
- **API 安全隔离**:
  - **CORS 与 CSRF**: 严格配置 CORS 白名单，所有涉及状态修改的 API 必须防范 CSRF 攻击。
  - **Rate Limiting (限流)**: 对所有公共 API（如登录、发帖）进行 IP 限流，防止暴力破解和 CC 攻击。
  - **XSS 防护**: 所有的富文本输入必须在服务端和前端进行严格的 Sanitization (如使用 `DOMPurify`)，禁止原生 `v-html` 或 `dangerouslySetInnerHTML` 的滥用。
  - **参数校验边界**: 控制层入口 (Controller) 必须使用如 `Zod` 或 `Joi` 的校验库对 Request Body / Query 进行严格白名单过滤。

## 7. Git 工作流与 CI/CD 规范
- **Commit 规范**: 严格执行 Angular 规范 (`feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `test:`, `chore:`)。
- **PR 审查 (Pull Request)**:
  - 代码必须通过 CI Pipeline（Lint, Type Check, Tests）。
  - PR 描述必须清晰说明“解决了什么问题”和“测试了哪些场景”。

## 8. 测试规范
- **单元测试**: 复杂的 Service 业务逻辑与共享的 Utils 必须达到 80% 以上的代码覆盖率 (推荐 Vitest)。
- **端到端测试 (E2E)**: 核心链路（如登录、发帖）使用 Playwright 或 Cypress 编写冒烟测试。