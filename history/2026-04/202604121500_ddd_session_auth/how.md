# Technical Design & Architecture (How)

## Architecture Decisions

### 1. Aggregate Roots & Entities (Domain Layer)
- **`Session` Aggregate Root**: Represents a user login session.
  - Properties: `id`, `userId`, `expiresAt`, `createdAt`.
  - Exposes behaviors like `isExpired()`, `revoke()`.
- **`AuthChallenge` Aggregate Root**: Represents a WebAuthn or general authentication challenge.
  - Properties: `id`, `userId`, `challenge`, `type` (e.g., `REGISTRATION`, `AUTHENTICATION`, `SUDO`), `expiresAt`, `createdAt`.
  - Exposes behaviors like `isExpired()`, `validateForConsumption()`, `consume()`.

### 2. Repositories (Infrastructure Layer)
- Define `ISessionRepository` and `IAuthChallengeRepository` interfaces.
- Implement `PrismaSessionRepository` and `PrismaAuthChallengeRepository` in `packages/backend/src/infrastructure/repositories/`.
- Ensure that `PrismaUserRepository` is fully utilized for all user creation and updates within `AuthApplicationService.registerUser`.

### 3. Application Services (Application Layer)
- **`AuthApplicationService` Refactoring**:
  - Integrate `ISessionRepository`, `IAuthChallengeRepository`, and `IUserRepository` (dependency injection).
  - Centralize `createSession`, `revokeSession`, `revokeAllUserSessions`.
  - Centralize `generateAuthChallenge`, `consumeAuthChallenge`.
  - Refactor `registerUser` to use `User.create()` and `IUserRepository.save()`.
  - Centralize `addPasskey` to use `Passkey` aggregate and repository.

## Security & Performance Mitigations
- **CQRS Read vs. Write**: Session validation within the `AuthRequest` middleware (`auth.ts` middleware) will continue to perform lightweight database queries (Reads), whereas all mutations (logins, logouts, kicks, Sudo mode creation) will route exclusively through the Application Service (Writes).
- **Challenge Consumption Validation**: `AuthChallenge.validateForConsumption()` will throw errors if the challenge has expired, eliminating edge cases where stale Sudo challenges are consumed.