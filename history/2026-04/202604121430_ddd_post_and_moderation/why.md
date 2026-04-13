# Domain Context & Purpose (Why)

## Background
Currently, the `CommunityApplicationService` handles Post and Comment logic by wrapping direct `prisma.post.create/update` calls. While this successfully removed the transaction scripts from the Controllers (`routes/post.ts`), the Application Service itself became a transaction script. 
Furthermore, the `controllers/moderation.ts` and `controllers/admin.ts` still contain raw Prisma calls to handle moderation features (approving/rejecting posts, managing moderated words, and restoring deleted content).

## Value Proposition
By introducing the `Post`, `Comment`, and `ModeratedWord` Aggregate Roots:
1. **True Encapsulation**: Post state transitions (e.g., `PUBLISHED` -> `DELETED` -> `PUBLISHED`, `PENDING` -> `PUBLISHED`) will be managed exclusively inside the Domain Entity, eliminating scattered updates and ensuring valid state machine transitions.
2. **Single Source of Truth**: Moderation policies (like approving or rejecting a post) become domain methods (`post.approve()`, `post.reject()`) rather than arbitrary `update` queries.
3. **Decoupled Architecture**: Repositories will map these aggregates to the database, fulfilling the promise of 100% DDD in the Community and Moderation contexts.