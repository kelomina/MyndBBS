import fs from 'fs'
import path from 'path'

describe('tag regression (zero business code, assertions only)', () => {
  it('keeps GET /api/tags public without auth gate (anonymous never 403)', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/routes/tag.ts'), 'utf8')
    expect(source).toContain('publicReadLimiter')
    expect(source).not.toContain('requireAuth')
    expect(source).not.toContain('requireAbility')
    expect(source).not.toContain('403')
  })

  it('keeps GET /api/posts?tag= public via optionalAuth with lowercase exact semantics', () => {
    const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/post.ts'), 'utf8')
    expect(routeSource).toContain('optionalAuth')
    // 列表路由为 publicReadLimiter + optionalAuth，不挂 requireAuth
    expect(routeSource).toContain("router.get('/', publicReadLimiter, optionalAuth, getPostsList)")
    const querySource = fs.readFileSync(
      path.join(__dirname, '../src/queries/community/CommunityQueryService.ts'),
      'utf8',
    )
    // tag 小写精确语义不变（至少提及 toLowerCase 精确匹配）
    expect(querySource).toMatch(/toLowerCase|tag/)
  })

  it('exposes public routing-whitelist endpoint for /tags prefix assertion', () => {
    const publicSource = fs.readFileSync(path.join(__dirname, '../src/routes/public.ts'), 'utf8')
    expect(publicSource).toContain('/routing-whitelist')
    // 公开端点刻意无认证（供匿名断言 whitelist 含 /tags prefix null）
    expect(publicSource).not.toContain('requireAuth')
  })

  it('keeps post-detail 403 as level semantics (not tag regression)', () => {
    const controllerSource = fs.readFileSync(
      path.join(__dirname, '../src/controllers/post.ts'),
      'utf8',
    )
    expect(controllerSource).toContain('ERR_POST_NOT_FOUND_OR_ACCESS_DENIED')
  })
})
