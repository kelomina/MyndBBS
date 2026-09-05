import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

test('root layout only exposes the public translation dictionary', async () => {
  const rootLayout = await fs.readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf-8')

  assert.match(rootLayout, /getPublicDictionary/)
  assert.doesNotMatch(rootLayout, /getDictionary\(locale\)/)
})

test('public translation dictionary omits privileged dictionary branches', async () => {
  const publicDictionary = await fs.readFile(
    new URL('../src/i18n/public-dictionary.ts', import.meta.url),
    'utf-8',
  )

  assert.match(publicDictionary, /admin:\s*{\s*}/)
  // Rationale (QA门禁 2026-09-05 [REJECTED] → 首选方案a 精确白名单):
  // ERR_VERIFICATION_FAILED / ERR_RATE_LIMITED_NEEDS_CAPTCHA / ERR_RATE_LIMITED
  // 本就经匿名 429/400 响应体明文下发（无新增披露），公开字典透出是匿名双语限流卡
  // （RateLimitCard/UnlockModal SSR+Client）所必需；其余特权码仍禁止透出。
  // apiErrors 精确白名单：仅允许上述 3 个匿名可达的限流/验证错误码透出。
  assert.match(publicDictionary, /apiErrors:\s*pick\(/)
  assert.match(publicDictionary, /ERR_VERIFICATION_FAILED/)
  assert.match(publicDictionary, /ERR_RATE_LIMITED_NEEDS_CAPTCHA/)
  assert.match(publicDictionary, /'ERR_RATE_LIMITED'/)
  // 精确性：apiErrors pick 数组仅含这 3 码，不多不少。
  const apiErrorsPick = publicDictionary.match(/apiErrors:\s*pick\([\s\S]*?\[([\s\S]*?)\]/)
  assert.ok(apiErrorsPick?.[1], 'apiErrors pick keys block should exist')
  const apiErrorKeys = [...apiErrorsPick[1].matchAll(/'(ERR_[A-Z_]+)'/g)].map((m) => m[1])
  assert.deepEqual(
    [...apiErrorKeys].sort(),
    ['ERR_RATE_LIMITED', 'ERR_RATE_LIMITED_NEEDS_CAPTCHA', 'ERR_VERIFICATION_FAILED'].sort(),
  )
  assert.match(publicDictionary, /messages:\s*pick\(dict\.messages,\s*\['title'\]\)/)
  // 联邦验证公开子键（匿名解题必需）：captcha.geometry/pow/federal 精确 pick，不透 admin.federal（管理页需 ADMIN，经完整字典走 BFF，不进公开字典）
  assert.match(publicDictionary, /geometry:\s*pick\(/)
  assert.match(publicDictionary, /pow:\s*pick\(/)
  assert.match(publicDictionary, /federal:\s*pick\(/)
  assert.match(publicDictionary, /switchKind/)
  assert.match(publicDictionary, /fallbackToSlider/)
  // 通知徽标合计公开键（UserNav 求和 tooltip/aria-label 所需）
  assert.match(publicDictionary, /notifications:\s*pick\(dict\.notifications/)
  assert.match(publicDictionary, /badgeAria/)
  assert.match(publicDictionary, /badgeTooltip/)
  assert.match(publicDictionary, /unreadTitle/)
  assert.doesNotMatch(publicDictionary, /ERR_DB_CONNECTION_FAILED/)
  assert.doesNotMatch(publicDictionary, /ERR_CSRF_TOKEN_MISSING_OR_INVALID/)
  assert.doesNotMatch(publicDictionary, /domainConfig/)
  assert.doesNotMatch(publicDictionary, /routingWhitelist/)
})
