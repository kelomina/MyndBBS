const test = require('node:test')
const assert = require('node:assert/strict')

const { BannedIp, isValidIp } = require('../dist/domain/system/BannedIp.js')
const { IpBanApplicationService } = require('../dist/application/system/IpBanApplicationService.js')
const { AntiSpamService } = require('../dist/application/system/AntiSpamService.js')
const {
  DEFAULT_ANTI_SPAM_POLICY,
  parseAntiSpamPolicy,
} = require('../dist/domain/system/SitePolicies.js')

// ── IP 格式 ──

test('isValidIp accepts IPv4/IPv6 and rejects malformed values', () => {
  assert.equal(isValidIp('192.168.1.1'), true)
  assert.equal(isValidIp('::1'), true)
  assert.equal(isValidIp('2001:db8::8a2e:370:7334'), true)
  assert.equal(isValidIp('999.1.1.1'), false)
  assert.equal(isValidIp('not-an-ip'), false)
  assert.equal(isValidIp(''), false)
})

// ── BannedIp 实体 ──

function makeBan(overrides = {}) {
  return BannedIp.create({
    id: 'ban-1',
    ip: '1.2.3.4',
    scope: 'ALL',
    reason: null,
    createdBy: 'admin-1',
    ...overrides,
  })
}

test('BannedIp expiry semantics: permanent vs timed', () => {
  const permanent = makeBan()
  assert.equal(permanent.isActive(), true)
  assert.equal(permanent.covers('LOGIN'), true)
  assert.equal(permanent.covers('REGISTRATION'), true)

  const past = new Date(Date.now() - 1000)
  const expiredBan = makeBan({ expiresAt: past })
  assert.equal(expiredBan.isActive(), false)

  const future = makeBan({ expiresAt: new Date(Date.now() + 60000) })
  assert.equal(future.isActive(), true)
})

test('REGISTRATION-scope ban covers registration but not login', () => {
  const regOnly = makeBan({ scope: 'REGISTRATION' })
  assert.equal(regOnly.covers('REGISTRATION'), true)
  assert.equal(regOnly.covers('LOGIN'), false)

  const all = makeBan({ scope: 'ALL' })
  assert.equal(all.covers('LOGIN'), true)
})

test('invalid IP is rejected at creation', () => {
  assert.throws(() => makeBan({ ip: '999.999.1.1' }), /ERR_INVALID_IP/)
})

// ── IpBanApplicationService ──

function makeIpBanService(rows = []) {
  const store = new Map(rows.map((r) => [r.ip, r]))
  const repo = {
    findById: async (id) => [...store.values()].find((b) => b.id === id) ?? null,
    findActiveBan: async (ip, purpose) =>
      [...store.values()].find((b) => b.ip === ip && b.isActive() && b.covers(purpose)) ?? null,
    listAll: async () => [...store.values()],
    insert: async (ban) => {
      if (store.has(ban.ip)) return false
      store.set(ban.ip, ban)
      return true
    },
    delete: async (id) => {
      for (const [ip, b] of store) {
        if (b.id === id) {
          store.delete(ip)
          return true
        }
      }
      return false
    },
  }
  const service = new IpBanApplicationService({ bannedIpRepository: repo })
  return { service, store }
}

test('banIp inserts, dedupes by unique ip and unban removes', async () => {
  const { service, store } = makeIpBanService()

  await service.banIp({ ip: '6.6.6.6', scope: 'ALL', operatorId: 'admin-1' })
  assert.equal(store.size, 1)

  await assert.rejects(
    () => service.banIp({ ip: '6.6.6.6', scope: 'REGISTRATION', operatorId: 'admin-1' }),
    /ERR_IP_ALREADY_BANNED/
  )

  assert.equal(await service.isBanned('6.6.6.6', 'LOGIN'), true)

  const [record] = store.values()
  await service.unbanIp(record.id)
  assert.equal(await service.isBanned('6.6.6.6', 'LOGIN'), false)
  await assert.rejects(() => service.unbanIp(record.id), /ERR_IP_BAN_NOT_FOUND/)
})

// ── AntiSpam 策略 ──

test('parseAntiSpamPolicy falls back to closed defaults on garbage input', () => {
  assert.deepEqual(parseAntiSpamPolicy(null), DEFAULT_ANTI_SPAM_POLICY)
  assert.deepEqual(
    parseAntiSpamPolicy({ accountAgeDays: -5, cooldownMinutes: 'x', maxNewContentsPerHour: 7 }),
    { accountAgeDays: 0, cooldownMinutes: 0, maxNewContentsPerHour: 7 }
  )
})

const HOUR = 60 * 60 * 1000

function makeAntiSpam({ policyJson = null, userCreatedAt = null, recentCount = 0 } = {}) {
  let storedPolicy = policyJson
  const service = new AntiSpamService({
    sitePolicyRepository: {
      get: async () => storedPolicy,
      set: async (_key, value) => {
        storedPolicy = value
      },
    },
    getUserCreatedAt: async () => userCreatedAt,
    countRecentContentsByAuthor: async () => recentCount,
  })
  return { service, getStored: () => storedPolicy }
}

test('anti-spam disabled by default: all-zero policy allows everything', async () => {
  const { service } = makeAntiSpam({ userCreatedAt: new Date() })
  await service.assertContentAllowed('u-1') // 不抛错即通过
})

test('cooldown blocks brand-new accounts within the window', async () => {
  const { service } = makeAntiSpam({
    policyJson: { kind: undefined, accountAgeDays: 1, cooldownMinutes: 30, maxNewContentsPerHour: 0 },
    userCreatedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 分钟前注册
  })
  await assert.rejects(() => service.assertContentAllowed('u-new'), /ERR_NEW_ACCOUNT_COOLDOWN/)
})

test('hourly rate limit applies to accounts inside the age window', async () => {
  const { service } = makeAntiSpam({
    policyJson: { accountAgeDays: 7, cooldownMinutes: 0, maxNewContentsPerHour: 3 },
    userCreatedAt: new Date(Date.now() - 2 * 24 * HOUR), // 窗口内但已过冷却
    recentCount: 3,
  })
  await assert.rejects(() => service.assertContentAllowed('u-new'), /ERR_NEW_ACCOUNT_RATE_LIMITED/)
})

test('accounts older than the age window bypass all checks', async () => {
  const { service } = makeAntiSpam({
    policyJson: { accountAgeDays: 7, cooldownMinutes: 30, maxNewContentsPerHour: 1 },
    userCreatedAt: new Date(Date.now() - 30 * 24 * HOUR),
    recentCount: 100,
  })
  await service.assertContentAllowed('u-old')
})

test('updatePolicy merges, clamps and persists', async () => {
  const { service, getStored } = makeAntiSpam({})
  const updated = await service.updatePolicy({ accountAgeDays: 3, cooldownMinutes: 15 })
  assert.deepEqual(updated, { accountAgeDays: 3, cooldownMinutes: 15, maxNewContentsPerHour: 0 })
  assert.deepEqual(getStored(), { accountAgeDays: 3, cooldownMinutes: 15, maxNewContentsPerHour: 0 })
})
