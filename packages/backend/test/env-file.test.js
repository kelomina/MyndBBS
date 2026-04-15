const test = require('node:test')
const assert = require('node:assert/strict')

const {
  upsertKey,
  upsertFrontendUrlOrigin,
  validateHostname,
  applyDomainConfigToEnv,
} = require('../dist/lib/EnvFileService.js')

test('upsertKey updates existing key', () => {
  const before = 'A=1\nB=2\n'
  const after = upsertKey(before, 'B', '"x"')
  assert.equal(after.includes('B="x"'), true)
})

test('upsertKey appends missing key', () => {
  const before = 'A=1\n'
  const after = upsertKey(before, 'B', '"x"')
  assert.equal(after.includes('B="x"'), true)
})

test('upsertFrontendUrlOrigin appends origin and dedupes', () => {
  const before = 'FRONTEND_URL="http://localhost:3000,http://localhost:3000"\n'
  const after = upsertFrontendUrlOrigin(before, 'http://localhost:3000')
  assert.equal((after.match(/http:\/\/localhost:3000/g) || []).length, 1)
})

test('validateHostname allows localhost and ::1', () => {
  assert.equal(validateHostname('localhost'), true)
  assert.equal(validateHostname('::1'), true)
})

test('validateHostname rejects ipv4', () => {
  assert.equal(validateHostname('127.0.0.1'), false)
})

test('applyDomainConfigToEnv writes TRUST_PROXY when reverseProxyMode enabled', () => {
  const before = ''
  const after = applyDomainConfigToEnv(before, {
    protocol: 'http',
    hostname: 'localhost',
    rpId: 'localhost',
    reverseProxyMode: true,
  })
  assert.equal(after.includes('TRUST_PROXY=true'), true)
})

test('applyDomainConfigToEnv writes ORIGIN for ipv6 hostname', () => {
  const before = ''
  const after = applyDomainConfigToEnv(before, {
    protocol: 'http',
    hostname: '::1',
    rpId: '::1',
    reverseProxyMode: false,
  })
  assert.equal(after.includes('ORIGIN="http://::1"'), true)
})
