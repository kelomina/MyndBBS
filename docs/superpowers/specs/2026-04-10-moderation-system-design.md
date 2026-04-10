# 审核词系统设计文档 (Moderation System Design)

## 1. 需求背景
系统需要一个审核词（敏感词）过滤机制。当用户发布或编辑帖子/评论时，若内容包含配置的审核词，该内容将进入“审核区”（处于待审核状态），并向用户明确提示。版主（仅限本板块）、管理员和超级管理员可以在后台配置这些审核词，并对进入审核队列的内容进行通过或拒绝的操作。

## 2. 数据库变更 (Prisma)
- **`PostStatus` 枚举**: 新增 `PENDING` 状态。
- **`Comment` 模型**: 新增 `isPending Boolean @default(false)` 字段。
- **`ModeratedWord` 模型**:
  ```prisma
  model ModeratedWord {
    id         String    @id @default(uuid()) @db.Uuid
    word       String
    categoryId String?   @db.Uuid // null 表示全局审核词
    category   Category? @relation(fields: [categoryId], references: [id], onDelete: Cascade)
    createdAt  DateTime  @default(now())

    @@unique([word, categoryId])
    @@index([categoryId])
  }
  ```

## 3. 后端 API 设计
### 3.1 审核词匹配拦截
- **创建/更新 帖子**: `POST /api/v1/posts`, `PUT /api/v1/posts/:id`。校验 `title` + `content`。
- **创建/更新 评论**: `POST /api/v1/posts/:id/comments`, `PUT /api/v1/comments/:id`。校验 `content`。
- **拦截逻辑**: 提取全局审核词和对应板块的专属审核词。若匹配成功，则覆盖状态为 `PENDING` (帖子) 或 `isPending = true` (评论)，并在响应头或正文中返回提示 `"内容包含审核词，已提交人工审核" (ERR_PENDING_MODERATION)`。

### 3.2 审核词管理 (Admin API)
- `GET /api/v1/admin/moderation/words`: 获取当前用户有权管理的审核词。
- `POST /api/v1/admin/moderation/words`: 添加审核词（可指定 `categoryId`）。
- `DELETE /api/v1/admin/moderation/words/:id`: 删除审核词。

### 3.3 审核队列管理 (Admin API)
- `GET /api/v1/admin/moderation/posts`: 获取待审核的帖子。
- `POST /api/v1/admin/moderation/posts/:id/approve`: 通过帖子 (更新为 PUBLISHED)。
- `POST /api/v1/admin/moderation/posts/:id/reject`: 拒绝帖子 (可直接软删除或设为 DELETED)。
- `GET /api/v1/admin/moderation/comments`: 获取待审核的评论。
- `POST /api/v1/admin/moderation/comments/:id/approve`: 通过评论 (isPending = false)。
- `POST /api/v1/admin/moderation/comments/:id/reject`: 拒绝评论 (软删除)。

## 4. 前端管理面板 (Admin Panel)
- **左侧导航栏**: 新增「内容审核 (Moderation)」入口，内含两个子页面：
  - **审核队列 (Queue)**: `Tabs` 切换待审核帖子和待审核评论，支持“通过”和“拒绝”。
  - **审核词配置 (Words)**: 列表展示审核词，支持新增（下拉选择全局或特定板块）和删除。
- **本地化 (i18n)**: 添加相关的中文和英文翻译。
