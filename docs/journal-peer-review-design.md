# MyndBBS 期刊独立投稿与双盲审稿设计

## 1. 决策结论

本功能采用独立投稿与同行审稿模式，不把期刊实现为普通论坛分类，也不复用 `PostStatus.PENDING`。投稿、审稿和公开出版属于独立生命周期；稿件只有正式接受并发布后，才可桥接到公共文章/帖子体系。

已冻结参数：

| 项目 | 决定 |
| --- | --- |
| 审稿模式 | 双盲 |
| 有效审稿数 | 至少 3 份已提交审稿意见 |
| 审稿截止时间 | 接受邀请后 14 天 |
| 邀请有效期 | 7 天未接受自动过期 |
| PDF 大小 | 单个文件最大 20 MB |
| 文件类型 | 仅 PDF；校验扩展名、MIME 和 `%PDF-` 文件头 |
| 投稿版本 | 提交后锁定；修回必须创建新版本 |
| 合作者 | 提交前可编辑；提交后由编辑处理变更 |
| 利益冲突 | 审稿人必须主动声明；声明冲突后不可审稿 |
| 审稿意见 | “给作者”与“仅编辑可见”分开存储 |
| 最终决定 | 编辑独立决定，不由系统按多数票自动决定 |
| 接收后发布 | 编辑确认后发布，不自动公开 |
| 文件保留 | 拒稿/撤稿后保留 3 年；清理后保留脱敏审计记录 |
| 已发表内容 | 不允许静默覆盖，只能发布更正或撤稿通知 |

## 2. 状态机

```text
DRAFT
  -> SUBMITTED
  -> TECHNICAL_CHECK
  -> EDITORIAL_SCREENING
  -> UNDER_REVIEW
  -> REVISION_REQUIRED
  -> RESUBMITTED
  -> UNDER_REVIEW
  -> ACCEPTED / REJECTED
  -> PUBLISHED
```

旁路状态：`WITHDRAWN`、`CORRECTED`、`RETRACTED`。

审稿任务状态：

```text
INVITED -> ACCEPTED / DECLINED / CONFLICT_DECLARED
         -> IN_PROGRESS -> SUBMITTED / EXPIRED
```

三人门槛按“已提交有效审稿意见”计算，而不是按邀请数计算；拒绝或过期的审稿人必须补充邀请。

## 3. 领域模型

第一版新增以下实体：

- `Journal`
- `JournalMember`
- `Submission`
- `SubmissionAuthor`
- `SubmissionVersion`
- `SubmissionFile`
- `ReviewerAssignment`
- `Review`
- `EditorialDecision`
- `SubmissionStatusHistory`

建议字段方向：

- `Submission`：期刊、通讯作者、标题、摘要、状态、当前版本、提交时间
- `SubmissionVersion`：版本号、标题、摘要、内容引用、创建者、创建时间；不可变
- `SubmissionFile`：版本、私有存储键、原始文件名、大小、MIME、哈希、扫描状态
- `ReviewerAssignment`：投稿版本、审稿人、邀请人、状态、截止时间、利益冲突状态
- `Review`：推荐结论、评分、作者可见意见、编辑私密意见、提交时间
- `EditorialDecision`：决定、理由、版本、轮次、编辑、时间

录用后再增加或启用 `JournalIssue`、`JournalArticle`，不让未录用稿件进入 `Post`、公共查询或搜索索引。

## 4. 权限与隐私

- 期刊编辑和审稿人使用期刊级成员关系，不新增全局 `REVIEWER` 角色。
- 作者只能读写自己的草稿和已提交记录。
- 已提交版本不可原地修改，修回必须建立新版本。
- 审稿人只能读取分配给自己的匿名稿件版本。
- 作者看不到审稿人身份；审稿人看不到作者身份；编辑可查看双方身份。
- 审稿意见的作者可见字段和编辑私密字段必须分离，并使用不同 DTO。
- 禁止自审、利益冲突审稿、重复分配和决定后继续提交审稿意见。
- 审计日志、通知、错误响应、WebSocket 和文件 URL 均不得泄露匿名映射。
- PDF 上传为私有文件；每次下载都必须重新执行资源级授权。
- 系统提示作者清理 PDF 元数据中的姓名、单位、致谢和文件属性；第一版不自动修改 PDF。

## 5. 研发顺序

