# Active Session Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure that revoking an active session immediately invalidates its associated JWT tokens by tying every token to a specific database `Session` record.

**Architecture:** Modify the `finalizeAuth` helper to generate a `Session` in the DB first and embed its `sessionId` into the JWT payload. Update the authentication middleware and token refresh endpoints to verify the existence of this session. Consolidate `loginUser` to use `finalizeAuth`.

**Tech Stack:** Node.js, Express, Prisma, JSON Web Tokens (jsonwebtoken)

---

### Task 1: Update `finalizeAuth` Helper and Export It

**Files:**
- Modify: `packages/backend/src/controllers/auth.ts`

- [ ] **Step 1: Export and Modify `finalizeAuth`**

In `packages/backend/src/controllers/auth.ts`, find the `finalizeAuth` function. Make it exported, create the `Session` first, and then include its `id` in the JWT payloads.

```typescript
// Replace existing finalizeAuth with:
export const finalizeAuth = async (user: any, req: Request, res: Response) => {
  // Create Session first
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      ...(req.ip && { ipAddress: req.ip }),
      ...(req.headers['user-agent'] && { userAgent: req.headers['user-agent'] }),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });

  const accessToken = jwt.sign({ userId: user.id, role: user.role, sessionId: session.id }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, role: user.role, sessionId: session.id }, process.env.JWT_REFRESH_SECRET as string || process.env.JWT_SECRET as string, { expiresIn: '7d' });

  res.clearCookie('tempToken');

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({ message: 'Login successful', user: { id: user.id, username: user.username, role: user.role } });
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/controllers/auth.ts
git commit -m "feat(backend): link JWTs to DB sessions in finalizeAuth"
```

### Task 2: Use `finalizeAuth` in `loginUser`

**Files:**
- Modify: `packages/backend/src/controllers/register.ts`

- [ ] **Step 1: Update `loginUser`**

In `packages/backend/src/controllers/register.ts`, import `finalizeAuth` from `./auth`.

```typescript
import { finalizeAuth } from './auth';
```

In `loginUser`, replace the block of code that issues tokens directly (when `methods.length === 0`) with a call to `finalizeAuth`.

Find:
```typescript
    const accessToken = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_REFRESH_SECRET as string || process.env.JWT_SECRET as string, { expiresIn: '7d' });

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ message: 'Login successful', user: { id: user.id, username: user.username, role: user.role } });
```

Replace with:
```typescript
    await finalizeAuth(user, req, res);
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/controllers/register.ts
git commit -m "feat(backend): use finalizeAuth for standard login"
```

### Task 3: Enforce Session Validation in Middleware

**Files:**
- Modify: `packages/backend/src/middleware/auth.ts`

- [ ] **Step 1: Update `requireAuth`**

In `packages/backend/src/middleware/auth.ts`, update `requireAuth` to verify the session exists in the DB.

First, import `prisma`:
```typescript
import { prisma } from '../db';
```

Make `requireAuth` async, and check for `sessionId`:
```typescript
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token = req.cookies?.accessToken;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: missing token' });
    return;
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    
    // Check session validity
    if (decoded.sessionId) {
      const session = await prisma.session.findUnique({ where: { id: decoded.sessionId } });
      if (!session) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(401).json({ error: 'Session revoked or invalid' });
        return;
      }
    }
    
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (error) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

Update the routes file (`packages/backend/src/routes/user.ts` and others if needed) to ensure that `requireAuth` is awaited properly by Express (Express 5 handles async middleware, which this project uses: `"express": "^5.2.1"` in package.json). No route changes should be strictly necessary.

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/middleware/auth.ts
git commit -m "feat(backend): validate db session in auth middleware"
```

### Task 4: Enforce Session Validation on Token Refresh

**Files:**
- Modify: `packages/backend/src/controllers/register.ts`

- [ ] **Step 1: Update `refreshToken` endpoint**

In `packages/backend/src/controllers/register.ts`, update `refreshToken` to check `decoded.sessionId`.

```typescript
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string || process.env.JWT_SECRET as string) as any;

    if (decoded.sessionId) {
      const session = await prisma.session.findUnique({ where: { id: decoded.sessionId } });
      if (!session) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(401).json({ error: 'Session revoked or invalid' });
        return;
      }
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    if (user.status === 'BANNED') {
      res.status(403).json({ error: 'Account is banned' });
      return;
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, sessionId: decoded.sessionId }, 
      process.env.JWT_SECRET as string, 
      { expiresIn: '15m' }
    );

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({ message: 'Token refreshed successfully' });
  } catch (error) {
    console.error(error);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/controllers/register.ts
git commit -m "feat(backend): validate db session on token refresh"
```