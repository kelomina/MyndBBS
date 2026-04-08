# Guest & User Level Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine USER permissions into LEVEL.1 to LEVEL.6, provide an ability payload for Guests to the browser, and allow Admin+ to restrict category access by user level.

**Architecture:** 
1. **Schema:** Add `level` (Int, default 1) to `User` model. Add `minLevel` (Int, default 0) to `Category` model. (0 = Guest allowed, 1-6 = User levels).
2. **CASL:** Update `AbilityUser` to include `level`. Update rules to enforce `category: { minLevel: { lte: userLevel } }`. Guest has level 0.
3. **API:** Add `optionalAuth` middleware to populate `req.ability` without failing on missing tokens. Add `GET /api/v1/auth/ability` endpoint for the frontend to fetch current user's (or guest's) abilities. Update `createCategory` and add `updateCategory` in admin controller to allow setting `minLevel`.

**Tech Stack:** Node.js, Express, Prisma, CASL

---

### Task 1: Database Schema Updates

**Files:**
- Modify: `/workspace/packages/backend/prisma/schema.prisma`

- [ ] **Step 1: Add `level` to User and `minLevel` to Category**

```prisma
// In schema.prisma, update User and Category models:

model User {
  // ... existing fields
  status             String    @default("ACTIVE")
  level              Int       @default(1) // ADD THIS LINE
  registeredIp       String?
  // ... existing fields
}

model Category {
  // ... existing fields
  sortOrder   Int      @default(0)
  minLevel    Int      @default(0) // ADD THIS LINE
  createdAt   DateTime @default(now())
  // ... existing fields
}
```

- [ ] **Step 2: Generate Prisma Client and Migrate/Push**

Run: `cd /workspace/packages/backend && npx prisma db push && npx prisma generate`
Expected: Database schema pushed and client generated successfully.

- [ ] **Step 3: Commit**

```bash
git add /workspace/packages/backend/prisma/schema.prisma
git commit -m "feat: add user level and category minLevel"
```

### Task 2: CASL Rules Updates

**Files:**
- Modify: `/workspace/packages/backend/src/lib/casl.ts`

- [ ] **Step 1: Update AbilityUser and rules**

```typescript
// Update AbilityUser type:
type AbilityUser = {
  id: string;
  role: string;
  level: number;
  moderatedCategories?: { categoryId: string }[];
};

// Update defineAbilityFor:
export function defineAbilityFor(user?: AbilityUser) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);
  
  const userLevel = user ? user.level : 0;

  if (!user) {
    // Guest
    can('read', 'Post', { status: 'PUBLISHED', category: { is: { minLevel: 0 } } } as any);
    can('read', 'Category', { minLevel: 0 });
    return build();
  }

  // Baseline permissions for authenticated users
  can('read', 'Category', { minLevel: { lte: userLevel } });
  can('read', 'Post', { category: { is: { minLevel: { lte: userLevel } } } } as any);
  
  // They can only create posts in categories they have access to
  can('create', 'Post', { category: { is: { minLevel: { lte: userLevel } } } } as any);
  
  can('update', 'Post', { authorId: user.id });
  can('delete', 'Post', { authorId: user.id });

  // Define based on role
  if (user.role === 'SUPER_ADMIN') {
    can('manage', 'all');
  } else if (user.role === 'ADMIN') {
    can('manage', 'all');
  } else if (user.role === 'MODERATOR') {
    can('read', 'all');
    can('read', 'AdminPanel');
  } else {
    // Regular User
  }

  // Category Moderator logic
  if (user.moderatedCategories && user.moderatedCategories.length > 0) {
    const categoryIds = user.moderatedCategories.map((mc) => mc.categoryId);
    can('manage', 'Post', { categoryId: { in: categoryIds } });
  }

  return build();
}
```

- [ ] **Step 2: Commit**

```bash
git add /workspace/packages/backend/src/lib/casl.ts
git commit -m "feat: update CASL rules for user levels and guest access"
```

### Task 3: Auth Middleware & Endpoint Updates

