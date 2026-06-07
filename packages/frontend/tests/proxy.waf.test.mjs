import assert from 'node:assert/strict';
import test from 'node:test';

const MALICIOUS_PATH_PATTERNS = [
  /\/fckeditor/i,
  /\/tiny_mce/i,
  /\/tinymce/i,
  /\/phpmyadmin/i,
  /\/pma\//i,
  /\/mysql\//i,
  /\/jmx-console/i,
  /\/web-console/i,
  /\/axis2/i,
  /\/axis\//i,
  /\/jolokia/i,
  /\/faces\//i,
  /\/scripts\//i,
  /\/cgi-bin\//i,
  /\/msdac/i,
  /\/_vti_bin/i,
  /\/citrix/i,
  /\/node\/1\?_format=hal_json/i,
  /\/zabbix\.php/i,
  /\/mantis/i,
  /\/mantisbt/i,
  /\/remote\/fgt_lang/i,
  /\/wavemaker/i,
  /\/docpicker/i,
  /\/sugarcrm/i,
  /\/telerik/i,
  /\/wps\//i,
  /\/resolute\.php/i,
  /\/console\/login/i,
  /\/wp-content\//i,
  /\/wp-admin/i,
  /\/wp-login/i,
  /\/\.git/i,
  /\/\.svn/i,
  /\/\.env/i,
  /\/debug\//i,
  /\/actuator/i,
  /\/heapdump/i,
  /\/status\?full/i,
  /\/AdaptCMS/i,
  /\/ADSearch/i,
  /\/analytics\/saw/i,
  /\/bmc_help/i,
  /\/bugs\/verify/i,
  /\/CTCWebService/i,
  /\/CgiStart/i,
  /\/application\.wadl/i,
  /\/service\?wsdl/i,
  /\/names\.nsf/i,
  /\/filter\/jmol/i,
  /\/getFavicon/i,
  /\/gotoURL/i,
  /\/open-flash-chart/i,
  /\/PDC/i,
  /\/show_image_/i,
  /\/proxy\.stream/i,
  /\/plugins\/servlet\/gadgets/i,
  /\/WebResource\.axd/i,
  /\/Telerik\.Web\.UI/i,
  /\/secure\/ConfigurePortal/i,
  /\/servlet\/taskProc/i,
  /\/MicroStrategy/i,
];

