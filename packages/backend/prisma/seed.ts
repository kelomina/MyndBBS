import { PrismaClient, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

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
  } else {
    console.log('A SUPER_ADMIN account already exists. Skipping root account creation.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
