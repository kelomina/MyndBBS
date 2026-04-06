# MyndBBS

**MyndBBS** 是一个现代化、企业级取向的开源论坛（BBS）项目，采用 TypeScript 全栈开发，包含前端应用、后端 API 与共享类型库。

- 中文 / English: [中文](#中文) | [English](#english)
- 设计文档: [2026-04-06-myndbbs-spec-design.md](file:///workspace/docs/superpowers/specs/2026-04-06-myndbbs-spec-design.md) | [2026-04-06-auth-design.md](file:///workspace/docs/superpowers/specs/2026-04-06-auth-design.md)
- 实施计划: [2026-04-06-myndbbs-initial-setup.md](file:///workspace/docs/superpowers/plans/2026-04-06-myndbbs-initial-setup.md) | [2026-04-06-auth-implementation.md](file:///workspace/docs/superpowers/plans/2026-04-06-auth-implementation.md)

---

# 中文

## 项目介绍

MyndBBS 目标是提供一个稳定、高性能、易扩展的论坛系统基础设施：

- 前端：Next.js（App Router）+ React + TypeScript
- 后端：Node.js + Express + TypeScript
- 数据访问：Prisma
- 共享层：前后端共享类型、常量、校验工具（`@myndbbs/shared`）

## 技术栈

- Node.js + TypeScript
- Monorepo：pnpm workspace
- Frontend：Next.js + Tailwind CSS
- Backend：Express（CORS/Helmet/Cookie Parser）
- ORM：Prisma
- 工程化：ESLint（Flat Config）+ Prettier

## 目录结构

```text
MyndBBS/
├── packages/
│   ├── frontend/   # Next.js 前端应用
│   ├── backend/    # Express 后端 API
│   └── shared/     # 前后端共享 TS 类型/常量/校验
├── docs/superpowers/
│   ├── specs/      # 设计规范
│   └── plans/      # 实施计划
├── eslint.config.mjs
├── pnpm-workspace.yaml
└── package.json
```

## 核心设计要点

### 认证与安全

认证系统以“可落地、安全优先、可扩展”为原则，关键点包括：

- 会话：JWT + HttpOnly Secure Cookie（Refresh Token）为主，降低 XSS 风险
- Passkey：使用浏览器能力检测 `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` 决定是否进行 Passkey 绑定/挑战
- 强密码：至少 8 位，包含大小写字母、数字、特殊符号（见 `@myndbbs/shared` 的校验工具）
- 2FA：注册后引导绑定 TOTP（设计规范中定义）

详细设计见 [2026-04-06-auth-design.md](file:///workspace/docs/superpowers/specs/2026-04-06-auth-design.md)。

### 反滥用与风控

- IP 限制：后端记录注册 IP，并限制单 IP 最大注册数量（当前实现为最多 3 个）
- 人机验证（插件化）：注册接口要求提交 `captchaToken`，后端通过可插拔的验证器进行校验
  - 当前仓库内置了开发态 mock（`valid-captcha-token`）用于联调

### 密码存储

当前实现采用：

- 密码 Hash：SHA-512（基于 Node.js `crypto`）+ 8-byte salt
- 数据库存储：`passwordHash` + `passwordSalt`

说明：此实现遵循当前设计要求。若未来希望进一步提升抗撞库能力，建议升级为 Argon2/bcrypt/scrypt（需要同步更新设计规范与实现）。

## 快速开始

### 1) 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

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

## 开发与规范

### Lint / Format

```bash
pnpm lint
pnpm format
```

### 文档

- 设计规范：`docs/superpowers/specs/`
- 实施计划：`docs/superpowers/plans/`

---

# English

## Overview

MyndBBS is a modern, enterprise-oriented open-source forum (BBS) project built with TypeScript end-to-end, including a frontend app, a backend API, and a shared type library.

- Frontend: Next.js (App Router) + React + TypeScript
- Backend: Node.js + Express + TypeScript
- Data access: Prisma
- Shared layer: shared types/constants/validators via `@myndbbs/shared`

## Tech Stack

- Node.js + TypeScript
- Monorepo: pnpm workspace
- Frontend: Next.js + Tailwind CSS
- Backend: Express (CORS/Helmet/Cookie Parser)
- ORM: Prisma
- Tooling: ESLint (Flat Config) + Prettier

## Repository Layout

```text
MyndBBS/
├── packages/
│   ├── frontend/   # Next.js frontend app
│   ├── backend/    # Express backend API
│   └── shared/     # Shared TS types/constants/validators
├── docs/superpowers/
│   ├── specs/      # Design specs
│   └── plans/      # Implementation plans
├── eslint.config.mjs
├── pnpm-workspace.yaml
└── package.json
```

## Key Design Notes

### Authentication & Security

The authentication system follows a “practical, security-first, extensible” approach:

- Session: JWT + HttpOnly Secure Cookie (Refresh Token) to reduce XSS risks
- Passkeys: use browser capability detection via `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` to decide whether to enroll/trigger passkeys
- Strong password policy: minimum 8 chars with upper/lowercase, number, and special char (implemented in `@myndbbs/shared`)
- 2FA: user onboarding includes a TOTP (Authenticator App) setup flow (defined in the spec)

See [2026-04-06-auth-design.md](file:///workspace/docs/superpowers/specs/2026-04-06-auth-design.md) for the full design.

### Abuse Prevention

- IP-based limit: backend records the registration IP and limits the number of accounts per IP (currently max 3)
- Captcha (plugin-style): registration requires `captchaToken`, verified by a pluggable validator
  - This repo provides a dev-mode mock token (`valid-captcha-token`) for local integration

### Password Storage

Current implementation uses:

- Hashing: SHA-512 (via Node.js `crypto`) + 8-byte salt
- Persistence: `passwordHash` + `passwordSalt` in the database

Note: this follows the current spec. If you want stronger resistance against offline cracking, consider upgrading to Argon2/bcrypt/scrypt and update both the spec and implementation accordingly.

## Quick Start

### 1) Install dependencies

From repository root:

```bash
pnpm install
```

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

## Development & Conventions

### Lint / Format

```bash
pnpm lint
pnpm format
```

### Docs

- Design specs: `docs/superpowers/specs/`
- Implementation plans: `docs/superpowers/plans/`
