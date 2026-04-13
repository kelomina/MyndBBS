# Technical Design & Architecture (How)

## Architecture Decisions

### 1. Aggregate Roots & Entities (Identity Domain)
We will treat `Role` and `Permission` as part of the **Identity Domain** (since they directly correlate with `User` access).
- **`Permission` Value Object / Entity**: Represents a single atomic capability in the system (e.g., `MANAGE_POSTS`).
  - Properties: `id`, `action`, `subject`, `conditions`.
- **`Role` Aggregate Root**: Represents a collection of permissions that define a user's capability level.
  - Properties: `id`, `name`, `description`, `permissions` (an array of Permission entities).
  - Exposes behaviors like `assignPermission(...)`, `revokePermission(...)`, `updateDetails(...)`.

### 2. Repositories (Infrastructure Layer)
- Define `IRoleRepository` and `IPermissionRepository` interfaces.
- Implement `PrismaRoleRepository` and `PrismaPermissionRepository` in `packages/backend/src/infrastructure/repositories/`.
  - `PrismaRoleRepository.save(role)` will persist the role details and safely orchestrate the `RolePermission` join table via Prisma transactions.

### 3. Application Services (Application Layer)
- Expand `UserApplicationService` or create a new `RoleApplicationService` (in `packages/backend/src/application/identity/RoleApplicationService.ts`).
  - Implement methods like `createRole`, `updateRole`, `assignPermissionToRole`, `revokePermissionFromRole`.

## Security & Performance Mitigations
- Read-heavy queries (e.g., middleware checking if a user has a specific permission) will continue to utilize fast Prisma lookups (`prisma.user.findUnique({ include: { role: { include: { permissions: true } } } })`) to construct the CASL ability objects, completely adhering to CQRS principles where Reads bypass the Domain layer for performance.
- Mutations (e.g., creating a new role or assigning permissions) will strictly flow through the Domain layer and Application Services to guarantee data integrity.