# MyndBBS Frontend Layout & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational Clean/Light UI shell (Header, Sidebar) and the Authentication pages (Login/Register) for the MyndBBS frontend using Next.js App Router and Tailwind CSS.

**Architecture:** We will create a responsive layout shell using Next.js `app/layout.tsx`. The Header and Sidebar will be abstracted into reusable React components. Authentication pages will reside in their own route groups (e.g., `app/(auth)/login`) to avoid the global sidebar layout if necessary, or we can simply hide the sidebar on auth routes. For this iteration, we will implement the auth pages as clean, centered standalone layouts.

**Tech Stack:** Next.js (App Router), React 19, Tailwind CSS v4, Lucide React (for icons).

---

### Task 1: Setup Frontend UI Dependencies and Base Styles

**Files:**
- Modify: `packages/frontend/package.json`
- Modify: `packages/frontend/src/app/globals.css`

- [ ] **Step 1: Install Icon Library**
  Run: `cd packages/frontend && pnpm add lucide-react`
  Expected: Installation succeeds.

- [ ] **Step 2: Update Global CSS for Clean/Light Theme**
  Modify `packages/frontend/src/app/globals.css` to define the base background and text colors matching the spec.

  ```css
  @import "tailwindcss";

  @theme {
    --color-background: #f9fafb;
    --color-foreground: #111827;
    --color-card: #ffffff;
    --color-muted: #6b7280;
    --color-border: #e5e7eb;
    --color-primary: #0ea5e9; /* Teal/Blue accent */
    --color-primary-foreground: #ffffff;
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add packages/frontend/package.json packages/frontend/src/app/globals.css
  git commit -m "feat(frontend): setup base theme variables and icons"
  ```

### Task 2: Create Global Header Component

**Files:**
- Create: `packages/frontend/src/components/layout/Header.tsx`

- [ ] **Step 1: Implement Header Component**
  Create `packages/frontend/src/components/layout/Header.tsx`:

  ```tsx
  import Link from 'next/link';
  import { Search, User, PenSquare } from 'lucide-react';

  export function Header() {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold tracking-tight text-primary">
              MyndBBS
            </Link>
          </div>
          
          <div className="flex flex-1 items-center justify-center px-8">
            <div className="relative w-full max-w-md hidden sm:block">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-muted" />
              </div>
              <input
                type="search"
                className="block w-full rounded-full border border-border bg-background py-2 pl-10 pr-3 text-sm placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Search community..."
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Link 
              href="/compose" 
              className="hidden sm:flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PenSquare className="mr-2 h-4 w-4" />
              New Post
            </Link>
            <Link 
              href="/login"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
            >
              <User className="h-5 w-5" />
              <span className="sr-only">Account</span>
            </Link>
          </div>
        </div>
      </header>
    );
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add packages/frontend/src/components/layout/Header.tsx
  git commit -m "feat(frontend): create global header component"
  ```

### Task 3: Create Sidebar Component

