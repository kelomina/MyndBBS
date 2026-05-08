const fs = require('fs');
const path = '/app/packages/frontend/.next/server/chunks/[root-of-the-server]__0oyckp5._.js';
let code = fs.readFileSync(path, 'utf8');
// Remove the INSTALL_LOCKED redirect block:
// Find the redirect pattern and replace it with empty
code = code.replace(
  /"true"!==process\.env\.INSTALL_LOCKED&&!i\.startsWith\("\/install"\)\)\{let t=e\.nextUrl\.clone\(\);return t\.pathname="\/install",[^}]+\}/
, 'false){');
console.log('Removed INSTALL_LOCKED redirect from middleware');
fs.writeFileSync(path, code, 'utf8');
