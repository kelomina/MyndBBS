const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

(async () => {
  try {
    const fetch = globalThis.fetch;
    const baseUrl = 'http://localhost:3001';
    
    // Helper
    const request = async (path, method, body, cookiesStr) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookiesStr ? { 'Cookie': cookiesStr } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json().catch(() => null);
      
      const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
      let newCookies = '';
      if (rawCookies && rawCookies.length > 0 && rawCookies[0]) {
        newCookies = rawCookies.map(c => c.split(';')[0]).join('; ');
      }
      return { status: res.status, data, cookies: newCookies };
    };

    // 1. Create root user if not exists
    const prisma = new PrismaClient();
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    const rootPass = 'Root@1234!';
    const rootEmail = `root${Date.now()}@test.com`;
    const rootUser = await prisma.user.create({
      data: { username: rootEmail, email: rootEmail, password: await argon2.hash(rootPass), roleId: adminRole.id }
    });

    let rootRes = await request('/api/v1/auth/login', 'POST', { email: rootEmail, password: rootPass });
    let rootCookie = rootRes.cookies;
    console.log('Root login status:', rootRes.status);
    console.log('Root cookie:', rootCookie);

    // 2. Create user (but don't log in yet)
    const userEmail = `user${Date.now()}@test.com`;
    const userPass = 'User@1234!';
    const hashedPass = await argon2.hash(userPass);
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    const newUser = await prisma.user.create({
      data: { email: userEmail, username: userEmail, password: hashedPass, roleId: userRole.id, status: 'ACTIVE' }
    });

    // 3. Root elevates user to ADMIN
    let elevateRes = await request(`/api/admin/users/${newUser.id}/role`, 'PATCH', { role: 'ADMIN' }, rootCookie);
    console.log('Elevate status:', elevateRes.status);

    // 5. User logs in
    let userRes = await request('/api/v1/auth/login', 'POST', { email: userEmail, password: userPass });
    console.log('User login status:', userRes.status);
    let userCookie = userRes.cookies;
    console.log('User cookie:', userCookie);

    // 7. User accesses admin users
    let adminUsers = await request('/api/admin/users', 'GET', null, userCookie);
    console.log('User admin users:', adminUsers.status, adminUsers.data);

  } catch (e) {
    console.error(e.message);
  }
})();
