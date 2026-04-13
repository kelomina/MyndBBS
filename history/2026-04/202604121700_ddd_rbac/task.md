# Task List (Implementation Plan)

## Phase 1: Foundational Infrastructure (Domain Layer)
- [√] **Task 1.1**: Create `Permission` Entity/Value Object in `packages/backend/src/domain/identity/Permission.ts`.
- [√] **Task 1.2**: Create `Role` Aggregate Root in `packages/backend/src/domain/identity/Role.ts`.
- [√] **Task 1.3**: Define repository interfaces `IPermissionRepository` and `IRoleRepository` inside `domain/identity/`.

## Phase 2: Repositories & Application Services (Infra & App Layer)
- [√] **Task 2.1**: Implement `PrismaPermissionRepository` and `PrismaRoleRepository` in `packages/backend/src/infrastructure/repositories/`.
  - Ensure `PrismaRoleRepository.save()` properly manages the many-to-many `RolePermission` relationship via Prisma transactions.
- [√] **Task 2.2**: Create a new `RoleApplicationService` (`packages/backend/src/application/identity/RoleApplicationService.ts`) to inject the new repositories.
  - Implement methods: `createRole`, `updateRole`, `assignPermissionToRole`, `revokePermissionFromRole`.

## Phase 3: Controller Refactoring & System Integration
- [√] **Task 3.1**: In `packages/backend/src/controllers/admin.ts`, instantiate `RoleApplicationService` alongside the other services.
- [√] **Task 3.2**: If there are any endpoints allowing admins to manage roles dynamically (none currently exist besides `install.ts`), route them to the new `RoleApplicationService`.

## Phase 4: Quality & Security Audit
- [√] **Task 4.1**: Execute a full-stack compilation check (`npx tsc --noEmit`) to verify interface mappings and type safety.
- [√] **Task 4.2**: Verify that all newly created classes and methods are annotated with the required JSDoc format (`Callers`, `Callees`, `Description`, `Keywords`) and employ modern, professional language.
- [√] **Task 4.3**: Ensure that all CQRS Read pathways (like `packages/backend/src/lib/casl.ts`) continue functioning efficiently without querying the domain models.