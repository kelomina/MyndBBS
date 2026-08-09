import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize from 'rehype-sanitize'
import { katexSanitizeSchema } from '../lib/markdown/mathSanitizeSchema'
import { remarkDisplayMath } from '../lib/markdown/markdownPlugins'

interface MarkdownContentProps {
  content: string
}

/**
 * Renders forum markdown (GitHub-flavored + KaTeX math) as static HTML.
 *
 * This is a server component: `rehype-katex` runs at request/build time and
 * produces the math markup in the server-rendered HTML, so no client-side math
 * pass is needed. The sanitizer runs *before* `rehype-katex` (see
 * `katexSanitizeSchema`), which is the ordering recommended by
 * `rehype-sanitize`.
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkDisplayMath]}
      rehypePlugins={[[rehypeSanitize, katexSanitizeSchema], rehypeKatex]}
    >
      {content}
    </ReactMarkdown>
  )
}
