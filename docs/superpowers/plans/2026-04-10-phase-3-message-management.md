# Phase 3: Message Management & Time Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users control over their data by adding two-sided message deletion, chat clearing, and an expiration (burn-after-reading) dropdown.

**Architecture:**
- **Deletion (Two-sided):** Based on user preference ("Option 2: Two-sided Deletion"), when a user deletes a message or clears a chat, it is permanently deleted (`prisma.privateMessage.delete`) from the database for BOTH users.
- **Expiration UI:** A dropdown will be added next to the existing "Burn after reading" toggle in the chat UI.
- **Expiration Enforcement:** The backend `sendMessage` API will calculate `expiresAt` based on the dropdown selection. The `getInbox` API will filter out any messages where `expiresAt < now()`.

**Tech Stack:** React, Next.js, Prisma, Express.

---

### Task 1: Update Database Schema for Expiration

**Files:**
- Modify: `packages/backend/prisma/schema.prisma`

- [ ] **Step 1: Add expiresAt to PrivateMessage model**

```prisma
// In packages/backend/prisma/schema.prisma
// Find model PrivateMessage and add expiresAt:
model PrivateMessage {
  // ... existing fields ...
  isRead                   Boolean  @default(false)
  isSystem                 Boolean  @default(false)
  expiresAt                DateTime? // <-- ADD THIS

  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  @@index([senderId])
  @@index([receiverId])
  @@index([createdAt])
  @@index([expiresAt]) // <-- ADD THIS INDEX
}
```

- [ ] **Step 2: Push schema and generate client**

Run: `cd packages/backend && npx prisma db push && npx prisma generate`

- [ ] **Step 3: Commit**

```bash
git add packages/backend/prisma/schema.prisma
git commit -m "feat(db): add expiresAt field and index to PrivateMessage model"
```

### Task 2: Backend APIs for Deletion and Expiration

**Files:**
- Modify: `packages/backend/src/controllers/message.ts`
- Modify: `packages/backend/src/routes/message.ts`

- [ ] **Step 1: Add delete and clear APIs**

```typescript
// In packages/backend/src/controllers/message.ts
export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const messageId = req.params.id;

  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const message = await prisma.privateMessage.findUnique({ where: { id: messageId } });
  if (!message) { res.status(404).json({ error: 'ERR_NOT_FOUND' }); return; }

  // Must be sender or receiver
  if (message.senderId !== userId && message.receiverId !== userId) {
    res.status(403).json({ error: 'ERR_FORBIDDEN' }); return;
  }

  await prisma.privateMessage.delete({ where: { id: messageId } });
  res.json({ success: true });
};

export const clearChat = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const withUserId = req.params.withUserId;

  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }
  if (!withUserId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  await prisma.privateMessage.deleteMany({
    where: {
      OR: [
        { senderId: userId, receiverId: withUserId },
        { senderId: withUserId, receiverId: userId }
      ]
    }
  });

  res.json({ success: true });
};
```

- [ ] **Step 2: Update sendMessage to handle expiration**

```typescript
// In packages/backend/src/controllers/message.ts -> sendMessage
// Extract expiresIn from req.body
const { receiverId, ephemeralPublicKey, ephemeralMlKemCiphertext, encryptedContent, senderEncryptedContent, expiresIn } = req.body;

// Calculate expiresAt
let expiresAt: Date | null = null;
if (expiresIn && typeof expiresIn === 'number') {
  expiresAt = new Date(Date.now() + expiresIn);
}

// Pass to prisma.privateMessage.create
const msg = await prisma.privateMessage.create({
  data: { 
    senderId, 
    receiverId, 
    ephemeralPublicKey, 
    ephemeralMlKemCiphertext, 
    encryptedContent, 
    senderEncryptedContent,
    expiresAt // <-- Add this
  }
});
```

- [ ] **Step 3: Filter expired messages in getInbox**

```typescript
// In packages/backend/src/controllers/message.ts -> getInbox
// Add expiration condition to whereClause:
  const notExpiredCondition = {
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } }
    ]
  };

  let whereClause: any = {
    AND: [
      { OR: [ { senderId: userId }, { receiverId: userId } ] },
      notExpiredCondition
    ]
  };

  if (withUserId) {
    whereClause = {
      AND: [
        {
          OR: [
            { senderId: userId, receiverId: String(withUserId) },
            { senderId: String(withUserId), receiverId: userId }
          ]
        },
        notExpiredCondition
      ]
    };
  }
```

- [ ] **Step 4: Register routes**

```typescript
// In packages/backend/src/routes/message.ts
import { ..., deleteMessage, clearChat } from '../controllers/message';

// ... existing routes ...
router.delete('/:id', requireAuth, deleteMessage);
router.delete('/chat/:withUserId', requireAuth, clearChat);
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/controllers/message.ts packages/backend/src/routes/message.ts
git commit -m "feat(messages): add APIs for two-sided deletion, clear chat, and server-side expiration filtering"
```

### Task 3: Frontend UI for Deletion

**Files:**
- Modify: `packages/frontend/src/app/messages/[username]/page.tsx`

- [ ] **Step 1: Add delete and clear handlers**

