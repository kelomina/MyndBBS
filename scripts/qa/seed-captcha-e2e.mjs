import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
const backendRoot = path.join(repoRoot, 'packages', 'backend')
const backendRequire = createRequire(path.join(backendRoot, 'package.json'))

const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL
if (!databaseUrl) throw new Error('E2E_DATABASE_URL or DATABASE_URL is required')
if (process.env.NODE_ENV !== 'test') throw new Error('CAPTCHA E2E seed requires NODE_ENV=test')

const parsedUrl = new URL(databaseUrl)
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''))
if (!['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname) || !/_test(?:$|[_-])/i.test(databaseName)) {
  throw new Error(`Refusing to seed a non-CI database: ${parsedUrl.hostname}/${databaseName}`)
}

const { pathToFileURL } = await import('node:url')
const { PrismaClient } = await import(pathToFileURL(path.join(backendRoot, 'dist', 'generated', 'prisma', 'client.js')).href)
const { PrismaPg } = backendRequire('@prisma/adapter-pg')
const { Pool } = backendRequire('pg')
const argon2 = backendRequire('argon2')

const pool = new Pool({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const ADMIN_EMAIL = 'captcha-e2e-admin@example.test'
const ADMIN_USERNAME = 'captcha_e2e_admin'
const USER_EMAIL = 'captcha-e2e-user@example.test'
const USER_USERNAME = 'captcha_e2e_user'
const PASSWORD = 'CaptchaE2E!123456'
const CATEGORY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

try {
  const [adminRole, userRole] = await Promise.all([
    prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN', description: 'E2E admin' } }),
    prisma.role.upsert({ where: { name: 'USER' }, update: {}, create: { name: 'USER', description: 'E2E user' } }),
  ])
  const permission = await prisma.permission.upsert({
    where: { action: 'manage:all' },
    update: {},
    create: { action: 'manage:all', description: 'E2E admin protection access' },
  })
  await prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
    update: {},
    create: { roleId: adminRole.id, permissionId: permission.id },
  })

  const password = await argon2.hash(PASSWORD)
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { username: ADMIN_USERNAME, password, roleId: adminRole.id, status: 'ACTIVE', level: 4 },
    create: { email: ADMIN_EMAIL, username: ADMIN_USERNAME, password, roleId: adminRole.id, status: 'ACTIVE', level: 4 },
  })
  const user = await prisma.user.upsert({
    where: { email: USER_EMAIL },
    update: { username: USER_USERNAME, password, roleId: userRole.id, status: 'ACTIVE', level: 1 },
    create: { email: USER_EMAIL, username: USER_USERNAME, password, roleId: userRole.id, status: 'ACTIVE', level: 1 },
  })
  await prisma.friendship.deleteMany({ where: { requesterId: user.id, addresseeId: admin.id } })
  const category = await prisma.category.upsert({
    where: { name: 'captcha-e2e' },
    update: { minLevel: 0 },
    create: { id: CATEGORY_ID, name: 'captcha-e2e', description: 'CAPTCHA E2E category', minLevel: 0, sortOrder: 99 },
  })
  const post = await prisma.post.upsert({
    where: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    update: { title: 'CAPTCHA E2E target', content: 'CAPTCHA E2E target post', authorId: admin.id, categoryId: category.id, status: 'PUBLISHED' },
    create: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'CAPTCHA E2E target', content: 'CAPTCHA E2E target post', authorId: admin.id, categoryId: category.id, status: 'PUBLISHED' },
  })

  console.log(JSON.stringify({
    admin: { email: ADMIN_EMAIL, username: ADMIN_USERNAME, password: PASSWORD, id: admin.id },
    user: { email: USER_EMAIL, username: USER_USERNAME, password: PASSWORD, id: user.id },
    category: { id: category.id, name: category.name },
    post: { id: post.id },
    friendTarget: { id: admin.id, username: ADMIN_USERNAME },
  }, null, 2))
} finally {
  await prisma.$disconnect()
  await pool.end()
}
