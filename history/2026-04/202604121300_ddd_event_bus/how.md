# Technical Design & Architecture (How)

## Architecture Decisions

### 1. Event Bus Infrastructure (`domain/shared/events/`)
We will introduce generic interfaces for Domain Events and the Event Bus:
- **`IDomainEvent`**: A contract for all events (`eventName`, `occurredOn`).
- **`IEventBus`**: A contract for publishing events and subscribing to them.
- **`InMemoryEventBus`**: An implementation using Node.js's built-in `EventEmitter` to handle the pub/sub in memory synchronously.

### 2. Specific Domain Events
We will define the following concrete events in the `domain/shared/events/`:
- `PostApprovedEvent`: Emitted when a pending post is approved.
- `PostRejectedEvent`: Emitted when a pending post is rejected.
- `PostRepliedEvent`: Emitted when a new comment is added to a post.
- `CommentRepliedEvent`: Emitted when a new child comment replies to a parent comment.

### 3. Notification Aggregate & Context (`domain/notification/`)
- **`Notification` Aggregate Root**: Represents a single notification for a user.
  - Properties: `id`, `userId`, `type`, `title`, `content`, `relatedId`, `read`, `createdAt`.
  - Exposes behaviors like `markAsRead()`.
- **`INotificationRepository`**: The contract for persisting notifications.
- **`PrismaNotificationRepository`**: The infrastructure implementation.

### 4. Application Services (`application/notification/`)
- **`NotificationApplicationService`**: This service will act as an event handler (subscriber). It will listen to the `EventBus` for the above events and, upon receiving them, orchestrate the creation and persistence of `Notification` aggregates.

## Security & Performance Mitigations
- **Decoupled Error Handling**: The `InMemoryEventBus` should ideally catch errors in event handlers so that a failure in sending a notification does not crash or rollback the primary transaction (e.g., post approval).
- **Extensibility**: By making the `EventBus` an injected dependency in controllers (or Application Services), we make the entire system highly testable.