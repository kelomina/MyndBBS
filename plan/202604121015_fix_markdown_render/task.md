# 任务清单

- [ ] 任务 1: 在 `packages/frontend` 安装 `react-markdown` 和 `remark-gfm` 依赖。
- [ ] 任务 2: 在 `packages/frontend/src/app/p/[id]/page.tsx` 中引入 `react-markdown` 和 `remark-gfm`。
- [ ] 任务 3: 修改 `packages/frontend/src/app/p/[id]/page.tsx` 中的渲染逻辑，使用 `<ReactMarkdown>` 组件渲染 `post.content`。
- [ ] 任务 4: 进行安全性/类型检查，确保 `react-markdown` 相关引用正确，无潜在安全漏洞。
- [ ] 任务 5: (可选) 如果列表页的 Markdown 源码需要过滤，增加辅助函数；此步可根据效果决定是否需要。目前主要是详情页渲染修复。
- [ ] 任务 6: 按照 `Smart Function Crafting & Annotation` 要求，确保被修改的函数有正确的 JSDoc 注释（例如 `PostDetailPage`），并检查 `Callers` 和 `Callees` 是否需要更新。