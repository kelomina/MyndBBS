import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('admin protection leaves verification configuration to plugin schema', () => {
  assert.doesNotMatch(read('src/app/admin/protection/page.tsx'), /CaptchaProtectionSection|FederalCaptchaSection/)
  assert.doesNotMatch(read('src/lib/api/admin.ts'), /protection\/captcha|protection\/federal/)
  assert.doesNotMatch(read('src/components/RateLimitPolicySection.tsx'), /ratelimit-strength-label/)
})

test('business entry points use fail-closed public requirements and omit captcha when disabled', () => {
  const requirements = read('src/lib/human-verification/requirements.ts')
  assert.match(requirements, /useState\(true\)/)
  assert.match(requirements, /catch/)
  for (const [file, surface] of [
    ['src/app/(auth)/register/RegisterClient.tsx', 'registration'],
    ['src/app/compose/ComposeForm.tsx', 'post'],
    ['src/app/p/[id]/CommentsSection.tsx', 'comment'],
    ['src/app/friends/page.tsx', 'friendRequest'],
    ['src/app/u/[username]/OwnerSettingsButton.tsx', 'friendRequest'],
  ]) {
    const source = read(file)
    assert.match(source, new RegExp(`useHumanVerificationRequirement\\('${surface}'\\)`))
    assert.match(source, /captchaRequired/)
  }
})

test('registration payload helper accepts an omitted captcha id', () => {
  assert.match(read('src/lib/api/emailRegistration.ts'), /captchaId\?: string/)
})
