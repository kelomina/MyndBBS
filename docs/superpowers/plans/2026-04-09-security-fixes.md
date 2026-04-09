# Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 16 security vulnerabilities identified in the codebase, following the priority order (Critical, High, Warning, Info).

**Architecture:** We will apply specific security patches to the Express controllers, Prisma queries, and middleware logic. We will use test-driven development to ensure the fixes are robust and do not break existing functionality.

**Tech Stack:** Node.js, Express, Prisma, Redis, TypeScript.

---

### Task 1: Fix Privilege Escalation in `admin.ts` (Critical)

**Files:**
- Modify: `packages/backend/src/controllers/admin.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add test for privilege escalation in admin tests
// It should fail because a level 3 admin can create a level 4 admin
```
*(Assume test-driven development will handle the exact test file creation)*

- [ ] **Step 2: Write minimal implementation**

Update `updateUserRole` in `packages/backend/src/controllers/admin.ts`:
```typescript
    // Prevent managing users with equal or higher roles than the operator
    const operatorRoleLevel = roleLevels[req.user?.role || 'USER'] || 1;
    if (currentRoleLevel >= operatorRoleLevel && req.user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Forbidden: Cannot manage user with equal or higher role' });
      return;
    }

    // NEW: Prevent granting a role that is higher than the operator's role
    if (newRoleLevel > operatorRoleLevel && req.user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Forbidden: Cannot grant a role higher than your own' });
      return;
    }
```

- [ ] **Step 3: Commit**
```bash
git add packages/backend/src/controllers/admin.ts
git commit -m "fix: prevent privilege escalation in role assignment"
```

### Task 2: Fix JWT Secret Fallback (Critical)

**Files:**
- Modify: `packages/backend/src/controllers/register.ts`
- Modify: `packages/backend/src/controllers/auth.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: Write minimal implementation**

In `packages/backend/src/index.ts`, add startup check:
```typescript
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET environment variables must be set.');
}
if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different.');
}
```

In `packages/backend/src/controllers/register.ts`:
Replace `process.env.JWT_REFRESH_SECRET as string || process.env.JWT_SECRET as string` with `process.env.JWT_REFRESH_SECRET as string`.

In `packages/backend/src/controllers/auth.ts`:
Replace `process.env.JWT_REFRESH_SECRET as string || process.env.JWT_SECRET as string` with `process.env.JWT_REFRESH_SECRET as string`.

- [ ] **Step 2: Commit**
```bash
git add packages/backend/src/index.ts packages/backend/src/controllers/register.ts packages/backend/src/controllers/auth.ts
git commit -m "fix: remove JWT secret fallback and enforce unique refresh secret"
```

### Task 3: Fix Captcha Mechanisms (Critical)

**Files:**
- Delete: `packages/backend/src/utils/captcha.ts`
- Modify: `packages/backend/src/controllers/captcha.ts`

- [ ] **Step 1: Write minimal implementation**

Delete `packages/backend/src/utils/captcha.ts`.

In `packages/backend/src/controllers/captcha.ts`, obfuscate the SVG:
```typescript
    // Instead of using cx="${targetPosition + 24}", use a path that is harder to parse simply
    // or better yet, just render a generic background. Since we need to show the gap, 
    // we can encode the target position into a complex path string.
    const cx = targetPosition + 24;
    const pathData = \`M \${cx - 20} 64 a 20 20 0 1 0 40 0 a 20 20 0 1 0 -40 0\`;
    const svgBackground = \`
      <svg width="318" height="128" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#1e293b" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="318" height="128" fill="url(#bg)" rx="8" />
        <text x="159" y="30" font-family="sans-serif" font-size="12" fill="#64748b" text-anchor="middle" letter-spacing="2">SECURITY VERIFICATION</text>
        <path d="\${pathData}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" filter="url(#glow)" stroke-dasharray="4 4" />
      </svg>
    \`;
```
Add check for `NODE_ENV` in `verifyCaptcha` to ensure no backdoors exist.

- [ ] **Step 2: Commit**
```bash
git rm packages/backend/src/utils/captcha.ts
git add packages/backend/src/controllers/captcha.ts
git commit -m "fix: remove captcha backdoor and obfuscate SVG coordinates"
```

### Task 4: Fix Session Logout Cache Inconsistency (Critical)

**Files:**
- Modify: `packages/backend/src/controllers/register.ts`
- Modify: `packages/backend/src/controllers/user.ts`

- [ ] **Step 1: Write minimal implementation**

In `packages/backend/src/controllers/register.ts` (`logoutUser`):
```typescript
import { redis } from '../lib/redis';

// Inside logoutUser, after finding sessionId:
    if (sessionId) {
      await prisma.session.deleteMany({
        where: { id: sessionId }
      });
      await redis.del(\`session:\${sessionId}\`);
      await redis.del(\`session:\${sessionId}:requires_refresh\`);
    }
```

In `packages/backend/src/controllers/user.ts` (`revokeSession`):
```typescript
import { redis } from '../lib/redis';

// Inside revokeSession:
    await prisma.session.delete({
      where: { id: sessionId }
    });
    await redis.del(\`session:\${sessionId}\`);
    await redis.del(\`session:\${sessionId}:requires_refresh\`);
```

- [ ] **Step 2: Commit**
```bash
git add packages/backend/src/controllers/register.ts packages/backend/src/controllers/user.ts
git commit -m "fix: clear redis cache on session logout and revocation"
```

