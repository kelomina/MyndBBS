# Backend Auth, Captcha & Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a secure backend with Argon2id password hashing, a server-side verified slider captcha, and admin management APIs (Users, Categories, Posts) using Prisma and Express.

**Architecture:** 
1. Prisma Schema updates to add Captcha, Categories, and Posts.
2. Express controllers for the Captcha generation and strict trajectory validation.
3. Express controllers for Auth (Register/Login) utilizing Argon2 and JWT.
4. Express controllers and router for Admin operations protected by JWT role-based middleware.

**Tech Stack:** Node.js, Express, Prisma (SQLite), `argon2`, `jsonwebtoken`.

---

### Task 1: Update Prisma Schema & Install Dependencies

**Files:**
- Modify: `packages/backend/package.json`
- Modify: `packages/backend/prisma/schema.prisma`

- [ ] **Step 1: Install new dependencies**
  Run: `cd packages/backend && pnpm add argon2 jsonwebtoken && pnpm add -D @types/jsonwebtoken`
  Expected: Installation succeeds.

- [ ] **Step 2: Update Schema**
  Modify `packages/backend/prisma/schema.prisma` to include the new models and update `User`.
  *(Replace the entire content with this)*
  ```prisma
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "sqlite" // Using sqlite for initial setup
    url      = env("DATABASE_URL")
  }

  enum Role {
    USER
    ADMIN
    MODERATOR
  }

  enum Status {
    ACTIVE
    BANNED
    PENDING
  }

  enum PostStatus {
    PUBLISHED
    HIDDEN
    PINNED
  }

  model User {
    id                 String    @id @default(uuid())
    email              String    @unique
    username           String    @unique
    password           String?   // Argon2 handles salt internally
    role               Role      @default(USER)
    status             Status    @default(ACTIVE)
    registeredIp       String?
    isPasskeyMandatory Boolean   @default(false)
    createdAt          DateTime  @default(now())
    updatedAt          DateTime  @updatedAt

    passkeys           Passkey[] 
    posts              Post[]
  }

  model Passkey {
    id             String   @id // CredentialID
    publicKey      Bytes
    userId         String
    user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    webAuthnUserID String
    counter        BigInt
    deviceType     String
    backedUp       Boolean
    createdAt      DateTime @default(now())
  }

  model CaptchaChallenge {
    id             String   @id @default(uuid())
    targetPosition Int
    verified       Boolean  @default(false)
    expiresAt      DateTime
    createdAt      DateTime @default(now())
  }

  model Category {
    id          String   @id @default(uuid())
    name        String   @unique
    description String?
    sortOrder   Int      @default(0)
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    posts       Post[]
  }

  model Post {
    id         String     @id @default(uuid())
    title      String
    content    String
    authorId   String
    author     User       @relation(fields: [authorId], references: [id])
    categoryId String
    category   Category   @relation(fields: [categoryId], references: [id])
    status     PostStatus @default(PUBLISHED)
    createdAt  DateTime   @default(now())
    updatedAt  DateTime   @updatedAt
  }
  ```

- [ ] **Step 3: Generate Prisma Client and Push DB**
  Run: `cd packages/backend && npx prisma generate && npx prisma db push --accept-data-loss`
  Expected: Prisma generates the client and updates the SQLite dev.db successfully.

- [ ] **Step 4: Commit**
  ```bash
  git add packages/backend/package.json packages/backend/prisma/schema.prisma
  git commit -m "feat(backend): update schema for captcha, categories, and posts; install argon2"
  ```

### Task 2: Implement Captcha API

**Files:**
- Create: `packages/backend/src/controllers/captcha.ts`
- Modify: `packages/backend/src/routes/auth.ts`

