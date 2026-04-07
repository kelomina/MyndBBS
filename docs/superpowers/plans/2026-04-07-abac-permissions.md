# ABAC Permission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the existing role-based access control (RBAC) with fine-grained attribute-based access control (ABAC) to ensure users can only edit their own posts, and moderators can be assigned to specific categories.

**Architecture:** Update the Prisma schema to support Category Moderators. Implement ABAC authorization logic in backend controllers to verify resource ownership (e.g., Post author) before allowing edit/delete actions.

**Tech Stack:** Node.js, Express, Prisma, TypeScript

---

### Task 1: Update Prisma Schema for Category Moderators

**Files:**
- Modify: `packages/backend/prisma/schema.prisma`
- Modify: `packages/backend/src/routes/admin.ts`
- Test: `packages/backend/tests/schema.test.ts` (create if needed)

- [ ] **Step 1: Add Category-Moderator relation in Prisma Schema**

```prisma
model Category {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  posts       Post[]
  moderators  CategoryModerator[]
}

model CategoryModerator {
  categoryId  String
  userId      String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([categoryId, userId])
}
```

- [ ] **Step 2: Generate Prisma Client**

Run: `cd packages/backend && npx prisma generate`
Expected: PASS with "Generated Prisma Client"

- [ ] **Step 3: Update Database Schema**

Run: `cd packages/backend && npx prisma db push`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/backend/prisma/schema.prisma
git commit -m "feat: add category moderators to schema"
```

### Task 2: Implement Post Ownership Authorization

**Files:**
- Create: `packages/backend/src/middleware/abac.ts`
- Create: `packages/backend/src/routes/post.ts`
- Modify: `packages/backend/src/app.ts` (to mount route)

- [ ] **Step 1: Create ABAC middleware**

```typescript
// packages/backend/src/middleware/abac.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export const requirePostOwnershipOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const postId = req.params.id;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role === 'ADMIN') {
      return next();
    }

    const post = await prisma.post.findUnique({ where: { id: postId }, include: { category: { include: { moderators: true } } } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check ownership
    if (post.authorId === user.userId) {
      return next();
    }

    // Check moderator status
    if (user.role === 'MODERATOR') {
      const isMod = post.category.moderators.some(mod => mod.userId === user.userId);
      if (isMod) return next();
    }

    return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 2: Create Post Routes with ABAC**

```typescript
// packages/backend/src/routes/post.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requirePostOwnershipOrAdmin } from '../middleware/abac';
import { prisma } from '../lib/prisma';

const router = Router();

router.delete('/:id', requireAuth, requirePostOwnershipOrAdmin, async (req, res) => {
  await prisma.post.delete({ where: { id: req.params.id } });
  res.json({ message: 'Post deleted' });
});

export default router;
```

- [ ] **Step 3: Mount Post Routes in App**

```typescript
// In packages/backend/src/app.ts (add these lines where routes are mounted)
// import postRoutes from './routes/post';
// app.use('/api/posts', postRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/middleware/abac.ts packages/backend/src/routes/post.ts
git commit -m "feat: implement post ownership and moderator abac"
```
