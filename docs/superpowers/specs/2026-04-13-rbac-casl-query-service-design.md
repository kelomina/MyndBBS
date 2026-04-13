# RBAC CASL Query Service Design

Date: 2026-04-13

## 1. Goal

将 RBAC 的读模型（RolePermission / Permission → CASL rules 构建）拆分为专用 Query Service：
- 保持写模型领域化（Role/Permission 变更依旧通过 `RoleApplicationService` + 领域聚合/仓储）。
- 读模型完全 DTO 化：Query Service 直接基于 Prisma Read 查询返回 **可序列化 DTO**（CASL rules 或可转换的 rule descriptors），不返回领域对象。
- 允许高频调用：通过 Redis 缓存 rules，并在角色/权限变更时提供失效策略。

## 2. Current State (Existing Code)

- CASL rules 在 [casl.ts](file:///workspace/packages/backend/src/lib/casl.ts) 中通过 `defineAbilityFor(user)` 构建。
- `requireAuth/optionalAuth` 在 [auth.ts](file:///workspace/packages/backend/src/middleware/auth.ts) 中负责：
  - 解析 token + session 校验
  - 查询 `categoryModerator`（moderator 场景）
  - 查询 `user.level`
  - 调用 `defineAbilityFor` 将 `req.ability` 注入请求
- Prisma Schema 中 RBAC 表结构：
  - [schema.prisma](file:///workspace/packages/backend/prisma/schema.prisma#L250-L280)
  - `Permission.action` 为唯一字符串字段（当前决定采用 `action:subject` 编码）。

## 3. Requirements & Decisions

### 3.1 Rule Source
- 选择：DB 权限驱动。
- 规则来源：`RolePermission` join `Permission`，按用户当前 `roleId` 读取。

### 3.2 Permission Encoding
- 选择：`Permission.action` 采用 `action:subject` 编码。
- 示例：
  - `manage:all`
  - `read:AdminPanel`
  - `delete:Post`

### 3.3 Caching
- 选择：Redis 缓存。
- 缓存 key 建议：
  - `ability_rules:user:{userId}`（更贴近用户级别与 category moderator 的动态性）
  - 或 `ability_rules:role:{roleId}`（更适合仅 role 决定能力的系统）
- 本次设计推荐：**user 级缓存**（因为规则构建可能叠加 level、moderatedCategories 等用户态信息）。

## 4. Proposed Architecture

### 4.1 New Query Service
新增目录（示例，最终以项目风格为准）：
- `packages/backend/src/queries/identity/AccessControlQueryService.ts`
- `packages/backend/src/queries/identity/dto.ts`

核心职责：
1. 读取用户授权上下文（DTO）：`roleName`, `level`, `moderatedCategoryIds`。
2. 读取 DB 权限集合（DTO）：`Permission.action` 字符串数组（或解析后的 `{ action, subject }[]`）。
3. 生成 CASL 规则 DTO（建议直接输出 `rules` 数组，适配 `req.ability.rules` 的序列化需求）。
4. 使用 Redis 缓存最终 `rules`。

### 4.2 DTO Shape

建议定义两层 DTO：

1) `AccessContextDTO`
- `userId: string`
- `roleName: string | null`
- `level: number`
- `moderatedCategoryIds: string[]`

2) `AbilityRulesDTO`
- `rules: unknown[]`（与 CASL `Ability#rules` 的 JSON 序列化结构保持兼容）

备注：如果希望更强类型，可以定义 `RuleDescriptorDTO = { action: string; subject: string }`，再由构建器转换为 CASL rules；但最终仍要输出可序列化结构。

### 4.3 CASL Builder Split

将 CASL 构建分为两段：

- **Query Service（读模型）**：
  - `getAbilityRulesForUser(userId): Promise<AbilityRulesDTO>`
  - 完全 DTO 化 + 可缓存

- **Builder（纯函数）**：
  - `buildAbilityFromRules(rulesDTO, baselineContext): AppAbility`
  - 不做 DB 查询

建议保留现有 [casl.ts](file:///workspace/packages/backend/src/lib/casl.ts) 作为 builder 所在模块，但将其对外接口从 `defineAbilityFor(user)` 演进为：
- `defineAbilityForContext(context: AccessContextDTO, extraRules: RuleDescriptorDTO[]): AppAbility`
- 或 `defineAbilityForRules(rulesDTO: AbilityRulesDTO): AppAbility`

（实现细节阶段再定）

### 4.4 Data Flow (Request)

以 `requireAuth` 为例：
1. 解析 token → 获取 `userId/sessionId`
2. session validity 校验（保持现状）
3. 调用 `AccessControlQueryService.getAbilityRulesForUser(userId)`
   - Redis hit：直接返回 rules DTO
   - Redis miss：Prisma join 查询 role/permission + moderatedCategories + level → 生成 rules DTO → Redis set
4. Builder 将 rules DTO 转换为 `AppAbility`，挂载到 `req.ability`

### 4.5 Invalidation

#### 4.5.1 User role change
当管理员更新用户 role 时：
- 仍保留现有 session refresh 机制（`session:{id}:requires_refresh`）。
- 新增：删除 ability cache：`redis.del(ability_rules:user:{userId})`。

#### 4.5.2 Role permission change
当管理员修改 role 的 permission 绑定关系时：
- 删除所有受影响用户的 cache 成本过高。
- 推荐策略：
  - `ability_rules:user:{userId}` 缓存设置 TTL（例如 5-15 分钟）。
  - 变更时至少删除 `ability_rules:role:{roleId}`（如果采用 role 级缓存）。
  - 或采用版本号：`ability_rules:user:{userId}:v{roleUpdatedAt}`（更复杂，可作为后续迭代）。

## 5. Error Handling

- 若 `Permission.action` 不符合 `action:subject` 格式：
  - Builder 忽略该条 permission（fail-open 或 fail-closed 需在实现阶段明确）。
  - 推荐：对管理员配置错误采取 fail-closed（忽略无效权限），避免意外放权。

## 6. Security Considerations

- Query Service 返回的 rules DTO 只用于后端权限判断与（可选）前端展示，不应包含敏感数据。
- Redis 缓存 key 仅包含 `userId/roleId`，value 为 rules 序列化。

## 7. Non-Goals

- 本次不新增“后台权限管理 API”。
- 本次不修改 Prisma schema（Permission 表仍维持 `action` 字符串字段）。
- 本次不改变现有 Post/Comment/Category 的领域逻辑。

## 8. Acceptance Criteria

- 代码层面：CASL 构建所需的 RolePermission/Permission 读取不再散落在 middleware 或其他业务模块中，而由 Query Service 统一提供。
- 架构层面：
  - Write：Role/Permission 变更仍通过领域聚合/应用服务。
  - Read：能力规则通过 Query Service DTO 输出（可缓存）。
- 质量：所有新/改函数满足严格 JSDoc（Callers/Callees/Description/Keywords）。

## 9. Notes (Repo Policy)

- 本设计文档已写入工作区，但尚未进行 git commit（遵循“仅在用户明确要求时才提交/推送”的仓库规则）。
