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
  assert.match(publicDictionary, /apiErrors:\s*{\s*}/)
  assert.match(publicDictionary, /messages:\s*pick\(dict\.messages,\s*\['title'\]\)/)
  assert.doesNotMatch(publicDictionary, /ERR_DB_CONNECTION_FAILED/)
  assert.doesNotMatch(publicDictionary, /ERR_CSRF_TOKEN_MISSING_OR_INVALID/)
  assert.doesNotMatch(publicDictionary, /domainConfig/)
  assert.doesNotMatch(publicDictionary, /routingWhitelist/)
})
