# 修复 Turbopack 解析 Tailwind v4 插件失败的问题

## 背景与目的
在 Next.js 15+ 使用 Turbopack 和 Tailwind CSS v4 时，由于 pnpm 的 node_modules Hoisting（提升）机制和 Turbopack 的 CSS 解析器存在兼容性 Bug，导致在 `globals.css` 中直接使用 `@plugin "@tailwindcss/typography"` 会触发 `Can't resolve '@tailwindcss/typography'` 错误。

## 目标与价值
通过引入 Tailwind CSS 传统的 JS 配置文件（`tailwind.config.ts`），将插件的解析工作交给 Node.js，而不是 Turbopack 的 CSS 解析器，从而稳定绕过此 Bug 并成功激活排版插件。