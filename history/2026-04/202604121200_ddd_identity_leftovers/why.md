# Domain Context & Purpose (Why)

## Background
The core of the `Identity` context (the `User` aggregate) has been successfully refactored. However, the critical "edges" of identity management—specifically user registration (`controllers/register.ts`), Captcha challenge verification (`controllers/captcha.ts`), and WebAuthn/Passkey lifecycle management (`controllers/auth.ts` and `controllers/user.ts`)—remain implemented as procedural transaction scripts that directly interact with Prisma.

Currently, the registration controller manually validates the captcha status, hashes passwords, and creates users. The captcha controller contains complex bot-detection heuristics mixed with database updates. The WebAuthn logic is scattered across multiple routes.

## Value Proposition
By fully encapsulating these remaining identity concerns into the `Identity` Bounded Context, we achieve:
1. **Unbreakable Registration Invariants**: Registration logic (password strength, username uniqueness, captcha consumption) will be orchestrated by the `AuthApplicationService`, preventing any chance of bypassing security checks.
2. **Encapsulated Security Mechanisms**: `CaptchaChallenge` and `Passkey` will become distinct Domain Entities/Value Objects. The heuristics for detecting bots (linear trajectory, speed variance) will be encapsulated within the `CaptchaChallenge` aggregate, making the rules highly testable and decoupled from the HTTP layer.
3. **Purity of the Presentation Layer**: Controllers will be stripped of their business logic, returning to their true purpose: parsing HTTP requests and delegating to the Domain layer.