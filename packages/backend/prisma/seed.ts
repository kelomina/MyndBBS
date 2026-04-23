import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { UserStatus } from '@myndbbs/shared';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Callers: []
 * Callees: [log, upsert, findUnique, findFirst, update, hash, create]
 * Description: Handles the main logic for the application.
 * Keywords: main, auto-annotated
 */
async function main() {
  console.log('Seeding database...');

  // 1. Ensure basic roles exist
  const roles = ['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'];
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `Role: ${roleName}` }
    });
  }

  // 1.5 Ensure basic categories exist
  const categories = [
    { name: 'tech', description: 'Technology and Development', sortOrder: 1 },
    { name: 'life', description: 'Life and Sharing', sortOrder: 2 },
    { name: 'qa', description: 'Questions and Answers', sortOrder: 3 }
  ];
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat
    });
  }

  // 2. Check if any SUPER_ADMIN exists
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN role not found after upsert');
  }

  // 2.5 Ensure 'system' user exists
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (!adminRole) {
    throw new Error('ADMIN role not found after upsert');
  }

  const existingSystemUser = await prisma.user.findFirst({ where: { username: 'system' } });
  if (!existingSystemUser) {
    console.log('No system account found. Creating system account...');
    const hashedSystemPassword = await argon2.hash(Math.random().toString(36).slice(-10));
    await prisma.user.create({
      data: {
        username: 'system',
        email: 'system@localhost',
        password: hashedSystemPassword,
        roleId: adminRole.id,
        status: UserStatus.ACTIVE
      }
    });
    console.log('System account created successfully');
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { roleId: superAdminRole.id }
  });

  if (!existingSuperAdmin) {
    console.log('No SUPER_ADMIN found. Creating root account...');
    
    // In case a root user already exists but isn't SUPER_ADMIN, we should update it
    const existingRoot = await prisma.user.findFirst({ where: { username: 'root' } });
    if (existingRoot) {
      await prisma.user.update({
        where: { id: existingRoot.id },
        data: { roleId: superAdminRole.id, status: UserStatus.ACTIVE }
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
          status: UserStatus.ACTIVE
        }
      });
      console.log('Root account created successfully: username "root", password "root"');
    }
  }

  // 3. Ensure essential public routes exist in route whitelist
  const defaultWhitelistRoutes = [
    {
      id: '00000000-0000-0000-0000-000000000000',
      path: '/api',
      isPrefix: true,
      minRole: null,
      description: 'Global API prefix whitelist (managed internally)',
    },
    {
      id: '00000000-0000-0000-0000-000000000001',
      path: '/terms',
      isPrefix: false,
      minRole: null,
      description: 'Public terms of service page',
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      path: '/privacy',
      isPrefix: false,
      minRole: null,
      description: 'Public privacy policy page',
    },
  ];

  for (const route of defaultWhitelistRoutes) {
    const existingRoute = await prisma.routeWhitelist.findUnique({ where: { path: route.path } });
    if (!existingRoute) {
      await prisma.routeWhitelist.create({ data: route });
      console.log(`Added ${route.path} to route whitelist`);
    }
  }

}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
