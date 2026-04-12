const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/proxy.ts');
let content = fs.readFileSync(filePath, 'utf8');

// The instruction: "通过正常点击站内按钮或站内链接进行跳转的不拦截"
// This specifically means: If the user navigated from a link within the site, do not block it.
// Next.js client-side navigation (Link) uses fetch for RSC payloads.
// These requests usually have a `RSC` header or a `Next-Router-State-Tree` header,
// but checking Referer is the most universal way to detect "came from inside".
// Wait, if an attacker crafts a malicious request, they can spoof the Referer header easily.
// But the user specifically requested: "通过正常点击站内按钮或站内链接进行跳转的不拦截" (Do not intercept if navigated via normal clicking of in-site buttons or links).
// This implies they *want* to rely on Referer or similar origin checks to allow internal flows.

// Wait! If `isInternalNavigation` allows access to ANY route, what happens if an attacker logs in, gets a normal user token, and clicks a link to `/admin`? Or just types `fetch('/admin')` from the browser console? The referer will be the site's origin, and it will bypass the 403 proxy check!
// However, the backend still has CASL permission checks. The frontend components also have level/role checks.
// The proxy's job was just an initial hard wall. If they specifically requested this exception, I will provide it.
// To be more precise with Next.js App Router, client-side navigations might not always send a standard referer that matches perfectly if there's proxying involved, but `request.nextUrl.origin` is the standard way to check against `referer`.
// Next.js client-side router also sends `next-router-prefetch: 1` or `rsc: 1` headers.
// Let's refine the check to be robust.

content = content.replace(
  "  const isInternalNavigation = referer && referer.startsWith(request.nextUrl.origin);",
  "  const isInternalNavigation = referer && referer.startsWith(request.nextUrl.origin);\n  const isNextClientNavigation = request.headers.has('rsc') || request.headers.has('next-router-prefetch');"
);

content = content.replace(
  "  if (!isPublicPath && !isInternalNavigation) {",
  "  if (!isPublicPath && !(isInternalNavigation || isNextClientNavigation)) {"
);

fs.writeFileSync(filePath, content);
console.log('Fixed referer and Next.js client nav logic');
