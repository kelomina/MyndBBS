# Task List (Implementation Plan)

## Phase 1: Identity Context (User Aggregate)
- [√] **Task 1.1**: Create `User` Aggregate Root in `packages/backend/src/domain/identity/User.ts`. It will encapsulate `email`, `username`, `password`, `level`, `roleId`, `status`, `isTotpEnabled`, `totpSecret`, `isPasskeyMandatory`.
- [√] **Task 1.2**: Create `IUserRepository` interface in `packages/backend/src/domain/identity/IUserRepository.ts`.
- [√] **Task 1.3**: Implement `PrismaUserRepository` in `packages/backend/src/infrastructure/repositories/`.
- [√] **Task 1.4**: Create `UserApplicationService` in `packages/backend/src/application/identity/UserApplicationService.ts` to orchestrate `updateProfile`, `enableTotp`, `disableTotp`, and level syncs.
- [√] **Task 1.5**: Refactor `packages/backend/src/controllers/user.ts` and `packages/backend/src/controllers/admin.ts` to use `UserApplicationService` instead of `prisma.user.update`.

## Phase 2: Messaging Context (Friendship & Private Message)
- [√] **Task 2.1**: Create `Friendship` Aggregate Root in `packages/backend/src/domain/messaging/Friendship.ts`.
- [√] **Task 2.2**: Create `PrivateMessage` Aggregate Root in `packages/backend/src/domain/messaging/PrivateMessage.ts`.
- [√] **Task 2.3**: Create `IFriendshipRepository` and `IPrivateMessageRepository` interfaces.
- [√] **Task 2.4**: Implement `PrismaFriendshipRepository` and `PrismaPrivateMessageRepository`.
- [√] **Task 2.5**: Create `MessagingApplicationService` in `packages/backend/src/application/messaging/MessagingApplicationService.ts` to orchestrate friend requests and private messages.
- [√] **Task 2.6**: Refactor `packages/backend/src/controllers/friend.ts` and `packages/backend/src/controllers/message.ts` to replace all `prisma.create/update` calls with `MessagingApplicationService`.

## Phase 3: Quality & Security Audit
- [√] **Task 3.1**: Execute `npx tsc --noEmit` to verify type safety.
- [√] **Task 3.2**: Add JSDoc annotations with `Callers`, `Callees`, `Description`, `Keywords`.