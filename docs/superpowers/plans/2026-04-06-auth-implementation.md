# MyndBBS Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement WebAuthn (Passkey) and JWT-based authentication system with email verification for MyndBBS.

**Architecture:** Express backend handling WebAuthn challenges and verification, issuing JWT Access Tokens and HttpOnly Refresh Tokens. Prisma ORM for User and Passkey models.

**Tech Stack:** Node.js, Express, Prisma, `@simplewebauthn/server`, `jsonwebtoken`, `nodemailer` (or similar for email), `redis` (for OTP).

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `packages/backend/prisma/schema.prisma`

- [ ] **Step 1: Add User, Passkey, and Enum models**

Update `packages/backend/prisma/schema.prisma` to include the Auth models:

```prisma
// packages/backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite" // Using sqlite for initial setup, change to mysql later if needed
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

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  username      String    @unique
  passwordHash  String?   
  passwordSalt  String?
  role          Role      @default(USER)
  status        Status    @default(ACTIVE)
  registeredIp  String?
  isPasskeyMandatory Boolean @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  passkeys      Passkey[] 
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
```

- [ ] **Step 2: Generate Prisma Client**

```bash
cd packages/backend
npx prisma generate
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/prisma/schema.prisma
git commit -m "feat(auth): add user and passkey prisma models"
```

### Task 2: Setup Shared Auth Types & Validations

**Files:**
- Create: `packages/shared/src/types/auth.ts`
- Create: `packages/shared/src/utils/validations.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Define Shared Auth Types**

`packages/shared/src/types/auth.ts`:
```typescript
export interface JwtPayload {
  userId: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
  }
}

export interface RegisterRequest {
  email: string;
  username: string;
  passwordHash?: string; // Optional only for pure passwordless accounts (future-proofing)
  captchaToken: string;
  supportsWebAuthn: boolean;
}
```

- [ ] **Step 2: Add Strict Password Regex**

`packages/shared/src/utils/validations.ts`:
```typescript
// Minimum 8 characters, at least one uppercase, one lowercase, one number and one special character
export const STRICT_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const isValidPassword = (password: string): boolean => {
  return STRICT_PASSWORD_REGEX.test(password);
};
```

- [ ] **Step 3: Export in index**

Modify `packages/shared/src/index.ts`:
```typescript
export * from './constants'
export * from './types/auth'
export * from './utils/validations'
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/auth.ts packages/shared/src/utils/validations.ts packages/shared/src/index.ts
git commit -m "feat(auth): add auth types and strict password validation regex"
```

### Task 3: Setup JWT and Auth Middleware

**Files:**
- Create: `packages/backend/src/utils/jwt.ts`
- Create: `packages/backend/src/middlewares/auth.ts`
- Modify: `packages/backend/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd packages/backend
pnpm add jsonwebtoken cookie-parser
pnpm add -D @types/jsonwebtoken @types/cookie-parser
```

- [ ] **Step 2: Create JWT Utility**

`packages/backend/src/utils/jwt.ts`:
```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'super-refresh-secret-change-in-prod';

export const generateTokens = (userId: string, role: string) => {
  const accessToken = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId, role }, REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET) as { userId: string, role: string };
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string, role: string };
};
```

- [ ] **Step 3: Create Auth Middleware**

`packages/backend/src/middlewares/auth.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; role: string };
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ code: 401, message: 'Unauthorized: Invalid token' });
  }
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/utils/jwt.ts packages/backend/src/middlewares/auth.ts packages/backend/package.json
git commit -m "feat(auth): setup jwt utility and auth middleware"
```

### Task 5: Implement Captcha and Password Hashing Utilities

**Files:**
- Create: `packages/backend/src/utils/crypto.ts`
- Create: `packages/backend/src/utils/captcha.ts`

- [ ] **Step 1: Create Crypto Utility (SHA-512 + 8-byte Salt)**

`packages/backend/src/utils/crypto.ts`:
```typescript
import crypto from 'crypto';

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
};

export const verifyPassword = (password: string, hash: string, salt: string) => {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};
```

- [ ] **Step 2: Create Captcha Verification Service (Plugin pattern)**

`packages/backend/src/utils/captcha.ts`:
```typescript
// Plugin pattern for captcha validation
export const verifyCaptcha = async (token: string, ip: string): Promise<boolean> => {
  // TODO: Integrate actual provider like Turnstile or reCAPTCHA here
  // For development/testing, accept a mocked token 'valid-captcha-token'
  if (process.env.NODE_env !== 'production' && token === 'valid-captcha-token') {
    return true;
  }
  
  // Real verification logic goes here
  return false;
};
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/utils/crypto.ts packages/backend/src/utils/captcha.ts
git commit -m "feat(auth): add sha-512 hashing and captcha verification plugin"
```

### Task 6: Implement IP Check and Registration Logic

**Files:**
- Create: `packages/backend/src/controllers/register.ts`
- Modify: `packages/backend/src/routes/auth.ts`

- [ ] **Step 1: Create Register Controller with IP Limit and Captcha**

`packages/backend/src/controllers/register.ts`:
```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { isValidPassword } from '@myndbbs/shared';
import { hashPassword } from '../utils/crypto';
import { verifyCaptcha } from '../utils/captcha';

