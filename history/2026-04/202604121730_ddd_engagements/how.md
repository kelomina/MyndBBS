# Technical Design & Architecture (How)

## Architecture Decisions

### 1. Aggregate Roots & Entities (Community Domain)
We will introduce 4 highly-cohesive, standalone Aggregate Roots representing user engagements in the `packages/backend/src/domain/community/` directory:
- **`PostUpvote`**: `userId`, `postId`, `createdAt`
- **`PostBookmark`**: `userId`, `postId`, `createdAt`
- **`CommentUpvote`**: `userId`, `commentId`, `createdAt`
- **`CommentBookmark`**: `userId`, `commentId`, `createdAt`

### 2. Repositories (Infrastructure Layer)
- Refactor `IEngagementRepository.ts` to utilize these new Aggregate Roots instead of executing an internal `toggle()` boolean script.
- Interface updates:
  - `findPostUpvote(postId, userId): Promise<PostUpvote | null>`
  - `savePostUpvote(upvote: PostUpvote): Promise<void>`
  - `deletePostUpvote(postId, userId): Promise<void>`
  - (Repeat similar interfaces for `PostBookmark`, `CommentUpvote`, `CommentBookmark`).
- Implement the refactored `PrismaEngagementRepository`. The logic is split into explicit read/save/delete Prisma calls.

### 3. Application Services (Application Layer)
- Update `CommunityApplicationService.ts`.
- The Application Service will now be responsible for the logic of checking the Post's state (e.g., verifying it exists before engaging), retrieving the engagement state from the repository, and then explicitly creating and saving, or explicitly deleting the engagement aggregate.
- The service methods (`togglePostUpvote`, etc.) will still return a boolean (e.g., `true` if upvoted, `false` if removed) for the Controller's DTO requirement, but the actual decision-making resides in the Application Service, fulfilling DDD requirements.

## Security & Performance Mitigations
- Extracting these into separate aggregates prevents loading a single `Post` Aggregate along with its 100,000 Upvote entities into the Node.js memory. This ensures optimal performance while still fully embracing DDD.
- Database unique constraints (`userId_postId`, `userId_commentId`) ensure consistency in concurrent scenarios.