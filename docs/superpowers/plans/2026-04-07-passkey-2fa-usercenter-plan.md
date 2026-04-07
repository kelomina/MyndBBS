# PassKey, 2FA, and User Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement forced 2FA during registration (Passkey or TOTP), secure login flow with 2FA, and a User Center page for profile, security, session management, and admin access.

**Architecture:** We will modify the Prisma schema to support TOTP and Sessions. Registration and Login endpoints will be split into a two-step process using temporary JWT tokens (`tempToken`). We will install `otplib` and `qrcode` for the backend, and `@simplewebauthn/browser` and `qrcode.react` for the frontend.

**Tech Stack:** Express, Prisma, Next.js, `@simplewebauthn`, `otplib`, `qrcode`, `argon2`

---

### Task 1: Update Database Schema & Install Dependencies

**Files:**
- Modify: `packages/backend/prisma/schema.prisma`
- Create: `packages/backend/prisma/migrations/...`

- [ ] **Step 1: Install new dependencies**

```bash
cd packages/backend
pnpm add otplib qrcode
pnpm add -D @types/qrcode
cd ../frontend
pnpm add @simplewebauthn/browser qrcode.react
```

- [ ] **Step 2: Update Prisma Schema**

Modify `packages/backend/prisma/schema.prisma`:
```prisma
model User {
  // ... existing fields
  totpSecret         String?
  isTotpEnabled      Boolean   @default(false)
  // ...
}

model Session {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ipAddress  String?
  userAgent  String?
  expiresAt  DateTime
  createdAt  DateTime @default(now())
}
```
Add `sessions Session[]` to `User` model.

- [ ] **Step 3: Generate Migration**

```bash
cd packages/backend
npx prisma migrate dev --name add_totp_and_sessions
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add totp and session models, install deps"
```

---

### Task 2: Implement Backend TOTP and Passkey Registration Endpoints

**Files:**
- Modify: `packages/backend/src/routes/auth.ts`
- Modify: `packages/backend/src/controllers/register.ts`
- Modify: `packages/backend/src/controllers/auth.ts`

- [ ] **Step 1: Update `registerUser` to issue a temporary token**

In `register.ts`, change `registerUser` to set a `tempToken` cookie instead of `accessToken`/`refreshToken`.
```typescript
const tempToken = jwt.sign({ userId: user.id, type: 'registration' }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
res.cookie('tempToken', tempToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
res.status(201).json({ message: 'User registered. Please complete 2FA.', user: { id: user.id, username: user.username, role: user.role } });
```

- [ ] **Step 2: Implement TOTP Generation Endpoint**

In `auth.ts` (controller), add `generateTotp` and `verifyTotpRegistration`. Use `otplib.authenticator.generateSecret()` and `qrcode.toDataURL()`. Update user with `totpSecret`. Verify with `otplib.authenticator.check()`. On success, set `isTotpEnabled = true`, remove `tempToken`, issue `accessToken` and `refreshToken`. Create a `Session` record.

- [ ] **Step 3: Implement Passkey Registration Endpoints**

In `auth.ts` (controller), add `generateRegistrationOptions` and `verifyRegistrationResponse`. Use `@simplewebauthn/server`. After successful verification, create `Passkey` record, remove `tempToken`, issue `accessToken`/`refreshToken`. Create a `Session` record.

- [ ] **Step 4: Expose routes in `auth.ts` (routes)**

```typescript
router.post('/totp/generate', generateTotp);
router.post('/totp/verify', verifyTotpRegistration);
router.get('/passkey/generate-registration-options', generateRegistrationOptions);
router.post('/passkey/verify-registration', verifyRegistrationResponse);
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src
git commit -m "feat: backend 2FA registration logic"
```

---

### Task 3: Implement Backend Login 2FA Flow

**Files:**
- Modify: `packages/backend/src/controllers/register.ts` (loginUser)
- Modify: `packages/backend/src/controllers/auth.ts`

- [x] **Step 1: Update `loginUser` to require 2FA**

