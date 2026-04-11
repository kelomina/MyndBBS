# Phase 3: Message Management & Time Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users control over their data by adding dynamic message deletion (one-sided vs two-sided based on conversation settings) and an expiration (burn-after-reading) dropdown.

**Architecture:**
- **Dynamic Deletion:** Add a `ConversationSetting` model to store `allowTwoSidedDelete`. When user A deletes a message, the server checks user B's setting. If true, it hard deletes the message. If false, it soft deletes it for user A by pushing user A's ID to a new `deletedBy` array on the `PrivateMessage`.
- **Expiration UI:** A dropdown will be added next to the existing "Burn after reading" toggle in the chat UI.
- **Expiration Enforcement:** The backend `sendMessage` API will calculate `expiresAt` based on the dropdown selection. The `getInbox` API will filter out any messages where `expiresAt < now()` or where the user's ID is in the `deletedBy` array.

**Tech Stack:** React, Next.js, Prisma, Express.

---

### Task 1: Update Database Schema

**Files:**
- Modify: `packages/backend/prisma/schema.prisma`

- [ ] **Step 1: Add ConversationSetting and updated PrivateMessage**

```prisma
// In packages/backend/prisma/schema.prisma
// Add ConversationSetting model:
model ConversationSetting {
  id                  String   @id @default(uuid()) @db.Uuid
  userId              String   @db.Uuid
  partnerId           String   @db.Uuid
  allowTwoSidedDelete Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user                User     @relation("UserConversationSettings", fields: [userId], references: [id], onDelete: Cascade)
  partner             User     @relation("PartnerConversationSettings", fields: [partnerId], references: [id], onDelete: Cascade)

  @@unique([userId, partnerId])
  @@index([userId])
  @@index([partnerId])
}

// In model User, add relations:
//   conversationSettings ConversationSetting[] @relation("UserConversationSettings")
//   partnerSettings      ConversationSetting[] @relation("PartnerConversationSettings")

// In model PrivateMessage, add expiresAt and deletedBy:
//   deletedBy                String[] @default([]) @db.Uuid
//   expiresAt                DateTime?
// Add index: @@index([expiresAt])
```

- [ ] **Step 2: Push schema and generate client**

Run: `cd packages/backend && npx prisma db push && npx prisma generate`

- [ ] **Step 3: Commit**

```bash
git add packages/backend/prisma/schema.prisma
git commit -m "feat(db): add ConversationSetting model and deletedBy/expiresAt fields to PrivateMessage"
```

### Task 2: Backend APIs for Conversation Settings and Deletion

**Files:**
- Modify: `packages/backend/src/controllers/message.ts`
- Modify: `packages/backend/src/routes/message.ts`

- [ ] **Step 1: Add get and update settings APIs**

```typescript
// In packages/backend/src/controllers/message.ts
export const getConversationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const partnerId = req.params.partnerId;
  if (!userId || !partnerId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  const setting = await prisma.conversationSetting.findUnique({
    where: { userId_partnerId: { userId, partnerId } }
  });
  res.json({ allowTwoSidedDelete: setting?.allowTwoSidedDelete || false });
};

export const updateConversationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const partnerId = req.params.partnerId;
  const { allowTwoSidedDelete } = req.body;
  if (!userId || !partnerId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  await prisma.conversationSetting.upsert({
    where: { userId_partnerId: { userId, partnerId } },
    update: { allowTwoSidedDelete },
    create: { userId, partnerId, allowTwoSidedDelete }
  });
  res.json({ success: true });
};
```

- [ ] **Step 2: Add delete and clear APIs with dynamic logic**

