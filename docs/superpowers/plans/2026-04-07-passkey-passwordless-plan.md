# Passwordless Passkey Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement passwordless Passkey login allowing users to authenticate without typing their email first.

**Architecture:** The backend will be modified to generate anonymous WebAuthn challenges. The frontend will request these options, invoke the browser's WebAuthn dialog, and send the signature back to the backend for verification and login.

**Tech Stack:** Express, Prisma, Next.js, React, `@simplewebauthn/server`, `@simplewebauthn/browser`

---

### Task 1: Update Backend Authentication Options Generation

**Files:**
- Modify: `packages/backend/src/controllers/auth.ts`

- [ ] **Step 1: Modify `generatePasskeyAuthenticationOptions`**
Update the controller to support anonymous challenge generation when `tempToken` is not present.

```typescript
export const generatePasskeyAuthenticationOptions = async (req: Request, res: Response): Promise<void> => {
  const { tempToken } = req.cookies;
  
  let options;
  let challengeId;

  if (tempToken) {
    // 2FA flow
    const user = await getUserFromTempToken(req, 'login');
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userPasskeys = await prisma.passkey.findMany({ where: { userId: user.id } });
    options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        transports: ['internal'],
      })),
      userVerification: 'preferred',
    });
    challengeId = user.id;
  } else {
    // Passwordless flow
    options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [], // Prompt for all discoverable credentials
      userVerification: 'preferred',
    });
    challengeId = crypto.randomUUID();
  }

  // Store challenge
  await prisma.authChallenge.upsert({
    where: { id: challengeId },
    update: { challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    create: { id: challengeId, challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }
  });

  res.json({ ...options, challengeId });
};
```
Note: Ensure `crypto` is imported at the top (`import crypto from 'crypto';`).

- [ ] **Step 2: Commit changes**
```bash
git add packages/backend/src/controllers/auth.ts
git commit -m "feat(backend): support anonymous passkey challenge generation"
```

### Task 2: Update Backend Authentication Verification

**Files:**
- Modify: `packages/backend/src/controllers/auth.ts`

- [ ] **Step 1: Modify `verifyPasskeyAuthenticationResponse`**
Update the verification controller to handle both 2FA and passwordless flows.

```typescript
export const verifyPasskeyAuthenticationResponse = async (req: Request, res: Response): Promise<void> => {
  const { response, challengeId: bodyChallengeId } = req.body;
  const { tempToken } = req.cookies;
  
  let user;
  let challengeId;

  if (tempToken) {
    // 2FA flow
    user = await getUserFromTempToken(req, 'login');
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    challengeId = user.id;
  } else {
    // Passwordless flow
    if (!bodyChallengeId) {
      res.status(400).json({ error: 'Challenge ID is required for passwordless login' });
      return;
    }
    challengeId = bodyChallengeId;
  }

  const expectedChallenge = await prisma.authChallenge.findUnique({ where: { id: challengeId } });
  if (!expectedChallenge || expectedChallenge.expiresAt < new Date()) {
    res.status(400).json({ error: 'Challenge expired or not found' });
    return;
  }

  const passkey = await prisma.passkey.findUnique({ where: { id: response.id } });
  if (!passkey) {
    res.status(400).json({ error: 'Passkey not found' });
    return;
  }

  if (tempToken && passkey.userId !== user?.id) {
    res.status(400).json({ error: 'Passkey does not belong to user' });
    return;
  }

  // In passwordless flow, we find the user from the passkey
  if (!tempToken) {
    user = await prisma.user.findUnique({ where: { id: passkey.userId } });
    if (!user) {
      res.status(400).json({ error: 'User not found for this passkey' });
      return;
    }
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: expectedChallenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
      },
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
    return;
  }

  if (verification.verified && verification.authenticationInfo) {
    const { newCounter } = verification.authenticationInfo;
    
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(newCounter) }
    });

    await prisma.authChallenge.delete({ where: { id: challengeId } });

    await finalizeAuth(user, req, res);

    res.json({ message: 'Login successful', user: { id: user.id, username: user.username, role: user.role } });
  } else {
    res.status(400).json({ error: 'Verification failed' });
  }
};
```

- [ ] **Step 2: Commit changes**
```bash
git add packages/backend/src/controllers/auth.ts
git commit -m "feat(backend): support passwordless passkey verification"
```

### Task 3: Update Frontend LoginClient

**Files:**
- Modify: `packages/frontend/src/app/(auth)/login/LoginClient.tsx`

- [ ] **Step 1: Add simplewebauthn import**
Add the import at the top of the file.
```tsx
import { startAuthentication } from '@simplewebauthn/browser';
```

- [ ] **Step 2: Add Passkey Login Handler**
Add `handlePasskeyLogin` function inside `LoginClient`.
```tsx
  const handlePasskeyLogin = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. Get options from server
      const optionsRes = await fetch('/api/v1/auth/passkey/generate-authentication-options');
      const optionsData = await optionsRes.json();

      if (!optionsRes.ok) {
        throw new Error(optionsData.error || 'Failed to generate passkey options');
      }

      const { challengeId, ...options } = optionsData;

      // 2. Invoke WebAuthn
      let authResponse;
      try {
        authResponse = await startAuthentication(options);
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setError('Passkey authentication was cancelled.');
        } else {
          setError('Failed to authenticate with passkey. Ensure your device supports it.');
        }
        setLoading(false);
        return;
      }

      // 3. Verify response
      const verifyRes = await fetch('/api/v1/auth/passkey/verify-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResponse, challengeId })
      });

      const verifyData = await verifyRes.json();

      if (verifyRes.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError(verifyData.error || 'Passkey verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during passkey login');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 3: Attach Handler to Button**
Find the passkey button and update it:
```tsx
          <button 
            type="button"
            onClick={handlePasskeyLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-background transition-colors disabled:opacity-50"
          >
            <Fingerprint className="h-5 w-5 text-primary" />
            {dict.auth.signInWithPasskey}
          </button>
```

- [ ] **Step 4: Commit changes**
```bash
git add packages/frontend/src/app/\(auth\)/login/LoginClient.tsx
git commit -m "feat(frontend): implement passwordless passkey login"
```

