# 全局函数调用图与功能注释计划 (Global Function Call Graph and Documentation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 分析整个项目的源码（共约 117 个文件），在每一个函数（无论是前端还是后端）的开头加上统一格式的注释，说明：哪些函数会调用这个函数（Callers），这个函数又会调用哪些函数（Callees），以及这个函数的功能是什么（Purpose）。

**Architecture:** 
由于项目规模庞大，我们将按照代码库的逻辑模块进行拆分，共分为 9 个主要任务（Tasks）。在每个任务中，执行者需要：
1. 阅读指定目录下的所有 TS/TSX/JS/JSX 文件，提取出每一个函数（包括导出函数和内部函数）。
2. 使用全局搜索工具（如 `rg` / `grep`）查找该函数在整个项目中的调用位置，以确定**调用者（Callers）**。
3. 分析该函数的方法体，找出它内部调用的其他函数，以确定**被调用者（Callees）**。
4. 总结该函数的业务逻辑，得出**功能描述（Purpose）**。
5. 使用文件编辑工具将固定格式的 JSDoc 注释插入到每个函数的上方。

**Tech Stack:** TypeScript, React (Next.js), Node.js (Express), Prisma

---

## 统一注释模板 (JSDoc Template)

在所有任务中，对于**每一个函数**，必须在其正上方插入以下格式的注释（请根据实际情况替换括号内内容）：

```typescript
/**
 * 功能：[详细描述函数的功能，例如：验证用户登录密码并生成 JWT 令牌]
 * 调用者：[列出调用此函数的函数或文件位置，例如：`loginController (packages/backend/src/controllers/auth.ts)`。如果没有则写“无（入口/顶层调用）”]
 * 被调用者：[列出此函数内部调用的其他核心函数，例如：`validatePassword (packages/shared/src/utils/validations.ts)`, `signJwt()`。如果没有则写“无”]
 */
```

---

### Task 1: 分析并注释 `packages/shared`

**Files:**
- Modify: `packages/shared/src/**/*.ts` (如 `utils/validations.ts`, `constants/index.ts` 等)

- [ ] **Step 1: 提取所有函数**
阅读 `packages/shared/src` 下的所有文件，列出所有函数（如 `validateEmail`, `validatePassword` 等）。

- [ ] **Step 2: 查找全局调用者并分析被调用者与功能**
使用 `rg "函数名"` 在 `packages/` 目录下搜索调用位置。阅读函数体确定被调用者和功能。

- [ ] **Step 3: 插入注释**
在每个函数上方插入上述规定的 JSDoc 注释模板。

- [ ] **Step 4: Commit**
```bash
git add packages/shared/src
git commit -m "docs(shared): add call graph and description comments to functions"
```

---

### Task 2: 分析并注释 `packages/backend/src/lib` 和 `middleware`

**Files:**
- Modify: `packages/backend/src/lib/**/*.ts` (如 `audit.ts`, `casl.ts`, `redis.ts` 等)
- Modify: `packages/backend/src/middleware/**/*.ts` (如 `auth.ts`)

- [ ] **Step 1: 提取所有函数**
阅读 `lib` 和 `middleware` 目录下的所有文件，列出所有函数。

- [ ] **Step 2: 查找全局调用者并分析被调用者与功能**
搜索 `lib` 和 `middleware` 中各个函数在后端的调用情况（如 `authMiddleware` 等）。

- [ ] **Step 3: 插入注释**
在每个函数上方插入上述规定的 JSDoc 注释模板。

- [ ] **Step 4: Commit**
```bash
git add packages/backend/src/lib packages/backend/src/middleware
git commit -m "docs(backend): add call graph comments to lib and middleware"
```

---

### Task 3: 分析并注释 `packages/backend/src/controllers` 和 `db.ts`

**Files:**
- Modify: `packages/backend/src/controllers/**/*.ts`
- Modify: `packages/backend/src/db.ts`

- [ ] **Step 1: 提取所有函数**
阅读 `controllers` 目录下的所有文件（如 `admin.ts`, `auth.ts`, `user.ts` 等）以及 `db.ts`。

- [ ] **Step 2: 查找全局调用者并分析被调用者与功能**
对于控制器函数，调用者通常是 `routes` 中的路由定义。查找对应路由即可。

- [ ] **Step 3: 插入注释**
在每个函数上方插入 JSDoc 注释模板。

- [ ] **Step 4: Commit**
```bash
git add packages/backend/src/controllers packages/backend/src/db.ts
git commit -m "docs(backend): add call graph comments to controllers and db"
```

---

### Task 4: 分析并注释 `packages/backend/src/routes` 和 `index.ts`

**Files:**
- Modify: `packages/backend/src/routes/**/*.ts`
- Modify: `packages/backend/src/index.ts`

- [ ] **Step 1: 提取所有函数**
这些文件主要是路由注册函数或服务器启动入口。提取所有包裹的函数。

