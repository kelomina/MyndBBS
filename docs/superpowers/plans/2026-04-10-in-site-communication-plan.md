# In-Site Communication System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- []`) syntax for tracking.

**Goal:** Implement a secure, zero-knowledge end-to-end encrypted private messaging system and a plaintext system notification module.

**Architecture:** 
1. Database Schema: Add `UserKey`, `PrivateMessage`, and `Notification` models to Prisma.
2. Notifications: Backend CRUD APIs and injection points in existing controllers (post approval, comments, etc.). Frontend UI for listing and marking as read.
3. Private Messages (E2EE): Backend APIs for key exchange and ciphertext storage. Frontend Web Crypto API service (`lib/crypto.ts`) to handle WebAuthn PRF, ECDH P-521 key derivation, and AES-GCM-256 encryption/decryption. Frontend UI for inbox and chat.

**Tech Stack:** Prisma, Express.js, React, `@simplewebauthn/browser`, Web Crypto API.

---

### Task 1: Database Schema Updates

**Files:**
- Modify: `packages/backend/prisma/schema.prisma`

- [ ] **Step 1: Add Notification enum and models**
Add `NotificationType` enum and `Notification`, `UserKey`, `PrivateMessage` models to `schema.prisma`.

```prisma
enum NotificationType {
  POST_APPROVED
  POST_REJECTED
  POST_REPLIED
  COMMENT_REPLIED
  SYSTEM
}

model Notification {
  id        String           @id @default(uuid()) @db.Uuid
  userId    String           @db.Uuid
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  content   String           @db.Text
  relatedId String?          @db.Uuid
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@index([userId])
  @@index([createdAt])
}

model UserKey {
  id                  String   @id @default(uuid()) @db.Uuid
  userId              String   @unique @db.Uuid
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  publicKey           String   @db.Text
  encryptedPrivateKey String   @db.Text
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model PrivateMessage {
  id                 String   @id @default(uuid()) @db.Uuid
  senderId           String   @db.Uuid
  sender             User     @relation("SentMessages", fields: [senderId], references: [id], onDelete: Cascade)
  receiverId         String   @db.Uuid
  receiver           User     @relation("ReceivedMessages", fields: [receiverId], references: [id], onDelete: Cascade)
  ephemeralPublicKey String   @db.Text
  encryptedContent   String   @db.Text
  isRead             Boolean  @default(false)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([senderId])
  @@index([receiverId])
  @@index([createdAt])
}
```
*Note: Also add `notifications Notification[]`, `userKey UserKey?`, `sentMessages PrivateMessage[] @relation("SentMessages")`, and `receivedMessages PrivateMessage[] @relation("ReceivedMessages")` to the `User` model.*

- [ ] **Step 2: Generate Prisma Client**
Run: `cd packages/backend && npx prisma generate`
Expected: Client generated successfully.

- [ ] **Step 3: Commit**
```bash
git add packages/backend/prisma/schema.prisma
git commit -m "feat(db): add schema models for notifications and E2EE messages"
```

---

### Task 2: Backend - Notification Service & API

**Files:**
- Create: `packages/backend/src/lib/notification.ts`
- Create: `packages/backend/src/controllers/notification.ts`
- Create: `packages/backend/src/routes/notification.ts`
- Modify: `packages/backend/src/app.ts` (to mount route)

- [ ] **Step 1: Create Notification Service**
```typescript
// packages/backend/src/lib/notification.ts
import { prisma } from '../db';
import { NotificationType } from '@prisma/client';

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  relatedId?: string;
}

export const sendNotification = async (params: SendNotificationParams) => {
  return prisma.notification.create({
    data: params
  });
};
```

- [ ] **Step 2: Create Notification Controller**
```typescript
// packages/backend/src/controllers/notification.ts
import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  
  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });

  res.json({ notifications, unreadCount });
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const { id } = req.body;
  
  if (id === 'all') {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  } else {
    await prisma.notification.update({
      where: { id, userId },
      data: { isRead: true }
    });
  }

  res.json({ success: true });
};
```