function isMaliciousPath(pathname) {
  return MALICIOUS_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

const ESSENTIAL_PUBLIC_PATHS = new Set([
  '/install',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/403',
  '/admin-setup',
  '/terms',
  '/privacy',
]);

function isEssentialPublicPath(pathname) {
  return (
    ESSENTIAL_PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/install') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico'
  );
}

const locales = ['en', 'zh'];

function normalizePathname(pathname) {
  let p = pathname;
  if (p.length > 1) {
    p = p.replace(/\/+$/, '');
  }

  const parts = p.split('/');
  const maybeLocale = parts[1];
  if (maybeLocale && locales.includes(maybeLocale)) {
    const rest = parts.slice(2).join('/');
    return rest ? `/${rest}` : '/';
  }

  return p;
}

test('isMaliciousPath blocks common CMS admin paths', () => {
  assert.equal(isMaliciousPath('/fckeditor'), true);
  assert.equal(isMaliciousPath('/FCKeditor/upload'), true);
  assert.equal(isMaliciousPath('/tiny_mce'), true);
  assert.equal(isMaliciousPath('/TinyMCE'), true);
  assert.equal(isMaliciousPath('/tinymce'), true);
});

test('isMaliciousPath blocks database management interfaces', () => {
  assert.equal(isMaliciousPath('/phpmyadmin'), true);
  assert.equal(isMaliciousPath('/phpMyAdmin'), true);
  assert.equal(isMaliciousPath('/pma/'), true);
  assert.equal(isMaliciousPath('/mysql/'), true);
});

test('isMaliciousPath blocks Java/J2EE monitoring consoles', () => {
  assert.equal(isMaliciousPath('/jmx-console'), true);
  assert.equal(isMaliciousPath('/web-console'), true);
  assert.equal(isMaliciousPath('/axis2'), true);
  assert.equal(isMaliciousPath('/axis/'), true);
  assert.equal(isMaliciousPath('/jolokia'), true);
  assert.equal(isMaliciousPath('/faces/'), true);
});

test('isMaliciousPath blocks common attack vectors', () => {
  assert.equal(isMaliciousPath('/.git/config'), true);
  assert.equal(isMaliciousPath('/.svn/entries'), true);
  assert.equal(isMaliciousPath('/.env'), true);
  assert.equal(isMaliciousPath('/debug/'), true);
  assert.equal(isMaliciousPath('/cgi-bin/'), true);
});

test('isMaliciousPath does not block legitimate cloud metadata paths', () => {
  assert.equal(isMaliciousPath('/latest/meta-data'), false);
  assert.equal(isMaliciousPath('/169.254.169.254'), false);
});

test('isMaliciousPath blocks Spring/Actuator endpoints', () => {
  assert.equal(isMaliciousPath('/actuator'), true);
  assert.equal(isMaliciousPath('/actuator/env'), true);
  assert.equal(isMaliciousPath('/heapdump'), true);
  assert.equal(isMaliciousPath('/status?full'), true);
});

test('isMaliciousPath blocks WordPress paths', () => {
  assert.equal(isMaliciousPath('/wp-admin'), true);
  assert.equal(isMaliciousPath('/wp-login'), true);
  assert.equal(isMaliciousPath('/wp-content/uploads'), true);
});

test('isMaliciousPath allows normal application paths', () => {
  assert.equal(isMaliciousPath('/'), false);
  assert.equal(isMaliciousPath('/posts'), false);
  assert.equal(isMaliciousPath('/login'), false);
  assert.equal(isMaliciousPath('/admin/users'), false);
  assert.equal(isMaliciousPath('/api/posts'), false);
  assert.equal(isMaliciousPath('/uploads/avatar.png'), false);
});

test('isMaliciousPath is case insensitive', () => {
  assert.equal(isMaliciousPath('/PHPMyAdmin'), true);
  assert.equal(isMaliciousPath('/WPS/admin'), true);
  assert.equal(isMaliciousPath('/.GIT/config'), true);
});

test('isEssentialPublicPath allows explicit essential public paths', () => {
  assert.equal(isEssentialPublicPath('/login'), true);
  assert.equal(isEssentialPublicPath('/register'), true);
  assert.equal(isEssentialPublicPath('/forgot-password'), true);
  assert.equal(isEssentialPublicPath('/reset-password'), true);
  assert.equal(isEssentialPublicPath('/403'), true);
  assert.equal(isEssentialPublicPath('/admin-setup'), true);
  assert.equal(isEssentialPublicPath('/terms'), true);
  assert.equal(isEssentialPublicPath('/privacy'), true);
});

test('isEssentialPublicPath allows /install and subpaths', () => {
  assert.equal(isEssentialPublicPath('/install'), true);
  assert.equal(isEssentialPublicPath('/install?step=database'), true);
});

test('isEssentialPublicPath allows static asset paths', () => {
  assert.equal(isEssentialPublicPath('/_next/static/main.js'), true);
  assert.equal(isEssentialPublicPath('/_next/image'), true);
  assert.equal(isEssentialPublicPath('/favicon.ico'), true);
});

test('isEssentialPublicPath allows API paths', () => {
  assert.equal(isEssentialPublicPath('/api/posts'), true);
  assert.equal(isEssentialPublicPath('/api/auth/login'), true);
  assert.equal(isEssentialPublicPath('/api/public/routing-whitelist'), true);
});

test('isEssentialPublicPath allows uploads paths', () => {
  assert.equal(isEssentialPublicPath('/uploads/avatar.png'), true);
  assert.equal(isEssentialPublicPath('/uploads/2024/05/image.jpg'), true);
});

test('isEssentialPublicPath blocks non-public application paths', () => {
  assert.equal(isEssentialPublicPath('/profile'), false);
  assert.equal(isEssentialPublicPath('/settings'), false);
  assert.equal(isEssentialPublicPath('/messages'), false);
  assert.equal(isEssentialPublicPath('/admin'), false);
  assert.equal(isEssentialPublicPath('/compose'), false);
});

test('normalizePathname removes trailing slashes except for root', () => {
  assert.equal(normalizePathname('/posts/'), '/posts');
  assert.equal(normalizePathname('/admin/users/'), '/admin/users');
  assert.equal(normalizePathname('/'), '/');
});

test('normalizePathname strips locale prefix', () => {
  assert.equal(normalizePathname('/en'), '/');
  assert.equal(normalizePathname('/en/'), '/');
  assert.equal(normalizePathname('/en/posts'), '/posts');
  assert.equal(normalizePathname('/en/admin/users'), '/admin/users');
  assert.equal(normalizePathname('/zh/login'), '/login');
  assert.equal(normalizePathname('/zh'), '/');
});

test('normalizePathname does not affect paths without locale prefix', () => {
  assert.equal(normalizePathname('/posts'), '/posts');
  assert.equal(normalizePathname('/admin/users'), '/admin/users');
  assert.equal(normalizePathname('/login'), '/login');
});

test('normalizePathname preserves paths that look like locales but are not', () => {
  assert.equal(normalizePathname('/enterprise/login'), '/enterprise/login');
  assert.equal(normalizePathname('/zen/dashboard'), '/zen/dashboard');
});

test('WAF integration: install wizard should be accessible without authentication', () => {
  const path = '/install';
  assert.equal(isMaliciousPath(path), false);
  assert.equal(isEssentialPublicPath(path), true);
});

test('WAF integration: admin paths should be protected', () => {
  const path = '/admin';
  assert.equal(isMaliciousPath(path), false);
  assert.equal(isEssentialPublicPath(path), false);
});

test('WAF integration: public read endpoints should be accessible', () => {
  const path = '/posts';
  assert.equal(isMaliciousPath(path), false);
  assert.equal(isEssentialPublicPath(path), false);
});

test('WAF integration: malicious paths should be blocked before auth check', () => {
  const maliciousPaths = [
    '/.git/config',
    '/wp-admin',
    '/phpmyadmin',
    '/actuator/env',
    '/debug/pprof',
  ];
  maliciousPaths.forEach((path) => {
    assert.equal(isMaliciousPath(path), true, `Expected ${path} to be blocked`);
  });
});
