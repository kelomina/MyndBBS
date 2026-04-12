# 修复 Markdown 渲染间距过大问题

## 背景与目的
在先前的纯文本渲染模式下，为了让文本保持原始换行和段落间距，帖子内容的包裹容器使用了 `whitespace-pre-wrap` 和 `space-y-4` 这两个 Tailwind 类。
当我们引入 `react-markdown` 之后，文本已经被解析为了结构化的 HTML 标签（如 `<p>`, `<h2>` 等），这些标签本身就含有换行符。`whitespace-pre-wrap` 使得浏览器将 HTML 标签之间的源码换行强行渲染为空白行，同时 `space-y-4` 又对每个标签额外增加了 Margin，导致视觉上出现了非常夸张的巨大间隙。

## 目标与价值
清理掉用于纯文本时代的冗余 CSS 类名，将排版完全交由 `@tailwindcss/typography` (`prose` 类) 来接管，使得帖子内容恢复标准的、阅读舒适的 Markdown 行距。