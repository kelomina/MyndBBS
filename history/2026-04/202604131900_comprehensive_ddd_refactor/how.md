# 技术设计与架构方案 (Technical Design & Architecture)

## Architecture Decisions (架构决策)
1. **路由与控制器分离 (Route-Controller Segregation)**
   - 创建缺失的控制器层文件：`controllers/post.ts`、`controllers/category.ts`、`controllers/upload.ts` 和 `controllers/install.ts`。
   - 将现有路由文件（如 `routes/post.ts`）中直接处理请求响应、鉴权验证和业务编排的代码完整迁移至对应的控制器中。
   - 路由层将只保留纯粹的中间件挂载与请求方法映射，形如：`router.post('/', requireAuth, postController.createPost);`

2. **剔除 Application Services 中的 Prisma (Decoupling Prisma from Application Services)**
   - **CommunityApplicationService**: 构造函数增加 `IUserRepository` 的注入，用于替换现有的 `prisma.user.findUnique`。同时更新其在 `controllers/post.ts` 和 `controllers/admin.ts` 中的所有实例化点。
   - **MessagingApplicationService**: 利用已注入的 `IUserRepository`，补充对应的 `findByUsername` 方法（如果尚未实现），替换掉原有的 `prisma.user.findUnique` 调用。
   - **SystemApplicationService**: 构造函数增加 `IUserRepository` 和 `IRoleRepository` 的注入。将其直接通过 Prisma 调用创建初始角色的代码，替换为调用仓储接口的规范方法。
   - 移除这些文件中关于 `import { prisma } from '../../db'` 的声明。

3. **管理系统配置服务化 (Abstracting Infrastructure Concerns)**
   - 在 `controllers/admin.ts` 中存在用于测试数据库连接的 `new PrismaClient()` 裸调用和直接修改 `.env` 文件的代码。这些基础设施操作（文件系统、动态 Prisma 客户端）将作为实现细节隐藏在基础设施层。
   - 通过在 `SystemApplicationService` 或特定的基础设施辅助服务中封装这些逻辑，确保 Controller 只调用应用服务层，保持应用服务的领域纯度。

## Security & Performance Mitigations (安全与性能对策)
- **安全检查**：迁移控制器时，必须严格保留现有的所有中间件链（如 `requireAuth`, `requireAbility`, 限流器等），防止出现越权漏洞。重构涉及 Casl ability 的检查代码（如 `accessibleBy` 或 `subject`）必须正确无误地复制到控制器层。
- **性能验证**：替换 Prisma 调用为 Repository 调用时，注意在可能的地方优化查询，避免引入因多次单个查询导致的 N+1 性能瓶颈。
