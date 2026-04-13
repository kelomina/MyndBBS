# Technical Design & Architecture (How)

## Architecture Decisions

### 1. Aggregate Roots & Entities (Domain Layer)
We will complete the `Community` domain by introducing the core Aggregates:
- **`Post` Aggregate Root**: Represents a forum post.
  - Properties: `id`, `title`, `content`, `authorId`, `categoryId`, `status` (`PUBLISHED`, `PENDING`, `DELETED`), `createdAt`.
  - Exposes behaviors like `updateContent(title, content, isModerated)`, `delete()`, `restore()`, `approve()`, `reject()`.
- **`Comment` Aggregate Root**: Represents a reply on a post.
  - Properties: `id`, `content`, `postId`, `authorId`, `parentId`, `isPending`, `deletedAt`, `createdAt`.
  - Exposes behaviors like `updateContent(content, isModerated)`, `delete()`, `restore()`, `approve()`, `reject()`.
- **`ModeratedWord` Aggregate Root**: Represents a banned word rule.
  - Properties: `id`, `word`, `categoryId`, `createdAt`.

### 2. Repositories (Infrastructure Layer)
- Define `IPostRepository`, `ICommentRepository`, and `IModeratedWordRepository` contracts in the domain layer.
- Implement `PrismaPostRepository`, `PrismaCommentRepository`, and `PrismaModeratedWordRepository` to handle the Prisma mapping for these complex models.

### 3. Application Services (Application Layer)
- Refactor **`CommunityApplicationService`** to consume the new `Post` and `Comment` Aggregates instead of direct Prisma calls.
- Create **`ModerationApplicationService`** in `packages/backend/src/application/community/ModerationApplicationService.ts`.
  - Orchestrates: `addModeratedWord`, `removeModeratedWord`, `approvePost`, `rejectPost`, `approveComment`, `rejectComment`.
  - This service will publish the `PostApprovedEvent` and `PostRejectedEvent` via the `EventBus` (which was previously handled in the controller).

## Security & Performance Mitigations
- **Event Bus Decoupling**: The Controller (`moderation.ts`) will no longer need to know about the `EventBus`. The `ModerationApplicationService` will handle event publication securely after updating the post state.
- **CQRS**: For retrieving posts/comments (Reads), the Controllers (`routes/post.ts` and `routes/category.ts`) will continue using highly optimized Prisma `findMany` queries, while the Writes will route through the Aggregates.