# CQRS Query Services (Full Read-Side Migration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后端所有 Prisma 读查询与 DTO 组装从 Route/Controller/ApplicationService/lib 下沉到 `src/queries/**` 的按域 QueryService，实现读写 100% CQRS 分离。

**Architecture:** 按域划分 QueryService（community / identity / messaging / admin / system），QueryService 只做 Prisma read + DTO 映射；Route/Controller 仅负责参数校验、鉴权、调用 QueryService。

**Tech Stack:** TypeScript, Express, Prisma, CASL (@casl/ability + @casl/prisma), Redis (ioredis)

---

## Source Spec

- Design spec: `docs/superpowers/specs/2026-04-13-cqrs-query-services-design.md`

## File Map (What goes where)

**New (read-side only):**
- Create: `packages/backend/src/queries/community/dto.ts`
- Create: `packages/backend/src/queries/community/CommunityQueryService.ts`
- Create: `packages/backend/src/queries/identity/IdentityQueryService.ts`
- Create: `packages/backend/src/queries/messaging/dto.ts`
- Create: `packages/backend/src/queries/messaging/MessagingQueryService.ts`
- Create: `packages/backend/src/queries/admin/AdminQueryService.ts`
- Create: `packages/backend/src/queries/system/SystemQueryService.ts`

**Refactor (remove Prisma reads from presentation):**
- Modify: `packages/backend/src/routes/post.ts`
- Modify: `packages/backend/src/routes/category.ts`
- Modify: `packages/backend/src/controllers/auth.ts`
- Modify: `packages/backend/src/controllers/register.ts`
- Modify: `packages/backend/src/controllers/user.ts`
- Modify: `packages/backend/src/controllers/sudo.ts`
- Modify: `packages/backend/src/controllers/friend.ts`
- Modify: `packages/backend/src/controllers/message.ts`
- Modify: `packages/backend/src/controllers/admin.ts`
- Modify: `packages/backend/src/controllers/moderation.ts`

**Refactor (remove write-then-read Prisma from command-side, optional but required for “100% CQRS”):**
- Modify: `packages/backend/src/application/community/CommunityApplicationService.ts`
- Modify: `packages/backend/src/application/community/ModerationApplicationService.ts`
- Modify: `packages/backend/src/lib/moderation.ts`

---

## Task 0: Local verification prerequisites

**Files:** none

- [ ] **Step 1: Install dependencies**

Run:
```bash
pnpm -C packages/backend install
```
Expected: dependencies installed.

- [ ] **Step 2: Generate Prisma client**

Run:
```bash
pnpm -C packages/backend run generate
```
Expected: Prisma client generated.

- [ ] **Step 3: Baseline search snapshot (for later comparison)**

Run:
```bash
rg -n "prisma\\.[a-zA-Z0-9_]+\\.(findUnique|findMany|findFirst|count)" packages/backend/src/controllers packages/backend/src/routes packages/backend/src/application packages/backend/src/lib
```
Expected: many matches (current state).

---

## Task 1: CommunityQueryService (posts/categories/comments read DTO)

**Files:**
- Create: `packages/backend/src/queries/community/dto.ts`
- Create: `packages/backend/src/queries/community/CommunityQueryService.ts`

- [ ] **Step 1: Create DTO types**

Create `packages/backend/src/queries/community/dto.ts`:
```ts
import type { Prisma } from '@prisma/client';

export type PostListItemDTO = Prisma.PostGetPayload<{
  include: {
    author: { select: { id: true; username: true } };
    category: { select: { id: true; name: true; description: true } };
    _count: { select: { comments: true; upvotes: true } };
  };
}>;

export type PostDetailDTO = Prisma.PostGetPayload<{
  include: {
    author: { select: { id: true; username: true } };
    category: { select: { id: true; name: true; description: true } };
    _count: { select: { comments: true; upvotes: true; bookmarks: true } };
  };
}>;

export type PostInteractionDTO = { upvoted: boolean; bookmarked: boolean };

export type CommentListItemDTO = Prisma.CommentGetPayload<{
  include: {
    author: { select: { id: true; username: true } };
    _count: { select: { upvotes: true; bookmarks: true; replies: true } };
  };
}> & { hasUpvoted?: boolean; hasBookmarked?: boolean };

export type CategoryListItemDTO = Prisma.CategoryGetPayload<{}>;

export type ListPostsParams = {
  ability: import('../../lib/casl').AppAbility;
  category?: string;
  sortBy?: string;
  take?: number;
};

export type GetPostParams = {
  ability: import('../../lib/casl').AppAbility;
  postId: string;
};

export type ListPostCommentsParams = {
  ability: import('../../lib/casl').AppAbility;
  postId: string;
  currentUserId?: string;
  take?: number;
};
```

