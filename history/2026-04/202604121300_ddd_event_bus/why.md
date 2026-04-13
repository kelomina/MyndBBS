# Domain Context & Purpose (Why)

## Background
Currently, the notification system relies on hardcoded, procedural function calls (`sendNotification`) scattered across various controllers and routes (e.g., `routes/post.ts`, `controllers/moderation.ts`). This creates a tight coupling between distinct domains (like Community or Moderation) and the Notification domain. 
For instance, when a moderator approves a post, the moderation controller directly calls the notification library. This violates the Single Responsibility Principle and the Open/Closed Principle.

## Value Proposition
By introducing a **Domain Event** architecture powered by an **Event Bus**:
1. **Decoupling**: The `Moderation` and `Community` contexts no longer need to know about the `Notification` context. They simply publish an event (e.g., `PostApprovedEvent`, `PostRepliedEvent`).
2. **Extensibility**: If we later want to add an email service or an audit logger that triggers on post approval, we simply add a new subscriber to the `EventBus` without modifying the moderation logic.
3. **Rich Domain Modeling**: The `Notification` becomes a proper Aggregate Root in its own Bounded Context, managing its own invariants (e.g., reading/archiving notifications).