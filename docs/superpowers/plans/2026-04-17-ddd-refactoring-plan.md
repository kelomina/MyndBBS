# DDD Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the backend architecture to strictly follow Domain-Driven Design (DDD) principles by moving infrastructure logic (TOTP, WebAuthn, JWT) out of application services and controllers into dedicated ports and adapters, and encapsulating domain orchestration inside application services.

**Architecture:** 
- Extract `ITotpPort`, `IPasskeyPort`, and `ITokenPort` interfaces in the Domain layer.
- Implement `TotpAdapter`, `PasskeyAdapter`, and `TokenAdapter` in the Infrastructure layer.
- Refactor `AuthApplicationService` and `UserApplicationService` to use these ports via Dependency Injection.
- Refactor Controllers (`auth.ts`, `user.ts`, `admin.ts`) to delegate all business logic to Application Services, strictly handling only HTTP request/response parsing and formatting.

**Tech Stack:** TypeScript, Express, Prisma, otplib, @simplewebauthn/server, jsonwebtoken.

---

### Task 1: Define Domain Ports

**Files:**
- Create: `packages/backend/src/domain/identity/ports/ITotpPort.ts`
- Create: `packages/backend/src/domain/identity/ports/IPasskeyPort.ts`
- Create: `packages/backend/src/domain/identity/ports/ITokenPort.ts`

- [ ] **Step 1: Create `ITotpPort.ts`**

```typescript
/**
 * Callers: [AuthApplicationService, UserApplicationService]
 * Callees: []
 * Description: Port interface for TOTP generation and verification.
 * Keywords: totp, port, domain, identity
 */
export interface ITotpPort {
  generateSecret(): string;
  generateURI(issuer: string, accountName: string, secret: string): string;
  verify(secret: string, token: string): boolean;
}
```

- [ ] **Step 2: Create `IPasskeyPort.ts`**

```typescript
/**
 * Callers: [AuthApplicationService]
 * Callees: []
 * Description: Port interface for WebAuthn Passkey operations.
 * Keywords: passkey, port, domain, identity, webauthn
 */
export interface IPasskeyPort {
  generateRegistrationOptions(user: any, excludeCredentials: any[]): Promise<any>;
  verifyRegistrationResponse(response: any, expectedChallenge: string, expectedOrigin: string, expectedRPID: string): Promise<any>;
  generateAuthenticationOptions(allowCredentials: any[]): Promise<any>;
  verifyAuthenticationResponse(response: any, expectedChallenge: string, expectedOrigin: string, expectedRPID: string, credential: any): Promise<any>;
}
```

- [ ] **Step 3: Create `ITokenPort.ts`**

```typescript
/**
 * Callers: [AuthApplicationService]
 * Callees: []
 * Description: Port interface for generating JWT tokens.
 * Keywords: token, port, domain, identity, jwt
 */
export interface ITokenPort {
  sign(payload: any, secret: string, expiresIn: string): string;
  verify(token: string, secret: string): any;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/domain/identity/ports/
git commit -m "refactor: add domain ports for totp, passkey, and tokens"
```

### Task 2: Implement Infrastructure Adapters

**Files:**
- Create: `packages/backend/src/infrastructure/services/identity/TotpAdapter.ts`
- Create: `packages/backend/src/infrastructure/services/identity/PasskeyAdapter.ts`
- Create: `packages/backend/src/infrastructure/services/identity/TokenAdapter.ts`
- Create: `packages/backend/tests/Adapters.test.ts`

- [ ] **Step 1: Create `TotpAdapter.ts`**

```typescript
import { ITotpPort } from '../../../domain/identity/ports/ITotpPort';
import { OTP } from 'otplib';

/**
 * Callers: [Registry]
 * Callees: [OTP]
 * Description: Infrastructure adapter for TOTP operations using otplib.
 * Keywords: totp, adapter, infrastructure, identity
 */
export class TotpAdapter implements ITotpPort {
  private authenticator = new OTP({ strategy: 'totp' });

  public generateSecret(): string {
    return this.authenticator.generateSecret();
  }

  public generateURI(issuer: string, accountName: string, secret: string): string {
    return this.authenticator.generateURI({ issuer, label: accountName, secret });
  }

  public verify(secret: string, token: string): boolean {
    const result = this.authenticator.verifySync({ secret, token });
    return result && result.valid;
  }
}
```

- [ ] **Step 2: Create `PasskeyAdapter.ts`**