- [ ] **Step 3: Create Routes and Mount**
```typescript
// packages/backend/src/routes/notification.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getNotifications, markAsRead } from '../controllers/notification';

const router = Router();
router.get('/', authenticate, getNotifications);
router.post('/read', authenticate, markAsRead);
export default router;
```
*Mount in app.ts:* `import notificationRoutes from './routes/notification'; app.use('/api/v1/notifications', notificationRoutes);`

- [ ] **Step 4: Commit**
```bash
git add packages/backend/src/lib/notification.ts packages/backend/src/controllers/notification.ts packages/backend/src/routes/notification.ts packages/backend/src/app.ts
git commit -m "feat(api): implement notification service and endpoints"
```

---

### Task 3: Backend - Inject Notification Triggers

**Files:**
- Modify: `packages/backend/src/controllers/moderation.ts`
- Modify: `packages/backend/src/controllers/post.ts`

- [ ] **Step 1: Inject in Post Moderation**
In `moderation.ts`, inside `reviewPost`, after `update({ status })`:
```typescript
import { sendNotification } from '../lib/notification';
// inside reviewPost (approve)
await sendNotification({
  userId: post.authorId,
  type: 'POST_APPROVED',
  title: 'Post Approved',
  content: `Your post "${post.title}" has been approved.`,
  relatedId: post.id
});
// inside reviewPost (reject)
await sendNotification({
  userId: post.authorId,
  type: 'POST_REJECTED',
  title: 'Post Rejected',
  content: `Your post "${post.title}" has been rejected. Reason: ${reason || 'N/A'}`,
  relatedId: post.id
});
```

- [ ] **Step 2: Inject in Comments**
In `post.ts`, inside `createComment`, after comment creation:
```typescript
import { sendNotification } from '../lib/notification';
// inside createComment
const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true, title: true } });
if (post && post.authorId !== req.user!.userId) {
  await sendNotification({
    userId: post.authorId,
    type: 'POST_REPLIED',
    title: 'New Reply to Your Post',
    content: `Someone replied to your post "${post.title}".`,
    relatedId: postId
  });
}
if (parentId) {
  const parentComment = await prisma.comment.findUnique({ where: { id: parentId }, select: { authorId: true } });
  if (parentComment && parentComment.authorId !== req.user!.userId) {
    await sendNotification({
      userId: parentComment.authorId,
      type: 'COMMENT_REPLIED',
      title: 'New Reply to Your Comment',
      content: `Someone replied to your comment on a post.`,
      relatedId: postId
    });
  }
}
```

- [ ] **Step 3: Commit**
```bash
git add packages/backend/src/controllers/moderation.ts packages/backend/src/controllers/post.ts
git commit -m "feat(api): inject notification triggers into moderation and comments"
```

---

### Task 4: Backend - E2EE Messages API

**Files:**
- Create: `packages/backend/src/controllers/message.ts`
- Create: `packages/backend/src/routes/message.ts`
- Modify: `packages/backend/src/app.ts` (mount)

- [ ] **Step 1: Implement Key Management APIs**
```typescript
// packages/backend/src/controllers/message.ts
import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';

export const uploadKeys = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }
  
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.level < 2) { res.status(403).json({ error: 'ERR_LEVEL_TOO_LOW' }); return; }

  const { publicKey, encryptedPrivateKey } = req.body;
  if (!publicKey || !encryptedPrivateKey) { res.status(400).json({ error: 'ERR_MISSING_KEYS' }); return; }

  await prisma.userKey.upsert({
    where: { userId },
    update: { publicKey, encryptedPrivateKey },
    create: { userId, publicKey, encryptedPrivateKey }
  });

  res.json({ success: true });
};

export const getMyKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const key = await prisma.userKey.findUnique({ where: { userId } });
  res.json({ key });
};

export const getUserPublicKey = async (req: AuthRequest, res: Response): Promise<void> => {
  const { username } = req.params;
  const user = await prisma.user.findUnique({ where: { username }, include: { userKey: true } });
  
  if (!user || !user.userKey) { res.status(404).json({ error: 'ERR_USER_OR_KEY_NOT_FOUND' }); return; }
  res.json({ publicKey: user.userKey.publicKey, userId: user.id });
};
```

