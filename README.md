# MyndBBS

**MyndBBS** 是一个现代化、企业级取向的开源论坛（BBS）项目，采用 TypeScript 全栈开发，包含前端应用、后端 API 与共享类型库。

- 中文 / English: [中文](#中文) | [English](#english)

---

# 中文

## 项目介绍

MyndBBS 目标是提供一个稳定、高性能、易扩展的论坛系统基础设施：

- 前端：Next.js 16（App Router）+ React 19 + TypeScript + i18n
- 后端：Node.js + Express + TypeScript + Redis
- 数据访问：Prisma（PostgreSQL）
- 权限控制：CASL（基于属性的访问控制 ABAC）
- 共享层：前后端共享类型、常量、校验工具（`@myndbbs/shared`）

## 技术栈

- Node.js + TypeScript
- Monorepo：pnpm workspace
- Frontend：Next.js 16 + Tailwind CSS v4 + next-themes + lucide-react
- Backend：Express（CORS/Helmet/Cookie Parser/Rate Limit）+ ioredis
- ORM：Prisma + @casl/prisma
- 密码学：Argon2 + @simplewebauthn + otplib
- 工程化：ESLint（Flat Config）+ Prettier

## 目录结构

```text
MyndBBS/
├── packages/
│   ├── frontend/   # Next.js 前端应用
│   ├── backend/    # Express 后端 API
│   └── shared/     # 前后端共享 TS 类型/常量/校验
├── eslint.config.mjs
├── pnpm-workspace.yaml
└── package.json
```

## 核心设计要点

### 认证与安全

认证系统以“可落地、安全优先、可扩展”为原则，关键点包括：

- 会话：JWT + HttpOnly Secure Cookie（Refresh Token）为主，配合 Redis 进行会话状态管理，支持多设备管理及主动踢除，降低 XSS 风险
- Passkey：使用 `@simplewebauthn` 支持无密码登录与 2FA 绑定
- 强密码：至少 8 位，包含大小写字母、数字、特殊符号（见 `@myndbbs/shared` 的校验工具）
- 2FA：注册后引导绑定 TOTP，使用 `otplib` 和 `qrcode` 生成验证
- 权限：集成 CASL，提供灵活的 ABAC 权限系统，限制操作范围与层级

### 反滥用与风控

- IP 限制：引入 `express-rate-limit` 与 Redis 记录访问频次，限制单 IP 最大注册数量（当前实现为最多 3 个）与 API 请求速率
- 人机验证（插件化）：注册等敏感接口要求提交 `captchaToken`，后端通过可插拔的验证器进行校验
  - 当前实现了基于前端的滑动拼图验证码（Slider Captcha）配合后端校验

### 密码存储

当前实现采用：

- 密码 Hash：Argon2，自带 salt 与防离线破解优化
- 数据库存储：`password`（包含 Argon2 hash 和内部 salt）

说明：已根据最新实现将哈希算法升级为 Argon2，废弃了早期的 SHA-512 + 独立 salt 实现。

## 快速开始

### 1) 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

### 2) 配置环境变量

- 后端：复制 [backend/.env.example](file:///workspace/packages/backend/.env.example) 到 `packages/backend/.env` 并按需修改
- 前端：复制 [frontend/.env.example](file:///workspace/packages/frontend/.env.example) 到 `packages/frontend/.env.local`（或 `.env`）并按需修改

生产部署必须关注的变量：

- 后端
  - `FRONTEND_URL`：允许跨域的前端 Origin 列表（可用逗号分隔）
  - `TRUST_PROXY`：如果后端在反向代理/LB 后面，需设为 `true`
  - `RP_ID` / `ORIGIN`：PassKey(WebAuthn) 依赖，生产必须设置为真实域名与 HTTPS origin
- 前端
  - `API_URL` / `NEXT_PUBLIC_API_URL`：用于 Next.js rewrites 的后端地址（默认本地 `http://localhost:3001`）
  - `ALLOWED_DEV_ORIGINS`：开发环境下允许访问 Next.js dev resources 的额外域名（逗号分隔）

### 2) 启动后端

后端位于 `packages/backend`，启动示例：

```bash
pnpm --filter backend exec ts-node src/index.ts
```

健康检查：

```bash
curl http://localhost:3001/api/health
```

### 3) 启动前端

前端位于 `packages/frontend`：

```bash
pnpm --filter frontend dev
```

默认访问：

- http://localhost:3000

## 生产部署要点（与登录/PassKey 相关）

- 前端启用基于 nonce 的 CSP（在 [middleware.ts](file:///workspace/packages/frontend/src/middleware.ts) 中动态生成），避免由于 CSP 拦截内联脚本导致 hydration 失败进而出现“按钮不可点/一直加载/PassKey 无效”等问题
- PassKey(WebAuthn) 生产必须使用 HTTPS（除 localhost 外），并正确设置后端 `RP_ID`/`ORIGIN`

## 开发与规范

### 代码风格与约定

本项目采用严格的代码格式化与代码质量控制，以保证前后端代码的统一性与可维护性：

- **格式化 (Prettier)**：使用无分号（`semi: false`）、单引号（`singleQuote: true`）、尾随逗号（`trailingComma: 'all'`），缩进 2 个空格，单行最大 100 字符。
- **代码检查 (ESLint)**：采用 Flat Config 配置，继承 `@eslint/js` 和 `typescript-eslint` 推荐规则。严格禁止使用 `any`，并对代码复杂度进行限制（单函数圈复杂度最高 10，代码最多 50 行）。
- **TypeScript 严格模式**：全栈启用 `"strict": true`。后端开启了严格属性校验（`exactOptionalPropertyTypes`）与索引校验（`noUncheckedIndexedAccess`）。
- **前端开发规范**：
  - 全面使用 Next.js App Router 架构，优先采用服务端组件（RSC）。
  - 涉及状态管理或浏览器 API 的组件，需在文件顶部显式声明 `'use client'`。
  - UI 样式全面采用 Tailwind CSS 与语义化 CSS 变量。
- **后端设计模式**：
  - 基于 Express，采用路由（Route）与控制器（Controller）职责分离的架构。
  - 数据库交互统一使用强类型 ORM（Prisma）。
- **命名规范**：React 组件文件与函数名使用大驼峰（PascalCase），普通函数与变量使用小驼峰（camelCase），全局常量使用全大写加下划线（UPPER_SNAKE_CASE）。

### Lint / Format

```bash
pnpm lint
pnpm format
```

---

# English

## Overview

MyndBBS is a modern, enterprise-oriented open-source forum (BBS) project built with TypeScript end-to-end, including a frontend app, a backend API, and a shared type library.

- Frontend: Next.js 16 (App Router) + React 19 + TypeScript + i18n
- Backend: Node.js + Express + TypeScript + Redis
- Data access: Prisma (PostgreSQL)
- Access Control: CASL (Attribute-Based Access Control - ABAC)
- Shared layer: shared types/constants/validators via `@myndbbs/shared`

## Tech Stack

- Node.js + TypeScript
- Monorepo: pnpm workspace
- Frontend: Next.js 16 + Tailwind CSS v4 + next-themes + lucide-react
- Backend: Express (CORS/Helmet/Cookie Parser/Rate Limit) + ioredis
- ORM: Prisma + @casl/prisma
- Cryptography: Argon2 + @simplewebauthn + otplib
- Tooling: ESLint (Flat Config) + Prettier

## Repository Layout

```text
MyndBBS/
├── packages/
│   ├── frontend/   # Next.js frontend app
│   ├── backend/    # Express backend API
│   └── shared/     # Shared TS types/constants/validators
├── eslint.config.mjs
├── pnpm-workspace.yaml
└── package.json
```

## Key Design Notes

### Authentication & Security

The authentication system follows a “practical, security-first, extensible” approach:

- Session: JWT + HttpOnly Secure Cookie (Refresh Token) combined with Redis for active session management, remote revocation, and XSS risk reduction
- Passkeys: fully integrated via `@simplewebauthn` for both passwordless login and 2FA
- Strong password policy: minimum 8 chars with upper/lowercase, number, and special char (implemented in `@myndbbs/shared`)
- 2FA: user onboarding includes a TOTP (Authenticator App) setup flow using `otplib` and `qrcode`
- Authorization: CASL integration providing a flexible Attribute-Based Access Control (ABAC) system for robust permissions handling

### Abuse Prevention

- Rate Limiting & IP checks: backed by `express-rate-limit` and Redis to restrict API calls and cap the number of accounts per IP (currently max 3)
- Captcha (plugin-style): sensitive endpoints require a `captchaToken`
  - Integrated a Slider Captcha component on the frontend with backend verification

### Password Storage

Current implementation uses:

- Hashing: Argon2 with built-in salt handling and enhanced offline-cracking resistance
- Persistence: single `password` field in the database

Note: The hashing algorithm has been upgraded to Argon2 based on the latest implementations, deprecating the earlier SHA-512 approach.

## Quick Start

### 1) Install dependencies

From repository root:

```bash
pnpm install
```

### 2) Environment variables

- Backend: copy [backend/.env.example](file:///workspace/packages/backend/.env.example) to `packages/backend/.env`
- Frontend: copy [frontend/.env.example](file:///workspace/packages/frontend/.env.example) to `packages/frontend/.env.local` (or `.env`)

Key production variables:

- Backend
  - `FRONTEND_URL`: allowed frontend origins (comma-separated)
  - `TRUST_PROXY`: set to `true` behind a reverse proxy / load balancer
  - `RP_ID` / `ORIGIN`: required for Passkeys (WebAuthn) and must match your real HTTPS domain
- Frontend
  - `API_URL` / `NEXT_PUBLIC_API_URL`: backend base URL for Next.js rewrites (defaults to `http://localhost:3001`)
  - `ALLOWED_DEV_ORIGINS`: extra dev origins allowed to access Next.js dev resources (comma-separated)

### 2) Start backend

Backend lives in `packages/backend`:

```bash
pnpm --filter backend exec ts-node src/index.ts
```

Health check:

```bash
curl http://localhost:3001/api/health
```

### 3) Start frontend

Frontend lives in `packages/frontend`:

```bash
pnpm --filter frontend dev
```

Default URL:

- http://localhost:3000

## Production notes (Login/Passkeys)

- Frontend uses a nonce-based CSP generated in [middleware.ts](file:///workspace/packages/frontend/src/middleware.ts) to prevent hydration from being blocked by CSP (which would otherwise break login and Passkeys)
- Passkeys (WebAuthn) require HTTPS in production (except localhost), and backend `RP_ID`/`ORIGIN` must match the deployed domain

## Development & Conventions

### Code Style & Conventions

This project adopts strict formatting and code quality controls to ensure consistency and maintainability across the full stack:

- **Formatting (Prettier)**: No semicolons (`semi: false`), single quotes (`singleQuote: true`), trailing commas (`trailingComma: 'all'`), 2-space indentation, and a maximum of 100 characters per line.
- **Linting (ESLint)**: Uses Flat Config extending `@eslint/js` and `typescript-eslint` recommended rules. Strict prohibition of `any` types, with function complexity limits (max cyclomatic complexity of 10, max 50 lines per function).
- **TypeScript Strictness**: `"strict": true` is enabled globally. The backend enforces extra safety with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- **Frontend Paradigms**:
  - Fully leverages Next.js App Router architecture, prioritizing React Server Components (RSC).
  - Client-side components requiring state or browser APIs explicitly declare `'use client'` at the top.
  - Comprehensive usage of Tailwind CSS paired with semantic CSS variables for UI styling.
- **Backend Patterns**:
  - Express-based with a clear separation of Route and Controller responsibilities.
  - Strongly-typed ORM (Prisma) for all database interactions.
- **Naming Conventions**: PascalCase for React component files and names, camelCase for regular functions and variables, and UPPER_SNAKE_CASE for global constants.

### Lint / Format

```bash
pnpm lint
pnpm format
```
