# CQRS Query Services Design (Full Read-Side Migration)

Date: 2026-04-13

## 1. Goal

将后端所有“读模型 Query（Prisma find* + DTO 组装）”从 Route / Controller / ApplicationService / lib 中剥离出来，统一沉淀到 `src/queries/**` 下的按域 QueryService 中：

- **Write Model**：继续保持 DDD（ApplicationService → Domain Aggregate → Repository）。
- **Read Model**：统一 QueryService（直接 Prisma 查询 + DTO 输出，允许 include/join/where 拼装），Route/Controller 只做参数校验、鉴权、调用。
- **一致性**：QueryService 输出稳定 DTO，避免在多个 Controller 里重复构建 DTO 导致行为漂移。

## 2. Non-Goals

- 不引入 QueryBus/Handler 框架（本轮使用“按域 QueryService”即可）。
- 不改 Prisma schema。
- 不重写前端请求协议（保持现有 API 响应字段结构尽量不变）。

## 3. Current State (Key Violations)

### 3.1 Query scattered in routes
- [post.ts](file:///workspace/packages/backend/src/routes/post.ts) 内大量 `prisma.post/comment/upvote/bookmark.find*` 以及 join/merge。
- [category.ts](file:///workspace/packages/backend/src/routes/category.ts) 直接 `prisma.category.findMany`。

### 3.2 Query scattered in controllers
- [user.ts](file:///workspace/packages/backend/src/controllers/user.ts) 中 profile/bookmarks/passkeys/sessions/publicProfile 等均为 Prisma 查询与 DTO 组装。
- [admin.ts](file:///workspace/packages/backend/src/controllers/admin.ts) 中 users/posts/recycleBin/whitelist/db-config 等含大量 Prisma 查询。
- [auth.ts](file:///workspace/packages/backend/src/controllers/auth.ts)、[register.ts](file:///workspace/packages/backend/src/controllers/register.ts)、[sudo.ts](file:///workspace/packages/backend/src/controllers/sudo.ts)、[friend.ts](file:///workspace/packages/backend/src/controllers/friend.ts)、[message.ts](file:///workspace/packages/backend/src/controllers/message.ts) 等含 Prisma 读。

### 3.3 Query in application services / lib
- [CommunityApplicationService.ts](file:///workspace/packages/backend/src/application/community/CommunityApplicationService.ts#L90-L191) 与 [ModerationApplicationService.ts](file:///workspace/packages/backend/src/application/community/ModerationApplicationService.ts#L24-L100) 存在“写后再读返回 rich DTO”的 CQRS 混杂。
- [moderation.ts](file:///workspace/packages/backend/src/lib/moderation.ts#L12-L35) 将 moderated words 的读取+缓存放在 lib 层。

## 4. Proposed Architecture

### 4.1 Directory layout

新增（示例路径）：

- `src/queries/community/CommunityQueryService.ts`
- `src/queries/community/dto.ts`

- `src/queries/identity/IdentityQueryService.ts`
- `src/queries/identity/dto.ts`（可扩展现有 RBAC dto）

- `src/queries/messaging/MessagingQueryService.ts`
- `src/queries/messaging/dto.ts`

- `src/queries/admin/AdminQueryService.ts`
- `src/queries/admin/dto.ts`

- `src/queries/system/SystemQueryService.ts`
- `src/queries/system/dto.ts`

### 4.2 QueryService contract

每个 QueryService：
- 只做 Prisma 查询与 DTO 映射（可以 include/join、accessibleBy、where 拼装）。
- **不返回 Domain Aggregate**。
- 默认不写 Redis 缓存（除 RBAC already done），如需缓存则显式加 key/ttl。

### 4.3 Controller/Route responsibilities

- 参数校验（req.body/params/query）。
- 鉴权（requireAuth / requireAbility）。
- 调用 QueryService 取 DTO 并返回。

### 4.4 Handling `accessibleBy` / CASL

- QueryService 可接受 `AppAbility` 或接收 `accessibleBy(ability).Model` 生成的 where 片段。
- 推荐签名：
  - `listPosts(params: { ability: AppAbility; category?: string; sortBy?: string }): Promise<PostListItemDTO[]>`
  - `getPostById(params: { ability: AppAbility; postId: string }): Promise<PostDetailDTO | null>`

### 4.5 Handling “write then read”

- ApplicationService（命令侧）只返回 id 或最小必要信息。
- Controller 在命令完成后调用 QueryService 再取 rich DTO。

## 5. Migration Plan (High-level)

按域分批迁移，保证每一步可运行：
1. Community QueryService：迁移 `routes/post.ts`, `routes/category.ts`。
2. Identity QueryService：迁移 `controllers/user.ts`, `controllers/register.ts`, `controllers/auth.ts`, `controllers/sudo.ts`。
3. Messaging QueryService：迁移 `controllers/message.ts`, `controllers/friend.ts`。
4. Admin/System QueryService：迁移 `controllers/admin.ts`, `controllers/moderation.ts`。
5. 清理 ApplicationService/lib 中的读侧逻辑（写后再读、moderation words）。

## 6. Acceptance Criteria

- 所有 `routes/*.ts` 与 `controllers/*.ts` 中的 Prisma `findUnique/findMany/findFirst/count` 等读操作均迁移到 `src/queries/**`。
- ApplicationService 不再包含 “写后再读返回 DTO” 的 Prisma 查询。
- `src/lib/*` 不再承担“查询+缓存”职责（迁移到 QueryService 或 query cache module）。
- 现有 API 返回结构保持兼容（除非明确声明 breaking change）。

## 7. Notes (Repo Policy)

- 本设计文档已写入工作区，但尚未进行 git commit（仅在用户明确要求时才提交/推送）。