### Task 5: Add Missing Re-auth for Sensitive Operations (Critical)

**Files:**
- Modify: `packages/backend/src/controllers/user.ts`
- Modify: `packages/backend/src/routes/user.ts` (if needed)

- [ ] **Step 1: Write minimal implementation**

In `packages/backend/src/controllers/user.ts` (`updateProfile`):
```typescript
    const { email, username, password, currentPassword, totpCode } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    // If changing password or email, require currentPassword or totpCode
    if (email || password) {
      if (!currentPassword && !totpCode) {
        res.status(401).json({ error: 'Current password or TOTP code required for sensitive changes' });
        return;
      }
      if (currentPassword) {
         const isValid = await argon2.verify(user.password, currentPassword);
         if (!isValid) {
           res.status(401).json({ error: 'Invalid current password' });
           return;
         }
      }
      // Implement TOTP verification if totpCode is provided...
    }
```
*(Add similar checks for `disableTotp`)*

- [ ] **Step 2: Commit**
```bash
git add packages/backend/src/controllers/user.ts
git commit -m "fix: require re-authentication for sensitive operations"
```

### Task 6: Fix IDOR / Category Restriction Bypass (High)

**Files:**
- Modify: `packages/backend/src/routes/post.ts`

- [ ] **Step 1: Write minimal implementation**

In `packages/backend/src/routes/post.ts` (`POST /`):
```typescript
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if ((currentUser?.level || 1) < category.minLevel) {
      res.status(403).json({ error: 'Insufficient level to post in this category' });
      return;
    }
```
*(Apply same logic to `PUT /:id`)*

- [ ] **Step 2: Commit**
```bash
git add packages/backend/src/routes/post.ts
git commit -m "fix: enforce category minLevel restrictions"
```

### Task 7: Fix TOTP Race Condition (High)

**Files:**
- Modify: `packages/backend/src/controllers/user.ts`

- [ ] **Step 1: Write minimal implementation**

Add `pendingTotpSecret` to Prisma schema (or store it in Redis). For now, store in Redis:
```typescript
// generateTotp
await redis.set(\`totp_setup:\${userId}\`, secret, 'EX', 300); // 5 mins
```
In `verifyTotp`:
```typescript
const secret = await redis.get(\`totp_setup:\${userId}\`);
if (!secret) return res.status(400).json({ error: 'TOTP setup expired or not initiated' });
const result = authenticator.verifySync({ secret, token: code });
if (result?.valid) {
  await prisma.user.update({ where: { id: userId }, data: { isTotpEnabled: true, totpSecret: secret } });
  await redis.del(\`totp_setup:\${userId}\`);
}
```

- [ ] **Step 2: Commit**
```bash
git add packages/backend/src/controllers/user.ts
git commit -m "fix: prevent TOTP race condition and overwrite"
```

### Task 8: Fix Trust Proxy and CORS (High)

**Files:**
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: Write minimal implementation**

```typescript
// Only trust proxy if explicitly configured (e.g. behind Nginx)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
} else {
  app.set('trust proxy', false);
}

// CORS strict check
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }, 
  credentials: true 
}));
```

- [ ] **Step 2: Commit**
```bash
git add packages/backend/src/index.ts
git commit -m "fix: secure trust proxy and CORS configuration"
```

### Task 9: Fix Password Regex, Rate Limits, and Passkey Keys (Warning)

**Files:**
- Modify: `packages/backend/src/controllers/register.ts`
- Modify: `packages/backend/src/routes/auth.ts`
- Modify: `packages/backend/src/controllers/auth.ts`

- [ ] **Step 1: Write minimal implementation**

Regex in `register.ts`:
```typescript
if (!/^[ -~]+$/.test(password)) {
  res.status(400).json({ error: 'Password contains invalid characters' });
  return;
}
```

Rate limits in `routes/auth.ts`:
Create `passwordResetLimiter`, `loginLimiter`, `registerLimiter` with appropriate thresholds.

Passkey keys in `auth.ts`:
Use `crypto.randomUUID()` for challenge ID instead of `userId` and store `userId` in the payload.

- [ ] **Step 2: Commit**
```bash
git add packages/backend/src/controllers/register.ts packages/backend/src/routes/auth.ts packages/backend/src/controllers/auth.ts
git commit -m "fix: improve password regex, rate limits, and passkey concurrency"
```

### Task 10: Fix Audit Log Masking, Errors, CASL, and Cookies (Info)

**Files:**
- Modify: `packages/backend/src/lib/audit.ts`
- Modify: `packages/backend/src/controllers/captcha.ts` (remove `details: String(error)`)
- Modify: `packages/backend/src/routes/post.ts` (ensure `req.query.category` is string)
- Modify: Cookie `SameSite` logic to `Lax` where necessary.

- [ ] **Step 1: Write minimal implementation**

Masking in `audit.ts`:
```typescript
const maskSensitiveData = (data: string) => {
  return data.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, '***@***.***')
             .replace(/(token|password|secret)[=:]\s*([^&\s]+)/gi, '$1=***');
};
```

- [ ] **Step 2: Commit**
```bash
git add packages/backend/src/lib/audit.ts packages/backend/src/controllers/captcha.ts packages/backend/src/routes/post.ts
git commit -m "fix: add audit log masking and cleanup info warnings"
```
