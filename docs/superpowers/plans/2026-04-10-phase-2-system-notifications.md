# Phase 2: System Notifications & Unread Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge system notifications into the E2EE messaging system as structured, unencrypted JSON cards, and add a global unread message badge to the navigation.

**Architecture:**
- **System User:** Create a virtual `system` user in `seed.ts` and `index.ts`.
- **System Messages:** Add `isSystem` boolean to `PrivateMessage` model. Update `sendNotification` to send structured JSON (type, title, content, relatedId) directly to the `PrivateMessage` table with `isSystem = true`.
- **Frontend Chat UI:** Bypass E2EE decryption for `isSystem` messages. Parse the JSON and render a beautiful, centered interactive card with a button to view the related post.
- **Unread Badges:** Remove the old `NotificationsDropdown`. Add `GET /unread-count` and `POST /read` endpoints. Display the red badge on the `Mail` icon in `UserNav.tsx` and clear it when the user opens a chat.

**Tech Stack:** React, Next.js, Prisma, Express.

---

### Task 1: Database Schema & System User Initialization

**Files:**
- Modify: `packages/backend/prisma/schema.prisma`
- Modify: `packages/backend/prisma/seed.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: Update Prisma Schema**

```prisma
// In packages/backend/prisma/schema.prisma
// Find model PrivateMessage and add isSystem:
model PrivateMessage {
  // ... existing fields ...
  encryptedContent         String   @db.Text
  senderEncryptedContent   String?  @db.Text
  isRead                   Boolean  @default(false)
  isSystem                 Boolean  @default(false) // <-- ADD THIS
  // ... existing fields ...
}
```

- [ ] **Step 2: Add system user to seed.ts**

```typescript
// In packages/backend/prisma/seed.ts
// Add near the end of main() function, before console.log('Database seeded successfully'):
  import crypto from 'crypto';
  import * as argon2 from 'argon2';
  
  const existingSystemUser = await prisma.user.findUnique({ where: { username: 'system' } });
  if (!existingSystemUser) {
    console.log('Creating system user...');
    await prisma.user.create({
      data: {
        username: 'system',
        email: 'system@localhost',
        password: await argon2.hash(crypto.randomBytes(32).toString('hex')),
        status: UserStatus.ACTIVE,
        roleId: superAdminRole.id
      }
    });
  }
```

- [ ] **Step 3: Add system user fallback to index.ts**

```typescript
// In packages/backend/src/index.ts
// Find the `else { // Normal Mode` block and add before app.listen:
  import crypto from 'crypto';
  import * as argon2 from 'argon2';
  import { UserStatus } from '@prisma/client';

  const ensureSystemUser = async () => {
    const sysUser = await prisma.user.findUnique({ where: { username: 'system' } });
    if (!sysUser) {
      const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
      if (superAdminRole) {
        await prisma.user.create({
          data: {
            username: 'system',
            email: 'system@localhost',
            password: await argon2.hash(crypto.randomBytes(32).toString('hex')),
            status: UserStatus.ACTIVE,
            roleId: superAdminRole.id
          }
        });
        console.log('System user auto-initialized.');
      }
    }
  };

  ensureSystemUser().then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }).catch(err => console.error('Failed to ensure system user:', err));
```

- [ ] **Step 4: Push schema and generate client**

Run: `cd packages/backend && npx prisma db push && npx prisma generate`

- [ ] **Step 5: Commit**

```bash
git add packages/backend/prisma/schema.prisma packages/backend/prisma/seed.ts packages/backend/src/index.ts
git commit -m "feat(db): add isSystem flag to messages and auto-initialize system user"
```

### Task 2: Route Notifications to PrivateMessages

**Files:**
- Modify: `packages/backend/src/lib/notification.ts`

- [ ] **Step 1: Rewrite sendNotification to create PrivateMessages**

```typescript
// In packages/backend/src/lib/notification.ts
import { prisma } from '../db';
import { NotificationType } from '@prisma/client';

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  relatedId?: string;
}

let systemUserIdCache: string | null = null;