- [ ] **Step 2: Implement CommunityQueryService by lifting current route queries**

Create `packages/backend/src/queries/community/CommunityQueryService.ts`:
```ts
import { prisma } from '../../db';
import { accessibleBy } from '@casl/prisma';
import type { AppAbility } from '../../lib/casl';
import {
  CategoryListItemDTO,
  CommentListItemDTO,
  ListPostCommentsParams,
  ListPostsParams,
  PostDetailDTO,
  PostInteractionDTO,
  PostListItemDTO,
} from './dto';

export class CommunityQueryService {
  public async listCategories(): Promise<CategoryListItemDTO[]> {
    return prisma.category.findMany({ take: 1000, orderBy: { sortOrder: 'asc' } });
  }

  public async listPosts(params: ListPostsParams): Promise<PostListItemDTO[]> {
    const { ability, category, sortBy, take = 1000 } = params;

    const whereClause: any = { AND: [accessibleBy(ability).Post] };
    if (category) {
      whereClause.AND.push({ category: { name: String(category) } });
    }

    let orderByClause: any = { createdAt: 'desc' };
    if (sortBy === 'popular') orderByClause = { id: 'asc' };

    return prisma.post.findMany({
      take,
      where: whereClause,
      orderBy: orderByClause,
      include: {
        author: { select: { id: true, username: true } },
        category: { select: { id: true, name: true, description: true } },
        _count: { select: { comments: true, upvotes: true } },
      },
    });
  }

  public async getPostById(ability: AppAbility, postId: string): Promise<PostDetailDTO | null> {
    return prisma.post.findFirst({
      where: { AND: [{ id: postId }, accessibleBy(ability).Post] },
      include: {
        author: { select: { id: true, username: true } },
        category: { select: { id: true, name: true, description: true } },
        _count: { select: { comments: true, upvotes: true, bookmarks: true } },
      },
    });
  }

  public async getPostInteractions(ability: AppAbility, postId: string, userId: string): Promise<PostInteractionDTO | null> {
    const post = await prisma.post.findFirst({ where: { AND: [{ id: postId }, accessibleBy(ability).Post] } });
    if (!post) return null;

    const [upvote, bookmark] = await Promise.all([
      prisma.upvote.findUnique({ where: { userId_postId: { userId, postId } } }),
      prisma.bookmark.findUnique({ where: { userId_postId: { userId, postId } } }),
    ]);

    return { upvoted: !!upvote, bookmarked: !!bookmark };
  }

  public async listPostComments(params: ListPostCommentsParams): Promise<CommentListItemDTO[] | null> {
    const { ability, postId, currentUserId, take = 1000 } = params;

    const post = await prisma.post.findFirst({ where: { AND: [{ id: postId }, accessibleBy(ability).Post] } });
    if (!post) return null;

    const comments = await prisma.comment.findMany({
      take,
      where: { AND: [{ postId }, accessibleBy(ability).Comment] },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, username: true } },
        _count: { select: { upvotes: true, bookmarks: true, replies: true } },
      },
    });

    if (!currentUserId) return comments as any;

    const [userUpvotes, userBookmarks] = await Promise.all([
      prisma.commentUpvote.findMany({ where: { userId: currentUserId, comment: { postId } }, select: { commentId: true } }),
      prisma.commentBookmark.findMany({ where: { userId: currentUserId, comment: { postId } }, select: { commentId: true } }),
    ]);

    const upvotedSet = new Set(userUpvotes.map((u) => u.commentId));
    const bookmarkedSet = new Set(userBookmarks.map((b) => b.commentId));

    return (comments as any).map((comment: any) => ({
      ...comment,
      hasUpvoted: upvotedSet.has(comment.id),
      hasBookmarked: bookmarkedSet.has(comment.id),
    }));
  }
}

export const communityQueryService = new CommunityQueryService();
```

- [ ] **Step 3: Compile check (backend only)**

Run:
```bash
pnpm -C packages/backend run build
```
Expected: TypeScript build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/queries/community
 git commit -m "feat(query): add community query service"
