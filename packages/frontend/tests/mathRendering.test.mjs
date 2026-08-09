import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import { katexSanitizeSchema } from '../src/lib/markdown/mathSanitizeSchema.ts';
import { remarkDisplayMath } from '../src/lib/markdown/markdownPlugins.ts';

// Renders exactly the pipeline used by <MarkdownContent>: sanitize the input
// first (so KaTeX's inline styles / MathML / SVG are never filtered), then
// render math with rehype-katex. remark-math produces intermediate
// `<code class="language-math …">` nodes that katexSanitizeSchema preserves.
function renderMarkdown(md) {
  return renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm, remarkMath, remarkDisplayMath],
        rehypePlugins: [[rehypeSanitize, katexSanitizeSchema], rehypeKatex],
      },
      md,
    ),
  );
}

function summarize(html) {
  const display = (html.match(/katex-display/g) || []).length;
  const inline = (html.match(/class="katex"/g) || []).length - display;
  const errors = (html.match(/katex-error/g) || []).length;
  return { display, inline, errors };
}

test('inline and block math render to KaTeX output', async (t) => {
  const md = [
    '复杂度 $\\mathcal{O}(B \\cdot H \\cdot T^2)$ 与 $C=512$',
    '',
    '$$\n\\text{Memory}_{\\text{DSRA}} \\approx \\mathcal{O}(B \\cdot H \\cdot K)\n$$',
  ].join('\n');

  const html = renderMarkdown(md);
  const stats = summarize(html);

  await t.test('inline math gets the katex class, display math gets katex-display', () => {
    assert.equal(stats.inline, 2, 'two inline formulas should render');
    assert.equal(stats.display, 1, 'one multiline block formula should render as display math');
    assert.equal(stats.errors, 0, 'no KaTeX parse errors');
  });

  await t.test('KaTeX emits MathML and HTML output for accessible rendering', () => {
    assert.ok(html.includes('katex-mathml'), 'MathML annotation should be present');
    assert.ok(html.includes('katex-html'), 'HTML fallback output should be present');
  });
});

test('single-line $$…$$ equations upgrade to display math', async (t) => {
  const md = [
    '$$\\text{Memory}_{\\text{DSRA}} \\approx \\mathcal{O}(B \\cdot H \\cdot C \\cdot K \\cdot d_{\\text{head}}) + \\mathcal{O}(2 \\cdot B \\cdot H \\cdot W \\cdot d_{\\text{head}})$$',
    '',
    '$$\\mathcal{L}_{\\text{div}} = \\lambda \\cdot \\frac{1}{B \\cdot H} \\sum_{b,h} \\left\\Vert{} \\text{Gram}\\left(K_{\\text{slots}}^{(b,h)}\\right) - I \\right\\Vert{}_F^2$$',
  ].join('\n');

  const html = renderMarkdown(md);
  const stats = summarize(html);

  await t.test('both post equations render as display math without parse errors', () => {
    assert.equal(stats.display, 2, 'single-line $$…$$ should be display math, not inline');
    assert.equal(stats.inline, 0);
    assert.equal(stats.errors, 0, 'real post equations must not produce katex-error');
  });
});

test('dollar signs outside math are not treated as math', async (t) => {
  await t.test('inline code containing $ stays plain code', () => {
    const html = renderMarkdown('The value is `$5` in code.');
    assert.ok(!html.includes('katex'), 'inline code with $ must not render math');
    assert.match(html, /<code>/, 'the code element should remain');
  });

  await t.test('escaped dollar signs stay literal', () => {
    const html = renderMarkdown('Price: \\$10, plus $5 in cash.');
    assert.ok(!html.includes('katex'), 'escaped dollars must not render math');
    assert.ok(html.includes('$10'), 'literal dollar text should remain visible');
  });
});

test('markdown injection is still sanitized when math is enabled', async (t) => {
  await t.test('script and event-handler attributes are stripped', () => {
    const html = renderMarkdown('Hello <script>alert(1)</script> <img src=x onerror=alert(1)> with $x^2$');
    assert.ok(!html.includes('<script'), 'script tag must be stripped');
    assert.ok(!html.includes('onerror'), 'onerror handler must be stripped');
    assert.ok(html.includes('katex'), 'math must still render');
  });

  await t.test('javascript: links are neutralized', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    assert.ok(!/href="javascript:/i.test(html), 'javascript: href must be removed');
  });
});