```typescript
// In packages/backend/src/controllers/message.ts
export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const messageId = req.params.id;
  if (!userId) { res.status(401).json({ error: 'ERR_UNAUTHORIZED' }); return; }

  const message = await prisma.privateMessage.findUnique({ where: { id: messageId } });
  if (!message) { res.status(404).json({ error: 'ERR_NOT_FOUND' }); return; }

  if (message.senderId !== userId && message.receiverId !== userId) {
    res.status(403).json({ error: 'ERR_FORBIDDEN' }); return;
  }

  // If sender is deleting, check receiver's settings
  const partnerId = message.senderId === userId ? message.receiverId : message.senderId;
  
  let canHardDelete = false;
  if (message.senderId === userId) {
    // Sender is deleting, can hard delete if receiver allows it
    const partnerSetting = await prisma.conversationSetting.findUnique({
      where: { userId_partnerId: { userId: partnerId, partnerId: userId } }
    });
    canHardDelete = partnerSetting?.allowTwoSidedDelete || false;
  }

  if (canHardDelete) {
    await prisma.privateMessage.delete({ where: { id: messageId } });
  } else {
    // Soft delete (one-sided)
    if (!message.deletedBy.includes(userId)) {
      const newDeletedBy = [...message.deletedBy, userId];
      // If both have deleted it, hard delete
      if (newDeletedBy.includes(message.senderId) && newDeletedBy.includes(message.receiverId)) {
        await prisma.privateMessage.delete({ where: { id: messageId } });
      } else {
        await prisma.privateMessage.update({
          where: { id: messageId },
          data: { deletedBy: { push: userId } }
        });
      }
    }
  }

  res.json({ success: true });
};

export const clearChat = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const withUserId = req.params.withUserId;
  if (!userId || !withUserId) { res.status(400).json({ error: 'ERR_BAD_REQUEST' }); return; }

  const partnerSetting = await prisma.conversationSetting.findUnique({
    where: { userId_partnerId: { userId: withUserId, partnerId: userId } }
  });
  const canHardDelete = partnerSetting?.allowTwoSidedDelete || false;

  const messages = await prisma.privateMessage.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: withUserId },
        { senderId: withUserId, receiverId: userId }
      ],
      NOT: { deletedBy: { has: userId } }
    },
    select: { id: true, senderId: true, receiverId: true, deletedBy: true }
  });

  for (const msg of messages) {
    if (canHardDelete && msg.senderId === userId) {
      await prisma.privateMessage.delete({ where: { id: msg.id } });
    } else {
      const newDeletedBy = [...msg.deletedBy, userId];
      if (newDeletedBy.includes(msg.senderId) && newDeletedBy.includes(msg.receiverId)) {
        await prisma.privateMessage.delete({ where: { id: msg.id } });
      } else {
        await prisma.privateMessage.update({
          where: { id: msg.id },
          data: { deletedBy: { push: userId } }
        });
      }
    }
  }

  res.json({ success: true });
};
```

- [ ] **Step 3: Update sendMessage and getInbox for expiration/deletion**

```typescript
// In sendMessage: Add expiresAt logic based on req.body.expiresIn (number ms)
  let expiresAt: Date | null = null;
  if (req.body.expiresIn && typeof req.body.expiresIn === 'number') {
    expiresAt = new Date(Date.now() + req.body.expiresIn);
  }
  // add expiresAt to prisma.privateMessage.create

// In getInbox: Update whereClause to filter out soft-deleted and expired messages
  const notExpiredCondition = {
    OR: [ { expiresAt: null }, { expiresAt: { gt: new Date() } } ]
  };

  // Add `NOT: { deletedBy: { has: userId } }` to the main AND array
  let whereClause: any = {
    AND: [
      { OR: [ { senderId: userId }, { receiverId: userId } ] },
      notExpiredCondition,
      { NOT: { deletedBy: { has: userId } } }
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
        notExpiredCondition,
        { NOT: { deletedBy: { has: userId } } }
      ]
    };
  }
```

- [ ] **Step 4: Register routes**

```typescript
// In packages/backend/src/routes/message.ts
import { ..., deleteMessage, clearChat, getConversationSettings, updateConversationSettings } from '../controllers/message';

// ... existing routes ...
router.get('/settings/:partnerId', requireAuth, getConversationSettings);
router.put('/settings/:partnerId', requireAuth, updateConversationSettings);
router.delete('/:id', requireAuth, deleteMessage);
router.delete('/chat/:withUserId', requireAuth, clearChat);
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/controllers/message.ts packages/backend/src/routes/message.ts
git commit -m "feat(messages): add APIs for dynamic one-sided/two-sided deletion and expiration filtering"
```

### Task 3: Frontend UI for Conversation Settings and Deletion

**Files:**
- Modify: `packages/frontend/src/app/messages/[username]/page.tsx`

- [ ] **Step 1: Add conversation settings toggle**

```tsx
// Inside packages/frontend/src/app/messages/[username]/page.tsx
// Add states:
const [allowTwoSidedDelete, setAllowTwoSidedDelete] = useState(false);
const [partnerAllowsTwoSidedDelete, setPartnerAllowsTwoSidedDelete] = useState(false);

// In loadInitialData:
const settingsRes = await fetch(`/api/v1/messages/settings/${targetData.userId}`, { credentials: 'include' });
if (settingsRes.ok) {
  const data = await settingsRes.json();
  setAllowTwoSidedDelete(data.allowTwoSidedDelete);
}

// Fetch partner's settings (requires a new API or just checking during delete. For now, we will just show generic warning during delete or fetch it). Let's fetch partner's settings for UI feedback:
// *Wait, the user only sets THEIR setting (allowing the partner to delete).*
// *The partner sets THEIR setting (allowing the user to delete).*
// Let's just implement the toggle for the current user's setting:
const toggleTwoSidedDelete = async (checked: boolean) => {
  setAllowTwoSidedDelete(checked);
  await fetch(`/api/v1/messages/settings/${targetUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ allowTwoSidedDelete: checked })
  });
};
```

- [ ] **Step 2: Add header UI and delete handlers**

```tsx
// Add toggle to header:
<div className="flex flex-col ml-4">
  <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
    <input type="checkbox" checked={allowTwoSidedDelete} onChange={(e) => toggleTwoSidedDelete(e.target.checked)} className="rounded" />
    {dict.messages?.allowPartnerDelete || 'Allow partner to delete our messages'}
  </label>
