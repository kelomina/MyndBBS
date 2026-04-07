# User Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the static User Center UI (profile and settings) to the backend database using a new public profile API and SSR.

**Architecture:** We will add a new Express route `GET /api/v1/user/public/:username` to fetch the public profile data using Prisma. The Next.js App Router will be updated to fetch this data server-side and render the profile page. Finally, we'll verify the settings page components correctly call the authenticated APIs.

**Tech Stack:** Express, Prisma, Next.js (App Router), React, Tailwind CSS

---

### Task 1: Implement Backend Public Profile API

**Files:**
- Create: `packages/backend/tests/publicProfile.test.js` (simple test script)
- Modify: `packages/backend/src/controllers/user.ts`
- Modify: `packages/backend/src/routes/user.ts`

- [ ] **Step 1: Write the failing test**

```javascript
// packages/backend/tests/publicProfile.test.js
const http = require('http');

http.get('http://localhost:3001/api/v1/user/public/nonexistent_user_123', (res) => {
  if (res.statusCode !== 404) {
    console.error('Expected 404, got ' + res.statusCode);
    process.exit(1);
  }
  console.log('Test passed: Got 404 for nonexistent user');
  process.exit(0);
}).on('error', (e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node packages/backend/tests/publicProfile.test.js`
Expected: FAIL with "Expected 404, got 404" (Wait, if the route doesn't exist, it might return 404 anyway. So we test for something specific, like an endpoint not found vs explicit 404 JSON, but a 404 is a good start. Let's just expect a 404, but actually the route doesn't exist so Express returns 404 HTML. To make it a real test, let's implement the route first, or just rely on the manual test since there is no test runner).

Wait, I will adjust the test to check for JSON.

```javascript
// packages/backend/tests/publicProfile.test.js
const http = require('http');

http.get('http://localhost:3001/api/v1/user/public/testuser', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode !== 404 && res.statusCode !== 200) {
      console.error('Failed: ' + res.statusCode);
      process.exit(1);
    }
    if (!data.includes('error') && !data.includes('user')) {
      console.error('Failed: No valid JSON response');
      process.exit(1);
    }
    console.log('Pass');
  });
});
```

- [ ] **Step 3: Write minimal implementation in Controller**

In `packages/backend/src/controllers/user.ts`, add:

```typescript
export const getPublicProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        role: true,
        createdAt: true,
        posts: {
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            category: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { posts: true } }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

- [ ] **Step 4: Add route to Express**

In `packages/backend/src/routes/user.ts`, import `getPublicProfile` and add:

```typescript
// Add near the bottom, before export
router.get('/public/:username', getPublicProfile);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node packages/backend/tests/publicProfile.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/controllers/user.ts packages/backend/src/routes/user.ts packages/backend/tests/publicProfile.test.js
git commit -m "feat(backend): add public profile API endpoint"
```

### Task 2: Implement Frontend SSR Profile Page

**Files:**
- Modify: `packages/frontend/src/app/u/[username]/page.tsx`

- [ ] **Step 1: Write the Server Component implementation**

Replace the contents of `packages/frontend/src/app/u/[username]/page.tsx` with:

```tsx
import { Calendar, MapPin, Link as LinkIcon } from 'lucide-react';
import { notFound } from 'next/navigation';

async function getProfile(username: string) {
  // Using localhost:3001 for server-side fetch to backend
  const res = await fetch(`http://localhost:3001/api/v1/user/public/${username}`, {
    cache: 'no-store' // or next: { revalidate: 60 }
  });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.user;
}

export default async function ProfilePage({ params }: { params: { username: string } }) {
  // Need to await params in Next.js 15+, but depending on version, we'll extract username
  const username = params.username;
  const user = await getProfile(username);

  if (!user) {
    notFound();
  }

  const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="h-48 w-full bg-gradient-to-r from-primary/40 to-blue-500/40"></div>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-24 mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="h-32 w-32 rounded-full border-4 border-background bg-card flex items-center justify-center text-4xl font-bold text-muted shadow-sm uppercase">
              {user.username[0]}
            </div>
            <div className="pb-2">
              <h1 className="text-3xl font-bold text-foreground">{user.username}</h1>
              <p className="text-muted text-sm capitalize">{user.role}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 space-y-6">
            <div className="rounded-xl bg-card p-5 shadow-sm border border-border/50 space-y-4">
              <div className="space-y-2 text-sm text-muted">
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Joined {joinDate}</div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-border">
                <div><span className="font-bold text-foreground">{user._count.posts}</span> <span className="text-muted text-sm">Posts</span></div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-2/3">
            <div className="border-b border-border mb-6">
              <nav className="-mb-px flex space-x-8">
                <span className="border-primary text-primary whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Posts ({user._count.posts})</span>
              </nav>
            </div>

            <div className="space-y-4">
              {user.posts.length === 0 ? (
                <p className="text-muted text-sm">No posts yet.</p>
              ) : (
                user.posts.map((post: any) => (
                  <div key={post.id} className="rounded-xl bg-card p-5 shadow-sm border border-border/50 transition-shadow hover:shadow-md cursor-pointer">
                    <h2 className="text-lg font-bold text-foreground mb-2">{post.title}</h2>
                    <p className="text-sm text-muted mb-4 line-clamp-2">{post.content}</p>
                    <div className="flex items-center text-xs text-muted gap-4">
                      <span>{post.category?.name || 'Uncategorized'}</span>
                      <span>•</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/app/u/\[username\]/page.tsx
git commit -m "feat(frontend): integrate public profile page with SSR"
```

### Task 3: Verify and Fix Settings Page

**Files:**
- Review: `packages/frontend/src/components/ProfileSettings.tsx`

- [ ] **Step 1: Check Settings Data Fetching**
The components `ProfileSettings.tsx`, `SecuritySettings.tsx`, and `SessionManagement.tsx` already contain fetch calls to `/api/v1/user/...` endpoints. The `next.config.ts` already has rewrites for `/api/*` to `http://localhost:3001/api/*`.
We just need to test that `/u/settings` works manually. No code changes needed here unless tests fail.

