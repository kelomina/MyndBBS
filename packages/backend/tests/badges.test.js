const test = require('node:test')
const assert = require('node:assert/strict')

const { BadgeCondition, isHourInNightWindow } = require('../dist/domain/badge/BadgeCondition.js')
const { BUILT_IN_BADGES } = require('../dist/domain/badge/BuiltInBadges.js')
const { Badge } = require('../dist/domain/badge/Badge.js')
const { BadgeApplicationService } = require('../dist/application/badge/BadgeApplicationService.js')

// ── 测试替身 / Test doubles ──

function makeUnitOfWork() {
  return { execute: async (fn) => fn() }
}

function makeBadgeRepo(badges = []) {
  const store = new Map(badges.map((b) => [b.id, b]))
  return {
    store,
    findById: async (id) => store.get(id) ?? null,
    findByCode: async (code) => [...store.values()].find((b) => b.code === code) ?? null,
    findAll: async () => [...store.values()],
    findAllActiveAuto: async () =>
      [...store.values()].filter((b) => b.isActive && b.grantType === 'AUTO'),
    save: async (badge) => {
      store.set(badge.id, badge)
    },
    delete: async (id) => {
      store.delete(id)
    },
    countHoldersGrouped: async () => new Map(),
  }
}

function makeUserBadgeRepo(holders = []) {
  const rows = new Map(holders.map((h) => [`${h.badgeId}:${h.userId}`, h]))
  return {
    rows,
    findByUserAndBadge: async (userId, badgeId) => rows.get(`${badgeId}:${userId}`) ?? null,
    findByUser: async (userId) =>
      [...rows.values()].filter((r) => r.userId === userId),
    findByBadge: async (badgeId) => [...rows.values()].filter((r) => r.badgeId === badgeId),
    findExistingKeys: async (badgeIds) => {
      const keys = new Set()
      for (const key of rows.keys()) {
        const [badgeId] = key.split(':')
        if (badgeIds.includes(badgeId)) keys.add(key)
      }
      return keys
    },
    save: async (ub) => {
      rows.set(`${ub.badgeId}:${ub.userId}`, ub)
    },
    remove: async (userId, badgeId) => rows.delete(`${badgeId}:${userId}`),
  }
}

function makeStatsPort({ levels = [], posts = new Map(), comments = new Map(), night = new Map() } = {}) {
  return {
    getUserIdsWithLevelAtLeast: async (threshold) => levels.filter((l) => l.level >= threshold).map((l) => l.id),
    getContentCountsByAuthor: async () => ({ posts, comments }),
    getNightContentCountsByAuthor: async () => night,
  }
}

function makeNotificationRepo() {
  const saved = []
  return { saved, save: async (n) => saved.push(n) }
}

function makeService({ badges = [], holders = [], stats = {} } = {}) {
  const badgeRepository = makeBadgeRepo(badges)
  const userBadgeRepository = makeUserBadgeRepo(holders)
  const notificationRepository = makeNotificationRepo()
  const service = new BadgeApplicationService({
    badgeRepository,
    userBadgeRepository,
    statsPort: makeStatsPort(stats),
    notificationRepository,
    unitOfWork: makeUnitOfWork(),
  })
  return { service, badgeRepository, userBadgeRepository, notificationRepository }
}

// ── BadgeCondition ──

test('BadgeCondition parses manual condition', () => {
  const c = BadgeCondition.fromJson({ kind: 'manual' })
  assert.equal(c.kind, 'manual')
  assert.equal(c.isAuto, false)
})

test('BadgeCondition parses user_level and rejects out-of-range threshold', () => {
  const ok = BadgeCondition.fromJson({ kind: 'user_level', threshold: 3 })
  assert.equal(ok.threshold, 3)
  assert.equal(ok.isAuto, true)

  assert.throws(() => BadgeCondition.fromJson({ kind: 'user_level', threshold: 7 }), /ERR_BADGE_INVALID_CONDITION/)
  assert.throws(() => BadgeCondition.fromJson({ kind: 'user_level' }), /ERR_BADGE_INVALID_CONDITION/)
})

test('BadgeCondition validates night_activity window and offset', () => {
  const ok = BadgeCondition.fromJson({
    kind: 'night_activity', threshold: 10, startHour: 21, endHour: 6,
  })
  assert.equal(ok.utcOffsetHours, 8) // 默认北京时间
  assert.equal(ok.toJson().utcOffsetHours, 8)

  assert.throws(
    () => BadgeCondition.fromJson({ kind: 'night_activity', threshold: 10, startHour: 24, endHour: 6 }),
    /ERR_BADGE_INVALID_CONDITION/,
  )
  assert.throws(
    () => BadgeCondition.fromJson({ kind: 'night_activity', threshold: 10 }),
    /ERR_BADGE_INVALID_CONDITION/,
  )
})

