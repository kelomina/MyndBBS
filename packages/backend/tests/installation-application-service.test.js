const test = require('node:test')
const assert = require('node:assert/strict')

const { InstallationApplicationService } = require('../dist/application/provisioning/InstallationApplicationService.js')

function createService(overrides = {}) {
  const envStore = overrides.envStore || {
    read: async () => '',
    write: async () => {},
    updateDatabaseUrl: async () => {},
    setupEnvironment: async () => {},
    updateDomainConfig: async () => {},
  }

  const dbValidator = overrides.dbValidator || {
    validate: async () => true,
  }

  const dbSchemaApplier = overrides.dbSchemaApplier || {
    applySchema: async () => {},
  }

  const sessionRepository = overrides.sessionRepository || {
    createSession: async () => ({ id: 's1', createdAt: new Date(), isCompleted: false }),
    getSession: async () => ({ id: 's1', createdAt: new Date(), isCompleted: false }),
    markCompleted: async () => {},
  }

  const identityBootstrap = overrides.identityBootstrap || {
    bootstrapSuperAdmin: async () => 'u1',
  }

  const restartScheduler = overrides.restartScheduler || {
    scheduleRestart: () => {},
  }

  return new InstallationApplicationService(
    envStore,
    dbValidator,
    dbSchemaApplier,
    sessionRepository,
    identityBootstrap,
    restartScheduler
  )
}

test('getCurrentDbConfig parses DATABASE_URL and decodes password', () => {
  const prev = process.env.DATABASE_URL
  try {
    process.env.DATABASE_URL = 'postgresql://alice:%40p%23@db.example.com:5433/mydb?schema=public'
    const service = createService()
    const cfg = service.getCurrentDbConfig()

    assert.equal(cfg.host, 'db.example.com')
    assert.equal(cfg.port, 5433)
    assert.equal(cfg.username, 'alice')
    assert.equal(cfg.password, '@p#')
    assert.equal(cfg.database, 'mydb')
  } finally {
    if (prev === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = prev
  }
})

test('getCurrentDbConfig falls back when DATABASE_URL is invalid', () => {
  const prev = process.env.DATABASE_URL
  try {
    process.env.DATABASE_URL = 'not-a-url'
    const service = createService()
    const cfg = service.getCurrentDbConfig()
    assert.equal(cfg.host, 'localhost')
    assert.equal(cfg.port, 5432)
  } finally {
    if (prev === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = prev
  }
})

test('updateDbConfig builds encoded DATABASE_URL and applies schema', async () => {
  let updatedUrl = null
  let schemaApplied = false

  const service = createService({
    envStore: {
      read: async () => '',
      write: async () => {},
      updateDatabaseUrl: async (url) => {
        updatedUrl = url
      },
      setupEnvironment: async () => {},
      updateDomainConfig: async () => {},
    },
    dbSchemaApplier: {
      applySchema: async () => {
        schemaApplied = true
      },
    },
  })

  await service.updateDbConfig('localhost', 5432, 'bob', 'p@ss w/space', 'forum')

  assert.equal(
    updatedUrl,
    'postgresql://bob:p%40ss%20w%2Fspace@localhost:5432/forum?schema=public'
  )
  assert.equal(schemaApplied, true)
})

test('scheduleRestart delegates to restart scheduler', () => {
  let calledWith = null
  const service = createService({
    restartScheduler: {
      scheduleRestart: (delayMs) => {
        calledWith = delayMs
      },
    },
  })

  service.scheduleRestart(1234)
  assert.equal(calledWith, 1234)
})

