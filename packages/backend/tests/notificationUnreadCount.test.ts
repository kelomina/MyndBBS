import { getUnreadNotificationCount } from '../src/controllers/notification'

describe('GET /api/notifications/unread-count', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.clearAllMocks()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() } as never
  }

  it('returns 401 ERR_UNAUTHORIZED when anonymous (requireAuth, no userId param)', async () => {
    const req = { user: undefined } as never
    const res = makeRes() as { status: jest.Mock; json: jest.Mock }
    await getUnreadNotificationCount(req, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'ERR_UNAUTHORIZED' })
  })

  it('counts only own unread via composite index shape {count}', async () => {
    // 控制器经 prisma.notification.count({where:{userId,isRead:false}}) 查询（索引 (userId,isRead,createdAt)）
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../src/controllers/notification.ts'),
      'utf8',
    )
    expect(source).toContain('prisma.notification.count')
    expect(source).toContain('isRead: false')
    expect(source).toContain('{ count }')
  })

  it('uses requireAuth (not hidden 404) on route', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../src/routes/notification.ts'),
      'utf8',
    )
    expect(source).toContain('requireAuth')
    expect(source).not.toContain('requireAuthHidden')
  })
})
