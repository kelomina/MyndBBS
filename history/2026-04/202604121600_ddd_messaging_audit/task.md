# Task List (Implementation Plan)

## Phase 1: Foundational Infrastructure (Domain Layer)
- [ ] **Task 1.1**: Create `UserKey` Aggregate Root in `packages/backend/src/domain/messaging/UserKey.ts`.
- [ ] **Task 1.2**: Create `ConversationSetting` Aggregate Root in `packages/backend/src/domain/messaging/ConversationSetting.ts`.
- [ ] **Task 1.3**: Create `AuditLog` Aggregate Root in `packages/backend/src/domain/system/AuditLog.ts`.
- [ ] **Task 1.4**: Define repository interfaces `IUserKeyRepository`, `IConversationSettingRepository`, and `IAuditLogRepository`.

## Phase 2: Repositories & Application Services (Infra & App Layer)
- [ ] **Task 2.1**: Implement `PrismaUserKeyRepository`, `PrismaConversationSettingRepository`, and `PrismaAuditLogRepository` in `packages/backend/src/infrastructure/repositories/`.
- [ ] **Task 2.2**: Refactor `MessagingApplicationService` (`packages/backend/src/application/messaging/MessagingApplicationService.ts`) to inject the new repositories.
- [ ] **Task 2.3**: Update `uploadKeys` and `updateConversationSettings` in `MessagingApplicationService` to use domain entities and repositories instead of direct Prisma calls.
- [ ] **Task 2.4**: Refactor `packages/backend/src/lib/audit.ts` to replace `prisma.auditLog.create` with `AuditLog.create` and `IAuditLogRepository.save`.

## Phase 3: Controller Refactoring (Refactoring the Presentation Layer)
- [ ] **Task 3.1**: Update `packages/backend/src/controllers/message.ts` to instantiate `MessagingApplicationService` with the new repositories.
- [ ] **Task 3.2**: Check if `MessagingApplicationService.clearChat` directly uses Prisma for `ConversationSetting` checks, and if so, update it to use `IConversationSettingRepository.findByUsers()`.

## Phase 4: Quality & Security Audit
- [ ] **Task 4.1**: Execute a full-stack compilation check (`npx tsc --noEmit`) to verify interface mappings and type safety.
- [ ] **Task 4.2**: Ensure compliance with the strict JSDoc format (`Callers`, `Callees`, `Description`, `Keywords`) on all newly created or modified functions.
- [ ] **Task 4.3**: Perform `grep -rn -E "prisma\.[a-zA-Z0-9]*\.(create|update|delete|upsert)" packages/backend/src | grep -v "infrastructure/repositories" | grep -v "routes/install.ts"` to confirm 0 remaining direct database mutations.