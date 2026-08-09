import { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize'

/**
 * Sanitize schema used for forum markdown content.
 *
 * `remark-math` turns `$…$` / `$$…$$` into `math` / `inlineMath` mdast nodes,
 * which `remark-rehype` renders as intermediate elements:
 *
 *   - inline: `<code class="language-math math-inline">…</code>`
 *   - block:  `<pre><code class="language-math math-display">…</code></pre>`
 *
 * The sanitizer runs *before* `rehype-katex`, so those intermediate nodes must
 * survive it. The KaTeX output itself is produced *after* sanitization and is
 * therefore never filtered — this is the pattern recommended by
 * `rehype-sanitize` (sanitize the input first, render math afterwards), and it
 * keeps the schema from having to allow KaTeX's inline styles or MathML/SVG.
 *
 * Raw HTML in markdown is not rendered by `react-markdown` by default, so the
 * only elements reaching this sanitizer come from markdown constructs or the
 * math markers above.
 */
export const katexSanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', /^language-math$/],
      ['className', 'math-inline'],
      ['className', 'math-display'],
    ],
  },
}
