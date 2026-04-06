# Frontend i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement robust internationalization (i18n) support in the Next.js frontend, initially supporting English (en) and Simplified Chinese (zh-CN), using a modern React 19 / Next.js App Router compatible approach without heavy third-party state libraries.

**Architecture:** 
We will implement dictionary-based localization using React Server Components (RSC) and React Context for Client Components. 
1. A server-side `getDictionary` function will load JSON files based on the requested locale.
2. Next.js Middleware will detect the user's preferred language from `Accept-Language` headers and rewrite URLs or set a cookie, defaulting to `en`.
3. A Language Switcher component will allow manual overrides.

**Tech Stack:** Next.js 16.2.2 App Router, standard JSON dictionaries.

---

### Task 1: Setup i18n Dictionaries

**Files:**
- Create: `packages/frontend/src/i18n/config.ts`
- Create: `packages/frontend/src/i18n/dictionaries/en.json`
- Create: `packages/frontend/src/i18n/dictionaries/zh.json`
- Create: `packages/frontend/src/i18n/get-dictionary.ts`

- [ ] **Step 1: Create i18n configuration**
  Create `packages/frontend/src/i18n/config.ts`:

  ```typescript
  export const defaultLocale = 'en';
  export const locales = ['en', 'zh'] as const;
  export type Locale = (typeof locales)[number];
  ```

- [ ] **Step 2: Create English Dictionary**
  Create `packages/frontend/src/i18n/dictionaries/en.json`:

  ```json
  {
    "common": {
      "searchPlaceholder": "Search community...",
      "newPost": "New Post",
      "account": "Account",
      "categories": "Categories"
    },
    "nav": {
      "home": "Home",
      "popular": "Popular",
      "recent": "Recent"
    },
    "auth": {
      "welcomeBack": "Welcome back",
      "signInToAccount": "Sign in to your MyndBBS account",
      "emailAddress": "Email address",
      "password": "Password",
      "rememberMe": "Remember me",
      "forgotPassword": "Forgot password?",
      "signIn": "Sign in",
      "orContinueWith": "Or continue with",
      "signInWithPasskey": "Sign in with Passkey",
      "dontHaveAccount": "Don't have an account?",
      "signUpNow": "Sign up now"
    }
  }
  ```

- [ ] **Step 3: Create Chinese Dictionary**
  Create `packages/frontend/src/i18n/dictionaries/zh.json`:

  ```json
  {
    "common": {
      "searchPlaceholder": "搜索社区...",
      "newPost": "发帖",
      "account": "账号",
      "categories": "分类节点"
    },
    "nav": {
      "home": "首页",
      "popular": "热门",
      "recent": "最新"
    },
    "auth": {
      "welcomeBack": "欢迎回来",
      "signInToAccount": "登录您的 MyndBBS 账号",
      "emailAddress": "邮箱地址",
      "password": "密码",
      "rememberMe": "记住我",
      "forgotPassword": "忘记密码？",
      "signIn": "登录",
      "orContinueWith": "或其他登录方式",
      "signInWithPasskey": "使用 Passkey 快捷登录",
      "dontHaveAccount": "还没有账号？",
      "signUpNow": "立即注册"
    }
  }
  ```

- [ ] **Step 4: Create Dictionary Loader**
  Create `packages/frontend/src/i18n/get-dictionary.ts`:

  ```typescript
  import 'server-only';
  import type { Locale } from './config';

  const dictionaries = {
    en: () => import('./dictionaries/en.json').then((module) => module.default),
    zh: () => import('./dictionaries/zh.json').then((module) => module.default),
  };

  export const getDictionary = async (locale: Locale) => {
    return dictionaries[locale]?.() ?? dictionaries.en();
  };
  ```

- [ ] **Step 5: Commit**
  ```bash
  git add packages/frontend/src/i18n
  git commit -m "feat(frontend): add i18n dictionaries and loader"
  ```

### Task 2: Implement Locale Middleware and Routing

To support i18n in the App Router without fully dynamic routes, we will use a Cookie-based approach combined with Middleware. The server components will read the cookie to determine the locale.

**Files:**
- Create: `packages/frontend/src/middleware.ts`
- Modify: `packages/frontend/src/app/layout.tsx`

