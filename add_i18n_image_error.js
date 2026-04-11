const fs = require('fs');
const path = require('path');

const zhPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const enPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');

let zhContent = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
let enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));

zhContent.messages.imageLoadError = "图片加载失败或已过期";
enContent.messages.imageLoadError = "Failed to load image or expired";

fs.writeFileSync(zhPath, JSON.stringify(zhContent, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2));
console.log('Added image error i18n keys');
