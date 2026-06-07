import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { UserStatus } from '@myndbbs/shared';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
import { ensureDefaultRouteWhitelist } from './seedDefaults';

dotenv.config();

/**
 * Callers: [main]
 * Callees: [Pool, PrismaPg, PrismaClient]
 * Description: Creates the runtime database clients used by the seed script only when the script is executed directly.
 * 描述：仅在直接执行种子脚本时创建数据库运行时客户端，避免测试导入时触发真实连接。
 * Variables: `connectionString` 表示数据库连接串；`pool` 表示 PostgreSQL 连接池；`adapter` 表示 Prisma 的 PG 适配器；`prisma` 表示种子脚本使用的 Prisma 客户端。
 * 变量：`connectionString` 表示数据库连接串；`pool` 表示 PostgreSQL 连接池；`adapter` 表示 Prisma 的 PG 适配器；`prisma` 表示种子脚本使用的 Prisma 客户端。
 * Integration: Call this helper from `main` so tests can import seed helpers without opening a database connection.
 * 接入方式：只在 `main` 中调用本函数，让测试能够导入种子辅助函数而不打开数据库连接。
 * Error Handling: Throws immediately when `DATABASE_URL` is missing so the seed script fails fast with a clear setup error.
 * 错误处理：当 `DATABASE_URL` 缺失时立即抛错，使种子脚本以明确的配置错误快速失败。
 * Keywords: seed runtime, Prisma client, connection pool, bootstrap, database, 种子运行时, Prisma 客户端, 连接池, 引导, 数据库
 */
function createSeedRuntime(): { prisma: PrismaClient; pool: Pool } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return { prisma, pool };
}

/**
 * Callers: [CLI]
 * Callees: [createSeedRuntime, upsert, findUnique, findFirst, update, create, hash, ensureDefaultRouteWhitelist, disconnect, end]
 * Description: Seeds the application roles, starter categories, bootstrap accounts, and essential route whitelist entries.
 * 描述：写入应用角色、初始分类、引导账号以及必需的路由白名单记录。
 * Variables: `prisma` 表示种子流程使用的 Prisma 客户端；`pool` 表示数据库连接池；`roles` 表示基础角色集合；`categories` 表示初始分类集合。
 * 变量：`prisma` 表示种子流程使用的 Prisma 客户端；`pool` 表示数据库连接池；`roles` 表示基础角色集合；`categories` 表示初始分类集合。
 * Integration: Execute this function through `pnpm prisma db seed` or `ts-node prisma/seed.ts`; tests should import smaller helpers instead of calling it directly.
 * 接入方式：通过 `pnpm prisma db seed` 或 `ts-node prisma/seed.ts` 执行本函数；测试应导入更小的辅助函数而不是直接调用。
 * Error Handling: Uses a `finally` block to close Prisma and PG resources, and rethrows failures so CI or operators can detect seed issues.
 * 错误处理：通过 `finally` 关闭 Prisma 与 PG 资源，并继续抛出失败，让 CI 或运维能够发现种子问题。
 * Keywords: seed main, roles, categories, super admin, whitelist, 种子主流程, 角色, 分类, 超级管理员, 白名单
 */
export async function main(): Promise<void> {
  const { prisma, pool } = createSeedRuntime();

  try {
    console.log('Seeding database...');

    const roles = ['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'];
    for (const roleName of roles) {
      await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName, description: `Role: ${roleName}` },
      });
    }

    const categories = [
      { name: 'tech', description: 'Technology and Development', sortOrder: 1 },
      { name: 'life', description: 'Life and Sharing', sortOrder: 2 },
      { name: 'qa', description: 'Questions and Answers', sortOrder: 3 },
    ];
    for (const category of categories) {
      await prisma.category.upsert({
        where: { name: category.name },
        update: {},
        create: category,
      });
    }

    const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    if (!superAdminRole) {
      throw new Error('SUPER_ADMIN role not found after upsert');
    }

    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (!adminRole) {
      throw new Error('ADMIN role not found after upsert');
    }

    const existingSystemUser = await prisma.user.findFirst({ where: { username: 'system' } });
    if (!existingSystemUser) {
      console.log('No system account found. Creating system account...');
      const hashedSystemPassword = await argon2.hash(crypto.randomBytes(10).toString('hex'));
      await prisma.user.create({
        data: {
          username: 'system',
          email: 'system@localhost',
          password: hashedSystemPassword,
          roleId: adminRole.id,
          status: UserStatus.ACTIVE,
        },
      });
      console.log('System account created successfully');
    }

    const existingSuperAdmin = await prisma.user.findFirst({
      where: { roleId: superAdminRole.id },
    });

    if (!existingSuperAdmin) {
      console.log('No SUPER_ADMIN found. Creating root account...');

      const existingRoot = await prisma.user.findFirst({ where: { username: 'root' } });
      if (existingRoot) {
        await prisma.user.update({
          where: { id: existingRoot.id },
          data: { roleId: superAdminRole.id, status: UserStatus.ACTIVE },
        });
        console.log('Root account existed but was updated to SUPER_ADMIN');
      } else {
        const hashedPassword = await argon2.hash('root');
        await prisma.user.create({
          data: {
            username: 'root',
            email: 'root@localhost',
            password: hashedPassword,
            roleId: superAdminRole.id,
            status: UserStatus.ACTIVE,
          },
        });
        console.log('Root account created successfully: username "root", password "root"');
      }
    }

    await ensureDefaultRouteWhitelist(prisma);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
