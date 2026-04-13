# Domain Context & Purpose (Why)

## Background
In our previous iterations, we successfully designed and implemented the Domain Models (e.g., `Post`, `Comment`, `Category`, `Engagement`) and the Application Layer (`CommunityApplicationService`) for the Community Bounded Context. 
However, the Presentation Layer—specifically `packages/backend/src/routes/post.ts` and the category management logic in `packages/backend/src/controllers/admin.ts`—was not fully integrated with these new architectural components. They continue to operate as Transaction Scripts, making direct calls to `prisma.post.create`, `prisma.comment.update`, etc., completely bypassing the Domain's business invariants.

## Value Proposition
By surgically refactoring the presentation layer to strictly use the `CommunityApplicationService`, we achieve:
1. **Architectural Purity (Strict DDD)**: The controllers will be stripped of business logic, serving only to parse HTTP requests and format HTTP responses.
2. **Centralized Business Rules**: All invariants (e.g., checking if a user's level is sufficient to post in a category, handling the `isModerated` state, updating engagement counters) will be exclusively managed by the Domain and Application layers.
3. **Elimination of Duplication**: The repetitive `toggleInteraction` helper in `routes/post.ts` and the scattered Prisma queries will be replaced by cohesive, semantic commands like `communityApplicationService.togglePostUpvote()`.