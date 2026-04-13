# Domain Context & Purpose (Why)

## Background
The current engagement features—namely `Upvote` and `Bookmark` for both Posts and Comments—are orchestrated via a single generic repository method (`togglePostUpvote`, `toggleCommentBookmark`, etc.). 
These repository methods execute direct `prisma.delete` or `prisma.create` queries, returning a raw boolean value. While highly performant, this violates Domain-Driven Design (DDD) principles: the application logic (the decision to create or delete an engagement based on its existence) is pushed down into the Infrastructure layer (the Repository), effectively acting as an Active Record script.

## Value Proposition
By extracting `PostUpvote`, `PostBookmark`, `CommentUpvote`, and `CommentBookmark` into standalone Domain Aggregates:
1. **Architectural Purity**: The Application Service will coordinate the business rules (checking if a Post is active, loading the engagement, and deleting or creating it).
2. **Scalability**: By utilizing Standalone Aggregates rather than nesting thousands of Upvotes inside a single `Post` Aggregate, the system maintains $O(1)$ memory usage and performance while remaining 100% DDD compliant.
3. **Future Extensibility**: If engagements need additional properties in the future (e.g., an upvote timestamp, upvote "weight" based on user level, or private/public bookmark folders), these properties will naturally fit into the explicit Domain Models.