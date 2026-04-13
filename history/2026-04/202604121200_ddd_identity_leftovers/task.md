# Task List (Implementation Plan)

## Phase 1: Foundational Infrastructure (Domain Layer)
- [√] **Task 1.1**: Create `CaptchaChallenge` Aggregate Root class in `packages/backend/src/domain/identity/CaptchaChallenge.ts`, defining properties, factory methods, and the complex `verifyTrajectory` and `consume` invariant methods.
- [√] **Task 1.2**: Create `Passkey` Entity class in `packages/backend/src/domain/identity/Passkey.ts`, representing a WebAuthn credential.
- [√] **Task 1.3**: Create `ICaptchaChallengeRepository` and `IPasskeyRepository` interfaces in the domain layer.

## Phase 2: Repositories & Application Services (Infra & App Layer)
- [√] **Task 2.1**: Implement `PrismaCaptchaChallengeRepository` and `PrismaPasskeyRepository` in `packages/backend/src/infrastructure/repositories/` to handle the ORM mapping.
- [√] **Task 2.2**: Expand the existing `AuthApplicationService` in `packages/backend/src/application/identity/AuthApplicationService.ts` to orchestrate commands like `generateCaptcha`, `verifyCaptcha`, `registerUser`, `addPasskey`, and `deletePasskey`.

## Phase 3: Controller Refactoring (Refactoring the Presentation Layer)
- [√] **Task 3.1**: Refactor `packages/backend/src/controllers/captcha.ts` to replace direct `prisma.captchaChallenge.create/update` calls and the procedural verification logic with calls to the `AuthApplicationService`.
- [√] **Task 3.2**: Refactor `packages/backend/src/controllers/register.ts` to replace direct `prisma.user.create` and manual hashing/captcha consumption with a single call to `AuthApplicationService.registerUser`.
- [√] **Task 3.3**: Refactor `packages/backend/src/controllers/user.ts` (passkey endpoints) and `packages/backend/src/controllers/auth.ts` to delegate WebAuthn credential lifecycle management to the `AuthApplicationService`.

## Phase 4: Quality & Security Audit
- [√] **Task 4.1**: Execute a full-stack compilation check (`npx tsc --noEmit`) to verify interface mappings and type safety.
- [√] **Task 4.2**: Verify that all newly created classes and methods are annotated with the required JSDoc format (`Callers`, `Callees`, `Description`, `Keywords`) and employ modern, professional language.