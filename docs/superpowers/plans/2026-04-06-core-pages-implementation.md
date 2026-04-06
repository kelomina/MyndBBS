# Core Pages & Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Dark Mode support across the entire frontend and build the remaining core pages: Post Detail, Compose Editor, User Profile, and Account Settings.
**Architecture:** 
- **Dark Mode**: Use `next-themes` combined with Tailwind's `dark:` variant and CSS variables to provide a seamless light/dark toggle.
- **Pages**: Standard App Router pages with mocked data.
**Tech Stack:** Next.js App Router, Tailwind CSS, `next-themes`, `lucide-react`.

---

### Task 1: Implement Dark Mode via next-themes

**Files:**
- Modify: `packages/frontend/package.json`
- Modify: `packages/frontend/src/app/globals.css`
- Create: `packages/frontend/src/components/ThemeProvider.tsx`
- Create: `packages/frontend/src/components/ThemeToggle.tsx`
- Modify: `packages/frontend/src/app/layout.tsx`
- Modify: `packages/frontend/src/components/layout/Header.tsx`

- [ ] **Step 1: Install next-themes**
  Run: `cd packages/frontend && pnpm add next-themes`

- [ ] **Step 2: Update CSS Variables for Dark Mode**
  Modify `packages/frontend/src/app/globals.css` to add dark mode variables:
  ```css
  @import "tailwindcss";

  @theme {
    --color-background: #f9fafb;
    --color-foreground: #111827;
    --color-card: #ffffff;
    --color-muted: #6b7280;
    --color-border: #e5e7eb;
    --color-primary: #0ea5e9;
    --color-primary-foreground: #ffffff;
  }

  /* Note: Tailwind 4 allows inline dark mode variants or custom CSS media queries. 
     Using class-based approach for next-themes compatibility. */
  .dark {
    --color-background: #0f172a;
    --color-foreground: #f8fafc;
    --color-card: #1e293b;
    --color-muted: #94a3b8;
    --color-border: #334155;
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  ```

- [ ] **Step 3: Create ThemeProvider**
  Create `packages/frontend/src/components/ThemeProvider.tsx`:
  ```tsx
  'use client';

  import * as React from 'react';
  import { ThemeProvider as NextThemesProvider } from 'next-themes';

  export function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </NextThemesProvider>
    );
  }
  ```

- [ ] **Step 4: Create ThemeToggle Component**
  Create `packages/frontend/src/components/ThemeToggle.tsx`:
  ```tsx
  'use client';

  import * as React from 'react';
  import { Moon, Sun } from 'lucide-react';
  import { useTheme } from 'next-themes';

  export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);
    if (!mounted) return <div className="h-9 w-9" />;

    return (
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
        title="Toggle Theme"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        <span className="sr-only">Toggle Theme</span>
      </button>
    );
  }
  ```

- [ ] **Step 5: Inject Provider into Layout and Toggle into Header**
  Modify `packages/frontend/src/app/layout.tsx` to wrap children in `ThemeProvider`:
  ```tsx
  import type { Metadata } from "next";
  import { headers } from "next/headers";
  import "./globals.css";
  import { Header } from "../components/layout/Header";
  import { Locale, defaultLocale } from "../i18n/config";
  import { ThemeProvider } from "../components/ThemeProvider";

  export const metadata: Metadata = {
    title: "MyndBBS - Modern Community",
    description: "A clean, fast, and secure community platform.",
  };

  export default async function RootLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    const headersList = await headers();
    const locale = (headersList.get('x-locale') || defaultLocale) as Locale;

    return (
      <html lang={locale} suppressHydrationWarning>
        <body className="min-h-screen flex flex-col bg-background transition-colors duration-300">
          <ThemeProvider>
            <Header locale={locale} />
            <div className="flex-1">
              {children}
            </div>
          </ThemeProvider>
        </body>
      </html>
    );
  }
  ```
  Modify `packages/frontend/src/components/layout/Header.tsx` to include `ThemeToggle` next to `LanguageSwitcher` (import it and place it in the right-side flex container).