</div>

// Add delete handlers:
const handleDeleteMessage = async (messageId: string, isMine: boolean) => {
  const confirmMsg = isMine 
    ? (dict.common?.confirmDeleteMine || 'Delete this message? If the partner allows it, it will be deleted for both.')
    : (dict.common?.confirmDeleteTheirs || 'Delete this message? This will only delete it from your view.');
  
  if (!confirm(confirmMsg)) return;
  
  try {
    const res = await fetch(`/api/v1/messages/${messageId}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setMessages(prev => prev.filter(m => m.id !== messageId));
  } catch (err) {}
};

const handleClearChat = async () => {
  if (!confirm(dict.common?.confirmClearChat || 'Clear entire chat history?')) return;
  try {
    const res = await fetch(`/api/v1/messages/chat/${targetUserId}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setMessages([]);
  } catch (err) {}
};
```

- [ ] **Step 3: Add Clear Chat button to header & Delete button to messages**

```tsx
// Header button:
<button onClick={handleClearChat} className="ml-auto flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg">
  <Trash2 className="h-4 w-4" />
  <span className="hidden sm:inline">{dict.common?.clearChat || 'Clear Chat'}</span>
</button>

// Message bubble buttons:
<div key={msg.id} className={`flex group items-center gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
  {isMine && (
    <button onClick={() => handleDeleteMessage(msg.id, isMine)} className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive rounded-md shrink-0">
      <Trash2 className="h-4 w-4" />
    </button>
  )}
  <div className={`max-w-[75%] rounded-2xl px-4 py-2 ...`}>...</div>
  {!isMine && (
    <button onClick={() => handleDeleteMessage(msg.id, isMine)} className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive rounded-md shrink-0">
      <Trash2 className="h-4 w-4" />
    </button>
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/app/messages/\[username\]/page.tsx
git commit -m "feat(ui): add conversation settings toggle, clear chat, and dynamic message deletion"
```

### Task 4: Frontend UI for Expiration Dropdown

**Files:**
- Modify: `packages/frontend/src/app/messages/[username]/page.tsx`
- Modify: `packages/frontend/src/i18n/dictionaries/zh.json`
- Modify: `packages/frontend/src/i18n/dictionaries/en.json`

- [ ] **Step 1: Add expiration state and UI**

```tsx
// Add expirationTime state:
const [expirationTime, setExpirationTime] = useState<number>(3600000); // 1 hour

// Update the handleSend payload:
expiresIn: burnAfterReading ? expirationTime : undefined

// Update input form area:
<div className="flex items-center gap-4 mb-2 text-xs text-muted-foreground">
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" checked={burnAfterReading} onChange={(e) => setBurnAfterReading(e.target.checked)} className="rounded text-primary" />
    {dict.messages?.burnAfterReading || 'Burn after reading'}
  </label>
  {burnAfterReading && (
    <div className="flex items-center gap-2">
      <span>{dict.messages?.expirationTime || 'Expires in:'}</span>
      <select value={expirationTime} onChange={(e) => setExpirationTime(Number(e.target.value))} className="bg-background border border-border rounded px-2 py-1 focus:border-primary">
        <option value={300000}>{dict.messages?.exp5m || '5 Minutes'}</option>
        <option value={3600000}>{dict.messages?.exp1h || '1 Hour'}</option>
        <option value={86400000}>{dict.messages?.exp24h || '24 Hours'}</option>
        <option value={604800000}>{dict.messages?.exp7d || '7 Days'}</option>
      </select>
    </div>
  )}
</div>
```

- [ ] **Step 2: Update dictionaries**

Add these keys to `zh.json` and `en.json`:
- `messages.allowPartnerDelete`: "Allow partner to delete our messages" / "允许对方为双方永久删除消息"
- `common.confirmDeleteMine`: "Delete this message? If the partner allows it, it will be deleted for both." / "删除此消息？如果对方允许，这将为双方永久删除。"
- `common.confirmDeleteTheirs`: "Delete this message? This will only delete it from your view." / "删除此消息？这只会从您的视图中单向删除。"
- `common.confirmClearChat`: "Clear entire chat history?" / "清空所有聊天记录？"
- `common.clearChat`: "Clear Chat" / "清空聊天"
- `messages.expirationTime`: "Expires in:" / "过期时间:"
- `messages.exp5m`: "5 Minutes" / "5 分钟"
- `messages.exp1h`: "1 Hour" / "1 小时"
- `messages.exp24h`: "24 Hours" / "24 小时"
- `messages.exp7d`: "7 Days" / "7 天"

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/app/messages/\[username\]/page.tsx packages/frontend/src/i18n/dictionaries/zh.json packages/frontend/src/i18n/dictionaries/en.json
git commit -m "feat(messages): add expiration dropdown and update dictionaries for phase 3"
```