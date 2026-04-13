# Task List (Implementation Plan)

## Phase 1: Foundational Infrastructure (Domain Layer)
- [√] **Task 1.1**: Create `Session` and `AuthChallenge` Aggregate Roots in `packages/backend/src/domain/identity/Session.ts` and `packages/backend/src/domain/identity/AuthChallenge.ts`.
- [√] **Task 1.2**: Create `ISessionRepository` and `IAuthChallengeRepository` interfaces.

## Phase 2: Repositories & Application Services (Infra & App Layer)
- [√] **Task 2.1**: Implement `PrismaSessionRepository` and `PrismaAuthChallengeRepository` in `packages/backend/src/infrastructure/repositories/`.
- [√] **Task 2.2**: Refactor `AuthApplicationService` (`packages/backend/src/application/identity/AuthApplicationService.ts`) to inject the new repositories.
- [√] **Task 2.3**: Refactor `registerUser` inside `AuthApplicationService` to use `User.create` and `IUserRepository.save`.
- [√] **Task 2.4**: Centralize `createSession`, `revokeSession`, `revokeAllUserSessions`, `generateAuthChallenge`, and `consumeAuthChallenge` within `AuthApplicationService`.

## Phase 3: Controller Refactoring (Refactoring the Presentation Layer)
- [√] **Task 3.1**: Refactor `packages/backend/src/controllers/auth.ts` and `packages/backend/src/controllers/register.ts` to replace direct `prisma.session.create`, `prisma.session.deleteMany`, and `prisma.authChallenge.upsert` with `AuthApplicationService` methods.
- [√] **Task 3.2**: Refactor `packages/backend/src/controllers/sudo.ts` and `packages/backend/src/controllers/user.ts` to replace `prisma.authChallenge.create/delete` and `prisma.session.delete` with `AuthApplicationService`.
- [√] **Task 3.3**: Refactor `packages/backend/src/controllers/admin.ts` to replace `prisma.session.deleteMany` with `AuthApplicationService.revokeAllUserSessions` when banning or changing user roles/levels. Replace `prisma.categoryModerator.delete` and `prisma.routeWhitelist.create/update/delete` to completely purge Prisma mutations.

## Phase 4: Quality & Security Audit
- [√] **Task 4.1**: Execute a full-stack compilation check (`npx tsc --noEmit`) to verify interface mappings and type safety.
- [√] **Task 4.2**: Verify that all newly created classes and methods are annotated with the required JSDoc format (`Callers`, `Callees`, `Description`, `Keywords`) and employ modern, professional language.
- [√] **Task 4.3**: Perform `grep -rn -E "prisma\.[a-zA-Z0-9]*\.(create|update|delete|upsert)" packages/backend/src | grep -v "infrastructure/repositories"` to confirm 0 remaining direct database mutations (excluding `install.ts` and `audit.ts` if out of scope).