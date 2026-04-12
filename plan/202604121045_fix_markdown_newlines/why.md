# 修复 Markdown 渲染的换行符解析问题

## 背景与目的
在引入了 `react-markdown` 和 `@tailwindcss/typography` 之后，发现帖子内容仍然被渲染为一个巨大的纯文本节点，而不是多层 HTML 标签（如 `<h1>`, `<blockquote>`, `<p>`）。
从用户提供的 DevTools DOM 截图来看，`post.content` 中的文本很可能被 JSON 序列化/反序列化或其他机制处理为了带字面量 `\n` 的单行字符串（或者因为某些原因没有真正的回车），导致 Markdown 解析器认为这是一整段文本，无法识别出基于换行符的块级元素。

## 目标与价值
修复前端从接口获取的 `post.content` 中可能的转义换行符，确保 `react-markdown` 接收到包含真实换行的字符串，从而正确解析块级元素。