# MyndBBS Initial Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the MyndBBS Monorepo infrastructure with Next.js, Express, Prisma, and strict coding standards.

**Architecture:** Monorepo using pnpm workspace containing frontend (Next.js), backend (Express), and shared (TypeScript definitions).

**Tech Stack:** Node.js, TypeScript, Next.js, Express, Prisma, pnpm, ESLint, Prettier, Husky.

---

### Task 1: Root Workspace Initialization

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`

- [ ] **Step 1: Initialize pnpm package**

```bash
pnpm init
```

- [ ] **Step 2: Modify package.json for root workspace**

Update `package.json` to include `"private": true` and common scripts.

```json
{
  "name": "myndbbs-root",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:frontend": "pnpm --filter frontend dev",
    "dev:backend": "pnpm --filter backend dev",
    "lint": "pnpm --filter '*' lint",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\""
  }
}
```

- [ ] **Step 3: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml
git commit -m "chore: initialize pnpm workspace"
```

### Task 2: Root Linting and Formatting Setup

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `eslint.config.mjs` (or `.eslintrc.js`)

- [ ] **Step 1: Install Prettier and ESLint**

```bash
pnpm add -w -D prettier eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin typescript
```

- [ ] **Step 2: Create .prettierrc**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 3: Create .eslintrc.js**

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    'complexity': ['error', 10],
    'max-lines-per-function': ['error', 50]
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add .prettierrc .eslintrc.js package.json pnpm-lock.yaml
git commit -m "chore: setup root eslint and prettier"
```

### Task 3: Initialize Shared Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/constants/index.ts`
- Create: `packages/shared/tsconfig.json`

- [ ] **Step 1: Create shared package directory and init**

```bash
mkdir -p packages/shared/src/constants
cd packages/shared && pnpm init
```

- [ ] **Step 2: Modify shared package.json**

Set name to `@myndbbs/shared` and main to `src/index.ts`.

```json
{
  "name": "@myndbbs/shared",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

- [ ] **Step 3: Create initial constants file**

`packages/shared/src/constants/index.ts`:
```typescript
export const APP_NAME = 'MyndBBS'
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024 // 5MB
```

`packages/shared/src/index.ts`:
```typescript
export * from './constants'
```

- [ ] **Step 4: Commit**

```bash
cd ../../
git add packages/shared
git commit -m "feat: initialize shared package"
```

### Task 4: Initialize Backend Package

**Files:**
- Create: `packages/backend/package.json`
- Create: `packages/backend/src/index.ts`

- [ ] **Step 1: Create backend directory and install dependencies**

```bash
mkdir -p packages/backend/src
cd packages/backend
pnpm init
```

Update `package.json` name to `@myndbbs/backend`.

- [ ] **Step 2: Install Express and Prisma**

```bash
pnpm add express cors helmet
pnpm add -D typescript @types/express @types/node ts-node nodemon prisma
```

- [ ] **Step 3: Initialize Prisma**

```bash
npx prisma init
```

- [ ] **Step 4: Create simple Express server**

`packages/backend/src/index.ts`:
```typescript
import express from 'express'
import { APP_NAME } from '@myndbbs/shared'

const app = express()
const port = process.env.PORT || 3001

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: APP_NAME })
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
```

- [ ] **Step 5: Link shared package to backend**

```bash
pnpm add @myndbbs/shared@workspace:*
```

- [ ] **Step 6: Commit**

```bash
cd ../../
git add packages/backend
git commit -m "feat: initialize backend package with express and prisma"
```

### Task 5: Initialize Frontend Package

**Files:**
- Create: `packages/frontend/package.json`

- [ ] **Step 1: Create Next.js app in frontend directory**

```bash
cd packages
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

- [ ] **Step 2: Link shared package to frontend**

```bash
cd frontend
pnpm add @myndbbs/shared@workspace:*
```

- [ ] **Step 3: Update page to use shared constant**

Modify `packages/frontend/src/app/page.tsx`:
```tsx
import { APP_NAME } from '@myndbbs/shared'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to {APP_NAME}</h1>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd ../../
git add packages/frontend
git commit -m "feat: initialize frontend package with next.js"
```