- [ ] **Step 6: Commit**
  ```bash
  git add packages/frontend/src
  git commit -m "feat(frontend): implement dark mode with next-themes"
  ```

### Task 2: Create Post Detail Page

**Files:**
- Create: `packages/frontend/src/app/p/[id]/page.tsx`

- [ ] **Step 1: Create Post Detail Page**
  Create `packages/frontend/src/app/p/[id]/page.tsx`:
  ```tsx
  import { Sidebar } from "../../../components/layout/Sidebar";
  import { MessageSquare, ArrowBigUp, Bookmark, Share } from "lucide-react";
  import { headers } from "next/headers";
  import { Locale, defaultLocale } from "../../../i18n/config";
  import { getDictionary } from "../../../i18n/get-dictionary";

  export default async function PostDetailPage({ params }: { params: { id: string } }) {
    const headersList = await headers();
    const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return (
      <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
        <Sidebar dict={dict} />
        
        <div className="flex-1 py-6 md:pl-8">
          <div className="mx-auto max-w-3xl">
            {/* Post Content */}
            <article className="rounded-xl bg-card p-6 shadow-sm border border-border/50 mb-6">
              <div className="mb-6 flex items-center justify-between text-sm text-muted">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg">A</div>
                  <div>
                    <div className="font-medium text-foreground">Admin</div>
                    <div className="text-xs">2 hours ago</div>
                  </div>
                </div>
                <span className="rounded-full bg-background px-3 py-1 font-medium border border-border">
                  Announcements
                </span>
              </div>
              
              <h1 className="mb-6 text-3xl font-bold text-foreground">
                Welcome to MyndBBS! Here is our design philosophy.
              </h1>
              
              <div className="prose dark:prose-invert max-w-none text-foreground space-y-4">
                <p>We are building a clean, light, and secure forum. In this post, we discuss why we chose Next.js and how we implemented WebAuthn for passwordless login.</p>
                <p>Our philosophy is simple: Content first, distractions second. We use plenty of whitespace, soft shadows, and careful typography to make reading a joy.</p>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>console.log("Hello World");</code>
                </pre>
              </div>
              
              <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center space-x-6 text-muted">
                  <button className="flex items-center space-x-2 transition-colors hover:text-primary">
                    <ArrowBigUp className="h-6 w-6" />
                    <span className="font-medium">142</span>
                  </button>
                  <button className="flex items-center space-x-2 transition-colors hover:text-primary">
                    <MessageSquare className="h-5 w-5" />
                    <span className="font-medium">24</span>
                  </button>
                </div>
                <div className="flex items-center space-x-4 text-muted">
                  <button className="transition-colors hover:text-foreground"><Bookmark className="h-5 w-5" /></button>
                  <button className="transition-colors hover:text-foreground"><Share className="h-5 w-5" /></button>
                </div>
              </div>
            </article>

            {/* Comments Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground mb-4">Comments (24)</h3>
              
              {/* Comment Input */}
              <div className="rounded-xl bg-card p-4 shadow-sm border border-border/50 flex gap-4">
                <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs mt-1">U</div>
                <div className="flex-1 space-y-3">
                  <textarea 
                    className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-y"
                    placeholder="Write a comment..."
                  ></textarea>
                  <div className="flex justify-end">
                    <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                      Post Comment
                    </button>
                  </div>
                </div>
              </div>

              {/* Mock Comment */}
              <div className="rounded-xl bg-card p-5 shadow-sm border border-border/50">
                <div className="flex space-x-3">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">D</div>
                  <div>
                    <div className="flex items-baseline space-x-2">
                      <span className="font-medium text-foreground text-sm">DevGuy</span>
                      <span className="text-xs text-muted">1 hour ago</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">
                      This looks amazing! The dark mode support is exactly what I was hoping for.
                    </p>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-muted font-medium">
                      <button className="hover:text-primary">Reply</button>
                      <button className="hover:text-primary flex items-center gap-1"><ArrowBigUp className="h-4 w-4" /> 12</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </main>
    );
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add packages/frontend/src/app/p
  git commit -m "feat(frontend): create post detail page"
  ```

