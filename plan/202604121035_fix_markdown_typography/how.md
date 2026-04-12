# 技术设计方案

## 方案选型
引入 Tailwind 官方的 Typography 插件（方案 1）。

## 架构变更
1. **依赖更新**:
   - 之前在探测过程中已经安装了 `@tailwindcss/typography`。
   
2. **样式配置修改**:
   - 由于项目使用的是 **Tailwind CSS v4**（通过 `packages/frontend/package.json` 中的 `@tailwindcss/postcss": "^4"` 确认），在 v4 版本中，引入插件的方式是在主 CSS 文件中使用 `@plugin` 规则。
   - 在 `packages/frontend/src/app/globals.css` 文件头部加入 `@plugin "@tailwindcss/typography";`。

3. **DOM 确认**:
   - `packages/frontend/src/app/p/[id]/page.tsx` 文件中的内容容器已经带有 `className="prose dark:prose-invert ..."`，因此只要引入了插件，该容器内的 HTML 标签将自动套用漂亮的默认样式。

## 安全与性能评估
- **安全性**: 仅涉及 CSS 渲染层面，对内容本身没有二次加工，不影响此前配置的防 XSS 安全性。
- **性能**: CSS 文件会略微增加几 KB 的体积，但这是为内容展示赋予必要样式的标准做法，且在生产环境中可被优化压缩。