- [ ] **Step 2: 查找全局调用者并分析被调用者与功能**
入口函数通常没有调用者，或由框架调用。被调用者主要是控制器和中间件。

- [ ] **Step 3: 插入注释**
在每个函数上方插入 JSDoc 注释模板。

- [ ] **Step 4: Commit**
```bash
git add packages/backend/src/routes packages/backend/src/index.ts
git commit -m "docs(backend): add call graph comments to routes and index"
```

---

### Task 5: 分析并注释 `packages/frontend/src/lib`, `i18n`, `proxy.ts`

**Files:**
- Modify: `packages/frontend/src/lib/**/*.ts` (如 `api/fetcher.ts`, `hooks.ts` 等)
- Modify: `packages/frontend/src/i18n/**/*.ts`
- Modify: `packages/frontend/src/proxy.ts`

- [ ] **Step 1: 提取所有函数**
列出前端工具类、API 请求类、Hook 和国际化函数。

- [ ] **Step 2: 查找全局调用者并分析被调用者与功能**
在 `packages/frontend/src` 目录下使用 `rg` 查找这些函数的调用者。

- [ ] **Step 3: 插入注释**
在每个函数上方插入 JSDoc 注释模板。

- [ ] **Step 4: Commit**
```bash
git add packages/frontend/src/lib packages/frontend/src/i18n packages/frontend/src/proxy.ts
git commit -m "docs(frontend): add call graph comments to lib, i18n, proxy"
```

---

### Task 6: 分析并注释 `packages/frontend/src/components/ui` 和 `layout`

**Files:**
- Modify: `packages/frontend/src/components/ui/**/*.tsx`
- Modify: `packages/frontend/src/components/layout/**/*.tsx`

- [ ] **Step 1: 提取所有函数组件**
列出这些基础 UI 组件和布局组件（如 `Button.tsx`, `Header.tsx` 等）。

- [ ] **Step 2: 查找全局调用者并分析被调用者与功能**
搜索组件被引入（import）和使用（如 `<Button>`）的位置，即为调用者。被调用者为组件内部的其他钩子或函数。

- [ ] **Step 3: 插入注释**
在每个组件函数（以及组件内部的辅助函数）上方插入 JSDoc 注释模板。

- [ ] **Step 4: Commit**
```bash
git add packages/frontend/src/components/ui packages/frontend/src/components/layout
git commit -m "docs(frontend): add call graph comments to ui and layout components"
```

---

### Task 7: 分析并注释前端通用组件 `packages/frontend/src/components`

**Files:**
- Modify: `packages/frontend/src/components/*.tsx` (排除上述已处理的目录)

- [ ] **Step 1: 提取所有函数组件**
阅读该目录下的组件代码（如 `PostEditor.tsx`, `SessionManagement.tsx` 等）。

- [ ] **Step 2: 查找全局调用者并分析被调用者与功能**
在 `app` 等页面目录下搜索这些组件的使用位置。

- [ ] **Step 3: 插入注释**
在每个组件函数上方插入 JSDoc 注释模板。

- [ ] **Step 4: Commit**
```bash
git add packages/frontend/src/components/*.tsx
git commit -m "docs(frontend): add call graph comments to general components"
```

---

### Task 8: 分析并注释前端 Auth 和 Admin 页面组件

**Files:**
- Modify: `packages/frontend/src/app/(auth)/**/*.tsx`
- Modify: `packages/frontend/src/app/admin/**/*.tsx`

- [ ] **Step 1: 提取所有页面函数组件和客户端组件**
这些是 Next.js App Router 页面组件。

- [ ] **Step 2: 查找全局调用者并分析被调用者与功能**
页面组件通常由 Next.js 框架调用（调用者写“Next.js App Router”）。找出它们内部调用的钩子、组件或工具函数作为被调用者。

- [ ] **Step 3: 插入注释**
在每个页面组件和内部处理函数（如 `handleSubmit` 等）上方插入 JSDoc 注释模板。

- [ ] **Step 4: Commit**
```bash
git add packages/frontend/src/app/\(auth\) packages/frontend/src/app/admin
git commit -m "docs(frontend): add call graph comments to auth and admin pages"
```

---

### Task 9: 分析并注释前端剩余页面组件

**Files:**
- Modify: `packages/frontend/src/app/**/*.tsx` (排除 `(auth)` 和 `admin`)

- [ ] **Step 1: 提取所有页面函数组件**
包括根目录的页面、`/p/[id]`, `/u/[username]` 等路由页面。

- [ ] **Step 2: 查找全局调用者并分析被调用者与功能**
与 Task 8 类似，处理调用者和被调用者。

- [ ] **Step 3: 插入注释**
在每个组件上方插入 JSDoc 注释模板。

- [ ] **Step 4: Commit**
```bash
git add packages/frontend/src/app
git commit -m "docs(frontend): add call graph comments to remaining pages"
```