```

---

## Task 2: Refactor routes/post.ts + routes/category.ts to use CommunityQueryService

**Files:**
- Modify: `packages/backend/src/routes/post.ts`
- Modify: `packages/backend/src/routes/category.ts`

- [ ] **Step 1: category.ts read path migration**

Replace Prisma read with service call:
```ts
import { communityQueryService } from '../queries/community/CommunityQueryService';

router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await communityQueryService.listCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'ERR_FAILED_TO_FETCH_CATEGORIES' });
  }
});
```

- [ ] **Step 2: post.ts GET endpoints migration**

In `packages/backend/src/routes/post.ts`:
1) Remove `import { prisma } from '../db';` (keep prisma for write-side only if still used in POST / for user level lookup until later tasks).
2) Remove `getAccessiblePost/getCommentWithPost` helper functions.
3) Inject:
```ts
import { communityQueryService } from '../queries/community/CommunityQueryService';
```
4) Rewrite read endpoints:

`GET /`:
```ts
const posts = await communityQueryService.listPosts({
  ability: req.ability!,
  category: req.query.category as any,
  sortBy: req.query.sortBy as any,
});
res.json(posts);
```

`GET /:id`:
```ts
const post = await communityQueryService.getPostById(req.ability!, req.params.id as string);
if (!post) {
  res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' });
  return;
}
res.json(post);
```

`GET /:id/interactions`:
```ts
const dto = await communityQueryService.getPostInteractions(req.ability!, req.params.id as string, req.user!.userId);
if (!dto) { res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' }); return; }
res.json(dto);
```

`GET /:id/comments`:
```ts
const dto = await communityQueryService.listPostComments({
  ability: req.ability!,
  postId: req.params.id as string,
  currentUserId: req.user?.userId,
});
if (!dto) { res.status(403).json({ error: 'ERR_POST_NOT_FOUND_OR_ACCESS_DENIED' }); return; }
res.json(dto);
```

- [ ] **Step 3: Run grep verification for routes read leakage**

Run:
```bash
rg -n "prisma\\.[a-zA-Z0-9_]+\\.(findUnique|findMany|findFirst|count)" packages/backend/src/routes | rg -v "routes/install.ts"
```
Expected: no matches in `routes/post.ts` and `routes/category.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/routes/post.ts packages/backend/src/routes/category.ts
 git commit -m "refactor(query): move community reads to query service"
```

---

## Task 3: IdentityQueryService (user/auth/passkey/session read DTO)

**Files:**
- Create: `packages/backend/src/queries/identity/IdentityQueryService.ts`
- Modify: `packages/backend/src/controllers/user.ts`
- Modify: `packages/backend/src/controllers/register.ts`
- Modify: `packages/backend/src/controllers/auth.ts`
- Modify: `packages/backend/src/controllers/sudo.ts`

- [ ] **Step 1: Implement IdentityQueryService**

Create `packages/backend/src/queries/identity/IdentityQueryService.ts`:
```ts
import { prisma } from '../../db';
import { accessibleBy } from '@casl/prisma';
import type { AppAbility } from '../../lib/casl';

export class IdentityQueryService {
  public async getProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        level: true,
        role: { select: { name: true } },
        isTotpEnabled: true,
        _count: { select: { passkeys: true } },
      },
    });
  }

  public async listBookmarks(userId: string) {
    const postBookmarks = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { post: { include: { author: { select: { id: true, username: true } }, category: { select: { id: true, name: true, description: true } } } } },
    });

    const commentBookmarks = await prisma.commentBookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { comment: { include: { author: { select: { id: true, username: true } }, post: { select: { id: true, title: true, status: true } } } } },
    });

    return [
      ...postBookmarks.map((b) => ({ ...(b as any).post, type: 'post', bookmarkedAt: b.createdAt })),
      ...commentBookmarks.map((b) => ({ ...(b as any).comment, type: 'comment', bookmarkedAt: b.createdAt })),
    ].sort((a: any, b: any) => b.bookmarkedAt.getTime() - a.bookmarkedAt.getTime());
  }

  public async listPasskeys(userId: string) {
    return prisma.passkey.findMany({
      where: { userId },
      select: { id: true, deviceType: true, backedUp: true, createdAt: true },
    });
  }

  public async countPasskeys(userId: string) {
    return prisma.passkey.count({ where: { userId } });
  }

  public async getUserForLogin(emailOrUsername: string) {
    return prisma.user.findFirst({
      where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] },
      include: { passkeys: true, role: true },
    });
  }

  public async getUserForRefresh(userId: string) {
    return prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  }

  public async getSessionById(sessionId: string) {
    return prisma.session.findUnique({ where: { id: sessionId } });
  }

  public async listSessions(userId: string) {
    return prisma.session.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  public async getPublicProfile(username: string, ability: AppAbility) {
    return prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        role: { select: { name: true } },
        createdAt: true,
        posts: {
          where: accessibleBy(ability).Post,
          select: { id: true, title: true, content: true, createdAt: true, category: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { posts: { where: accessibleBy(ability).Post } } },
      },
    });
  }

  public async getUserWithRoleById(userId: string) {
    return prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  }

  public async listUserPasskeyIds(userId: string) {
    return prisma.passkey.findMany({ where: { userId }, select: { id: true, counter: true, publicKey: true } });
  }

  public async getPasskeyById(passkeyId: string) {
    return prisma.passkey.findUnique({ where: { id: passkeyId } });
  }
}

