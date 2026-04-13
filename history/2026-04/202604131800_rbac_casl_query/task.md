# Task List (Implementation Plan)

## Phase 1: Foundational Infrastructure (Query DTOs)
- [√] **Task 1.1**: Create `packages/backend/src/queries/identity/dto.ts` defining `AccessContextDTO`, `RuleDescriptorDTO`, and `AbilityRulesDTO`.

## Phase 2: Query Service & Caching Implementation (Infra & Query Layer)
- [√] **Task 2.1**: Implement `AccessControlQueryService` in `packages/backend/src/queries/identity/AccessControlQueryService.ts`.
  - Step 1: Write `getAbilityRulesForUser` which queries `prisma.user` (including `role.permissions`).
  - Step 2: Implement Redis caching (`ability_rules:user:{userId}`) with a fallback to DB.
  - Step 3: Parse `Permission.action` strings (format `action:subject`) into an array of `RuleDescriptorDTO`.

## Phase 3: CASL Builder Refactoring (Core Logic)
- [√] **Task 3.1**: Refactor `packages/backend/src/lib/casl.ts`.
  - Step 1: Change `defineAbilityFor` to `defineAbilityForContext(context: AccessContextDTO, extraRules: RuleDescriptorDTO[])`.
  - Step 2: Remove direct `prisma` imports and async queries from this file to ensure it is a pure function.
  - Step 3: Implement baseline rules (e.g. basic user rights, moderator rules) and loop through `extraRules` to inject DB-driven capabilities (`can(rule.action, rule.subject)`).

## Phase 4: Middleware Integration (Presentation Layer)
- [√] **Task 4.1**: Refactor `packages/backend/src/middleware/auth.ts`.
  - Step 1: Instantiate `AccessControlQueryService`.
  - Step 2: In `requireAuth` and `optionalAuth`, after verifying the token, call `AccessControlQueryService.getAbilityRulesForUser(userId)`.
  - Step 3: Pass the returned DTO to `defineAbilityForContext` to attach `req.ability`.

## Phase 5: Cache Invalidation (Write Model Synchronization)
- [√] **Task 5.1**: Update `packages/backend/src/application/identity/RoleApplicationService.ts`.
  - Step 1: Inject Redis client and add cache invalidation logic (`redis.del(ability_rules:user:{userId})`) or role-based invalidation strategies when `assignPermissionToRole` or `revokePermissionFromRole` are called.
- [√] **Task 5.2**: Update `packages/backend/src/application/identity/UserApplicationService.ts`.
  - Step 1: Add cache invalidation logic for the user when their role or level changes.

## Phase 6: Quality & Security Audit
- [√] **Task 6.1**: Execute a full-stack compilation check (`npx tsc --noEmit`) to verify interface mappings and type safety.
- [√] **Task 6.2**: Verify that all newly created classes and methods are annotated with the required JSDoc format (`Callers`, `Callees`, `Description`, `Keywords`) and employ modern, professional language.