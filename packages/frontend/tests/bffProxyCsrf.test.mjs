import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const bffProxyPath = new URL('../src/lib/bff/proxy.ts', import.meta.url)

test('BFF CSRF check trusts reverse-proxy forwarded origin', async () => {
  const source = await fs.readFile(bffProxyPath, 'utf8')

  assert.match(source, /function getTrustedRequestOrigins/)
  assert.match(source, /x-forwarded-proto/)
  assert.match(source, /x-forwarded-host/)
  assert.match(source, /https/)
  assert.match(source, /normalizeOrigin\(request\.headers\.get\('origin'\)\)/)
})

test('BFF strips browser supplied internal auth headers before proxying', async () => {
  const source = await fs.readFile(bffProxyPath, 'utf8')

  assert.match(source, /BROWSER_STRIPPED_HEADERS/)
  assert.match(source, /'authorization'/)
  assert.match(source, /'x-myndbbs-session-id'/)
  assert.match(source, /'x-myndbbs-bff'/)
  assert.match(source, /!BROWSER_STRIPPED_HEADERS\.has\(lowerKey\)/)
})
