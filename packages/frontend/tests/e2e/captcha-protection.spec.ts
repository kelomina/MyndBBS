import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'

const ADMIN = { email: 'captcha-e2e-admin@example.test', password: 'CaptchaE2E!123456' }
const USER = { email: 'captcha-e2e-user@example.test', password: 'CaptchaE2E!123456' }
const POST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TARGET_POSITION = 120
const WRITE_HEADERS = { 'X-Requested-With': 'XMLHttpRequest', Origin: 'http://127.0.0.1:3101' }

const repoRoot = path.basename(process.cwd()) === 'frontend' ? path.resolve(process.cwd(), '../..') : process.cwd()
const backendRoot = path.join(repoRoot, 'packages', 'backend')
const backendRequire = createRequire(path.join(backendRoot, 'package.json'))
const { PrismaClient } = backendRequire(path.join(backendRoot, 'dist', 'generated', 'prisma', 'client.js'))
const { PrismaPg } = backendRequire('@prisma/adapter-pg')
const { Pool } = backendRequire('pg')

function dragPath() {
  return [
    { x: 0, y: 0, time: 0 },
    { x: 8, y: 2, time: 70 },
    { x: 20, y: -1, time: 155 },
    { x: 37, y: 3, time: 245 },
    { x: 55, y: 0, time: 350 },
    { x: 74, y: 4, time: 470 },
    { x: 94, y: 1, time: 610 },
    { x: TARGET_POSITION, y: 3, time: 780 },
  ]
}

async function login(request: APIRequestContext, credentials: typeof ADMIN) {
  const response = await request.post('/api/v1/auth/login', { data: credentials, headers: WRITE_HEADERS })
  expect(response.status(), `login ${credentials.email}: ${await response.text()}`).toBe(200)
}

async function issueAndVerify(request: APIRequestContext) {
  const issue = await request.get('/api/v1/auth/captcha?testFixed=1')
  const issueBody = await issue.json() as { captchaId?: string }
  expect(issue.status()).toBe(200)
  const { captchaId } = issueBody
  expect(captchaId).toMatch(/^[0-9a-f-]{36}$/i)
  const verify = await request.post('/api/v1/auth/captcha/verify', {
    data: { captchaId, dragPath: dragPath(), totalDragTime: 780, finalPosition: TARGET_POSITION },
    headers: WRITE_HEADERS,
  })
  expect(verify.status(), `verify: ${await verify.text()}`).toBe(200)
  return captchaId
}