export const identityQueryService = new IdentityQueryService();
```

- [ ] **Step 2: Refactor controllers to consume IdentityQueryService**

Update controllers:

1) `packages/backend/src/controllers/user.ts`
- `getProfile`: replace `prisma.user.findUnique` → `identityQueryService.getProfile(userId)`
- `getBookmarkedPosts`: replace both prisma queries → `identityQueryService.listBookmarks(userId)`
- `getPasskeys`: replace prisma query → `identityQueryService.listPasskeys(userId)`
- `deletePasskey`: replace `prisma.passkey.count` → `identityQueryService.countPasskeys(userId)`
- `getSessions`: use `identityQueryService.listSessions(userId)`
- `getPublicProfile`: use `identityQueryService.getPublicProfile(username, req.ability!)`

2) `packages/backend/src/controllers/register.ts`
- `loginUser`: replace `prisma.user.findFirst` → `identityQueryService.getUserForLogin(email)`
- `refreshToken`: replace `prisma.session.findUnique` / `prisma.user.findUnique` → `identityQueryService.getSessionById(decoded.sessionId)` / `identityQueryService.getUserForRefresh(decoded.userId)`

3) `packages/backend/src/controllers/auth.ts`
- `getUserFromTempToken`: replace `prisma.user.findUnique(include role)` → `identityQueryService.getUserWithRoleById(decoded.userId)`
- `generatePasskeyRegistrationOptions`: replace `prisma.passkey.findMany` → `identityQueryService.listUserPasskeyIds(user.id)`
- `verifyPasskeyAuthenticationResponse`: replace `prisma.passkey.findUnique` (and any user lookup) → `identityQueryService.getPasskeyById(...)` / `identityQueryService.getUserWithRoleById(...)`

4) `packages/backend/src/controllers/sudo.ts`
- `getSudoPasskeyOptions`: replace `prisma.passkey.findMany` → `identityQueryService.listUserPasskeyIds(userId)`
- `verifySudo`: replace `prisma.user.findUnique` / `prisma.passkey.findUnique` → `identityQueryService.getUserWithRoleById(userId)` / `identityQueryService.getPasskeyById(...)`

- [ ] **Step 3: Grep verification (identity read leakage)**

Run:
```bash
rg -n "prisma\\.[a-zA-Z0-9_]+\\.(findUnique|findMany|findFirst|count)" packages/backend/src/controllers/{user,register,auth,sudo}.ts
```
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/queries/identity/IdentityQueryService.ts packages/backend/src/controllers/user.ts packages/backend/src/controllers/register.ts packages/backend/src/controllers/auth.ts packages/backend/src/controllers/sudo.ts
 git commit -m "refactor(query): move identity reads to query service"
```

---

## Task 4: MessagingQueryService (messages/friends keys read DTO)

**Files:**
- Create: `packages/backend/src/queries/messaging/dto.ts`
- Create: `packages/backend/src/queries/messaging/MessagingQueryService.ts`
- Modify: `packages/backend/src/controllers/message.ts`
- Modify: `packages/backend/src/controllers/friend.ts`

- [ ] **Step 1: Create DTOs**