1. Prisma 枚举、表结构、索引和迁移。
2. `journal` DDD 领域、状态机和仓储。
3. 投稿版本及 PDF 私有存储、下载授权、文件清理。
4. 审稿邀请、接受/拒绝、利益冲突和三人门槛。
5. 编辑决定、多轮修回和不可变历史。
6. CASL 资源级权限、通知、邮件和审计事件。
7. 作者投稿箱、编辑台、审稿台及国际化。
8. 安全、并发、匿名泄漏和 BFF 集成测试。

## 6. 第一版明确暂缓

- DOI、JATS/XML、PDF 自动排版
- 自动匹配审稿人
- 外部专家账号和邮件邀请
- 自动查重和相似度检测
- 收费投稿、订阅和复杂评分统计
- 公共审稿讨论区
- 静默覆盖已发表文章

## 7. 验收门禁

进入实现阶段前，必须保证：

1. 状态转换只允许合法路径。
2. 三名有效审稿意见才允许编辑完成最终决定（紧急人工 override 必须记录理由）。
3. 双盲身份在 DTO、日志、通知、文件元数据和错误信息中均不泄露。
4. 旧版本不可变，修回必产生新版本。
5. 投稿中的任何状态都不会出现在公共帖子、搜索或推荐接口。
6. 事务失败不会留下半成品投稿、审稿分配或通知。
7. 作者、编辑、审稿人和管理员的访问矩阵有自动化测试覆盖。

## 8. 参考规范

- COPE：Ethical Guidelines for Peer Reviewers
  https://publicationethics.org/guidance/guidelines/ethical-guidelines-peer-reviewers
- ICMJE：Author, Peer Reviewer and Editorial Responsibilities
  https://www.icmje.org/recommendations/browse/roles-and-responsibilities/author-responsibilities--peer-reviewer-responsibilities-and-journal-responsibilities.html
- ICMJE：Corrections and Version Control
  https://www.icmje.org/recommendations/browse/publishing-and-editorial-issues/corrections-and-version-control.html
- DOAJ：Principles of Transparency and Best Practice
  https://doaj.org/apply/transparency/

以上链接在本环境中未能联网复核，实施前需重新点验页面版本和措辞。上述设计采用的是可迁移的通用原则，不把医学期刊专属条款直接套用到 MyndBBS。

## 9. 实施裁决（由主协调模型冻结）

为避免后续反复决策，工程实现采用以下默认方案：

- 首版支持多个 `Journal`，但部署时先创建一个默认期刊。
- 期刊成员采用资源级 `JournalMember`，角色固定为 `OWNER`、`EDITOR`、`REVIEWER`。
- 审稿采用双盲；数据库保留真实关联，但所有作者/审稿人 DTO 使用脱敏投影。
- 每轮目标分配 3 名审稿人；只有 `Review.status = SUBMITTED` 才计入有效数量。
- 少于 3 份有效意见时，编辑决定接口默认拒绝；如需人工例外，必须填写原因并写入审计日志。
- 投稿正文首版只保存 PDF 引用和必要元数据，不把 PDF 内容复制进 `Post`。
- PDF 使用独立私有存储键；下载接口不返回永久公开 URL。
- 文件扫描失败或 MIME/文件头不匹配时，稿件不得进入编辑初审。
- 投稿版本使用数据库不可变记录；禁止通过普通 `PUT` 修改已提交版本。
- 所有跨表写操作通过 `IUnitOfWork` 完成，并使用复合唯一约束防止重复分配、重复决定和重复提交。
- 通知采用精确收件人投递；不向全体版主广播投稿或审稿信息。
- 首版不自动发送外部审稿邀请；审稿人必须是站内已认证用户并已加入期刊成员名单。

### 阶段 2 的固定交付物

1. Prisma schema 与 migration：期刊、投稿、版本、PDF 文件、审稿分配、审稿意见、编辑决定、状态历史。
2. `packages/backend/src/domain/journal`：状态转移和值对象。
3. `packages/backend/src/application/journal`：作者、编辑、审稿人用例服务。
4. 私有 PDF 上传/下载授权和文件生命周期清理接口。
5. CASL 期刊资源权限与匿名 DTO 投影。
6. 状态机、权限隔离、PDF 校验和三人门槛测试。

完成上述交付物并通过验证后，才进入前端投稿箱、编辑台和审稿台开发。
