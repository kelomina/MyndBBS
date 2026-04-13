# 开发实施任务清单 (Task List)

- [√] **1. 重构 Category 路由与控制器**
  - 创建 `src/controllers/category.ts` 并将 `src/routes/category.ts` 中的逻辑迁移过去。
  - 在 `src/routes/category.ts` 中引入并挂载 `categoryController`。

- [√] **2. 重构 Upload 路由与控制器**
  - 创建 `src/controllers/upload.ts` 并将 `src/routes/upload.ts` 中的文件上传处理逻辑（Multer 配置可留在单独的配置中或控制器同层）迁移过去。
  - 在 `src/routes/upload.ts` 中引入并挂载 `uploadController`。

- [√] **3. 重构 Install 路由与控制器**
  - 创建 `src/controllers/install.ts`，提取庞大的 HTML 字符串以及 `api/env`、`api/admin` 的回调函数。
  - 修改 `src/routes/install.ts` 仅做路由映射。

- [√] **4. 重构 Post 路由与控制器**
  - 创建 `src/controllers/post.ts`，将所有 `router.get`, `router.post`, `router.put`, `router.delete` 等回调提取为导出的控制器函数。
  - 迁移相关的 `AuthApplicationService`、`CommunityApplicationService` 实例化及相关的 Repository 依赖。
  - 更新 `src/routes/post.ts` 挂载对应的控制器。

- [√] **5. 补充 UserRepository 与 RoleRepository 接口实现**
  - 在 `domain/identity/IUserRepository.ts` 中检查或添加 `findByUsername(username: string): Promise<User | null>` 方法。
  - 在 `infrastructure/repositories/PrismaUserRepository.ts` 中实现上述方法。
  - 检查 `domain/identity/IRoleRepository.ts` 是否有 `findByName` 和 `save` 的方法，并在 `PrismaRoleRepository` 补充实现。

- [√] **6. 修复 CommunityApplicationService 违规**
  - 修改 `CommunityApplicationService.ts` 构造函数，注入 `IUserRepository`。
  - 替换 `assignCategoryModerator` 方法中的 `prisma.user.findUnique` 调用为 `this.userRepository.findById(userId)`（如果需要获取 RoleName，可通过 queryService 获取或在 UserRepository 扩展支持关联的角色名称，为保持简单，可直接通过 `user.roleId` 和 `IRoleRepository` 校验）。
  - 同步更新所有实例化 `CommunityApplicationService` 的地方（包括 `controllers/post.ts` 和 `controllers/admin.ts`）。

- [√] **7. 修复 MessagingApplicationService 违规**
  - 在 `MessagingApplicationService.ts` 中，使用 `this.userRepository.findByUsername('system')` 替换掉 `prisma.user.findUnique({ where: { username: 'system' } })`。
  - 在 `uploadKeys` 方法中，使用 `this.userRepository.findById(userId)` 替换 `prisma.user.findUnique({ where: { id: userId } })`。

- [√] **8. 修复 SystemApplicationService 违规**
  - 修改 `SystemApplicationService.ts` 构造函数，注入 `IUserRepository` 与 `IRoleRepository`。
  - 将 `createTemporaryRootUser` 与 `finalizeInstallation` 中的 `prisma.role.findUnique` 和 `prisma.user.upsert` 替换为 Repository 调用。
  - 更新实例化 `SystemApplicationService` 的地方（包括 `controllers/install.ts` 和 `controllers/admin.ts`）。

- [√] **9. 修复 Admin Controller 基础设施耦合**
  - 在 `SystemApplicationService.ts` 中新增一个专门测试并更新数据库连接的 `updateDatabaseConfiguration(url: string)` 方法（封装原先在 `admin.ts` 中的 `new PrismaClient()` 连接测试、写入 `.env` 文件、触发重启等底层逻辑）。
  - 在 `controllers/admin.ts` 的 `updateDbConfig` 控制器中调用上述服务方法，移除 `new PrismaClient()`。

- [√] **10. 质量验证与安全检查 (Verification & Security)**
  - 确保所有新创建的 Controller 函数以及修改后的 Application Services 函数都包含标准的 JSDoc 注释 (`Callers`, `Callees`, `Description`, `Keywords`)。
  - 运行 `npm run build` 和 `npx tsc --noEmit` 确保没有类型错误和语法错误。
  - 确保全工程中除 `db.ts`、QueryServices、Repositories 以及明确的基础设施外，无 `import { prisma } from '../../db'`。