const prisma = new PrismaClient();
const MAX_ACCOUNTS_PER_IP = 3;

export const registerUser = async (req: Request, res: Response) => {
  const { email, username, password, captchaToken, supportsWebAuthn } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';

  if (!email || !username || !captchaToken || supportsWebAuthn === undefined) {
    return res.status(400).json({ code: 400, message: 'Missing required fields' });
  }

  // Verify Captcha
  const isCaptchaValid = await verifyCaptcha(captchaToken, ip);
  if (!isCaptchaValid) {
    return res.status(403).json({ code: 403, message: 'Invalid captcha token' });
  }

  // Password is required for all new registrations (Cross-device fallback)
  if (!password) {
    return res.status(400).json({ code: 400, message: 'Password is required' });
  }
  
  if (!isValidPassword(password)) {
    return res.status(400).json({ code: 400, message: 'Password does not meet strict requirements' });
  }

  try {
    // Check IP limits
    const ipAccountCount = await prisma.user.count({
      where: { registeredIp: ip }
    });

    if (ipAccountCount >= MAX_ACCOUNTS_PER_IP) {
      return res.status(403).json({ code: 403, message: 'Maximum accounts reached for this IP' });
    }

    // Check if email/username exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      return res.status(409).json({ code: 409, message: 'Email or username already exists' });
    }

    const { hash: passwordHash, salt: passwordSalt } = hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash, // Saved even if Passkey is supported
        passwordSalt,
        registeredIp: ip,
        isPasskeyMandatory: supportsWebAuthn // Flag to prompt Passkey on compatible devices
      }
    });

    if (supportsWebAuthn) {
      // Logic to trigger Passkey registration challenge will go here
      return res.status(201).json({ 
        code: 0, 
        message: 'User registered, proceed to Passkey and 2FA setup', 
        data: { userId: newUser.id, requirePasskeySetup: true } 
      });
    }

    res.status(201).json({ code: 0, message: 'User registered, proceed to 2FA setup', data: { userId: newUser.id } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
};
```

- [ ] **Step 2: Update Auth Routes**

Modify `packages/backend/src/routes/auth.ts`:
```typescript
import { Router } from 'express';
import { generateRegisterChallenge } from '../controllers/auth';
import { registerUser } from '../controllers/register';

const router = Router();

router.post('/register', registerUser);
router.post('/register/challenge', generateRegisterChallenge);

export default router;
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/controllers/register.ts packages/backend/src/routes/auth.ts
git commit -m "feat(auth): implement strict password, IP limits, and captcha for registration"
```

**Files:**
- Create: `packages/backend/src/routes/auth.ts`
- Create: `packages/backend/src/controllers/auth.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: Install WebAuthn dependencies**

```bash
cd packages/backend
pnpm add @simplewebauthn/server
```

- [ ] **Step 2: Create Auth Controller (Mocked Logic)**

`packages/backend/src/controllers/auth.ts`:
```typescript
import { Request, Response } from 'express';
import { generateRegistrationOptions } from '@simplewebauthn/server';

const rpName = 'MyndBBS';
const rpID = 'localhost'; // Should be domain in prod
const origin = `http://${rpID}:3000`;

// Mock in-memory store for challenges
const userChallenges: { [userId: string]: string } = {};

export const generateRegisterChallenge = async (req: Request, res: Response) => {
  const { email, username } = req.body;
  
  if (!email || !username) {
    return res.status(400).json({ code: 400, message: 'Email and username required' });
  }

  // Mock user ID generation for challenge
  const mockUserId = 'user-' + Date.now();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new Uint8Array(Buffer.from(mockUserId)),
    userName: username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  userChallenges[mockUserId] = options.challenge;

  res.json({ 
    code: 0, 
    message: 'Challenge generated', 
    data: { options, mockUserId } 
  });
};
```

- [ ] **Step 3: Create Auth Routes**

`packages/backend/src/routes/auth.ts`:
```typescript
import { Router } from 'express';
import { generateRegisterChallenge } from '../controllers/auth';

const router = Router();

router.post('/register/challenge', generateRegisterChallenge);

export default router;
```

- [ ] **Step 4: Register Routes in Express**

Modify `packages/backend/src/index.ts` to use `cookie-parser` and the new routes:
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { APP_NAME } from '@myndbbs/shared';
import authRoutes from './routes/auth';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: APP_NAME });
});

app.use('/api/v1/auth', authRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/routes/auth.ts packages/backend/src/controllers/auth.ts packages/backend/src/index.ts packages/backend/package.json
git commit -m "feat(auth): setup webauthn registration challenge endpoint"
```