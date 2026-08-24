const test = require('node:test')
const assert = require('node:assert/strict')

const { ContentReport } = require('../dist/domain/community/ContentReport.js')
const { ReportApplicationService } = require('../dist/application/report/ReportApplicationService.js')
const { ReportResolvedEvent } = require('../dist/domain/shared/events/DomainEvents.js')

// ── 测试替身 / Test doubles ──

function makeRepo(existing = []) {
  const rows = new Map(existing.map((r) => [r.id, r]))
  return {
    rows,
    findById: async (id) => rows.get(id) ?? null,
    existsDuplicate: async ({ reporterId, targetType, postId, commentId }) =>
      [...rows.values()].some(
        (r) =>
          r.reporterId === reporterId &&
          r.targetType === targetType &&
          r.postId === postId &&
          (r.commentId ?? null) === (commentId ?? null)
      ),
    save: async (r) => {
      rows.set(r.id, r)
    },
  }
}

function makeService({ posts = new Map(), comments = new Map(), repoRows = [] } = {}) {
  const published = []
  const eventBus = { publish: async (e) => published.push(e), subscribe: () => {} }
  const postRepository = {
    findById: async (id) => posts.get(id) ?? null,
  }
  const commentRepository = {
    findById: async (id) => comments.get(id) ?? null,
  }
  const reportRepository = makeRepo(repoRows)
  const service = new ReportApplicationService({
    reportRepository,
    postRepository,
    commentRepository,
    eventBus,
  })
  return { service, reportRepository, published }
}

function submitted(overrides = {}) {
  return ContentReport.submit({
    id: overrides.id ?? 'r-' + Math.random().toString(36).slice(2),
    reporterId: 'u-reporter',
    targetType: 'POST',
    postId: 'p-1',
    reason: 'SPAM',
    ...overrides,
  })
}

// ── 实体状态机 ──

test('submitting with OTHER reason requires detail', () => {
  assert.throws(
    () => submitted({ reason: 'OTHER', detail: '   ' }),
    /ERR_REPORT_REASON_DETAIL_REQUIRED/
  )
  const ok = submitted({ reason: 'OTHER', detail: 'spam bot network' })
  assert.equal(ok.detail, 'spam bot network')
})

test('comment reports require commentId; resolve/dismiss are terminal', () => {
  assert.throws(
    () => submitted({ targetType: 'COMMENT', commentId: null }),
    /ERR_BAD_REQUEST/
  )

  const report = submitted()
  report.resolve('mod-1', 'confirmed spam')
  assert.equal(report.status, 'RESOLVED')
  assert.equal(report.handledBy, 'mod-1')

  assert.throws(() => report.dismiss('mod-2'), /ERR_REPORT_ALREADY_HANDLED/)
  assert.throws(() => report.resolve('mod-2'), /ERR_REPORT_ALREADY_HANDLED/)
})

// ── 提交校验 ──

test('submitReport validates target existence and self-reporting', async () => {
  const posts = new Map([['p-mine', { id: 'p-mine', authorId: 'u-me' }]])
  const comments = new Map([
    ['c-orphan', { id: 'c-orphan', authorId: 'u-x', postId: 'p-other' }],
    ['c-ok', { id: 'c-ok', authorId: 'u-x', postId: 'p-1' }],
  ])
  const { service } = makeService({ posts, comments })

  await assert.rejects(
    () =>
      service.submitReport({ reporterId: 'u-me', targetType: 'POST', postId: 'p-ghost', reason: 'SPAM' }),
    /ERR_REPORT_TARGET_NOT_FOUND/
  )
  await assert.rejects(
    () =>
      service.submitReport({ reporterId: 'u-me', targetType: 'POST', postId: 'p-mine', reason: 'SPAM' }),
    /ERR_REPORT_SELF_TARGET/
  )
  await assert.rejects(
    () =>
      service.submitReport({
        reporterId: 'u-me',
        targetType: 'COMMENT',
        postId: 'p-1',
        commentId: 'c-orphan',
        reason: 'SPAM',
      }),
    /ERR_REPORT_TARGET_NOT_FOUND/
  )
})

test('duplicate submissions from the same reporter are rejected', async () => {
  const existing = submitted({ id: 'r-existing' })
  const posts = new Map([['p-1', { id: 'p-1', authorId: 'u-author' }]])
  const { service } = makeService({ repoRows: [existing], posts })

  await assert.rejects(
    () =>
      service.submitReport({ reporterId: 'u-reporter', targetType: 'POST', postId: 'p-1', reason: 'ABUSE' }),
    /ERR_REPORT_ALREADY_SUBMITTED/
  )
})

// ── 处理流与徽章联动事件 ──

test('resolving publishes ReportResolvedEvent for immediate badge evaluation', async () => {
  const existing = submitted({ id: 'r-resolve-me' })
  const { service, reportRepository, published } = makeService({ repoRows: [existing] })

  await service.resolveReport('mod-1', 'r-resolve-me', 'verified')
  const saved = await reportRepository.findById('r-resolve-me')
  assert.equal(saved.status, 'RESOLVED')
  assert.equal(saved.handledBy, 'mod-1')

  const event = published.find((e) => e.eventName === 'ReportResolvedEvent')
  assert.ok(event)
  assert.equal(event.reporterId, 'u-reporter')
  assert.equal(event.handlerId, 'mod-1')
})

test('dismissing does not publish badge events', async () => {
  const existing = submitted({ id: 'r-dismiss-me' })
  const { service, published } = makeService({ repoRows: [existing] })

  await service.dismissReport('mod-1', 'r-dismiss-me')
  assert.equal(published.filter((e) => e.eventName === 'ReportResolvedEvent').length, 0)
})
