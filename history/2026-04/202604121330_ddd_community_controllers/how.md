# Technical Design & Architecture (How)

## Architecture Decisions

### 1. Aggregate Roots & Entities (Domain Layer)
We will complete the implementation of the Domain Layer within `packages/backend/src/domain/community/`:
- **`Category` Aggregate Root**: Represents a forum category.
  - Properties: `id`, `name`, `description`, `sortOrder`, `minLevel`, `createdAt`.
  - Exposes behaviors like `updateDetails(name, description, sortOrder)`, `changeMinLevel(level)`.
- **`Post` and `Comment`**: While full aggregates might be complex to extract in one go without breaking Prisma relations, we will manage their creation and interaction states via the Application Service to encapsulate the business logic.

### 2. Repositories (Infrastructure Layer)
- Define `ICategoryRepository` and `IEngagementRepository` (for upvotes/bookmarks) contracts in the domain layer.
- Implement `PrismaCategoryRepository` and `PrismaEngagementRepository` in `packages/backend/src/infrastructure/repositories/` to handle the Object-Relational Mapping for categories and engagements.

### 3. Application Services (Application Layer)
- Create the **`CommunityApplicationService`** in `packages/backend/src/application/community/CommunityApplicationService.ts`.
- This service will orchestrate all write operations (Commands):
  - `createCategory`, `updateCategory`, `deleteCategory`
  - `createPost`, `updatePost`, `deletePost`
  - `createComment`, `updateComment`, `deleteComment`
  - `togglePostUpvote`, `togglePostBookmark`
  - `toggleCommentUpvote`, `toggleCommentBookmark`

## Security & Performance Mitigations
- **Authorization & Levels**: The `CommunityApplicationService` will inherently validate that a user's level meets the category's `minLevel` requirement before allowing them to post.
- **CQRS Implementation**: The retrieval operations (`getPosts`, `getComments`, `getCategories` in `routes/post.ts` and `routes/category.ts`) will remain optimized Prisma `findMany` queries (Reads), while all mutations (Writes) will be securely routed through the Application Service.