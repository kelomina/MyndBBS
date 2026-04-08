const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

(async () => {
  const prisma = new PrismaClient();
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  
  if (!await prisma.user.findFirst({ where: { username: 'root' } })) {
    await prisma.user.create({
      data: { username: 'root', email: 'root@test.com', password: await argon2.hash('Root@1234!'), roleId: adminRole.id }
    });
  }

  const userEmail = `user${Date.now()}@test.com`;
  const userPass = 'User@1234!';
  const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
  const newUser = await prisma.user.create({
    data: { email: userEmail, username: userEmail, password: await argon2.hash(userPass), roleId: userRole.id, status: 'ACTIVE' }
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Log in as root
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'root');
  await page.fill('input[type="password"]', 'Root@1234!');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3000/');

  // 2. Elevate user to ADMIN
  await page.goto('http://localhost:3000/admin/users');
  await page.waitForSelector('table');
  await page.evaluate(async (userId) => {
    await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ADMIN' })
    });
  }, newUser.id);

  // 3. Manually refresh browser -> logged out of root
  await page.reload();
  await page.waitForURL('http://localhost:3000/login');

  // 4. Log in as user
  await page.fill('input[type="email"]', userEmail);
  await page.fill('input[type="password"]', userPass);
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3000/');

  // 5. Go to admin dashboard
  await page.goto('http://localhost:3000/admin/users');
  
  try {
    await page.waitForSelector('text="Forbidden: Insufficient permissions"', { timeout: 3000 });
    console.log('BUG REPRODUCED! Found "Forbidden: Insufficient permissions" on the page.');
  } catch (e) {
    console.log('Bug NOT reproduced. The text was not found.');
    console.log('Page content:', await page.content());
  }

  await browser.close();
})();