```tsx
// Inside packages/frontend/src/app/messages/[username]/page.tsx
// Import Trash2 from lucide-react
import { ..., Trash2 } from 'lucide-react';

// Add handler functions before handleSend
const handleDeleteMessage = async (messageId: string) => {
  if (!confirm(dict.common?.confirmDelete || 'Are you sure you want to delete this message for everyone?')) return;
  
  try {
    const res = await fetch(`/api/v1/messages/${messageId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    }
  } catch (err) {
    console.error('Failed to delete message', err);
  }
};

const handleClearChat = async () => {
  if (!confirm(dict.common?.confirmClearChat || 'Are you sure you want to permanently clear this chat for both users?')) return;
  
  try {
    const res = await fetch(`/api/v1/messages/chat/${targetUserId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (res.ok) {
      setMessages([]);
    }
  } catch (err) {
    console.error('Failed to clear chat', err);
  }
};
```

- [ ] **Step 2: Add Clear Chat button to header**

```tsx
// Find the header container `<div className="flex items-center gap-4 mb-6 shrink-0">`
// Add the button at the end:
  <button
    onClick={handleClearChat}
    className="ml-auto flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors"
    title={dict.common?.clearChat || 'Clear Chat'}
  >
    <Trash2 className="h-4 w-4" />
    <span className="hidden sm:inline">{dict.common?.clearChat || 'Clear Chat'}</span>
  </button>
</div>
```

- [ ] **Step 3: Add Delete button to message bubbles**

```tsx
// Find the normal message rendering (after if (msg.isSystem))
// Update the container to have `group items-center gap-2`:
<div key={msg.id} className={`flex group items-center gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
  {isMine && (
    <button 
      onClick={() => handleDeleteMessage(msg.id)}
      className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-opacity rounded-md shrink-0"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )}

  <div className={`max-w-[75%] rounded-2xl px-4 py-2 ...`}>
    ...
  </div>

  {!isMine && (
    <button 
      onClick={() => handleDeleteMessage(msg.id)}
      className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-opacity rounded-md shrink-0"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/app/messages/\[username\]/page.tsx
git commit -m "feat(ui): add clear chat button and individual message deletion (two-sided)"
```

### Task 4: Frontend UI for Expiration Dropdown

**Files:**
- Modify: `packages/frontend/src/app/messages/[username]/page.tsx`
- Modify: `packages/frontend/src/i18n/dictionaries/zh.json`
- Modify: `packages/frontend/src/i18n/dictionaries/en.json`

- [ ] **Step 1: Add expiration state and dictionary strings**

```tsx
// Inside packages/frontend/src/app/messages/[username]/page.tsx
// The existing `burnAfterReading` state is already there.
// Add expirationTime state:
const [expirationTime, setExpirationTime] = useState<number>(3600000); // Default 1 hour in ms

// Update the handleSend payload to include expiresIn:
      const res = await fetch('/api/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          receiverId: targetUserId,
          ephemeralPublicKey: ephemeralPublicKeyBase64,
          ephemeralMlKemCiphertext: ephemeralMlKemCiphertextBase64,
          encryptedContent,
          senderEncryptedContent,
          expiresIn: burnAfterReading ? expirationTime : undefined // <-- ADD THIS
        })
      });
```

- [ ] **Step 2: Add expiration dropdown to the UI**

```tsx
// Find the input area form `<form onSubmit={handleSend} className="flex gap-2">`
// Modify the container above it:
<div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
  <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
    <input 
      type="checkbox" 
      checked={burnAfterReading}
      onChange={(e) => setBurnAfterReading(e.target.checked)}
      className="rounded border-border text-primary focus:ring-primary"
    />
    <Flame className="h-3 w-3 text-orange-500" />
    {dict.messages?.burnAfterReading || 'Burn after reading'}
  </label>

  {burnAfterReading && (
    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
      <span>{dict.messages?.expirationTime || 'Expires in:'}</span>
      <select 
        value={expirationTime}
        onChange={(e) => setExpirationTime(Number(e.target.value))}
        className="bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
      >
        <option value={300000}>{dict.messages?.exp5m || '5 Minutes'}</option>
        <option value={3600000}>{dict.messages?.exp1h || '1 Hour'}</option>
        <option value={86400000}>{dict.messages?.exp24h || '24 Hours'}</option>
        <option value={604800000}>{dict.messages?.exp7d || '7 Days'}</option>
      </select>
    </div>
  )}
</div>
```

- [ ] **Step 3: Update dictionaries**

Add these keys to `zh.json` and `en.json` under `messages` and `common`:
- `common.confirmDelete`: "Are you sure you want to delete this message for everyone?" / "确定要为双方永久删除这条消息吗？"
- `common.confirmClearChat`: "Are you sure you want to permanently clear this chat for both users?" / "确定要为双方永久清空所有聊天记录吗？"
- `common.clearChat`: "Clear Chat" / "清空聊天"
- `messages.expirationTime`: "Expires in:" / "过期时间:"
- `messages.exp5m`: "5 Minutes" / "5 分钟"
- `messages.exp1h`: "1 Hour" / "1 小时"
- `messages.exp24h`: "24 Hours" / "24 小时"
- `messages.exp7d`: "7 Days" / "7 天"

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/app/messages/\[username\]/page.tsx packages/frontend/src/i18n/dictionaries/zh.json packages/frontend/src/i18n/dictionaries/en.json
git commit -m "feat(messages): add expiration dropdown for burn-after-reading mode"
```