- [ ] **Step 2: Implement Message CRUD APIs**
```typescript
// appending to message.ts
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const senderId = req.user?.userId;
  if (!senderId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const { receiverId, ephemeralPublicKey, encryptedContent } = req.body;
  
  const sender = await prisma.user.findUnique({ where: { id: senderId } });
  if (!sender || sender.level < 2) { res.status(403).json({ error: 'ERR_LEVEL_TOO_LOW' }); return; }

  const msg = await prisma.privateMessage.create({
    data: { senderId, receiverId, ephemeralPublicKey, encryptedContent }
  });

  res.json({ success: true, message: msg });
};

export const getInbox = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const { withUserId } = req.query; // to fetch conversation thread

  let whereClause: any = {
    OR: [ { senderId: userId }, { receiverId: userId } ]
  };

  if (withUserId) {
    whereClause = {
      OR: [
        { senderId: userId, receiverId: String(withUserId) },
        { senderId: String(withUserId), receiverId: userId }
      ]
    };
  }

  const messages = await prisma.privateMessage.findMany({
    where: whereClause,
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { username: true } }, receiver: { select: { username: true } } }
  });

  res.json({ messages });
};
```

- [ ] **Step 3: Create Routes and Mount**
```typescript
// packages/backend/src/routes/message.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadKeys, getMyKey, getUserPublicKey, sendMessage, getInbox } from '../controllers/message';

const router = Router();
router.post('/keys', authenticate, uploadKeys);
router.get('/keys/me', authenticate, getMyKey);
router.get('/keys/:username', authenticate, getUserPublicKey);
router.post('/', authenticate, sendMessage);
router.get('/inbox', authenticate, getInbox);
export default router;
```
*Mount in app.ts:* `import messageRoutes from './routes/message'; app.use('/api/v1/messages', messageRoutes);`

- [ ] **Step 4: Commit**
```bash
git add packages/backend/src/controllers/message.ts packages/backend/src/routes/message.ts packages/backend/src/app.ts
git commit -m "feat(api): implement E2EE message endpoints"
```

---

### Task 5: Frontend - Web Crypto E2EE Service

**Files:**
- Create: `packages/frontend/src/lib/crypto/e2ee.ts`

- [ ] **Step 1: Implement Key Generation & Export**
```typescript
// packages/frontend/src/lib/crypto/e2ee.ts
export const generateECDHKeyPair = async () => {
  return window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-521' },
    true,
    ['deriveKey', 'deriveBits']
  );
};

export const exportKeyToBase64 = async (key: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey(key.type === 'public' ? 'spki' : 'pkcs8', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

export const importPublicKeyFromBase64 = async (base64: string): Promise<CryptoKey> => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return window.crypto.subtle.importKey(
    'spki', bytes.buffer, { name: 'ECDH', namedCurve: 'P-521' }, true, []
  );
};

export const importPrivateKeyFromBase64 = async (base64: string): Promise<CryptoKey> => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return window.crypto.subtle.importKey(
    'pkcs8', bytes.buffer, { name: 'ECDH', namedCurve: 'P-521' }, true, ['deriveKey', 'deriveBits']
  );
};
```

- [ ] **Step 2: Implement PRF AES Wrapper**
```typescript
// append to e2ee.ts
export const getAesKeyFromPrf = async (prfBytes: Uint8Array): Promise<CryptoKey> => {
  return window.crypto.subtle.importKey(
    'raw', prfBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
};

export const encryptPrivateKey = async (privateKeyBase64: string, aesKey: CryptoKey): Promise<string> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, enc.encode(privateKeyBase64)
  );
  
  // Combine IV and ciphertext for storage
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
};

export const decryptPrivateKey = async (encryptedBase64: string, aesKey: CryptoKey): Promise<string> => {
  const binaryString = atob(encryptedBase64);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) combined[i] = binaryString.charCodeAt(i);
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, aesKey, ciphertext
  );
  return new TextDecoder().decode(decrypted);
};
```