In `register.ts`, change `loginUser`. If password is valid, check if `isTotpEnabled` or user has Passkeys. If yes, issue `tempToken` (type 'login') and return `{ requires2FA: true, methods: ['passkey', 'totp'] }`.

- [x] **Step 2: Implement TOTP Login Verification**

In `auth.ts` (controller), add `verifyTotpLogin`. Read `tempToken`, get user, check `otplib.authenticator.check(code, user.totpSecret)`. If valid, remove `tempToken`, issue `accessToken`/`refreshToken`. Create `Session`.

- [x] **Step 3: Implement Passkey Login Endpoints**

In `auth.ts` (controller), add `generateAuthenticationOptions` and `verifyAuthenticationResponse`. Upon success, remove `tempToken`, issue `accessToken`/`refreshToken`. Create `Session`.

- [x] **Step 4: Expose Login 2FA routes**

```typescript
router.post('/totp/login-verify', verifyTotpLogin);
router.get('/passkey/generate-authentication-options', generateAuthenticationOptions);
router.post('/passkey/verify-authentication', verifyAuthenticationResponse);
```

- [x] **Step 5: Commit**

```bash
git add packages/backend/src
git commit -m "feat: backend login 2FA flow"
```

---

### Task 4: Frontend Registration & Login Integration

**Files:**
- Modify: `packages/frontend/src/app/(auth)/register/page.tsx`
- Modify: `packages/frontend/src/app/(auth)/login/page.tsx`
- Create: `packages/frontend/src/components/TwoFactorSetup.tsx`
- Create: `packages/frontend/src/components/TwoFactorLogin.tsx`

- [ ] **Step 1: Implement `TwoFactorSetup` Component**

Checks `window.PublicKeyCredential`. If available, automatically triggers `@simplewebauthn/browser` `startRegistration()`. If unsupported or fails, fetches TOTP QR code and displays input for TOTP verification.

- [ ] **Step 2: Update Register Page**

Render `TwoFactorSetup` upon successful step 1 of registration.

- [ ] **Step 3: Implement `TwoFactorLogin` Component**

Upon receiving `requires2FA` from login, render this component. It should try `startAuthentication()` if passkeys are available. Also provide a fallback TOTP code input.

- [ ] **Step 4: Update Login Page**

Render `TwoFactorLogin` when step 1 of login returns `requires2FA`.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: frontend 2FA auth flows"
```

---

### Task 5: Backend User Center Endpoints

**Files:**
- Modify: `packages/backend/src/routes/auth.ts`
- Create: `packages/backend/src/controllers/user.ts`
- Modify: `packages/backend/src/index.ts` (add user routes)

- [ ] **Step 1: Implement Profile Update**

In `user.ts`, add `updateProfile` (update email, username, password). Requires authentication.

- [ ] **Step 2: Implement Session Management**

In `user.ts`, add `getSessions` and `revokeSession`. `getSessions` returns `prisma.session.findMany` for the user. `revokeSession` deletes a specific session ID.

- [ ] **Step 3: Expose User routes**

Create `user.routes.ts` or add to existing router. Secure with `authMiddleware`.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src
git commit -m "feat: backend user center endpoints"
```

---

### Task 6: Frontend User Center Page

**Files:**
- Create: `packages/frontend/src/app/u/settings/page.tsx`
- Create: `packages/frontend/src/components/ProfileSettings.tsx`
- Create: `packages/frontend/src/components/SecuritySettings.tsx`
- Create: `packages/frontend/src/components/SessionManagement.tsx`

- [ ] **Step 1: Build the Layout**

In `app/u/settings/page.tsx`, create tabs or a sidebar for Basic Profile, Security Settings, Session Management, and Activity. If user role is `ADMIN`, show a link to `/admin`.

- [ ] **Step 2: Profile Settings Component**

Form to update email, username, and password.

- [ ] **Step 3: Security Settings Component**

List Passkeys, option to add new Passkey. Display TOTP status (enabled/disabled), option to disable or re-enable.

- [ ] **Step 4: Session Management Component**

List active sessions. Button to revoke sessions.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: frontend user center page"
```
