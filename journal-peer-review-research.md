# 独立投稿与同行评审：阶段 1 资料摘要

外部官方站点（COPE、ICMJE、DOAJ、WAME）在本次会话不可达，故仅记录待复核入口：

- COPE《Ethical guidelines for peer reviewers》：<https://publicationethics.org/guidance/guidelines/ethical-guidelines-peer-reviewers>
- ICMJE《Author Responsibilities—Peer Reviewer Responsibilities and Journal Responsibilities》：<https://www.icmje.org/recommendations/browse/roles-and-responsibilities/author-responsibilities--peer-reviewer-responsibilities-and-journal-responsibilities.html>
- ICMJE《Corrections and Version Control》：<https://www.icmje.org/recommendations/browse/publishing-and-editorial-issues/corrections-and-version-control.html>
- DOAJ《Principles of Transparency and Best Practice in Scholarly Publishing》：<https://doaj.org/apply/transparency/>
- WAME《Recommendations on Publication Ethics Policies for Medical Journals》：<https://wame.org/recommendations-on-publication-ethics-policies-for-medical-journals>

最低伦理基线（待联网冻结）：角色分离（作者/编辑/审稿人）；审稿保密；利益冲突披露与回避；决定和版本可追溯；修回产生新版本；发表后通过公开更正/撤稿记录处理，不能静默覆盖；公开申诉/投诉入口。
现有 MyndBBS 仅有 `PostStatus` 的 `PENDING -> PUBLISHED/DELETED` 社区审核流（`packages/backend/prisma/schema.prisma:70-79`、`packages/backend/src/domain/community/Post.ts:40-53,96-120`），分类版主（`schema.prisma:182-205`）和通用角色（`:324-366`），没有投稿版本、审稿分配、评审意见、编辑决定或冲突实体。

独立投稿 MVP 建议独立 `Submission` 聚合及版本、`ReviewerAssignment`、`Review`、`EditorialDecision`、不可变 `SubmissionEvent`。状态：`DRAFT -> SUBMITTED -> TECHNICAL_CHECK -> EDITORIAL_SCREENING -> REVIEWER_INVITED/ACCEPTED -> UNDER_REVIEW -> EDITOR_DECISION -> MINOR_REVISION/MAJOR_REVISION -> REVISION_SUBMITTED`，最终 `ACCEPTED -> PUBLISHED`、`REJECTED`；另有 `WITHDRAWN`，发表后 `CORRECTION/RETRACTED`。必须做角色分权、匿名访问控制、冲突回避、通知、审计、公开政策页；自动匹配、DOI/ORCID、反剽窃和复杂编委会可后置。