test('isHourInNightWindow supports normal and wrap-around windows', () => {
  assert.equal(isHourInNightWindow(3, 0, 6), true)
  assert.equal(isHourInNightWindow(7, 0, 6), false)
  // 跨零点窗口 [21..23] ∪ [0..6]
  assert.equal(isHourInNightWindow(23, 21, 6), true)
  assert.equal(isHourInNightWindow(2, 21, 6), true)
  assert.equal(isHourInNightWindow(12, 21, 6), false)
})

// ── 内置徽章定义 ──

test('built-in badges cover the required set with unique codes', () => {
  const codes = BUILT_IN_BADGES.map((b) => b.code)
  assert.equal(new Set(codes).size, codes.length)

  for (const expected of [
    'kolostudio_official',
    'level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'level_6',
    'anti_drug_guardian',
    'night_owl',
    'chatterbox',
  ]) {
    assert.ok(codes.includes(expected), `missing built-in badge ${expected}`)
  }

  const official = BUILT_IN_BADGES.find((b) => b.code === 'kolostudio_official')
  assert.equal(official.grantType, 'MANUAL')

  for (let level = 1; level <= 6; level++) {
    const levelBadge = BUILT_IN_BADGES.find((b) => b.code === `level_${level}`)
    assert.equal(levelBadge.grantType, 'AUTO')
    assert.equal(levelBadge.condition.kind, 'user_level')
    assert.equal(levelBadge.condition.threshold, level)
  }

  const nightOwl = BUILT_IN_BADGES.find((b) => b.code === 'night_owl')
  assert.equal(nightOwl.condition.kind, 'night_activity')
  assert.equal(nightOwl.condition.startHour, 0)
  assert.equal(nightOwl.condition.endHour, 6)

  const chatterbox = BUILT_IN_BADGES.find((b) => b.code === 'chatterbox')
  assert.equal(chatterbox.condition.kind, 'content_count')

  const guardian = BUILT_IN_BADGES.find((b) => b.code === 'anti_drug_guardian')
  assert.equal(guardian.grantType, 'AUTO')
  assert.equal(guardian.condition.kind, 'upheld_reports')
  assert.equal(guardian.condition.threshold, 3)
})

test('Badge.createSystem produces a SYSTEM-type badge', () => {
  const def = BUILT_IN_BADGES[0]
  const badge = Badge.createSystem({
    id: 'b-system-1',
    code: def.code,
    name: def.name,
    description: def.description,
    icon: def.icon,
    color: def.color,
    grantType: def.grantType,
    condition: def.condition,
    isActive: true,
    sortOrder: 0,
  })
  assert.equal(badge.isSystem(), true)
  assert.throws(() => badge.update({ name: 'Hacked' }), /ERR_BADGE_SYSTEM_IMMUTABLE/)
  assert.doesNotThrow(() => badge.syncSystemDefinition({ name: def.name }))
})

// ── 应用服务：自动评估 ──

function systemLevelBadge(level) {
  const def = BUILT_IN_BADGES.find((b) => b.code === `level_${level}`)
  return Badge.createSystem({
    id: `badge-level-${level}`,
    code: def.code,
    name: def.name,
    description: def.description,
    icon: def.icon,
    color: def.color,
    grantType: def.grantType,
    condition: def.condition,
    isActive: true,
    sortOrder: def.sortOrder,
  })
}

test('evaluateAndGrantAll grants eligible users once and notifies them', async () => {
  const chatterDef = BUILT_IN_BADGES.find((b) => b.code === 'chatterbox')
  const chatterBadge = Badge.createSystem({
    id: 'badge-chatter',
    code: chatterDef.code,
    name: chatterDef.name,
    description: chatterDef.description,
    icon: chatterDef.icon,
    color: chatterDef.color,
    grantType: chatterDef.grantType,
    condition: chatterDef.condition,
    isActive: true,
    sortOrder: chatterDef.sortOrder,
  })

  const { service, notificationRepository, userBadgeRepository } = makeService({
    badges: [chatterBadge],
    holders: [], // u-already 暂未持有，稍后再验证幂等
    stats: {
      posts: new Map([['u-active', 60], ['u-quiet', 1], ['u-already', 60]]),
      comments: new Map([['u-active', 50], ['u-already', 40]]),
    },
  })

  const first = await service.evaluateAndGrantAll()
  assert.equal(first.grantedCount, 2) // u-active (110) 与 u-already (100)
  assert.equal(notificationRepository.saved.length, 2)

  // 幂等：再次评估不再授予
  const second = await service.evaluateAndGrantAll()
  assert.equal(second.grantedCount, 0)
  assert.equal(userBadgeRepository.rows.size, 2)

  const holder = await userBadgeRepository.findByUserAndBadge('u-active', 'badge-chatter')
  assert.ok(holder)
  assert.equal(holder.grantedBy, null) // 自动授予无操作者
})

