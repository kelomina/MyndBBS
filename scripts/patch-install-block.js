const fs = require('fs');
const path = '/app/packages/frontend/.next/server/chunks/[root-of-the-server]__0oyckp5._.js';
let code = fs.readFileSync(path, 'utf8');

const marker = 'fetch("http://backend:3001/api/public/install-status"';
const idx = code.indexOf(marker);
if (idx < 0) { console.log('NOT FOUND'); process.exit(1); }

const ifStart = code.lastIndexOf('if(', idx);
const closeBrace = code.indexOf('}', idx) + 1;
const fullBlock = code.substring(ifStart, closeBrace);
console.log('Old block length:', fullBlock.length);

const newBlock = 'if(true){try{let n=await fetch("http://backend:3001/api/public/install-status",{signal:AbortSignal.timeout(2000)});if(n.ok){let r=await n.json();if(r.installed&&i.startsWith("/install")){let t=e.nextUrl.clone();t.pathname="/";return t7.NextResponse.redirect(t)}if(!r.installed&&!i.startsWith("/install")){let t=e.nextUrl.clone();t.pathname="/install";return t7.NextResponse.redirect(t)}}else if(!i.startsWith("/install")){let t=e.nextUrl.clone();t.pathname="/install";return t7.NextResponse.redirect(t)}}catch(e){if(!i.startsWith("/install")){let t=e.nextUrl.clone();t.pathname="/install";return t7.NextResponse.redirect(t)}}}';

code = code.replace(fullBlock, newBlock);
fs.writeFileSync(path, code, 'utf8');
console.log('OK, new length:', newBlock.length);