const getSystemUserId = async () => {
  if (systemUserIdCache) return systemUserIdCache;
  const sysUser = await prisma.user.findUnique({ where: { username: 'system' } });
  if (sysUser) {
    systemUserIdCache = sysUser.id;
    return sysUser.id;
  }
  throw new Error('System user not found');
};

export const sendNotification = async (params: SendNotificationParams) => {
  try {
    const systemUserId = await getSystemUserId();
    
    // Serialize notification data as structured JSON
    const payload = JSON.stringify({
      type: params.type,
      title: params.title,
      content: params.content,
      relatedId: params.relatedId
    });

    // Create unencrypted system message
    return await prisma.privateMessage.create({
      data: {
        senderId: systemUserId,
        receiverId: params.userId,
        ephemeralPublicKey: 'system', // Placeholder required by schema
        encryptedContent: payload,
        isSystem: true
      }
    });
  } catch (error) {
    console.error('Failed to send system message notification:', error);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/lib/notification.ts
git commit -m "feat(notifications): route all system notifications to unencrypted E2EE private messages as structured JSON"
```

### Task 3: Unread Count and Mark as Read APIs

**Files:**
- Modify: `packages/backend/src/controllers/message.ts`
- Modify: `packages/backend/src/routes/message.ts`

- [ ] **Step 1: Add unread count API in controller**

```typescript
// In packages/backend/src/controllers/message.ts
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const count = await prisma.privateMessage.count({
    where: { receiverId: userId, isRead: false }
  });
  res.json({ count });
};
```

- [ ] **Step 2: Add mark as read API in controller**

```typescript
// In packages/backend/src/controllers/message.ts
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { senderId } = req.body;
  if (!userId || !senderId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  await prisma.privateMessage.updateMany({
    where: { receiverId: userId, senderId: senderId, isRead: false },
    data: { isRead: true }
  });
  res.json({ success: true });
};
```

- [ ] **Step 3: Register new routes**

```typescript
// In packages/backend/src/routes/message.ts
import { uploadKeys, getMyKey, getUserPublicKey, sendMessage, getInbox, getUnreadCount, markAsRead } from '../controllers/message';

// ... existing routes ...
router.get('/unread', requireAuth, getUnreadCount);
router.put('/read', requireAuth, markAsRead);
```

- [ ] **Step 4: Return isSystem in getInbox**

```typescript
// In packages/backend/src/controllers/message.ts -> getInbox
// Find the prisma.privateMessage.findMany call and add select for isSystem and isRead
// Change include to select to be precise, or just ensure the whole model is returned.
// Since findMany returns all scalar fields by default, isSystem and isRead will be included automatically.
// Just verify no explicit select is restricting it. (Current code uses include, so scalar fields are fine).
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/controllers/message.ts packages/backend/src/routes/message.ts
git commit -m "feat(messages): add APIs for fetching unread count and marking conversation as read"
```

### Task 4: Global Unread Badge and Cleanup Header

**Files:**
- Modify: `packages/frontend/src/components/layout/Header.tsx`
- Modify: `packages/frontend/src/components/layout/UserNav.tsx`

- [ ] **Step 1: Remove old NotificationsDropdown from Header**

```tsx
// In packages/frontend/src/components/layout/Header.tsx
// Remove: import { NotificationsDropdown } from '../NotificationsDropdown';
// Remove: <NotificationsDropdown />
```

- [ ] **Step 2: Add unread badge to UserNav**

```tsx
// In packages/frontend/src/components/layout/UserNav.tsx
import { useEffect, useState } from 'react';
// ...

export function UserNav({ title, newPostText, messagesText }: { title: string; newPostText?: string; messagesText?: string }) {
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch('/api/v1/user/profile', { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => {
        setUser(data.user);
        // Fetch unread count
        return fetch('/api/v1/messages/unread', { credentials: 'include' });
      })
      .then(res => res?.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data.count === 'number') setUnreadCount(data.count);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // Optional: Poll unread count every 60s
    const interval = setInterval(() => {
      fetch('/api/v1/messages/unread', { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setUnreadCount(data.count); })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ...
  // Find the Mail link and update it:
        <Link
          href="/messages"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
          title={messagesText || 'Messages'}
        >
          <Mail className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/components/layout/Header.tsx packages/frontend/src/components/layout/UserNav.tsx
git commit -m "feat(ui): replace legacy notifications dropdown with global unread messages badge on UserNav"
```

### Task 5: Render Structured System Messages in Chat

**Files:**
- Modify: `packages/frontend/src/app/messages/[username]/page.tsx`
- Modify: `packages/frontend/src/app/messages/page.tsx`

- [ ] **Step 1: Add interface field and markAsRead logic**

```tsx
// In packages/frontend/src/app/messages/[username]/page.tsx
// Update interface:
interface Message {
  // ... existing ...
  isSystem: boolean;
  isRead: boolean;
}

// In loadInitialData or a new useEffect after targetUserId is set, mark messages as read:
// Add inside targetKeyRes.ok block:
fetch('/api/v1/messages/read', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ senderId: targetData.userId }),
  credentials: 'include'
}).catch(console.error);
```

- [ ] **Step 2: Bypass decryption for system messages**

```tsx
// In packages/frontend/src/app/messages/[username]/page.tsx -> decryptAllMessages
const decryptAllMessages = async () => {
  let needsUpdate = false;
  const updatedMessages = await Promise.all(messages.map(async (msg) => {
    if (msg.plaintext) return msg;
    needsUpdate = true;

    // Bypass E2EE for system messages
    if (msg.isSystem) {
      return { ...msg, plaintext: msg.encryptedContent };
    }

    // ... existing try/catch decryption logic ...
  }));
```

- [ ] **Step 3: Render structured JSON system card**

```tsx
// In packages/frontend/src/app/messages/[username]/page.tsx -> message.map
// Add Link import at the top: import Link from 'next/link';
// Inside messages.map((msg) => {
  if (msg.isSystem) {
    let parsed: any = { content: msg.plaintext };
    try { parsed = JSON.parse(msg.plaintext || '{}'); } catch (e) {}

    return (
      <div key={msg.id} className="flex justify-center my-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm max-w-[85%] sm:max-w-[400px] w-full flex flex-col items-center text-center">
          <div className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-2">
            System Notification
          </div>
          <h4 className="font-semibold text-sm mb-1">{parsed.title || 'Notification'}</h4>
          <p className="text-xs text-muted-foreground mb-4">{parsed.content}</p>
          {parsed.relatedId && (
            <Link 
              href={`/p/${parsed.relatedId}`}
              className="w-full py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-xs font-medium transition-colors"
            >
              View Related Content
            </Link>
          )}
          <span className="text-[10px] text-muted-foreground/50 mt-3">
            {new Date(msg.createdAt).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  // ... existing normal message bubble rendering ...
```

- [ ] **Step 4: Update Inbox list page**

```tsx
// In packages/frontend/src/app/messages/page.tsx
// Update interface Message to include isSystem and isRead.
// In decryptAllMessages, bypass decryption:
  if (msg.isSystem) {
    let parsed: any = { title: 'System Notification' };
    try { parsed = JSON.parse(msg.encryptedContent || '{}'); } catch (e) {}
    return { ...msg, plaintext: parsed.title };
  }
// In the inbox list rendering, you can add an unread dot:
// <div className="flex-1 min-w-0">
//   <h3 className="font-semibold truncate flex items-center gap-2">
//     {isSystem ? 'System' : partnerName}
//     {!msg.isRead && msg.receiverId === currentUser?.id && <span className="h-2 w-2 rounded-full bg-red-500"></span>}
//   </h3>
//   <p className="text-sm text-muted-foreground truncate">{msg.plaintext || '...'}</p>
// </div>
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/app/messages/\[username\]/page.tsx packages/frontend/src/app/messages/page.tsx
git commit -m "feat(messages): render system notifications as structured interactive cards and bypass E2EE decryption"
```