- [ ] **Step 3: Implement Message Encrypt/Decrypt (HKDF + ECDH)**
```typescript
// append to e2ee.ts
const deriveAesGcmKey = async (privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> => {
  return window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptMessage = async (text: string, myPrivateKey: CryptoKey, theirPublicKey: CryptoKey): Promise<string> => {
  const aesKey = await deriveAesGcmKey(myPrivateKey, theirPublicKey);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(text)
  );
  
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
};

export const decryptMessage = async (encryptedBase64: string, myPrivateKey: CryptoKey, theirPublicKey: CryptoKey): Promise<string> => {
  const aesKey = await deriveAesGcmKey(myPrivateKey, theirPublicKey);
  const binaryString = atob(encryptedBase64);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) combined[i] = binaryString.charCodeAt(i);
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, aesKey, ciphertext
  );
  return new TextDecoder().decode(decrypted);
};
```

- [ ] **Step 4: Commit**
```bash
git add packages/frontend/src/lib/crypto/e2ee.ts
git commit -m "feat(frontend): add web crypto service for E2EE"
```

---

### Task 6: Frontend - Notifications UI

**Files:**
- Create: `packages/frontend/src/components/NotificationsDropdown.tsx`
- Modify: `packages/frontend/src/components/layout/Header.tsx`

- [ ] **Step 1: Create Notifications Dropdown Component**
Create a component that fetches `/api/v1/notifications`, displays a bell icon with unread count badge. Clicking opens a popover listing notifications. Clicking a notification marks it as read and redirects if `relatedId` exists. Add a "Mark all as read" button.

- [ ] **Step 2: Integrate into Header**
Add `<NotificationsDropdown />` next to `<UserNav />` in `Header.tsx`.

- [ ] **Step 3: Commit**
```bash
git add packages/frontend/src/components/NotificationsDropdown.tsx packages/frontend/src/components/layout/Header.tsx
git commit -m "feat(frontend): implement notifications UI in header"
```

---

### Task 7: Frontend - Private Messages UI (Initialization & Inbox)

**Files:**
- Create: `packages/frontend/src/app/messages/page.tsx`
- Create: `packages/frontend/src/app/messages/[username]/page.tsx`

- [ ] **Step 1: Inbox Page & Key Initialization Flow**
In `app/messages/page.tsx`, check user level (must be >= 2).
Fetch `/api/v1/messages/keys/me`.
If no key exists:
1. Show "Initialize Secure Messaging" button.
2. On click, call `generateECDHKeyPair()`.
3. Call `startAuthentication` (WebAuthn) with `extensions: { prf: { eval: { first: new Uint8Array(32) } } }`.
4. Extract PRF bytes from assertion extension results.
5. Derive AES key via `getAesKeyFromPrf()`.
6. Export private key, encrypt it via `encryptPrivateKey()`.
7. Upload to `/api/v1/messages/keys`.
Once keys exist, fetch and list inbox conversations (grouped by user).

- [ ] **Step 2: Chat Page (A -> B)**
In `app/messages/[username]/page.tsx`:
1. Fetch target user's public key (`/api/v1/messages/keys/:username`).
2. Prompt user for Passkey auth to get PRF and unlock their own private key.
3. Fetch message history (`/api/v1/messages/inbox?withUserId=...`).
4. Loop through messages: use `decryptMessage()` to display plaintext.
5. On Send: generate ephemeral keypair, `encryptMessage()` with target's public key, POST to `/api/v1/messages`.

- [ ] **Step 3: Commit**
```bash
git add packages/frontend/src/app/messages
git commit -m "feat(frontend): implement E2EE private messages UI"
```
