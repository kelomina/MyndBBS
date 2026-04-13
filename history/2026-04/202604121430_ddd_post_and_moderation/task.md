# Task List (Implementation Plan)

## Phase 1: Foundational Infrastructure (Domain Layer)
- [ ] **Task 1.1**: Create `Post` and `Comment` Aggregate Roots in `packages/backend/src/domain/community/Post.ts` and `packages/backend/src/domain/community/Comment.ts`.
- [ ] **Task 1.2**: Create `ModeratedWord` Aggregate Root in `packages/backend/src/domain/community/ModeratedWord.ts`.
- [ ] **Task 1.3**: Create `IPostRepository`, `ICommentRepository`, and `IModeratedWordRepository` interfaces.

## Phase 2: Repositories & Application Services (Infra & App Layer)
- [ ] **Task 2.1**: Implement `PrismaPostRepository`, `PrismaCommentRepository`, and `PrismaModeratedWordRepository` in `packages/backend/src/infrastructure/repositories/`.
- [ ] **Task 2.2**: Create the `ModerationApplicationService` in `packages/backend/src/application/community/ModerationApplicationService.ts` to orchestrate moderation logic and event publishing (`PostApprovedEvent`, etc.).
- [ ] **Task 2.3**: Refactor `CommunityApplicationService` to replace `prisma.post/comment.create/update/delete` with the new Domain Aggregates and Repositories.

## Phase 3: Controller Refactoring (Refactoring the Presentation Layer)
- [ ] **Task 3.1**: Refactor `packages/backend/src/controllers/moderation.ts` to replace direct `prisma.update` and `prisma.create` calls with `ModerationApplicationService`.
- [ ] **Task 3.2**: Refactor `packages/backend/src/controllers/admin.ts` (specifically `restorePost` and `restoreComment`) to use the `ModerationApplicationService`.
- [ ] **Task 3.3**: Refactor `packages/backend/src/routes/post.ts` to ensure it only reads from the updated `CommunityApplicationService` returns without relying on internal `prisma.post` details.

## Phase 4: Quality & Security Audit
- [ ] **Task 4.1**: Execute a full-stack compilation check (`npx tsc --noEmit`) to verify interface mappings and type safety.
- [ ] **Task 4.2**: Verify that all newly created classes and methods are annotated with the required JSDoc format (`Callers`, `Callees`, `Description`, `Keywords`) and employ modern, professional language.