- [ ] **Step 1: Create Captcha Controller**
  Create `packages/backend/src/controllers/captcha.ts`:
  ```typescript
  import { Request, Response } from 'express';
  import { PrismaClient } from '@prisma/client';

  const prisma = new PrismaClient();

  export const generateCaptcha = async (req: Request, res: Response) => {
    try {
      // Assuming a track width of 300px and target width of 60px.
      // Position between 80 and 240
      const targetPosition = Math.floor(Math.random() * (240 - 80 + 1)) + 80;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const challenge = await prisma.captchaChallenge.create({
        data: {
          targetPosition,
          expiresAt
        }
      });

      res.json({ captchaId: challenge.id, targetPosition });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate captcha' });
    }
  };

  export const verifyCaptcha = async (req: Request, res: Response): Promise<void> => {
    try {
      const { captchaId, dragPath, totalDragTime, finalPosition } = req.body;

      if (!captchaId || !dragPath || !totalDragTime || finalPosition === undefined) {
        res.status(400).json({ success: false, error: 'Missing parameters' });
        return;
      }

      const challenge = await prisma.captchaChallenge.findUnique({
        where: { id: captchaId }
      });

      if (!challenge) {
        res.status(404).json({ success: false, error: 'Challenge not found' });
        return;
      }

      if (challenge.expiresAt < new Date()) {
        res.status(400).json({ success: false, error: 'Challenge expired' });
        return;
      }

      // Automation Check 1 & 2
      if (totalDragTime < 200 || dragPath.length < 8) {
        res.status(400).json({ success: false, error: 'Automation detected (Speed/Points)' });
        return;
      }

      // Automation Check 3: Variance
      let timeIntervals: number[] = [];
      for (let i = 1; i < dragPath.length; i++) {
        timeIntervals.push(dragPath[i].time - dragPath[i - 1].time);
      }
      
      const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
      const variance = timeIntervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / timeIntervals.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev < 1.5) {
        res.status(400).json({ success: false, error: 'Automation detected (Variance)' });
        return;
      }

      // Position Check
      const SLIDER_CENTER_OFFSET = 25; // 50 / 2
      const TARGET_CENTER_OFFSET = 30; // 60 / 2
      const VALIDATION_TOLERANCE = 35;

      const sliderCenter = finalPosition + SLIDER_CENTER_OFFSET;
      const targetCenter = challenge.targetPosition + TARGET_CENTER_OFFSET;
      const centerOffset = Math.abs(sliderCenter - targetCenter);

      if (centerOffset > VALIDATION_TOLERANCE) {
        res.status(400).json({ success: false, error: 'Position mismatch' });
        return;
      }

      // Mark as verified
      await prisma.captchaChallenge.update({
        where: { id: captchaId },
        data: { verified: true }
      });

      res.json({ success: true, message: 'Verification passed' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Server error during verification' });
    }
  };
  ```

- [ ] **Step 2: Mount Captcha Routes**
  Modify `packages/backend/src/routes/auth.ts` to include captcha endpoints:
  ```typescript
  import { Router } from 'express';
  import { generateRegisterChallenge } from '../controllers/auth';
  import { registerUser, loginUser } from '../controllers/register';
  import { generateCaptcha, verifyCaptcha } from '../controllers/captcha';

  const router: Router = Router();

  // Captcha
  router.get('/captcha', generateCaptcha);
  router.post('/captcha/verify', verifyCaptcha);

  // Auth
  router.post('/register', registerUser);
  router.post('/login', loginUser);
  router.post('/register/challenge', generateRegisterChallenge);

  export default router;
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add packages/backend/src/controllers/captcha.ts packages/backend/src/routes/auth.ts
  git commit -m "feat(backend): implement server-side slider captcha validation"
  ```

### Task 3: Implement Auth Controllers (Argon2 + JWT)

**Files:**
- Modify: `packages/backend/src/controllers/register.ts`
- Create: `packages/backend/src/middleware/auth.ts`

- [ ] **Step 1: Rewrite Register and Add Login Controller**
  Modify `packages/backend/src/controllers/register.ts` to use `argon2` and `jsonwebtoken`, and enforce Captcha validation during registration.
  ```typescript
  import { Request, Response } from 'express';
  import { PrismaClient } from '@prisma/client';
  import * as argon2 from 'argon2';
  import jwt from 'jsonwebtoken';

  const prisma = new PrismaClient();
  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

  export const registerUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, username, password, captchaId } = req.body;

      if (!email || !username || !password || !captchaId) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Verify Captcha
      const challenge = await prisma.captchaChallenge.findUnique({
        where: { id: captchaId }
      });

      if (!challenge || !challenge.verified || challenge.expiresAt < new Date()) {
        res.status(400).json({ error: 'Invalid, expired, or unverified captcha' });
        return;
      }

      // Check if user exists
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] }
      });

      if (existingUser) {
        res.status(400).json({ error: 'Email or username already in use' });
        return;
      }

      // Hash password with Argon2id
      const hashedPassword = await argon2.hash(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          username,
          password: hashedPassword
        }
      });

      // Cleanup captcha
      await prisma.captchaChallenge.delete({ where: { id: captchaId } });

      // Generate JWT
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({ message: 'User registered successfully', token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  export const loginUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.password) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      if (user.status === 'BANNED') {
        res.status(403).json({ error: 'Account is banned' });
        return;
      }

      const isValid = await argon2.verify(user.password, password);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

      res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  ```