test('evaluateUser reacts to level changes instantly', async () => {
  const { service, userBadgeRepository, notificationRepository } = makeService({
    badges: [systemLevelBadge(3)],
    stats: { levels: [{ id: 'u-promoted', level: 3 }, { id: 'u-low', level: 1 }] },
  })

  const granted = await service.evaluateUser('u-promoted')
  assert.equal(granted, 1)
  assert.ok(await userBadgeRepository.findByUserAndBadge('u-promoted', 'badge-level-3'))

  const none = await service.evaluateUser('u-low')
  assert.equal(none, 0)
  assert.equal(notificationRepository.saved.length, 1)
})

// ── 应用服务：手动授予 / 撤销与 CRUD ──

test('grant/revoke lifecycle enforces ownership invariants', async () => {
  const officialDef = BUILT_IN_BADGES.find((b) => b.code === 'kolostudio_official')
  const official = Badge.createSystem({
    id: 'badge-official',
    code: officialDef.code,
    name: officialDef.name,
    description: officialDef.description,
    icon: officialDef.icon,
    color: officialDef.color,
    grantType: officialDef.grantType,
    condition: officialDef.condition,
    isActive: true,
    sortOrder: 0,
  })

  const { service, userBadgeRepository } = makeService({ badges: [official] })

  await service.grantBadgeToUser('admin-1', 'badge-official', 'u-target', 'staff')
  const holder = await userBadgeRepository.findByUserAndBadge('u-target', 'badge-official')
  assert.equal(holder.grantedBy, 'admin-1')
  assert.equal(holder.reason, 'staff')

  await assert.rejects(
    () => service.grantBadgeToUser('admin-1', 'badge-official', 'u-target'),
    /ERR_BADGE_ALREADY_OWNED/,
  )
  await assert.rejects(
    () => service.grantBadgeToUser('admin-1', 'badge-missing', 'u-target'),
    /ERR_BADGE_NOT_FOUND/,
  )

  await service.revokeBadgeFromUser('admin-1', 'badge-official', 'u-target')
  assert.equal(await userBadgeRepository.findByUserAndBadge('u-target', 'badge-official'), null)
  await assert.rejects(
    () => service.revokeBadgeFromUser('admin-1', 'badge-official', 'u-target'),
    /ERR_BADGE_NOT_OWNED/,
  )
})

test('create/update/delete enforce code uniqueness and system immutability', async () => {
  const { service, badgeRepository } = makeService({ badges: [systemLevelBadge(1)] })

  const created = await service.createBadge({
    code: 'bug_hunter',
    name: 'Bug Hunter',
    grantType: 'AUTO',
    conditionJson: { kind: 'post_count', threshold: 5 },
  })
  assert.equal(created.isSystem(), false)

  await assert.rejects(
    () => service.createBadge({ code: 'bug_hunter', name: 'Dup', grantType: 'MANUAL' }),
    /ERR_BADGE_CODE_ALREADY_EXISTS/,
  )

  // MANUAL 徽章条件一律落为 manual；AUTO 必须携带合法条件
  const manual = await service.createBadge({ code: 'pure_manual', name: 'Manual', grantType: 'MANUAL', conditionJson: { kind: 'user_level', threshold: 9 } })
  assert.equal(manual.condition.kind, 'manual')
  await assert.rejects(
    () => service.createBadge({ code: 'bad_auto', name: 'Bad', grantType: 'AUTO', conditionJson: { kind: 'manual' } }),
    /ERR_BADGE_INVALID_CONDITION/,
  )

  // SYSTEM 徽章不可改业务字段、不可删除，仅可启停
  await assert.rejects(
    () => service.updateBadge('badge-level-1', { name: 'Renamed' }),
    /ERR_BADGE_SYSTEM_IMMUTABLE/,
  )
  await assert.rejects(() => service.deleteBadge('badge-level-1'), /ERR_BADGE_CANNOT_DELETE_SYSTEM/)
  await service.updateBadge('badge-level-1', { isActive: false })

  // CUSTOM 徽章可编辑可删除
  await service.updateBadge(created.id, { name: 'Bug Hunter Pro' })
  const updated = await badgeRepository.findById(created.id)
  assert.equal(updated.name, 'Bug Hunter Pro')
  await service.deleteBadge(created.id)
  assert.equal(await badgeRepository.findById(created.id), null)
})