- [ ] **Step 1: Create Middleware**
  Create `packages/frontend/src/middleware.ts`:

  ```typescript
  import { NextResponse } from 'next/server';
  import type { NextRequest } from 'next/server';
  import { defaultLocale, locales } from './i18n/config';

  function getLocale(request: NextRequest): string {
    // 1. Check cookie
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
    if (cookieLocale && locales.includes(cookieLocale as any)) {
      return cookieLocale;
    }

    // 2. Check Accept-Language header
    const acceptLang = request.headers.get('Accept-Language');
    if (acceptLang) {
      if (acceptLang.includes('zh')) return 'zh';
    }

    return defaultLocale;
  }

  export function middleware(request: NextRequest) {
    const locale = getLocale(request);
    
    const response = NextResponse.next();
    
    // Set cookie if not present or differs from detected
    if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
      response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
    }
    
    // We pass the locale to headers so Server Components can read it without needing to parse cookies manually everywhere
    response.headers.set('x-locale', locale);

    return response;
  }

  export const config = {
    matcher: [
      '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
  };
  ```

- [ ] **Step 2: Update Root Layout to Provide Locale Context**
  Modify `packages/frontend/src/app/layout.tsx` to read the locale from the headers and pass the dictionary. Since `Header` is currently a Server Component, we can fetch the dictionary there.

  ```tsx
  import type { Metadata } from "next";
  import { headers } from "next/headers";
  import "./globals.css";
  import { Header } from "../components/layout/Header";
  import { Locale, defaultLocale } from "../i18n/config";

  export const metadata: Metadata = {
    title: "MyndBBS - Modern Community",
    description: "A clean, fast, and secure community platform.",
  };

  export default async function RootLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    // Await headers() in Next.js 15+
    const headersList = await headers();
    const locale = (headersList.get('x-locale') || defaultLocale) as Locale;

    return (
      <html lang={locale} suppressHydrationWarning>
        <body className="min-h-screen flex flex-col bg-background">
          <Header locale={locale} />
          <div className="flex-1">
            {children}
          </div>
        </body>
      </html>
    );
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add packages/frontend/src/middleware.ts packages/frontend/src/app/layout.tsx
  git commit -m "feat(frontend): implement i18n middleware and locale resolution"
  ```

### Task 3: Translate Header Component and Add Language Switcher

**Files:**
- Modify: `packages/frontend/src/components/layout/Header.tsx`
- Create: `packages/frontend/src/components/LanguageSwitcher.tsx`