Create `packages/backend/src/queries/messaging/dto.ts`:
```ts
import type { Prisma } from '@prisma/client';

export type FriendshipDTO = Prisma.FriendshipGetPayload<{
  include: {
    requester: { select: { id: true; username: true } };
    addressee: { select: { id: true; username: true } };
  };
}>;

export type ConversationSettingsDTO = { allowTwoSidedDelete: boolean };
```

- [ ] **Step 2: Implement MessagingQueryService**

Create `packages/backend/src/queries/messaging/MessagingQueryService.ts`:
```ts
import { prisma } from '../../db';

export class MessagingQueryService {
  public async getMyKey(userId: string) {
    return prisma.userKey.findUnique({ where: { userId } });
  }

  public async getUserPublicKey(username: string) {
    return prisma.user.findUnique({ where: { username }, include: { userKey: true } });
  }

  public async getConversationSettings(userId: string, partnerId: string) {
    const setting = await prisma.conversationSetting.findUnique({ where: { userId_partnerId: { userId, partnerId } } });
    return { allowTwoSidedDelete: setting?.allowTwoSidedDelete || false };
  }

  public async getUnreadCount(userId: string) {
    return prisma.privateMessage.count({ where: { receiverId: userId, isRead: false } });
  }

  public async listFriends(userId: string) {
    return prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
    });
  }
}

export const messagingQueryService = new MessagingQueryService();
```

- [ ] **Step 3: Refactor controllers**

1) `packages/backend/src/controllers/message.ts`
- `getMyKey`: replace prisma query → `messagingQueryService.getMyKey(userId)`
- `getUserPublicKey`: replace prisma query → `messagingQueryService.getUserPublicKey(username)`
- `getConversationSettings`: replace prisma query → `messagingQueryService.getConversationSettings(userId, partnerId)`
- `getUnreadCount`: replace prisma query → `messagingQueryService.getUnreadCount(userId)`

2) `packages/backend/src/controllers/friend.ts`
- `getFriends`: replace prisma query → `messagingQueryService.listFriends(userId)`

- [ ] **Step 4: Grep verification**

Run:
```bash
rg -n "prisma\\.[a-zA-Z0-9_]+\\.(findUnique|findMany|findFirst|count)" packages/backend/src/controllers/{message,friend}.ts
```
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/queries/messaging packages/backend/src/controllers/message.ts packages/backend/src/controllers/friend.ts
 git commit -m "refactor(query): move messaging reads to query service"
```

---

## Task 5: AdminQueryService + SystemQueryService (admin reads)

**Files:**
- Create: `packages/backend/src/queries/admin/dto.ts`
- Create: `packages/backend/src/queries/admin/AdminQueryService.ts`
- Create: `packages/backend/src/queries/system/SystemQueryService.ts`
- Modify: `packages/backend/src/controllers/admin.ts`
- Modify: `packages/backend/src/controllers/moderation.ts`

- [ ] **Step 1: Implement AdminQueryService (core list views)**

Create `packages/backend/src/queries/admin/AdminQueryService.ts`:
```ts
import { prisma } from '../../db';
import { accessibleBy } from '@casl/prisma';
import type { AppAbility } from '../../lib/casl';
import { PostStatus } from '@prisma/client';

export class AdminQueryService {
  public async listUsers() {
    const users = await prisma.user.findMany({
      take: 1000,
      select: { id: true, username: true, email: true, role: { select: { name: true } }, status: true, createdAt: true },
    });
    return users.map((u) => ({ ...u, role: u.role?.name || null }));
  }

  public async listCategories() {
    return prisma.category.findMany({ take: 1000, orderBy: { sortOrder: 'asc' } });
  }

