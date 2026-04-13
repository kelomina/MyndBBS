# Domain Context & Purpose (Why)

## Background
While the core business contexts (Community, Messaging) have been successfully migrated to a 100% pure Domain-Driven Design (DDD) and Command Query Responsibility Segregation (CQRS) architecture, the Identity context still harbors critical technical debt in its session and authentication workflows. Specifically:
1. **Session Management**: Controllers (`auth.ts`, `register.ts`, `admin.ts`, `user.ts`) and library functions (`lib/session.ts`) manipulate user sessions directly via `prisma.session.create` and `prisma.session.deleteMany`.
2. **Authentication Challenges**: High-privilege operations (WebAuthn, Passkeys, Sudo mode) directly create and delete challenges using `prisma.authChallenge.upsert` and `prisma.authChallenge.delete`.
3. **Registration Loophole**: The `AuthApplicationService.registerUser` method bypasses the Domain layer, creating users directly via `prisma.user.create` instead of utilizing the established `User` Aggregate Root and `IUserRepository`.

## Value Proposition
By extracting `Session` and `AuthChallenge` into true Domain Aggregates and fully refactoring the `AuthApplicationService`:
1. **Architectural Purity**: The system will achieve 100% DDD compliance, centralizing all authentication invariant logic (e.g., challenge expiry, session lifecycle).
2. **Enhanced Security**: Centralized session creation and revocation through the Domain layer prevents accidental bypasses or inconsistent state changes across scattered controllers.
3. **Code Reusability**: Common operations like "revoke all sessions for a user" or "generate and validate a WebAuthn challenge" become explicit, reusable domain behaviors rather than duplicated transaction scripts.