async function assertCaptchaDeleted(captchaId: string) {
  const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('E2E_DATABASE_URL or DATABASE_URL is required')
  const pool = new Pool({ connectionString: databaseUrl })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    expect(await prisma.captchaChallenge.findUnique({ where: { id: captchaId } })).toBeNull()
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

async function expectReplayFailure(request: APIRequestContext, captchaId: string, data: Record<string, unknown>, endpoint: string) {
  const replay = await request.post(endpoint, { data: { ...data, captchaId }, headers: WRITE_HEADERS })
  expect(replay.status()).toBeGreaterThanOrEqual(400)
  const body = await replay.json()
  expect(String(body.error)).toMatch(/CAPTCHA|CAPTCHA_IS_REQUIRED|INVALID_OR_EXPIRED/i)
}

function trackNetwork(page: Page) {
  const events: Array<Record<string, unknown>> = []
  const onRequest = (request: import('@playwright/test').Request) => {
    if (request.url().includes('/api/')) {
      events.push({ type: 'request', method: request.method(), url: request.url(), postData: request.postData() })
    }
  }
  const onResponse = (response: import('@playwright/test').Response) => {
    if (response.url().includes('/api/')) {
      events.push({ type: 'response', status: response.status(), url: response.url() })
    }
  }
  page.on('request', onRequest)
  page.on('response', onResponse)
  return async (name: string) => {
    await test.info().attach(name, {
      body: JSON.stringify(events, null, 2),
      contentType: 'application/json',
    })
    page.off('request', onRequest)
    page.off('response', onResponse)
  }
}

test.describe('real CAPTCHA protection stack', () => {
  test.beforeAll(() => {
    execFileSync(process.execPath, [path.join(repoRoot, 'scripts/qa/seed-captcha-e2e.mjs')], {
      cwd: repoRoot,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'inherit',
    })
  })

  test('admin UI and policy API enforce anonymous/user/admin permissions', async ({ page }) => {
    const saveNetwork = trackNetwork(page)
    const request = page.request
    const anonymous = await request.get('/api/admin/protection/captcha')
    expect(anonymous.status()).toBe(404)

    await login(request, USER)
    const userResponse = await request.get('/api/admin/protection/captcha')
    expect(userResponse.status()).toBe(403)

    await request.post('/api/v1/auth/logout', { headers: WRITE_HEADERS })
    await login(request, ADMIN)
    const initial = await request.get('/api/admin/protection/captcha')
    expect(initial.status()).toBe(200)
    const policy = await initial.json()
    expect(policy.surfaces).toEqual({ registration: true, post: true, comment: true, friendRequest: true })

    const updated = await request.put('/api/admin/protection/captcha', {
      data: { enabled: true, surfaces: { registration: true, post: false, comment: true, friendRequest: true } },
      headers: WRITE_HEADERS,
    })
    expect(updated.status()).toBe(200)
    expect((await updated.json()).policy.surfaces.post).toBe(false)
    const restored = await request.put('/api/admin/protection/captcha', { data: policy, headers: WRITE_HEADERS })
    expect(restored.status()).toBe(200)

    await page.goto('/admin/protection')
    await expect(page.getByTestId('captcha-protection-section')).toBeVisible()
    for (const surface of ['registration', 'post', 'comment', 'friendRequest']) {
      await expect(page.getByTestId(`captcha-protection-${surface}`)).toBeChecked()
    }
    await test.info().attach('admin-protection-screenshot', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    await saveNetwork('admin-protection-network')
  })

  test('verified CAPTCHA is consumed once by post, comment, and friend request HTTP flows', async ({ page }) => {
    const saveNetwork = trackNetwork(page)
    const request = page.request
    await login(request, USER)

    const categories = await request.get('/api/categories')
    const categoryList = await categories.json() as Array<{ id: string; name: string }>
    expect(categories.status()).toBe(200)
    const category = categoryList.find((item) => item.name === 'captcha-e2e')
    if (!category) throw new Error('captcha-e2e category fixture missing')

    const postCaptcha = await issueAndVerify(request)
    const post = await request.post('/api/posts', {
      data: { title: `captcha-e2e-${Date.now()}`, content: 'real HTTP CAPTCHA post', categoryId: category.id, captchaId: postCaptcha },
      headers: WRITE_HEADERS,
    })
    expect(post.status(), `post: ${await post.text()}`).toBe(201)
    await assertCaptchaDeleted(postCaptcha)
    await expectReplayFailure(request, postCaptcha, { title: 'replay', content: 'replay', categoryId: category.id }, '/api/posts')

    const commentCaptcha = await issueAndVerify(request)
    const comment = await request.post(`/api/posts/${POST_ID}/comments`, { data: { content: 'real HTTP CAPTCHA comment', captchaId: commentCaptcha }, headers: WRITE_HEADERS })
    expect(comment.status(), `comment: ${await comment.text()}`).toBe(201)
    await assertCaptchaDeleted(commentCaptcha)
    await expectReplayFailure(request, commentCaptcha, { content: 'replay' }, `/api/posts/${POST_ID}/comments`)

    const friendCaptcha = await issueAndVerify(request)
    const target = await request.get('/api/v1/user/public/captcha_e2e_admin')
    const targetBody = await target.json() as { user?: { id?: string } }
    const addresseeId = targetBody.user?.id
    if (!addresseeId) throw new Error('captcha-e2e admin fixture missing')
    const friend = await request.post('/api/v1/friends/request', { data: { addresseeId, captchaId: friendCaptcha }, headers: WRITE_HEADERS })
    expect(friend.status(), `friend: ${await friend.text()}`).toBe(200)
    await assertCaptchaDeleted(friendCaptcha)
    await expectReplayFailure(request, friendCaptcha, { addresseeId }, '/api/v1/friends/request')
    await saveNetwork('captcha-business-network')
  })

  test('registration fails closed on a missing CAPTCHA without entering SMTP flow', async ({ page }) => {
    const saveNetwork = trackNetwork(page)
    const request = page.request
    await login(request, ADMIN)
    const response = await request.post('/api/v1/auth/register', {
      data: { email: `captcha-missing-${Date.now()}@example.test`, username: `captcha_missing_${Date.now()}`, password: 'CaptchaE2E!123456' },
      headers: WRITE_HEADERS,
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toBe('ERR_REGISTRATION_REQUEST_INVALID')
    await saveNetwork('captcha-registration-network')
  })
})
