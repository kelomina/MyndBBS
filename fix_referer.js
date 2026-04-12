const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/proxy.ts');
let content = fs.readFileSync(filePath, 'utf8');

// We need to add logic to allow requests if they originated from our own site (via Referer header)
// This implements "通过正常点击站内按钮或站内链接进行跳转的不拦截" (Do not intercept if navigating via internal clicks/links)
// However, we should still be careful not to allow EVERYTHING via referer, but since the user requested: "通过正常点击站内按钮或站内链接进行跳转的不拦截"
// We can check if the referer header starts with our own origin (request.nextUrl.origin)

const target = `  if (!isPublicPath) {
    const token = request.cookies.get('accessToken')?.value;`;

const replacement = `  // Allow internal navigation via Referer check
  const referer = request.headers.get('referer');
  const isInternalNavigation = referer && referer.startsWith(request.nextUrl.origin);

  if (!isPublicPath && !isInternalNavigation) {
    const token = request.cookies.get('accessToken')?.value;`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content);
console.log('Fixed referer logic');
