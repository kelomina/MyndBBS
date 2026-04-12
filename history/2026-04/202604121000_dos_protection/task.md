# 实施任务清单

## 阶段一：全局与中间件防御
- [√] **任务 1.1**: 更新 `packages/backend/src/index.ts`，为 `express.json()` 和 `express.urlencoded()` 增加 `{ limit: '100kb' }` 限制。
- [√] **任务 1.2**: 查找或创建 `packages/backend/src/lib/rateLimit.ts`，定义 `postLimiter`, `uploadLimiter`, 和 `friendRequestLimiter` 实例。

## 阶段二：路由层限流接入
- [√] **任务 2.1**: 更新 `packages/backend/src/routes/post.ts`，为发帖和评论路由挂载 `postLimiter`。
- [√] **任务 2.2**: 更新 `packages/backend/src/routes/upload.ts` 和 `packages/backend/src/routes/friend.ts`，分别挂载上传与好友请求的限流器。

## 阶段三：数据库层兜底截断
- [√] **任务 3.1**: 修改 `packages/backend/src/controllers/admin.ts` 中的 `getUsers`, `getPosts`, `getDeletedPosts` 等查询方法，为所有 `findMany` 增加 `take: 1000` 兜底截断。
- [√] **任务 3.2**: 修改 `packages/backend/src/controllers/moderation.ts` 中的 `getModeratedWords`, `getPendingPosts` 和 `packages/backend/src/routes/category.ts` 中的分类查询，增加 `take: 1000`。

## 阶段四：验证与审计
- [√] **任务 4.1**: 运行全栈测试/编译，确保没有任何类型报错。
- [√] **任务 4.2**: 抽查核心链路（发帖、大文件模拟请求），验证限流和 Payload 拦截是否生效。