- [ ] **Step 1: Create Language Switcher Component (Client Component)**
  Create `packages/frontend/src/components/LanguageSwitcher.tsx`:

  ```tsx
  'use client';

  import { useRouter } from 'next/navigation';
  import { Globe } from 'lucide-react';
  import { Locale } from '../i18n/config';

  export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
    const router = useRouter();

    const toggleLanguage = () => {
      const nextLocale = currentLocale === 'en' ? 'zh' : 'en';
      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000`;
      router.refresh();
    };

    return (
      <button
        onClick={toggleLanguage}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
        title={currentLocale === 'en' ? 'Switch to Chinese' : '切换至英文'}
      >
        <Globe className="h-5 w-5" />
        <span className="sr-only">Toggle Language</span>
      </button>
    );
  }
  ```

- [ ] **Step 2: Update Header to use Dictionary and Switcher**
  Modify `packages/frontend/src/components/layout/Header.tsx`:

  ```tsx
  import Link from 'next/link';
  import { Search, User, PenSquare } from 'lucide-react';
  import { getDictionary } from '../../i18n/get-dictionary';
  import { Locale } from '../../i18n/config';
  import { LanguageSwitcher } from '../LanguageSwitcher';

  export async function Header({ locale }: { locale: Locale }) {
    const dict = await getDictionary(locale);

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
                placeholder={dict.common.searchPlaceholder}
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <LanguageSwitcher currentLocale={locale} />
            <Link 
              href="/compose" 
              className="hidden sm:flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PenSquare className="mr-2 h-4 w-4" />
              {dict.common.newPost}
            </Link>
            <Link 
              href="/login"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
              title={dict.common.account}
            >
              <User className="h-5 w-5" />
              <span className="sr-only">{dict.common.account}</span>
            </Link>
          </div>
        </div>
      </header>
    );
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add packages/frontend/src/components
  git commit -m "feat(frontend): translate header and add language switcher"
  ```

### Task 4: Translate Sidebar and Home Page

**Files:**
- Modify: `packages/frontend/src/app/page.tsx`
- Modify: `packages/frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update Sidebar to accept dictionary**
  Modify `packages/frontend/src/components/layout/Sidebar.tsx`:

  ```tsx
  import Link from 'next/link';
  import { Home, TrendingUp, Clock, Hash } from 'lucide-react';

  export function Sidebar({ dict }: { dict: any }) {
    const MAIN_NAV = [
      { name: dict.nav.home, href: '/', icon: Home },
      { name: dict.nav.popular, href: '/popular', icon: TrendingUp },
      { name: dict.nav.recent, href: '/recent', icon: Clock },
    ];

    const CATEGORIES = [
      { name: 'Technology', href: '/c/tech' },
      { name: 'Life', href: '/c/life' },
      { name: 'Q&A', href: '/c/qa' },
    ];

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
              {dict.common.categories}
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

- [ ] **Step 2: Update Home Page**
  Modify `packages/frontend/src/app/page.tsx`:

  ```tsx
  import { headers } from "next/headers";
  import { Sidebar } from "../components/layout/Sidebar";
  import { MessageSquare, ArrowBigUp } from "lucide-react";
  import { Locale, defaultLocale } from "../i18n/config";
  import { getDictionary } from "../i18n/get-dictionary";

  const MOCK_POSTS = [
    { id: 1, title: "Welcome to MyndBBS! Here is our design philosophy.", author: "Admin", category: "Announcements", time: "2h ago", upvotes: 142, comments: 24, excerpt: "We are building a clean, light, and secure forum. In this post, we discuss why we chose Next.js and how we implemented WebAuthn for passwordless login." },
    { id: 2, title: "How to properly type Prisma queries in a monorepo?", author: "DevGuy", category: "Technology", time: "5h ago", upvotes: 38, comments: 12, excerpt: "I'm struggling with sharing Prisma types between my backend and frontend packages. Does anyone have a good pattern for this?" },
    { id: 3, title: "Share your minimal desk setups for 2026", author: "Minimalist", category: "Life", time: "1d ago", upvotes: 215, comments: 89, excerpt: "Since we're all about that clean/light aesthetic here, let's see where you write your code. Post your desk photos below!" },
  ];

  export default async function Home() {
    const headersList = await headers();
    const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return (
      <main className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
        <Sidebar dict={dict} />
        
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
  git add packages/frontend/src/components/layout/Sidebar.tsx packages/frontend/src/app/page.tsx
  git commit -m "feat(frontend): translate sidebar and inject dictionary into home page"
  ```

### Task 5: Translate Login Page

**Files:**
- Modify: `packages/frontend/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Translate Login Page**
  Modify `packages/frontend/src/app/(auth)/login/page.tsx`:

  ```tsx
  import Link from 'next/link';
  import { headers } from 'next/headers';
  import { Fingerprint } from 'lucide-react';
  import { getDictionary } from '../../../i18n/get-dictionary';
  import { Locale, defaultLocale } from '../../../i18n/config';

  export default async function LoginPage() {
    const headersList = await headers();
    const locale = (headersList.get('x-locale') || defaultLocale) as Locale;
    const dict = await getDictionary(locale);

    return (
      <div className="rounded-2xl bg-card px-8 py-10 shadow-sm border border-border/50">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{dict.auth.welcomeBack}</h2>
          <p className="mt-2 text-sm text-muted">
            {dict.auth.signInToAccount}
          </p>
        </div>

        <form className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                {dict.auth.emailAddress}
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
                {dict.auth.password}
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
                {dict.auth.rememberMe}
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-primary hover:text-primary/80">
                {dict.auth.forgotPassword}
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 transition-colors"
            >
              {dict.auth.signIn}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-2 text-muted">{dict.auth.orContinueWith}</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-background transition-colors"
            >
              <Fingerprint className="h-5 w-5 text-primary" />
              {dict.auth.signInWithPasskey}
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          {dict.auth.dontHaveAccount}{' '}
          <Link href="/register" className="font-medium text-primary hover:text-primary/80">
            {dict.auth.signUpNow}
          </Link>
        </p>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add packages/frontend/src/app/\(auth\)/login/page.tsx
  git commit -m "feat(frontend): translate login page"
  ```