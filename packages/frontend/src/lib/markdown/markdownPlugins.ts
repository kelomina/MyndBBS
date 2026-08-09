import type { Content, Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * Upgrade a standalone single-line `$$…$$` expression to block (display) math.
 *
 * `remark-math` parses `$$x$$` on a single line as *inline* math (only the
 * multiline `$$\n…\n$$` fence form is treated as block math). Authors who put
 * an equation on its own line between `$$` delimiters expect display math.
 *
 * This plugin detects that case — a paragraph consisting of exactly one
 * `inlineMath` node whose raw source starts and ends with `$$` — and rewrites
 * it into the same block `math` node that `remark-math` produces for a
 * multiline fence, so `rehype-katex` renders it in display mode.
 */
export const remarkDisplayMath: Plugin<[], Root> = function () {
  return (tree, file) => {
    const source = typeof file.value === 'string' ? file.value : ''

    visit(tree, 'paragraph', (paragraph, index, parent) => {
      if (!parent || index === undefined) return
      if (paragraph.children.length !== 1) return

      const inline = paragraph.children[0]
      if (inline.type !== 'inlineMath') return

      // Determine whether the author wrote `$$…$$` (not `$…$` or `\(…\)`)
      // by inspecting the raw markdown the paragraph was parsed from.
      const position = paragraph.position
      if (position?.start.offset === undefined || position?.end.offset === undefined) return
      const raw = source.slice(position.start.offset, position.end.offset).trim()
      if (!raw.startsWith('$$') || !raw.endsWith('$$')) return

      const value = String((inline as unknown as { value?: string }).value ?? '')
      const mathNode = {
        type: 'math' as const,
        value,
        data: {
          hName: 'pre' as const,
          hChildren: [
            {
              type: 'element' as const,
              tagName: 'code',
              properties: { className: ['language-math', 'math-display'] },
              children: [{ type: 'text' as const, value }],
            },
          ],
        },
      }

      parent.children[index] = mathNode as unknown as Content
    })
  }
}
