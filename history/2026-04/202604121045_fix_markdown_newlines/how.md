# 技术设计方案

## 方案选型
在传入 `<ReactMarkdown>` 前对 `post.content` 的字面量 `\n` 进行反转义替换。

## 架构变更
1. **内容处理**:
   - 在 `packages/frontend/src/app/p/[id]/page.tsx` 中，由于后台或者某种传输原因导致回车变成了文字的 `\n`，所以我们应该执行一次 `.replace(/\\n/g, '\n')` 操作。
   - 这也是由于 `textarea` 绑定的内容在某些提交或存储逻辑中可能被当成了普通字符串，导致后台存的是 `\\n`。
   - 代码：`<ReactMarkdown remarkPlugins={[remarkGfm]} children={post.content.replace(/\\n/g, '\n')} />`

## 安全与性能评估
- **安全性**: 该替换只影响排版控制符，不增加 XSS 风险。
- **性能**: 字符串的正则替换开销极低。