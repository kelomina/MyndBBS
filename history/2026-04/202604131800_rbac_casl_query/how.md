# Technical Design & Architecture (How)

## Architecture Decisions

### 1. New Query Service (`AccessControlQueryService`)
- Responsible solely for querying the database (via Prisma) and returning serializable DTOs (`AbilityRulesDTO`).
- Implements Redis caching at the user level (`ability_rules:user:{userId}`).
- Parses the database string `Permission.action` (formatted as `action:subject`) into structural rule descriptors.

### 2. DTO Serialization
- Defines `AccessContextDTO` (user context info) and `AbilityRulesDTO` (raw rules array) in `packages/backend/src/queries/identity/dto.ts`.
- The output of the Query Service is strictly `AbilityRulesDTO`, ensuring it contains no Domain Entities.

### 3. CASL Builder Refactoring (`casl.ts`)
- Decouples `defineAbilityFor` from database queries.
- Changes the signature to accept the `AccessContextDTO` and `AbilityRulesDTO`.
- Implements fallback/baseline rules for guest/user levels directly inside the pure function builder.

### 4. Middleware Updates (`auth.ts`)
- In `requireAuth` and `optionalAuth`, the middleware will now call the `AccessControlQueryService` to fetch the rules DTO (often hitting Redis cache).
- It will then pass the DTO into the refactored `casl.ts` pure function to mount the `AppAbility` onto the `req` object.

### 5. Cache Invalidation
- Modifies `RoleApplicationService` (in the write model) to aggressively invalidate the Redis cache (`ability_rules:user:{userId}`) whenever an administrator updates user roles or modifies role permissions.

## Security & Performance Mitigations
- The `action:subject` parsing will fail-closed on malformed permission strings.
- Redis caching with a TTL ensures stale permissions naturally flush out, preventing authorization persistence bugs.
- Caching at the user level minimizes read query fan-outs for complex Role+Level logic.