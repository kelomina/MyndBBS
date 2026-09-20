import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('admin protection exposes the four business CAPTCHA surfaces', () => {
  const page = read('src/app/admin/protection/page.tsx')
  const section = read('src/components/CaptchaProtectionSection.tsx')
  for (const surface of ['registration', 'post', 'comment', 'friendRequest']) {
    assert.match(section, new RegExp(surface))
  }
  assert.match(page, /CaptchaProtectionSection/)
  assert.match(read('src/lib/api/admin.ts'), /\/api\/admin\/protection\/captcha/)
})

test('business entry points use fail-closed public requirements and omit captcha when disabled', () => {
  const requirements = read('src/lib/captcha/requirements.ts')
  assert.match(requirements, /DEFAULT_CAPTCHA_REQUIREMENTS/)
  assert.match(requirements, /catch\(\(\) =>/)
  for (const [file, surface] of [
    ['src/app/(auth)/register/RegisterClient.tsx', 'registration'],
    ['src/app/compose/ComposeForm.tsx', 'post'],
    ['src/app/p/[id]/CommentsSection.tsx', 'comment'],
    ['src/app/friends/page.tsx', 'friendRequest'],
    ['src/app/u/[username]/OwnerSettingsButton.tsx', 'friendRequest'],
  ]) {
    const source = read(file)
    assert.match(source, new RegExp(`useCaptchaRequirement\\('${surface}'\\)`))
    assert.match(source, /captchaRequired/)
  }
})

test('registration payload helper accepts an omitted captcha id', () => {
  assert.match(read('src/lib/api/emailRegistration.ts'), /captchaId\?: string/)
})
