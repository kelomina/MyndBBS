const fs = require('fs');
const path = '/app/packages/frontend/.next/server/chunks/[root-of-the-server]__0oyckp5._.js';
let code = fs.readFileSync(path, 'utf8');
const original = code;

// Add INSTALL_LOCKED redirect back: find where whitelist starts and add redirect before it
// The redirect should fire for non-install paths when INSTALL_LOCKED is not 'true'

// Pattern: the whitelist check starts with "let o=function"
// Before it, we need to add the redirect

const whitelistMarker = 'let o=function(e,t){for(let r of t)';
const redirectCode = '"true"!==process.env.INSTALL_LOCKED&&!i.startsWith("/install")){let t=e.nextUrl.clone();return t.pathname="/install",t7.NextResponse.redirect(t)}';

if (code.includes(whitelistMarker)) {
  code = code.replace(
    whitelistMarker,
    redirectCode + whitelistMarker
  );
}

if (code !== original) {
  fs.writeFileSync(path, code, 'utf8');
  console.log('Redirect added successfully');
} else {
  console.log('ERROR: Pattern not found');
  process.exit(1);
}
