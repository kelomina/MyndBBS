# Task List (Implementation Plan)

## Phase 1: Foundational Infrastructure (Domain Layer - Shared Events)
- [√] **Task 1.1**: Create `IDomainEvent` and `IEventBus` interfaces in `packages/backend/src/domain/shared/events/`.
- [√] **Task 1.2**: Create the specific domain events (`PostApprovedEvent`, `PostRejectedEvent`, `PostRepliedEvent`, `CommentRepliedEvent`) in `packages/backend/src/domain/shared/events/`.

## Phase 2: Foundational Infrastructure (Domain Layer - Notification Context)
- [√] **Task 2.1**: Create the `Notification` Aggregate Root class in `packages/backend/src/domain/notification/Notification.ts`.
- [√] **Task 2.2**: Create the `INotificationRepository` interface.

## Phase 3: Repositories & Application Services (Infra & App Layer)
- [√] **Task 3.1**: Implement `InMemoryEventBus` in `packages/backend/src/infrastructure/events/InMemoryEventBus.ts`.
- [√] **Task 3.2**: Implement `PrismaNotificationRepository` in `packages/backend/src/infrastructure/repositories/`.
- [√] **Task 3.3**: Create `NotificationApplicationService` in `packages/backend/src/application/notification/NotificationApplicationService.ts`. Register it as a subscriber to the `EventBus` to handle the defined domain events.

## Phase 4: Controller Refactoring (Refactoring the Presentation Layer)
- [√] **Task 4.1**: Refactor `packages/backend/src/controllers/moderation.ts` to remove `sendNotification` and instead publish `PostApprovedEvent` and `PostRejectedEvent` via an injected `EventBus`.
- [√] **Task 4.2**: Refactor `packages/backend/src/routes/post.ts` to remove `sendNotification` and instead publish `PostRepliedEvent` and `CommentRepliedEvent` via the `EventBus`.
- [√] **Task 4.3**: Delete the legacy `lib/notification.ts` file, completing the removal of the hardcoded notification system.

## Phase 5: Quality & Security Audit
- [√] **Task 5.1**: Execute a full-stack compilation check (`npx tsc --noEmit`) to verify interface mappings and type safety.
- [√] **Task 5.2**: Verify that all newly created classes and methods are annotated with the required JSDoc format (`Callers`, `Callees`, `Description`, `Keywords`) and employ modern, professional language.