  public async listPosts(ability: AppAbility) {
    return prisma.post.findMany({
      take: 1000,
      where: accessibleBy(ability, 'read').Post,
      include: { author: { select: { username: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async listDeletedPosts(ability: AppAbility) {
    return prisma.post.findMany({
      take: 1000,
      where: { AND: [accessibleBy(ability, 'manage').Post, { status: PostStatus.DELETED }] },
      include: { author: { select: { username: true } }, category: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  public async getPostById(id: string) {
    return prisma.post.findUnique({ where: { id } });
  }

  public async listDeletedComments() {
    return prisma.comment.findMany({
      take: 1000,
      where: { deletedAt: { not: null } },
      include: { author: { select: { username: true } }, post: { select: { title: true } } },
      orderBy: { deletedAt: 'desc' },
    });
  }
}

export const adminQueryService = new AdminQueryService();
```

- [ ] **Step 2: Implement SystemQueryService (whitelist read)**

Create `packages/backend/src/queries/system/SystemQueryService.ts`:
```ts
import { prisma } from '../../db';

export class SystemQueryService {
  public async listRouteWhitelist() {
    return prisma.routeWhitelist.findMany({ orderBy: { createdAt: 'asc' } });
  }
}

export const systemQueryService = new SystemQueryService();
```

- [ ] **Step 3: Refactor admin.ts read functions to call query services**

Update `packages/backend/src/controllers/admin.ts`:
- `getUsers`: call `adminQueryService.listUsers()`
- `getCategories`: call `adminQueryService.listCategories()`
- `getPosts`: call `adminQueryService.listPosts(req.ability!)`
- `getDeletedPosts`: call `adminQueryService.listDeletedPosts(req.ability!)`
- `getDeletedComments`: call `adminQueryService.listDeletedComments()`
- `getRouteWhitelist`: call `systemQueryService.listRouteWhitelist()`

Also remove direct Prisma read usage inside these functions.

- [ ] **Step 4: Refactor moderation.ts read functions to call admin/system/community query services**

Create a new method on `AdminQueryService` (extend file) for queue reads by lifting existing logic from [controllers/moderation.ts](file:///workspace/packages/backend/src/controllers/moderation.ts):

Add to `AdminQueryService`:
```ts
public async getModeratorScope(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true, moderatedCategories: true } });
  const isSuperAdmin = user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'ADMIN';
  const categoryIds = isSuperAdmin ? undefined : user?.moderatedCategories.map((c) => c.categoryId);
  return { isSuperAdmin, categoryIds };
}

public async listModeratedWords(userId: string) {
  const { categoryIds } = await this.getModeratorScope(userId);
  return prisma.moderatedWord.findMany({
    take: 1000,
    where: categoryIds
      ? { OR: [{ categoryId: null }, { categoryId: { in: categoryIds } }] }
      : {},
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

public async listPendingPosts(userId: string) {
  const { categoryIds } = await this.getModeratorScope(userId);
  return prisma.post.findMany({
    take: 1000,
    where: { status: 'PENDING', ...(categoryIds ? { categoryId: { in: categoryIds } } : {}) },
    include: { author: { select: { username: true } }, category: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

public async listPendingComments(userId: string) {
  const { categoryIds } = await this.getModeratorScope(userId);
  return prisma.comment.findMany({
    take: 1000,
    where: {
      isPending: true,
      deletedAt: null,
      ...(categoryIds ? { post: { categoryId: { in: categoryIds } } } : {}),
    },
    include: { author: { select: { username: true } }, post: { select: { title: true, id: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
```

Then update `packages/backend/src/controllers/moderation.ts`:
- `getModeratedWords` → `adminQueryService.listModeratedWords(req.user!.userId)`
- `getPendingPosts` → `adminQueryService.listPendingPosts(req.user!.userId)`
- `getPendingComments` → `adminQueryService.listPendingComments(req.user!.userId)`

- [ ] **Step 5: Grep verification (admin/moderation read leakage)**

Run:
```bash
rg -n "prisma\\.[a-zA-Z0-9_]+\\.(findUnique|findMany|findFirst|count)" packages/backend/src/controllers/{admin,moderation}.ts
```
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/queries/admin packages/backend/src/queries/system packages/backend/src/controllers/admin.ts packages/backend/src/controllers/moderation.ts
 git commit -m "refactor(query): move admin reads to query services"
```

---

## Task 6: Remove read-side Prisma from ApplicationService + lib (required for “100% CQRS”)

**Files:**
- Modify: `packages/backend/src/application/community/CommunityApplicationService.ts`
- Modify: `packages/backend/src/application/community/ModerationApplicationService.ts`
- Modify: `packages/backend/src/lib/moderation.ts`
- Modify: `packages/backend/src/routes/post.ts`
- Modify: `packages/backend/src/controllers/admin.ts`

- [ ] **Step 1: CommunityApplicationService command return minimization**

In `CommunityApplicationService`:
- `createPost`: return `{ postId: string; isModerated: boolean }` (remove prisma DTO read)
- `updatePost`: return `{ postId: string }`
- `createComment`: return `{ commentId: string }`
- `updateComment`: return `{ commentId: string }`

Example for `createPost`:
```ts
public async createPost(...): Promise<{ postId: string; isModerated: boolean }> {
  ...
  await this.postRepository.save(post);
  return { postId: post.id, isModerated };
}
```

- [ ] **Step 2: ModerationApplicationService command return minimization**

In `ModerationApplicationService`:
- `approvePost/rejectPost/restorePost/changePostStatus`: return `{ postId: string }`
- `approveComment/rejectComment/restoreComment`: return `{ commentId: string }`

Example:
```ts
public async approvePost(postId: string): Promise<{ postId: string }> {
  ...
  await this.postRepository.save(post);
  this.eventBus.publish(...);
  return { postId };
}
```

- [ ] **Step 3: Replace command-follow-up reads in routes/controllers**

1) `routes/post.ts`:
- After `createPost`, call `communityQueryService.getPostById(req.ability!, postId)` to return rich DTO.

2) `controllers/admin.ts`:
- After moderation commands (updatePostStatus / restore / etc.), call `adminQueryService.getPostById(id)` (or a richer query method) to return DTO.

- [ ] **Step 4: Move moderated words read+cache out of lib/moderation.ts**

Replace `lib/moderation.ts` with a thin wrapper that delegates read to a new QueryService method (add to `AdminQueryService` or create `CommunityModerationQueryService`).

Concrete approach (keep callers stable):
- Create `packages/backend/src/queries/community/ModerationQueryService.ts` with:
```ts
import { prisma } from '../../db';
import redis from '../../lib/redis';

const MODERATION_CACHE_KEY = 'moderation_words';

export class ModerationQueryService {
  public async getModerationWords() {
    const cached = await redis.get(MODERATION_CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const words = await prisma.moderatedWord.findMany();
    const global: string[] = [];
    const category: Record<string, string[]> = {};

    for (const w of words) {
      if (w.categoryId) {
        const catId = w.categoryId as string;
        if (!category[catId]) category[catId] = [];
        category[catId]!.push(w.word);
      } else {
        global.push(w.word);
      }
    }

    const result = { global, category };
    await redis.set(MODERATION_CACHE_KEY, JSON.stringify(result), 'EX', 3600);
    return result;
  }

  public async clearModerationCache() {
    await redis.del(MODERATION_CACHE_KEY);
  }
}

export const moderationQueryService = new ModerationQueryService();
```

Then modify `packages/backend/src/lib/moderation.ts` to remove direct prisma usage and call `moderationQueryService.getModerationWords()`.

- [ ] **Step 5: Grep verification (application/lib read leakage)**

Run:
```bash
rg -n "prisma\\.[a-zA-Z0-9_]+\\.(findUnique|findMany|findFirst|count)" packages/backend/src/application packages/backend/src/lib
```
Expected: no matches (except `packages/backend/src/db.ts`).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/application/community packages/backend/src/lib/moderation.ts packages/backend/src/queries/community packages/backend/src/routes/post.ts packages/backend/src/controllers/admin.ts
 git commit -m "refactor(cqrs): remove command-side prisma reads"
```

---

## Task 7: Global verification & regression checklist

**Files:** none

- [ ] **Step 1: Global grep: no Prisma read in presentation/command layers**

Run:
```bash
rg -n "prisma\\.[a-zA-Z0-9_]+\\.(findUnique|findMany|findFirst|count)" packages/backend/src/controllers packages/backend/src/routes packages/backend/src/application packages/backend/src/lib \
  | rg -v "packages/backend/src/routes/install.ts" \
  | rg -v "packages/backend/src/db.ts" \
  | rg -v "packages/backend/src/queries/"
```
Expected: empty output.

- [ ] **Step 2: Build**

Run:
```bash
pnpm -C packages/backend run build
```
Expected: build succeeds.

- [ ] **Step 3: Manual smoke test (local server)**

Run:
```bash
pnpm -C packages/backend run dev
```
Expected: server starts; spot-check endpoints:
- `GET /api/categories`
- `GET /api/posts`
- `GET /api/posts/:id`
- `GET /api/v1/user/profile` (requires auth)

- [ ] **Step 4: Final commit (optional)**

If you prefer a single squash at end, stop here and squash; otherwise keep the incremental commits above.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-13-cqrs-query-services.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** - execute tasks in this session using executing-plans

Which approach?
