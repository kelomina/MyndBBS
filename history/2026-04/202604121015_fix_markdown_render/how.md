# 技术设计方案

## 方案选型
选择了基于 `react-markdown` 的渲染方案（方案 1）。
此方案是 React 社区非常成熟、主流的 Markdown 渲染库，它基于 AST，默认防止 XSS 攻击（不渲染 HTML 标签或通过 `rehype-raw` / `rehype-sanitize` 进行控制），这相比直接通过 `dangerouslySetInnerHTML` 渲染 `marked` 的结果更为安全和符合 React 范式。

为了支持 GitHub Flavored Markdown (如表格、删除线等)，还会引入 `remark-gfm` 插件。

## 架构变更
1. **依赖更新**:
   - 在 `packages/frontend/package.json` 中添加 `react-markdown` 和 `remark-gfm` 依赖。

2. **组件修改**:
   - 修改 `packages/frontend/src/app/p/[id]/page.tsx` 中的帖子详情页，将原来渲染 `post.content` 的容器，改为引入并使用 `<ReactMarkdown>` 组件。
   - `packages/frontend/src/components/PostList.tsx` 中的列表页展示内容，可以保持为文本截断，但也可以考虑在列表页使用简单的文本截取（无需完全渲染 Markdown，或者剔除 Markdown 符号，保持简单）。根据代码，当前直接渲染为 `<p className="...">{post.content}</p>`，因为是摘要，如果原样保留 Markdown 字符可能稍显杂乱，但一般可以接受，这里主要聚焦在帖子详情页。

## 安全与性能评估
- **安全性**: `react-markdown` 默认过滤所有 HTML，只解析合法的 Markdown，具有极高的防 XSS 能力。
- **性能**: AST 解析会有少量开销，但在正常长度的帖子上可以忽略不计。