# Permission System Security & Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the privilege escalation vulnerability where moderators have full admin access, and implement the API endpoints to manage category moderators.

**Architecture:** We will split the `requireAdmin` middleware into `requireSuperAdmin` (only `ADMIN`) and `requireModerator` (`ADMIN` or `MODERATOR`). We will then apply these to the appropriate admin routes. Finally, we will build the CRUD endpoints for `CategoryModerator` assignments.

**Tech Stack:** Node.js, Express, Prisma, TypeScript

---

### Task 1: Fix Privilege Escalation in Middlewares

**Files:**
- Modify: `packages/backend/src/middleware/auth.ts`

- [ ] **Step 1: Create `requireSuperAdmin` middleware**

```typescript
// Add to packages/backend/src/middleware/auth.ts
export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    return;
  }
  
  next();
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/middleware/auth.ts
git commit -m "fix: add requireSuperAdmin middleware to prevent privilege escalation"
```

### Task 2: Apply Strict Middlewares to Admin Routes

**Files:**
- Modify: `packages/backend/src/routes/admin.ts`

- [ ] **Step 1: Update admin route protections**

```typescript
// Replace router.use(requireAdmin) with specific route-level protections
// packages/backend/src/routes/admin.ts

import { Router } from 'express';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth';
import {
  getUsers, updateUserRole, updateUserStatus,
  getCategories, createCategory, deleteCategory,
  getPosts, updatePostStatus
} from '../controllers/admin';

const router: Router = Router();

router.use(requireAuth);

// Super Admin only routes (User Management & Category Structure)
router.get('/users', requireSuperAdmin, getUsers);
router.patch('/users/:id/role', requireSuperAdmin, updateUserRole);
router.patch('/users/:id/status', requireSuperAdmin, updateUserStatus);
router.post('/categories', requireSuperAdmin, createCategory);
router.delete('/categories/:id', requireSuperAdmin, deleteCategory);

// Moderator & Admin routes (Content Management)
router.get('/categories', requireAdmin, getCategories);
router.get('/posts', requireAdmin, getPosts);
router.patch('/posts/:id/status', requireAdmin, updatePostStatus);

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/routes/admin.ts
git commit -m "fix: apply strict super admin protections to critical routes"
```

### Task 3: Implement Category Moderator Management API

**Files:**
- Modify: `packages/backend/src/controllers/admin.ts`
- Modify: `packages/backend/src/routes/admin.ts`

- [ ] **Step 1: Add Controller logic for Category Moderators**

```typescript
// Add to packages/backend/src/controllers/admin.ts
export const assignCategoryModerator = async (req: Request, res: Response) => {
  try {
    const { categoryId, userId } = req.params;
    
    // Ensure both user and category exist, and user is a MODERATOR
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'MODERATOR') {
      return res.status(400).json({ error: 'User not found or is not a MODERATOR' });
    }

    const assignment = await prisma.categoryModerator.upsert({
      where: {
        categoryId_userId: { categoryId, userId }
      },
      update: {},
      create: { categoryId, userId }
    });

    res.json({ message: 'Moderator assigned', assignment });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const removeCategoryModerator = async (req: Request, res: Response) => {
  try {
    const { categoryId, userId } = req.params;
    
    await prisma.categoryModerator.delete({
      where: {
        categoryId_userId: { categoryId, userId }
      }
    });

    res.json({ message: 'Moderator removed' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
```

- [ ] **Step 2: Register Moderator Management Routes**

```typescript
// Add to packages/backend/src/routes/admin.ts (under Super Admin section)
// Make sure to import assignCategoryModerator, removeCategoryModerator

router.post('/categories/:categoryId/moderators/:userId', requireSuperAdmin, assignCategoryModerator);
router.delete('/categories/:categoryId/moderators/:userId', requireSuperAdmin, removeCategoryModerator);
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/controllers/admin.ts packages/backend/src/routes/admin.ts
git commit -m "feat: implement category moderator management APIs"
```