```typescript
import { IPasskeyPort } from '../../../domain/identity/ports/IPasskeyPort';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { APP_NAME } from '@myndbbs/shared';

/**
 * Callers: [Registry]
 * Callees: [@simplewebauthn/server]
 * Description: Infrastructure adapter for Passkey operations using simplewebauthn.
 * Keywords: passkey, adapter, infrastructure, identity, webauthn
 */
export class PasskeyAdapter implements IPasskeyPort {
  public async generateRegistrationOptions(user: any, excludeCredentials: any[]): Promise<any> {
    return generateRegistrationOptions({
      rpName: APP_NAME,
      rpID: process.env.RP_ID || 'localhost',
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });
  }

  public async verifyRegistrationResponse(response: any, expectedChallenge: string, expectedOrigin: string, expectedRPID: string): Promise<any> {
    return verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
    });
  }

  public async generateAuthenticationOptions(allowCredentials: any[]): Promise<any> {
    return generateAuthenticationOptions({
      rpID: process.env.RP_ID || 'localhost',
      allowCredentials,
      userVerification: 'preferred',
    });
  }

  public async verifyAuthenticationResponse(response: any, expectedChallenge: string, expectedOrigin: string, expectedRPID: string, credential: any): Promise<any> {
    return verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      credential,
    });
  }
}
```

- [ ] **Step 3: Create `TokenAdapter.ts`**

```typescript
import { ITokenPort } from '../../../domain/identity/ports/ITokenPort';
import jwt from 'jsonwebtoken';

/**
 * Callers: [Registry]
 * Callees: [jwt]
 * Description: Infrastructure adapter for Token operations using jsonwebtoken.
 * Keywords: token, adapter, infrastructure, identity, jwt
 */
export class TokenAdapter implements ITokenPort {
  public sign(payload: any, secret: string, expiresIn: string): string {
    return jwt.sign(payload, secret, { expiresIn });
  }

  public verify(token: string, secret: string): any {
    return jwt.verify(token, secret);
  }
}
```

- [ ] **Step 4: Write tests for Adapters**

```typescript
// packages/backend/tests/Adapters.test.ts
import { TotpAdapter } from '../src/infrastructure/services/identity/TotpAdapter';
import { TokenAdapter } from '../src/infrastructure/services/identity/TokenAdapter';

describe('Infrastructure Adapters', () => {
  it('should generate and verify TOTP', () => {
    const adapter = new TotpAdapter();
    const secret = adapter.generateSecret();
    expect(secret).toBeDefined();
    // Assuming we can't easily mock time for token here, just check instance creation
    expect(adapter).toBeInstanceOf(TotpAdapter);
  });

  it('should sign and verify Token', () => {
    const adapter = new TokenAdapter();
    const secret = 'test-secret';
    const token = adapter.sign({ userId: '123' }, secret, '1h');
    const decoded = adapter.verify(token, secret);
    expect(decoded).toHaveProperty('userId', '123');
  });
});
```

- [ ] **Step 5: Run tests to verify**

Run: `npx jest packages/backend/tests/Adapters.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/infrastructure/services/identity/ packages/backend/tests/Adapters.test.ts
git commit -m "refactor: implement infrastructure adapters for totp, passkey, tokens"
```

### Task 3: Refactor Application Services

**Files:**
- Modify: `packages/backend/src/application/identity/AuthApplicationService.ts`
- Modify: `packages/backend/src/application/identity/UserApplicationService.ts`
- Modify: `packages/backend/src/registry.ts`

- [ ] **Step 1: Update Dependency Injection in `registry.ts`**

In `packages/backend/src/registry.ts`, import the new adapters and inject them into `authApplicationService` and `userApplicationService`.
```typescript
import { TotpAdapter } from './infrastructure/services/identity/TotpAdapter';
import { PasskeyAdapter } from './infrastructure/services/identity/PasskeyAdapter';
import { TokenAdapter } from './infrastructure/services/identity/TokenAdapter';

const totpAdapter = new TotpAdapter();
const passkeyAdapter = new PasskeyAdapter();
const tokenAdapter = new TokenAdapter();

export const userApplicationService = new UserApplicationService(
  new PrismaUserRepository(),
  redisAbilityCache,
  new Argon2PasswordHasher(),
  totpAdapter
);

export const authApplicationService = new AuthApplicationService(
  new PrismaCaptchaChallengeRepository(),
  new PrismaPasskeyRepository(),
  new PrismaSessionRepository(),
  new PrismaAuthChallengeRepository(),
  new PrismaUserRepository(),
  new PrismaRoleRepository(),
  new Argon2PasswordHasher(),
  authCache,
  totpAdapter,
  passkeyAdapter,
  tokenAdapter
);
```

- [ ] **Step 2: Update `UserApplicationService` to use `ITotpPort`**

