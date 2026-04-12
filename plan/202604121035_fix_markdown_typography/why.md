# 修复 Markdown 渲染的排版问题

## 背景与目的
在上一阶段的修复中，我们引入了 `react-markdown` 成功将帖子详情的内容从纯文本转换为了包含 HTML 标签（如 `<h1>`、`<blockquote>`、`<ul>` 等）的结构。但是由于本项目前端使用的是 **Tailwind CSS v4**，它的基础样式重置（Preflight）移除了所有 HTML 标签的默认浏览器样式，导致即便生成了正确的 DOM 结构，在视觉上依然像普通段落一样平淡无奇。

## 目标与价值
通过引入 Tailwind 的官方排版插件 `@tailwindcss/typography`，使带有 `prose` 类的容器中的 HTML 标签能够重新获得美观、合理的排版样式，从而使用户发布的 Markdown 内容真正得到“渲染”。