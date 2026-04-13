# Technical Design & Architecture (How)

## Architecture Decisions

### 1. Aggregate Roots & Entities (Domain Layer)
We will introduce two new Domain Entities within the `packages/backend/src/domain/identity/` directory to complement the existing `User` aggregate:
- **`CaptchaChallenge` Aggregate Root**: Represents a slider captcha challenge.
  - Properties: `id`, `targetPosition`, `verified`, `expiresAt`.
  - Exposes domain behaviors like `verifyTrajectory(dragPath, totalDragTime, finalPosition)` which encapsulates the bot-detection heuristics (linear trajectory, variance), and `consume()` to mark it as used.
- **`Passkey` Entity / Value Object**: Represents a WebAuthn credential linked to a user.
  - While it could be an Aggregate Root, it's intrinsically tied to a `User`. However, for managing registration challenges independently, it might be beneficial to manage it via the `AuthApplicationService` and a dedicated `IPasskeyRepository`.

### 2. Repositories (Infrastructure Layer)
- Define `ICaptchaChallengeRepository` and `IPasskeyRepository` contracts in the domain layer.
- Implement `PrismaCaptchaChallengeRepository` and `PrismaPasskeyRepository` in `packages/backend/src/infrastructure/repositories/` to handle the Object-Relational Mapping.

### 3. Application Services (Application Layer)
- Expand the existing `AuthApplicationService` in `packages/backend/src/application/identity/AuthApplicationService.ts` to orchestrate new commands:
  - `generateCaptcha()`: Creates and persists a new `CaptchaChallenge`.
  - `verifyCaptcha(id, dragPath, totalDragTime, finalPosition)`: Retrieves the challenge, evaluates the trajectory via the domain entity, and persists the verified status.
  - `registerUser(email, username, password, captchaId)`: Orchestrates the consumption of the captcha, hashing of the password, and creation of the `User` aggregate.
  - `addPasskey(...)` / `deletePasskey(...)`: Manages the lifecycle of a user's passkeys.

## Security & Performance Mitigations
- **Security Check (Invariants)**: By embedding the trajectory evaluation logic inside the `CaptchaChallenge` aggregate, we ensure that the complex mathematical heuristics cannot be accidentally bypassed by a flawed controller implementation. The `consume()` method ensures a captcha is strictly single-use.
- **CQRS Implementation**: Read operations for passkeys and sessions will remain performant, while the critical mutation logic (registration, verification) will flow entirely through the fortified `AuthApplicationService`.