### Task 3: Create Compose Editor Page

**Files:**
- Create: `packages/frontend/src/app/compose/page.tsx`

- [ ] **Step 1: Create Compose Page**
  Create `packages/frontend/src/app/compose/page.tsx`:
  ```tsx
  import { ArrowLeft, Image as ImageIcon, Link as LinkIcon, List, Bold, Italic } from 'lucide-react';
  import Link from 'next/link';

  export default function ComposePage() {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          
          <div className="mb-8 flex items-center justify-between">
            <Link href="/" className="flex items-center text-sm font-medium text-muted hover:text-foreground transition-colors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
            <button className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
              Publish
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <select className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary w-48">
                <option value="">Select Category...</option>
                <option value="tech">Technology</option>
                <option value="life">Life</option>
                <option value="qa">Q&A</option>
              </select>
            </div>

            <input 
              type="text" 
              placeholder="Post Title" 
              className="w-full bg-transparent text-4xl font-bold text-foreground placeholder-muted focus:outline-none"
            />

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col min-h-[400px]">
              {/* Toolbar */}
              <div className="flex items-center gap-1 border-b border-border p-2 bg-background/50">
                <button className="p-2 text-muted hover:text-foreground hover:bg-background rounded"><Bold className="h-4 w-4" /></button>
                <button className="p-2 text-muted hover:text-foreground hover:bg-background rounded"><Italic className="h-4 w-4" /></button>
                <div className="w-px h-4 bg-border mx-2"></div>
                <button className="p-2 text-muted hover:text-foreground hover:bg-background rounded"><List className="h-4 w-4" /></button>
                <div className="w-px h-4 bg-border mx-2"></div>
                <button className="p-2 text-muted hover:text-foreground hover:bg-background rounded"><LinkIcon className="h-4 w-4" /></button>
                <button className="p-2 text-muted hover:text-foreground hover:bg-background rounded"><ImageIcon className="h-4 w-4" /></button>
              </div>
              
              {/* Editor Area */}
              <textarea 
                className="flex-1 w-full bg-transparent p-4 text-foreground placeholder-muted focus:outline-none resize-none"
                placeholder="Write your content here... (Markdown supported)"
              ></textarea>
            </div>
          </div>

        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add packages/frontend/src/app/compose
  git commit -m "feat(frontend): create compose editor page"
  ```

### Task 4: Create Profile and Settings Pages

**Files:**
- Create: `packages/frontend/src/app/u/[username]/page.tsx`
- Create: `packages/frontend/src/app/settings/page.tsx`