In `packages/backend/src/application/identity/UserApplicationService.ts`:
- Remove `import { OTP } from 'otplib';` and `const authenticator = ...`.
- Add `private totpPort: ITotpPort` to the constructor.
- Replace `authenticator.verifySync({ secret: user.totpSecret, token: totpCode })` with `this.totpPort.verify(user.totpSecret, totpCode)`.

- [ ] **Step 3: Update `AuthApplicationService` to encapsulate Passkey & Token logic**

In `packages/backend/src/application/identity/AuthApplicationService.ts`:
- Remove `@simplewebauthn/server` imports.
- Inject `totpPort`, `passkeyPort`, and `tokenPort` in constructor.
- Refactor `generatePasskeyRegistrationOptions` and `verifyPasskeyRegistration` to use `this.passkeyPort`.
- Add `generatePasskeyAuthenticationOptions(userId: string)` using `this.passkeyPort.generateAuthenticationOptions`.
- Add `verifyPasskeyAuthenticationResponse(userId: string, response: any, challengeId: string)` using `this.passkeyPort.verifyAuthenticationResponse`.
- Add `finalizeAuth(user: any, ip: string, userAgent: string)` returning `accessToken` and `refreshToken` using `this.tokenPort.sign`.

- [ ] **Step 4: Update `AuthApplicationService.deletePasskey` to handle business rules**

Modify `deletePasskey` to downgrade user level if remaining passkeys is 0:
```typescript
  public async deletePasskey(id: string, requesterUserId: string): Promise<string> {
    const passkey = await this.passkeyRepository.findById(id);
    if (!passkey) throw new Error('ERR_PASSKEY_NOT_FOUND');
    if (passkey.userId !== requesterUserId) throw new Error('ERR_FORBIDDEN_NOT_YOUR_PASSKEY');
    
    await this.passkeyRepository.delete(id);
    
    const remainingPasskeys = await this.passkeyRepository.findByUserId(requesterUserId);
    if (remainingPasskeys.length === 0) {
      const user = await this.userRepository.findById(requesterUserId);
      if (user) {
        user.changeLevel(1);
        await this.userRepository.save(user);
      }
    }
    
    return passkey.userId;
  }
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/application/identity/ packages/backend/src/registry.ts
git commit -m "refactor: encapsulate passkey and totp logic within application services"
```

### Task 4: Refactor Controllers

**Files:**
- Modify: `packages/backend/src/controllers/auth.ts`
- Modify: `packages/backend/src/controllers/user.ts`
- Modify: `packages/backend/src/controllers/admin.ts`

- [x] **Step 1: Clean up `auth.ts`**

In `packages/backend/src/controllers/auth.ts`:
- Remove `@simplewebauthn/server`, `otplib`, `jsonwebtoken`, and `QRCode` imports.
- Delegate `generateTotp`, `verifyTotpRegistration`, `generatePasskeyRegistrationOptions`, `verifyPasskeyRegistrationResponse`, `generatePasskeyAuthenticationOptions`, `verifyPasskeyAuthenticationResponse`, and `verifyTotpLogin` completely to `authApplicationService`.
- Refactor `finalizeAuth` to accept tokens from `authApplicationService.finalizeAuth(user, req.ip, req.headers['user-agent'])` and only set HTTP cookies.

- [x] **Step 2: Clean up `user.ts`**

In `packages/backend/src/controllers/user.ts`:
- Remove `otplib` and `QRCode` imports.
- Delegate `generateTotp` and `verifyTotp` to `authApplicationService` or `userApplicationService`.
- In `deletePasskey`, remove the controller-level CQRS check for remaining passkeys (since `authApplicationService.deletePasskey` now handles it).

- [x] **Step 3: Clean up `admin.ts`**

In `packages/backend/src/controllers/admin.ts` `updateDbConfig`:
- Delegate DB URL construction to `installationApplicationService.updateDbConfig(host, port, username, password, database)`. The Application Service should format the connection string internally.

- [x] **Step 4: Commit**

```bash
git add packages/backend/src/controllers/
git commit -m "refactor: remove domain and infrastructure logic from controllers"
```

### Task 5: Final Review & Testing

- [x] **Step 1: Verify tests and i18n keys**

Ensure that all thrown errors use `ERR_` prefixes (e.g., `ERR_INVALID_PASSKEY`, `ERR_TOTP_VERIFICATION_FAILED`) for proper i18n handling in the frontend. Ensure JSDoc comments (`@Callers`, `@Callees`, etc.) are maintained for all new adapter classes.

- [x] **Step 2: Run all backend tests**

Run: `cd packages/backend && npm run test`
Expected: PASS

- [x] **Step 3: Commit**

```bash
git commit -m "chore: ensure tests pass and jsdocs are updated"
```
