# Task List (Implementation Plan)

## Phase 1: Foundational Infrastructure (Domain Layer)
- [ ] **Task 1.1**: Create `Category` Aggregate Root class in `packages/backend/src/domain/community/Category.ts`, defining properties, factory methods, and state mutation invariants (`updateDetails`, `changeMinLevel`).
- [ ] **Task 1.2**: Create `ICategoryRepository` interface in the domain layer.
- [ ] **Task 1.3**: Create `IEngagementRepository` interface in the domain layer to handle the persistence of upvotes and bookmarks.

## Phase 2: Repositories & Application Services (Infra & App Layer)
- [ ] **Task 2.1**: Implement `PrismaCategoryRepository` and `PrismaEngagementRepository` in `packages/backend/src/infrastructure/repositories/` to handle the ORM mapping for categories and engagements.
- [ ] **Task 2.2**: Create the `CommunityApplicationService` in `packages/backend/src/application/community/CommunityApplicationService.ts` to orchestrate new commands: `createCategory`, `updateCategory`, `deleteCategory`, `createPost`, `updatePost`, `deletePost`, and the four `toggleEngagement` methods (post upvote/bookmark, comment upvote/bookmark).

## Phase 3: Controller Refactoring (Refactoring the Presentation Layer)
- [ ] **Task 3.1**: Refactor `packages/backend/src/controllers/admin.ts` to replace direct `prisma.category.create/update/delete` calls with calls to the `CommunityApplicationService`.
- [ ] **Task 3.2**: Refactor `packages/backend/src/routes/post.ts` to replace direct `prisma.post.create/update/delete` and `prisma.comment.create/update/delete` calls with calls to the `CommunityApplicationService`.
- [ ] **Task 3.3**: Refactor `packages/backend/src/routes/post.ts` to replace direct `toggleInteraction` (upvote/bookmark) helper with calls to the `CommunityApplicationService`.

## Phase 4: Quality & Security Audit
- [ ] **Task 4.1**: Execute a full-stack compilation check (`npx tsc --noEmit`) to verify interface mappings and type safety.
- [ ] **Task 4.2**: Verify that all newly created classes and methods are annotated with the required JSDoc format (`Callers`, `Callees`, `Description`, `Keywords`) and employ modern, professional language.