- [ ] **Step 2: Create Auth Middleware**
  Create `packages/backend/src/middleware/auth.ts`:
  ```typescript
  import { Request, Response, NextFunction } from 'express';
  import jwt from 'jsonwebtoken';

  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

  export interface AuthRequest extends Request {
    user?: {
      userId: string;
      role: string;
    };
  }

  export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'ADMIN' && req.user.role !== 'MODERATOR') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }
    
    next();
  };
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add packages/backend/src/controllers/register.ts packages/backend/src/middleware/auth.ts
  git commit -m "feat(backend): implement argon2 auth and jwt middleware"
  ```

### Task 4: Implement Admin Controllers & Routes

**Files:**
- Create: `packages/backend/src/controllers/admin.ts`
- Create: `packages/backend/src/routes/admin.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: Create Admin Controller**
  Create `packages/backend/src/controllers/admin.ts`:
  ```typescript
  import { Request, Response } from 'express';
  import { PrismaClient } from '@prisma/client';

  const prisma = new PrismaClient();

  // Users
  export const getUsers = async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, email: true, role: true, status: true, createdAt: true }
    });
    res.json(users);
  };

  export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { role } = req.body;
    if (!['USER', 'ADMIN', 'MODERATOR'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    const user = await prisma.user.update({ where: { id }, data: { role } });
    res.json({ message: 'Role updated', user: { id: user.id, role: user.role } });
  };

  export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['ACTIVE', 'BANNED', 'PENDING'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const user = await prisma.user.update({ where: { id }, data: { status } });
    res.json({ message: 'Status updated', user: { id: user.id, status: user.status } });
  };

  // Categories
  export const getCategories = async (req: Request, res: Response) => {
    const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(categories);
  };

  export const createCategory = async (req: Request, res: Response) => {
    const { name, description, sortOrder } = req.body;
    const category = await prisma.category.create({
      data: { name, description, sortOrder: sortOrder || 0 }
    });
    res.status(201).json(category);
  };

  export const deleteCategory = async (req: Request, res: Response) => {
    const { id } = req.params;
    await prisma.category.delete({ where: { id } });
    res.json({ message: 'Category deleted' });
  };

  // Posts
  export const getPosts = async (req: Request, res: Response) => {
    const posts = await prisma.post.findMany({
      include: { author: { select: { username: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(posts);
  };

  export const updatePostStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['PUBLISHED', 'HIDDEN', 'PINNED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const post = await prisma.post.update({ where: { id }, data: { status } });
    res.json({ message: 'Post status updated', post });
  };
  ```

- [ ] **Step 2: Create Admin Router**
  Create `packages/backend/src/routes/admin.ts`:
  ```typescript
  import { Router } from 'express';
  import { requireAuth, requireAdmin } from '../middleware/auth';
  import {
    getUsers, updateUserRole, updateUserStatus,
    getCategories, createCategory, deleteCategory,
    getPosts, updatePostStatus
  } from '../controllers/admin';

  const router: Router = Router();

  // Protect all admin routes
  router.use(requireAuth);
  router.use(requireAdmin);

  // Users
  router.get('/users', getUsers);
  router.patch('/users/:id/role', updateUserRole);
  router.patch('/users/:id/status', updateUserStatus);

  // Categories
  router.get('/categories', getCategories);
  router.post('/categories', createCategory);
  router.delete('/categories/:id', deleteCategory);

  // Posts
  router.get('/posts', getPosts);
  router.patch('/posts/:id/status', updatePostStatus);

  export default router;
  ```

- [ ] **Step 3: Mount Admin Routes in Index**
  Modify `packages/backend/src/index.ts` to mount the admin router.
  *(Ensure imports are correct and `app.use('/api/admin', adminRoutes)` is added).*
  ```typescript
  import express from 'express';
  import cors from 'cors';
  import authRoutes from './routes/auth';
  import adminRoutes from './routes/admin';

  const app = express();
  const port = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add packages/backend/src/controllers/admin.ts packages/backend/src/routes/admin.ts packages/backend/src/index.ts
  git commit -m "feat(backend): implement admin APIs for users, categories, and posts"
  ```