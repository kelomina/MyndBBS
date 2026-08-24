# MyndBBS 社区功能补全 · 开发路线图与设计文档

> 状态：Phase 1 已实施；Phase 2-4 为规划。
> 对标对象：Discourse / Flarum / NodeBB / Discuz! 的成熟功能集。
> 本文档是社区治理与活跃度功能补全的权威设计依据，实现以本文档为准。

---

## 1. 背景与差距分析

MyndBBS 在安全与基础设施层面已具备差异化优势（E2E 加密私信含后量子密钥、Passkey/TOTP/OIDC 三通道认证、审计日志、CASL 细粒度权限、回收站恢复、审核词+人工审核双轨），但对照主流开源论坛，存在以下缺口：

### 缺口清单

| 编号 | 缺口 | 严重度 | 现有可复用基础 |
|---|---|---|---|
| G1 | 用户举报系统 | P0 治理刚需 | 审核队列 UI、ModerationApplicationService、版主通知管道 |
| G2 | IP 封禁 / 防小号 | P0 治理刚需 | User.registeredIp 已记录、express-rate-limit |
| G3 | 新用户防灌水规则 | P0 治理刚需 | isPending 首审机制 |
| G4 | 话题标签 Tag | P1 活跃引擎 | 无（需新建表） |
| G5 | @提及通知 | P1 活跃引擎 | 评论通知管道 |
| G6 | 引用回复 UI | P1 活跃引擎 | parentId 结构已有 |
| G7 | 声望值体系 | P1 活跃引擎 | 徽章系统、Upvote 数据 |
| G8 | 邮件通知（被回复/@/私信） | P1 召回 | SMTP + EmailTemplate 基础设施 |
| G9 | 未读新帖标记 | P1 | Session.lastSeenAt 类字段缺失 |
| G10 | 帖子图片上传/附件 | P2 内容 | LocalFileStorageAdapter、BFF duplex 上传 |
| G11 | 站点设置面板 | P2 运营 | env 配置散落 |
| G12 | 统计仪表盘 | P2 运营 | 全量业务数据在库 |
| G13 | SEO 三件套（sitemap/robots/OG） | P2 增长 | Next.js SSR 底子 |
| G14 | 精华帖流程 | P2 内容 | PostStatus.PINNED 已有 |

---

## 2. 阶段规划

| 阶段 | 内容 | 状态 |
|---|---|---|
| **Phase 1** | G1 用户举报系统（详细设计见 §3）+ 徽章联动 | ✅ 已上线 |
| **Phase 2** | G2 IP 封禁管理 + G3 新用户防灌水规则 | ✅ 已上线 |
| **Phase 3** | G4 Tag 标签 → G5 @提及 → G8 邮件通知 | ✅ 已上线 |
| **Phase 4** | G10 图片上传 → G11 站点设置 → G12 统计 → G13 SEO → G14 精华 | ✅ 已上线 |

依赖关系：G1 是 G7（缉毒卫士自动授予条件）的前置；G4 与 G5 相互放大；建议 G8 在 G5 之后做以复用提及解析。

---

## 3. Phase 1 · 用户举报系统 详细设计

### 3.1 目标与非目标

**目标**
1. 注册用户可对帖子/评论发起举报（理由分类 + 可选补充说明）
2. 版主及以上可在管理面板查看举报队列、标记成立/驳回
3. 举报成立自动累计，驱动「缉毒卫士」徽章自动授予（新增 `upheld_reports` 条件类型）
4. 举报成立时即时评估该举报人的徽章（事件驱动，不等周期任务）

**非目标（v1 明确不做）**
- 不内置"成立即删帖"联动——内容处置仍走现有删除/隐藏工具，避免权限级联复杂度
- 不做举报人站内信推送通知——面板 tab 承载时效性，v2 再评估
- 不做针对用户（而非内容）的举报
- 不做多级申诉流程

### 3.2 数据模型

```prisma
enum ReportStatus {
  PENDING    // 待处理
  RESOLVED   // 成立
  DISMISSED  // 驳回
}

enum ReportTargetType {
  POST
  COMMENT
}

enum ReportReason {
  SPAM         // 垃圾广告
  PORNOGRAPHY  // 色情低俗
  ILLEGAL      // 违法违规
  ABUSE        // 人身攻击/辱骂
  COPYRIGHT    // 侵权
  OTHER        // 其他（须填 detail）
}

model ContentReport {
  id             String            @id @default(uuid()) @db.Uuid
  reporterId     String            @db.Uuid
  reporter       User              @relation("ReportsFiled", fields: [reporterId], references: [id], onDelete: Cascade)
  targetType     ReportTargetType
  postId         String            @db.Uuid   // 评论举报同时记录所属帖子，便于聚合展示
  commentId      String?           @db.Uuid
  reason         ReportReason
  detail         String?           @db.Text   // OTHER 时必填，≤500 字符
  status         ReportStatus      @default(PENDING)
  handledBy      String?           @db.Uuid   // 处理人
  handledAt      DateTime?
  resolutionNote String?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@index([status, createdAt])
  @@index([reporterId])
}
```

去重规则（应用层强制）：同一 `reporterId + targetType + postId + commentId` 组合仅允许一条记录（不论历史状态）。PostgreSQL 对 NULL 参与的唯一约束视为互异，故不在 DB 层建唯一索引，由仓储 `existsDuplicate` 查询保证。

### 3.3 API 契约

**用户端** — `/api/v1/reports`（新建路由，requireAuth）

| 方法 | 路径 | 入参 | 出参 | 错误码 |
|---|---|---|---|---|
| POST | `/` | `{ targetType: 'POST'\|'COMMENT', postId, commentId?, reason, detail? }` | `{ message, report: { id, status } }` | 见下 |

