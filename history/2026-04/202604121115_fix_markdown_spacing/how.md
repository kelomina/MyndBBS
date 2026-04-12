# 技术设计方案

## 方案选型
在 `page.tsx` 中直接删除导致排版冲突的 CSS 类名。

## 架构变更
1. **代码层面**:
   - 定位 `packages/frontend/src/app/p/[id]/page.tsx` 中包围 `<ReactMarkdown>` 的 `<div className="...">`。
   - 原始 `className` 是 `"prose dark:prose-invert max-w-none text-foreground space-y-4 whitespace-pre-wrap"`。
   - 修改后 `className` 为 `"prose dark:prose-invert max-w-none text-foreground"`。
   - 去除 `space-y-4` 和 `whitespace-pre-wrap` 即可让 `prose` 完全接管标签的 `margin` 和浏览器默认换行逻辑。

## 安全与性能评估
- **安全性**: 该修改仅改变了 CSS 类，不改变任何业务逻辑或 XSS 风险面。
- **性能**: 对运行性能无影响，反而略微减少了 CSS 的复杂度。