- [ ] **Step 1: Create Profile Page**
  Create `packages/frontend/src/app/u/[username]/page.tsx`:
  ```tsx
  import { Calendar, MapPin, Link as LinkIcon } from 'lucide-react';

  export default function ProfilePage({ params }: { params: { username: string } }) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background">
        {/* Cover Photo */}
        <div className="h-48 w-full bg-gradient-to-r from-primary/40 to-blue-500/40"></div>
        
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-16 sm:-mt-24 mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-6">
              <div className="h-32 w-32 rounded-full border-4 border-background bg-card flex items-center justify-center text-4xl font-bold text-muted shadow-sm">
                {params.username[0].toUpperCase()}
              </div>
              <div className="pb-2">
                <h1 className="text-3xl font-bold text-foreground">{params.username}</h1>
                <p className="text-muted">@frontend_dev</p>
              </div>
            </div>
            <div className="pb-2 flex gap-3">
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
                Follow
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Left Column: Info */}
            <div className="w-full md:w-1/3 space-y-6">
              <div className="rounded-xl bg-card p-5 shadow-sm border border-border/50 space-y-4">
                <p className="text-sm text-foreground">Passionate developer building clean and light user interfaces.</p>
                <div className="space-y-2 text-sm text-muted">
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> San Francisco, CA</div>
                  <div className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> <a href="#" className="text-primary hover:underline">github.com</a></div>
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Joined April 2026</div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-border">
                  <div><span className="font-bold text-foreground">42</span> <span className="text-muted text-sm">Followers</span></div>
                  <div><span className="font-bold text-foreground">12</span> <span className="text-muted text-sm">Following</span></div>
                </div>
              </div>
            </div>

            {/* Right Column: Content Tabs */}
            <div className="w-full md:w-2/3">
              <div className="border-b border-border mb-6">
                <nav className="-mb-px flex space-x-8">
                  <a href="#" className="border-primary text-primary whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Posts (12)</a>
                  <a href="#" className="border-transparent text-muted hover:border-border hover:text-foreground whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Comments (48)</a>
                  <a href="#" className="border-transparent text-muted hover:border-border hover:text-foreground whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Upvoted</a>
                </nav>
              </div>
              
              {/* Mock Post List */}
              <div className="space-y-4">
                <div className="rounded-xl bg-card p-5 shadow-sm border border-border/50 transition-shadow hover:shadow-md cursor-pointer">
                  <h2 className="text-lg font-bold text-foreground mb-2">My journey learning Next.js App Router</h2>
                  <p className="text-sm text-muted mb-4 line-clamp-2">It was challenging at first, but understanding Server Components changed everything.</p>
                  <div className="flex items-center text-xs text-muted gap-4">
                    <span>Technology</span>
                    <span>•</span>
                    <span>3 days ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create Settings Page**
  Create `packages/frontend/src/app/settings/page.tsx`:
  ```tsx
  import { Fingerprint, Shield, User, Bell, Palette } from 'lucide-react';

  export default function SettingsPage() {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Settings</h1>
        
        <div className="flex flex-col md:flex-row gap-8">
          {/* Settings Nav */}
          <nav className="w-full md:w-64 flex flex-col gap-1 shrink-0">
            <a href="#" className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-sm font-medium text-foreground shadow-sm border border-border/50">
              <User className="h-4 w-4" /> Profile
            </a>
            <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-card hover:text-foreground transition-colors">
              <Shield className="h-4 w-4" /> Security & Passkeys
            </a>
            <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-card hover:text-foreground transition-colors">
              <Palette className="h-4 w-4" /> Appearance
            </a>
            <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-card hover:text-foreground transition-colors">
              <Bell className="h-4 w-4" /> Notifications
            </a>
          </nav>

          {/* Settings Content Area */}
          <div className="flex-1 space-y-8">
            {/* Mocking the Security Tab as it's the most critical for our features */}
            <div className="rounded-xl bg-card p-6 shadow-sm border border-border/50">
              <h2 className="text-xl font-bold text-foreground mb-1">Security & Passkeys</h2>
              <p className="text-sm text-muted mb-6">Manage your password and secure passwordless login methods.</p>
              
              <div className="space-y-6">
                <div className="pb-6 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground mb-4">Change Password</h3>
                  <div className="space-y-4 max-w-md">
                    <input type="password" placeholder="Current Password" className="block w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    <input type="password" placeholder="New Password" className="block w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">Update Password</button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-foreground mb-4">Passkeys</h3>
                  <p className="text-sm text-muted mb-4">Passkeys allow you to securely sign in using your device's fingerprint, face scan, or screen lock.</p>
                  
                  <div className="rounded-lg border border-border bg-background p-4 flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Fingerprint className="h-8 w-8 text-primary" />
                      <div>
                        <div className="text-sm font-medium text-foreground">MacBook Pro Touch ID</div>
                        <div className="text-xs text-muted">Added Apr 6, 2026 • Last used today</div>
                      </div>
                    </div>
                    <button className="text-sm text-red-500 hover:text-red-600 font-medium">Remove</button>
                  </div>

                  <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-background transition-colors">
                    <Fingerprint className="h-4 w-4" /> Add New Passkey
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add packages/frontend/src/app/u packages/frontend/src/app/settings
  git commit -m "feat(frontend): create profile and settings pages"
  ```