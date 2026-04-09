# MyndBBS

**MyndBBS** 是一个现代化、企业级取向的开源论坛（BBS）项目，采用 TypeScript 全栈开发，包含前端应用、后端 API 与共享类型库。

- 中文 / English: [中文](#中文) | [English](#english)

---

# 中文

## 项目介绍

MyndBBS 目标是提供一个稳定、高性能、易扩展的论坛系统基础设施：

- 前端：Next.js 16（App Router）+ React 19 + TypeScript + i18n
- 后端：Node.js + Express + TypeScript + Redis
- 数据访问：Prisma（SQLite 默认）
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

---

# English

## Overview

MyndBBS is a modern, enterprise-oriented open-source forum (BBS) project built with TypeScript end-to-end, including a frontend app, a backend API, and a shared type library.

- Frontend: Next.js 16 (App Router) + React 19 + TypeScript + i18n
- Backend: Node.js + Express + TypeScript + Redis
- Data access: Prisma (SQLite default)
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