**Files:**
- Modify: `/workspace/packages/backend/src/middleware/auth.ts`
- Modify: `/workspace/packages/backend/src/controllers/auth.ts`
- Modify: `/workspace/packages/backend/src/routes/auth.ts`

- [ ] **Step 1: Add optionalAuth and update requireAuth in auth.ts middleware**

```typescript
// In src/middleware/auth.ts, update requireAuth's defineAbilityFor call:
/*
    const dbUser = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { level: true } });
    req.ability = defineAbilityFor({
      id: decoded.userId,
      role: decoded.role,
      level: dbUser?.level || 1,
      moderatedCategories
    });
*/

// Add optionalAuth function:
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  let token = req.cookies?.accessToken;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    req.ability = defineAbilityFor(undefined);
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    // For simplicity, assuming valid token if verifiable (skipping redis check for optional route)
    // Or just copy the redis check logic
    const dbUser = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { level: true } });
    
    let moderatedCategories = [];
    if (decoded.role === 'MODERATOR') {
      moderatedCategories = await prisma.categoryModerator.findMany({
        where: { userId: decoded.userId },
        select: { categoryId: true }
      });
    }

    req.user = { userId: decoded.userId, sessionId: decoded.sessionId, role: decoded.role };
    req.ability = defineAbilityFor({
      id: decoded.userId,
      role: decoded.role,
      level: dbUser?.level || 1,
      moderatedCategories
    });
  } catch (error) {
    // Invalid token, treat as guest
    req.ability = defineAbilityFor(undefined);
  }
  next();
};
```

- [ ] **Step 2: Add getAbility to auth controller**

```typescript
// In src/controllers/auth.ts
export const getAbility = async (req: AuthRequest, res: Response): Promise<void> => {
  // Assuming optionalAuth was used before this
  res.json({ rules: req.ability?.rules || [] });
};
```

- [ ] **Step 3: Expose /api/v1/auth/ability route**

```typescript
// In src/routes/auth.ts
import { optionalAuth } from '../middleware/auth';
import { getAbility } from '../controllers/auth';

// Add the route:
router.get('/ability', optionalAuth, getAbility);
```

- [ ] **Step 4: Commit**

```bash
git add /workspace/packages/backend/src/middleware/auth.ts /workspace/packages/backend/src/controllers/auth.ts /workspace/packages/backend/src/routes/auth.ts
git commit -m "feat: expose ability rules to browser and handle optional auth"
```

### Task 4: Category Admin Management Updates

**Files:**
- Modify: `/workspace/packages/backend/src/controllers/admin.ts`
- Modify: `/workspace/packages/backend/src/routes/admin.ts`

- [ ] **Step 1: Update createCategory and add updateCategory in admin controller**

```typescript
// In src/controllers/admin.ts
export const createCategory = async (req: AuthRequest, res: Response) => {
  const { name, description, sortOrder, minLevel } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  const category = await prisma.category.create({
    data: { name, description, sortOrder: sortOrder || 0, minLevel: minLevel || 0 }
  });

  await logAudit(operatorId, 'CREATE_CATEGORY', `Category:${category.id}`);
  res.status(201).json(category);
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, description, sortOrder, minLevel } = req.body;
  const operatorId = req.user?.userId || 'unknown';

  const category = await prisma.category.update({
    where: { id },
    data: { name, description, sortOrder, minLevel }
  });

  await logAudit(operatorId, 'UPDATE_CATEGORY', `Category:${category.id}`);
  res.json(category);
};
```

- [ ] **Step 2: Register updateCategory route**

```typescript
// In src/routes/admin.ts
// import updateCategory
router.put('/categories/:id', requireAuth, requireAbility('update', 'Category'), updateCategory);
// OR use 'manage' ability if 'update' is not granted specifically
```

- [ ] **Step 3: Commit**

```bash
git add /workspace/packages/backend/src/controllers/admin.ts /workspace/packages/backend/src/routes/admin.ts
git commit -m "feat: allow admins to set minLevel for categories"
```