错误码：
- `ERR_REPORT_TARGET_NOT_FOUND` 404 目标不存在或不可读
- `ERR_REPORT_ALREADY_SUBMITTED` 409 重复举报
- `ERR_REPORT_SELF_TARGET` 400 不能举报自己的内容
- `ERR_REPORT_REASON_DETAIL_REQUIRED` 400 OTHER 理由未填说明
- `ERR_BAD_REQUEST` 400 参数缺失

限流：复用 reportLimiter（新定义，每 IP 每 15 分钟 10 次）。

**管理端** — `/api/admin/reports`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/?status=&targetType=&skip=&take=` | `read AdminPanel`（MODERATOR+） | 分页列表，含目标内容快照与举报人信息 |
| POST | `/:id/resolve` body `{ note? }` | `handle Report` | 标记成立 → 发 `ReportResolvedEvent` |
| POST | `/:id/dismiss` body `{ note? }` | `handle Report` | 标记驳回 |

错误码：`ERR_REPORT_NOT_FOUND` 404、`ERR_REPORT_ALREADY_HANDLED` 409（非 PENDING 状态重复处理）。

### 3.4 领域规则与状态机

```
PENDING ──resolve──> RESOLVED （终态）
PENDING ──dismiss──> DISMISSED （终态）
```

- 仅 PENDING 可流转；终态操作抛 `ERR_REPORT_ALREADY_HANDLED`
- 目标有效性校验：POST 必须存在（状态不限——已删除内容仍可被举报追溯）；COMMENT 必须存在且其 postId 与入参一致
- 举报人不能举报自己的内容（authorId === reporterId 抛错）

### 3.5 权限模型（CASL 变更）

- `AppSubjects` 新增 `'Report'`；`Action` 新增 `'handle'`
- MODERATOR 角色分支追加：`can('read', 'Report')` + `can('handle', 'Report')`
- ADMIN/SUPER_ADMIN 经 `manage all` 天然覆盖
- 用户创建举报不需要 CASL subject（登录即可，走 requireAuth）

### 3.6 徽章联动

1. `BadgeConditionKind` 新增 `'upheld_reports'`：`{ kind, threshold }`，语义为"该用户的举报被采纳（RESOLVED）次数达到 threshold"
2. `IBadgeStatsPort` 新增 `getUpheldReportCountsByReporter(): Promise<Map<string, number>>`
3. 内置徽章 `anti_drug_guardian` 定义更新为 AUTO：`{ kind: 'upheld_reports', threshold: 3 }`——启动种子经 `syncSystemDefinition` 自动刷新存量库
4. `ReportResolvedEvent { reportId, reporterId, handlerId }` 发布于 resolve 成功后；`BadgeEventListener` 订阅并对 `event.reporterId` 即时评估（等级变更同款模式）

### 3.7 前端交互设计

**用户侧**
- 帖子：`PostActions.tsx` 操作区新增「举报」（仅当浏览者非作者时显示）
- 评论：`CommentItem.tsx` 操作行新增「举报」（同样排除本人）
- 弹窗：理由单选（6 类本地化文案）+ OTHER 时显示说明 textarea + 提交按钮
- 成功 toast：「举报已提交，感谢你的反馈」；重复举报提示已提交过

**管理侧**
- `admin/moderation/ModerationClient.tsx` 新增第四个 tab「用户举报」（MODERATOR 可见）
- 列表列：目标类型/预览（截断正文）、理由、详情、举报人、时间、状态
- 行操作：成立 / 驳回（均可附处理备注）；状态筛选下拉

### 3.8 i18n 清单

前端字典 `report` 节 + admin tab 文案 + apiErrors 六个错误码；后端 locales en/zh 同步六个错误码。

### 3.9 测试计划

- 后端 jest：领域实体状态机、应用服务（创建校验/去重/自举报/OTHER 详情必填）、resolve→事件发布、徽章条件统计
- 前端静态断言：PostActions/CommentItem 举报入口、ModerationClient 第四 tab、api 函数、字典键
- 门禁：双端 tsc、eslint、node --test、jest、next build

### 3.10 验收标准

1. 登录用户可对任意他人帖子/评论成功提交举报，重复提交返回 409
2. 版主在管理面板可见并处理举报；处理后状态终态化
3. 举报人获 3 次「成立」后自动获得缉毒卫士徽章并有系统通知
4. CI 全绿；生产部署后迁移增量安全（仅新增表与枚举）

---

## 4. Phase 2-4 概要设计（后续按此展开）

### Phase 2 · 治理强化
- **IP 封禁**：`BannedIp { ip Inet, reason, createdBy, createdAt, expiresAt? }`；注册/登录中间件校验；管理面板 CRUD。registeredIp 已落库支持历史排查
- **防灌水规则**：`SitePolicy` KV 表（首帖必审开关、新户 N 小时限发 M 帖、最小账户年龄发外链）；CommunityApplicationService 发帖路径前置校验

### Phase 3 · 活跃引擎
- **Tag**：`Tag { id, name unique-slug }` + `PostTag(postId, tagId)`；发帖表单标签输入（最多 5 个）；/tags 聚合页；搜索接入
- **@提及**：正则解析 `@username` → NotificationService mention 通知 + 渲染高亮链接；通知设置增加"提及"开关
- **邮件通知**：EmailTemplateType 增加 NOTIFICATION_REPLY/NOTIFICATION_MENTION/NOTIFICATION_MESSAGE；用户通知偏好表；邮件发送复用现有队列

### Phase 4 · 内容与运营（逐项独立，无相互依赖）
图片上传复用 LocalFileStorageAdapter + BFF duplex；站点设置走 KV 表 + 缓存；统计走既有 CQRS 读侧聚合；sitemap 用 Next.js app/sitemap.ts 动态生成。