**Files:**
- Create: `packages/frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Implement Sidebar Component**
  Create `packages/frontend/src/components/layout/Sidebar.tsx`:

  ```tsx
  import Link from 'next/link';
  import { Home, TrendingUp, Clock, Hash } from 'lucide-react';

  const MAIN_NAV = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Popular', href: '/popular', icon: TrendingUp },
    { name: 'Recent', href: '/recent', icon: Clock },
  ];

  const CATEGORIES = [
    { name: 'Technology', href: '/c/tech' },
    { name: 'Life', href: '/c/life' },
    { name: 'Q&A', href: '/c/qa' },
  ];

  export function Sidebar() {
    return (
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="sticky top-20 flex flex-col gap-8 py-6 pr-6">
          
          <nav className="flex flex-col gap-1">
            {MAIN_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white hover:shadow-sm"
                >
                  <Icon className="h-4 w-4 text-muted" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div>
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Categories
            </h3>
            <nav className="flex flex-col gap-1">
              {CATEGORIES.map((category) => (
                <Link
                  key={category.name}
                  href={category.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-white hover:text-foreground hover:shadow-sm"
                >
                  <Hash className="h-4 w-4 opacity-50" />
                  {category.name}
                </Link>
              ))}
            </nav>
          </div>
          
        </div>
      </aside>
    );
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add packages/frontend/src/components/layout/Sidebar.tsx
  git commit -m "feat(frontend): create left sidebar component"
  ```

### Task 4: Assemble Main Layout and Home Feed Shell

**Files:**
- Modify: `packages/frontend/src/app/layout.tsx`
- Modify: `packages/frontend/src/app/page.tsx`

- [ ] **Step 1: Update Root Layout**
  Modify `packages/frontend/src/app/layout.tsx` to include the Header. We will use route groups for the sidebar later, or conditionally render it, but for now, we'll put the header globally and structure the main body.

  ```tsx
  import type { Metadata } from "next";
  import "./globals.css";
  import { Header } from "../components/layout/Header";

  export const metadata: Metadata = {
    title: "MyndBBS - Modern Community",
    description: "A clean, fast, and secure community platform.",
  };

  export default function RootLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
      <html lang="en">
        <body className="min-h-screen flex flex-col bg-background">
          <Header />
          <div className="flex-1">
            {children}
          </div>
        </body>
      </html>
    );
  }
  ```

- [ ] **Step 2: Implement Home Page with Sidebar and Feed Placeholder**
  Modify `packages/frontend/src/app/page.tsx`:

  ```tsx
  import { Sidebar } from "../components/layout/Sidebar";
  import { MessageSquare, ArrowBigUp } from "lucide-react";

  // Mock data for the feed
  const MOCK_POSTS = [
    { id: 1, title: "Welcome to MyndBBS! Here is our design philosophy.", author: "Admin", category: "Announcements", time: "2h ago", upvotes: 142, comments: 24, excerpt: "We are building a clean, light, and secure forum. In this post, we discuss why we chose Next.js and how we implemented WebAuthn for passwordless login." },
    { id: 2, title: "How to properly type Prisma queries in a monorepo?", author: "DevGuy", category: "Technology", time: "5h ago", upvotes: 38, comments: 12, excerpt: "I'm struggling with sharing Prisma types between my backend and frontend packages. Does anyone have a good pattern for this?" },
    { id: 3, title: "Share your minimal desk setups for 2026", author: "Minimalist", category: "Life", time: "1d ago", upvotes: 215, comments: 89, excerpt: "Since we're all about that clean/light aesthetic here, let's see where you write your code. Post your desk photos below!" },
  ];

  export default function Home() {
    return (
      <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
        <Sidebar />
        
        {/* Main Feed Area */}
        <div className="flex-1 py-6 md:pl-8">
          <div className="mx-auto max-w-3xl space-y-4">
            {MOCK_POSTS.map((post) => (
              <article key={post.id} className="rounded-xl bg-card p-5 shadow-sm transition-shadow hover:shadow-md border border-border/50">
                <div className="mb-3 flex items-center justify-between text-xs text-muted">
                  <div className="flex items-center space-x-2">
                    <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">{post.author[0]}</div>
                    <span className="font-medium text-foreground">{post.author}</span>
                    <span>•</span>
                    <span>{post.time}</span>
                  </div>
                  <span className="rounded-full bg-background px-2.5 py-0.5 font-medium">
                    {post.category}
                  </span>
                </div>
                
                <h2 className="mb-2 text-xl font-bold text-foreground transition-colors hover:text-primary cursor-pointer">
                  {post.title}
                </h2>
                <p className="mb-4 text-sm text-muted line-clamp-2">
                  {post.excerpt}
                </p>
                
                <div className="flex items-center space-x-4 text-sm font-medium text-muted">
                  <button className="flex items-center space-x-1 transition-colors hover:text-primary">
                    <ArrowBigUp className="h-5 w-5" />
                    <span>{post.upvotes}</span>
                  </button>
                  <button className="flex items-center space-x-1 transition-colors hover:text-primary">
                    <MessageSquare className="h-4 w-4" />
                    <span>{post.comments}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    );
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add packages/frontend/src/app/layout.tsx packages/frontend/src/app/page.tsx
  git commit -m "feat(frontend): assemble main layout with sidebar and mock feed"
  ```

### Task 5: Create Authentication Layout and Login Page

**Files:**
- Create: `packages/frontend/src/app/(auth)/layout.tsx`
- Create: `packages/frontend/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create Auth Group Layout**
  Create `packages/frontend/src/app/(auth)/layout.tsx` to center auth cards on the screen:

  ```tsx
  export default function AuthLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          {children}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create Login Page**
  Create `packages/frontend/src/app/(auth)/login/page.tsx`:

  ```tsx
  import Link from 'next/link';
  import { Fingerprint } from 'lucide-react';

  export default function LoginPage() {
    return (
      <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
          <p className="mt-2 text-sm text-muted">
            Sign in to your MyndBBS account
          </p>
        </div>

        <form className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full rounded-lg border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm bg-background"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full rounded-lg border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm bg-background"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-muted">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-primary hover:text-primary/80">
                Forgot password?
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 transition-colors"
            >
              Sign in
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-2 text-muted">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-background transition-colors"
            >
              <Fingerprint className="h-5 w-5 text-primary" />
              Sign in with Passkey
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          Don't have an account?{' '}
          <Link href="/register" className="font-medium text-primary hover:text-primary/80">
            Sign up now
          </Link>
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add packages/frontend/src/app/\(auth\)
  git commit -m "feat(frontend): create login page with passkey option"
  ```

### Task 6: Create Registration Page

**Files:**
- Create: `packages/frontend/src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Create Register Page**
  Create `packages/frontend/src/app/(auth)/register/page.tsx`:

  ```tsx
  import Link from 'next/link';
  import { ShieldCheck } from 'lucide-react';

  export default function RegisterPage() {
    return (
      <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Join MyndBBS</h2>
          <p className="mt-2 text-sm text-muted">
            Create an account to join the conversation
          </p>
        </div>

        <form className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                required
                className="block w-full rounded-lg border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm bg-background"
              />
            </div>
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-foreground">
              Username
            </label>
            <div className="mt-1">
              <input
                id="username"
                name="username"
                type="text"
                required
                className="block w-full rounded-lg border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm bg-background"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                required
                className="block w-full rounded-lg border border-border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm bg-background"
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              Must be at least 8 characters, include uppercase, lowercase, number & special char.
            </p>
          </div>

          {/* Mock Captcha Area */}
          <div className="rounded-lg border border-dashed border-border bg-background p-4 flex items-center justify-center gap-2 text-sm text-muted">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            <span>Captcha Verification Area</span>
          </div>

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
            >
              Create Account
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary/80">
            Sign in
          </Link>
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add packages/frontend/src/app/\(auth\)/register
  git commit -m "feat(frontend): create register page with strong password hint and captcha placeholder"
  ```