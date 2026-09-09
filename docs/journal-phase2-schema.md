# 期刊阶段 2：数据模型冻结稿

本文是 `journal-peer-review-design.md` 的工程化补充，作为 Prisma 实现前的唯一模型依据。

## 枚举

```prisma
enum JournalStatus { DRAFT ACTIVE ARCHIVED }
enum JournalMemberRole { OWNER EDITOR REVIEWER }
enum SubmissionStatus { DRAFT SUBMITTED TECHNICAL_CHECK EDITORIAL_SCREENING UNDER_REVIEW REVISION_REQUIRED RESUBMITTED ACCEPTED REJECTED WITHDRAWN PUBLISHED CORRECTED RETRACTED }
enum ReviewAssignmentStatus { INVITED ACCEPTED DECLINED CONFLICT_DECLARED IN_PROGRESS SUBMITTED EXPIRED CANCELLED }
enum ReviewRecommendation { ACCEPT MINOR_REVISION MAJOR_REVISION REJECT }
enum EditorialDecisionType { DESK_REJECT REJECT MINOR_REVISION MAJOR_REVISION ACCEPT }
enum SubmissionFileScanStatus { PENDING CLEAN REJECTED }
```

## 关系约束

- `JournalMember` 对 `(journalId, userId)` 唯一。
- `SubmissionVersion` 对 `(submissionId, versionNumber)` 唯一，提交版本不可更新。
- `ReviewerAssignment` 对 `(submissionVersionId, reviewerId)` 唯一。
- 同一版本最多一个有效编辑决定；决定写入后禁止覆盖。
- `SubmissionFile` 仅允许一个主 PDF（通过服务层约束）；文件扫描状态为 `CLEAN` 才能提交。
- 所有外键使用 UUID；投稿删除采用逻辑状态，不物理删除审稿记录。

## 事务边界

以下操作必须在同一 `IUnitOfWork` 事务中完成：

1. 提交投稿：锁定当前版本、创建提交事件、写状态历史。
2. 分配审稿人：检查成员关系/冲突/重复分配后批量创建邀请。
3. 提交审稿：锁定 assignment，写入 Review，更新 assignment 状态。
4. 编辑决定：检查有效审稿数、写决定、迁移投稿状态、创建通知事件。
5. 修回：创建新版本、递增轮次、迁移为 `RESUBMITTED`。

## 文件安全

- 存储键格式：`journals/{journalId}/submissions/{submissionId}/versions/{versionId}/{uuid}.pdf`。
- 路径中不使用用户名、标题或原始文件名。
- 下载时根据当前用户、期刊成员、审稿分配和版本状态重新授权。
- 日志只记录文件 ID、大小、哈希和扫描结果，不记录 PDF 内容。

## 非目标

本阶段不修改 `Post`、`PostStatus`、普通帖子审核流程、公共搜索索引和论坛评论模型。
