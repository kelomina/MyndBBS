const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Animate error banner
content = content.replace(
  '<div className="mb-6 shrink-0 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">',
  '<div className="mb-6 shrink-0 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ease-out">'
);

// Animate modal popups
content = content.replace(
  '<div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>',
  '<div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>'
);

// Animate the image itself inside the modal
content = content.replace(
  '<img src={previewImage} className="max-w-full max-h-full object-contain" alt="Preview" />',
  '<img src={previewImage} className="max-w-full max-h-full object-contain animate-in zoom-in-95 duration-200" alt="Preview" />'
);

fs.writeFileSync(filePath, content);
console.log('Added animations');
