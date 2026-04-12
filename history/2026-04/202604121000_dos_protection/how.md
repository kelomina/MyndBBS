# 技术设计与实现方案 (DoS 防护)

## 设计原则
遵循用户“保持代码优雅，可维护性高，本地化强”的指导，我们将采用**中间件复用**与**默认安全参数**的策略，避免在业务代码中散落大量的防御逻辑。

## 核心防护措施

### 1. 全局大载荷拦截 (Payload Limiting)
- **实现方式**: 修改 `packages/backend/src/index.ts` 中的 `express.json()`，显式增加 `limit: '100kb'` 的参数配置。
- **本地化考量**: 集中配置于入口文件，对所有路由生效，业务代码零感知。

### 2. 核心接口限流 (Rate Limiting)
- **实现方式**: 复用 `packages/backend/src/lib/rateLimit.ts` (或基于现有的 Redis 实例)，统一定义业务级限流器工厂。
  - `postLimiter`: 限制每分钟发帖/评论频率。
  - `uploadLimiter`: 限制每分钟上传文件的次数。
  - `friendRequestLimiter`: 限制好友请求发送频率。
- **路由集成**: 在 `routes/post.ts`, `routes/upload.ts`, `routes/friend.ts` 中以中间件形式按需挂载，保持代码简洁。

### 3. 数据库查询兜底截断 (DB Query Bounds)
- **实现方式**: 针对前端可能需要全量数据的情况（Admin 面板渲染），不能直接改为严格的游标分页（破坏前端逻辑），而应设置一个**合理的兜底阈值**（如 `take: 1000`）。
- **作用域**: 针对 `admin.ts`, `moderation.ts`, `category.ts` 中的所有无限制 `prisma.*.findMany()` 调用，强制增加 `take` 参数。
- **优雅性考量**: 保持返回数组的签名不变，防止前端 Admin 渲染崩溃，同时彻底杜绝千万级数据加载导致的 OOM。