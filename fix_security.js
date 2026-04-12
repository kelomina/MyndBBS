const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/proxy.ts');
let content = fs.readFileSync(filePath, 'utf8');

// If an attacker spoofs the referer header or sends a fake RSC header, they can bypass the proxy check and hit the Next.js server directly.
// This means they could access /admin or /wp-admin and get a 404 instead of a 403, or worse, if they had normal user privileges, they might hit /admin and see some UI (though backend APIs would still block them).
// To properly secure the application, we shouldn't rely on easily spoofable headers like Referer or RSC to bypass security checks.
// The user originally asked: "通过正常点击站内按钮或站内链接进行跳转的不拦截"
// This implies they don't want 403 pages interrupting flow. But if we just block the specific paths that *must* be restricted (like /admin), we don't need the Referer hack at all!
// What are the actually restricted paths in the frontend?
// Based on the file structure: /admin, /admin-setup, /admin/*
// So if we just explicitly protect /admin and /wp-admin (and any other known admin paths), we can safely remove the Referer hack and provide real security.
// Let's replace the whole isPublicPath / referer logic with a strict path-based ACL.

const replacement = `  // 403 Protection Logic
  // Define paths that explicitly require SUPER_ADMIN privileges
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/wp-admin') || pathname.startsWith('/phpmyadmin') || pathname === '/.env';

  if (isAdminPath) {
    const token = request.cookies.get('accessToken')?.value;
    let isSuperAdmin = false;

    if (token) {
      try {
        const payload = token.split('.')[1];
        let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const decoded = atob(b64);
        const parsed = JSON.parse(decoded);
        if (parsed.role === 'SUPER_ADMIN') {
          isSuperAdmin = true;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!isSuperAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/403';

      // Preserve locale cookie on redirect
      const redirectResponse = NextResponse.redirect(url);
      if (request.cookies.get('NEXT_LOCALE')?.value !== locale) {
        redirectResponse.cookies.set('NEXT_LOCALE', locale, { path: '/' });
      }
      return redirectResponse;
    }
  }`;

// We need to replace from "// 403 Protection Logic" up to "return response;"
const startToken = "// 403 Protection Logic";
const endToken = "  return response;";

const startIndex = content.indexOf(startToken);
const endIndex = content.lastIndexOf(endToken);

if (startIndex !== -1 && endIndex !== -1) {
    const newContent = content.substring(0, startIndex) + replacement + "\n\n" + content.substring(endIndex);
    fs.writeFileSync(filePath, newContent);
    console.log('Fixed security logic');
} else {
    console.log('Could not find tokens');
}
