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
    console.log('Root login:', rootRes.status);
    let rootCookie = rootRes.cookies;

    // 2. Register user
    const userEmail = `user${Date.now()}@test.com`;
    const userPass = 'User@1234!';
    const hashedPass = await argon2.hash(userPass);
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    const newUser = await prisma.user.create({
      data: { email: userEmail, username: userEmail, password: hashedPass, roleId: userRole.id, status: 'ACTIVE' }
    });
    console.log('Created user:', newUser.id);

    // 3. User login
    let userRes = await request('/api/v1/auth/login', 'POST', { email: userEmail, password: userPass });
    console.log('User login:', userRes.status);
    let userCookie = userRes.cookies;

    // 4. Root elevates user
    let elevateRes = await request(`/api/admin/users/${newUser.id}/role`, 'PATCH', { role: 'ADMIN' }, rootCookie);
    console.log('Root elevate:', elevateRes.status, elevateRes.data);

    // 5. User access admin (old token)
    let adminRes1 = await request('/api/admin/users', 'GET', null, userCookie);
    console.log('User access admin (old token):', adminRes1.status, adminRes1.data);
    if (adminRes1.cookies) {
      console.log('Got new cookie on refresh!', adminRes1.cookies);
      userCookie = adminRes1.cookies;
    }

    // 6. User access admin again (new token)
    let adminRes2 = await request('/api/admin/users', 'GET', null, userCookie);
    console.log('User access admin (new token):', adminRes2.status, adminRes2.data);

    // 7. Fresh login
    let userRes2 = await request('/api/v1/auth/login', 'POST', { email: userEmail, password: userPass });
    console.log('User login 2:', userRes2.status);
    let userCookie2 = userRes2.cookies;

    let adminRes3 = await request('/api/admin/users', 'GET', null, userCookie2);
    console.log('User access admin (fresh login):', adminRes3.status, adminRes3.data);

  } catch (e) {
    console.error(e.message);
  }
})();
