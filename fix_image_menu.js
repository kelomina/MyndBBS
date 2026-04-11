const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover border shadow-lg rounded-lg p-2 z-50 flex flex-col gap-1 min-w-[120px]">`;
const replacement = `<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border shadow-2xl rounded-lg p-2 z-50 flex flex-col gap-1 min-w-[120px] backdrop-blur-md dark:bg-zinc-900/95 animate-in zoom-in-95 duration-200">`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content);
console.log('Fixed image context menu background');
