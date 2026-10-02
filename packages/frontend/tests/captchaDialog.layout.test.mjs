import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

for (const [file, onSuccess] of [
  ['src/app/compose/ComposeForm.tsx', 'handlePublish'],
  ['src/app/p/[id]/CommentsSection.tsx', 'handleSubmit'],
]) {
  test(`${file} gives the percentage-width CAPTCHA a responsive dialog width`, () => {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    const backdrop = source.match(/className="(fixed inset-0[^"]*)"/)?.[1].split(/\s+/)
    const panel = source.match(/className="(bg-card p-6 rounded-2xl shadow-xl relative[^"]*)"/)?.[1].split(/\s+/)

    assert.ok(backdrop?.includes('p-4'), 'keep a 16px inset on narrow viewports')
    assert.ok(panel?.includes('w-full'), 'percentage-width children must not size a shrink-to-fit panel')
    assert.ok(panel?.includes('max-w-[398px]'), '350px CAPTCHA plus 48px dialog padding')
    assert.ok(panel?.includes('min-w-0'), 'allow the panel to fit narrow viewports')
    assert.match(source, new RegExp(`onSuccess={${onSuccess}}`))
    assert.doesNotMatch(source, /<SliderCaptcha[^>]*\bmanual\b/)
  })
}
