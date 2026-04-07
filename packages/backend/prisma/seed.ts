import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Ensure basic roles exist
  const roles = ['USER', 'MODERATOR', 'ADMIN'];
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `Role: ${roleName}` }
    });
  }

  // 2. Check if any ADMIN exists
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (!adminRole) {
    throw new Error('ADMIN role not found after upsert');
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { roleId: adminRole.id }
  });

  if (!existingAdmin) {
    console.log('No ADMIN found. Creating root account...');
    const hashedPassword = await argon2.hash('root');
    await prisma.user.create({
      data: {
        username: 'root',
        email: 'root@localhost',
        password: hashedPassword,
        roleId: adminRole.id,
        status: 'ACTIVE'
      }
    });
    console.log('Root account created successfully: username "root", password "root"');
  } else {
    console.log('An ADMIN account already exists. Skipping root account creation.');
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
