const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `      try {
        const data = JSON.parse(payload);
        if (data.type !== 'image') return;

        const res = await fetch(data.url);
        const encryptedBuffer = await res.arrayBuffer();

        const keyBytes = Uint8Array.from(atob(data.key), c => c.charCodeAt(0));
        const ivBytes = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));

        const aesKey = await window.crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, encryptedBuffer);

        const blob = new Blob([decryptedBuffer], { type: data.mime });
        setBlobUrl(URL.createObjectURL(blob));
      } catch (e) {
        console.error('Failed to decrypt image', e);
      }`;

const replace = `      try {
        const data = JSON.parse(payload);
        if (data.type !== 'image') return;

        const res = await fetch(data.url);
        if (!res.ok) throw new Error(\`Failed to fetch image: \${res.status}\`);
        
        const encryptedBuffer = await res.arrayBuffer();

        const keyBytes = Uint8Array.from(atob(data.key), c => c.charCodeAt(0));
        const ivBytes = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));

        const aesKey = await window.crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
        const decryptedBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, encryptedBuffer);

        const blob = new Blob([decryptedBuffer], { type: data.mime });
        setBlobUrl(URL.createObjectURL(blob));
      } catch (e) {
        console.error('Failed to decrypt image', e);
        setBlobUrl('error');
      }`;

content = content.replace(target, replace);

// Add error UI for blobUrl === 'error'
const uiTarget = `  if (!blobUrl) return <Loader2 className="animate-spin h-5 w-5" />;\n\n  return (\n    <div className="relative">`;
const uiReplace = `  if (!blobUrl) return <Loader2 className="animate-spin h-5 w-5" />;\n  if (blobUrl === 'error') return <div className="flex flex-col items-center gap-1 p-4 bg-destructive/10 text-destructive rounded text-xs border border-destructive/20"><AlertCircle className="h-5 w-5" /><span>{dict.messages?.imageLoadError || "Failed to load image"}</span></div>;\n\n  return (\n    <div className="relative">`;

content = content.replace(uiTarget, uiReplace);

// Make sure AlertCircle is imported
if (!content.includes('AlertCircle')) {
    content = content.replace(
        "import { Shield, MessageSquare, Loader2, Search, Settings, UserPlus, Flame, Trash2, Clock, Trash, Image as ImageIcon, X, Check } from 'lucide-react';",
        "import { Shield, MessageSquare, Loader2, Search, Settings, UserPlus, Flame, Trash2, Clock, Trash, Image as ImageIcon, X, Check, AlertCircle } from 'lucide-react';"
    );
}

fs.writeFileSync(filePath, content);
console.log('Fixed image decryption error handling');
