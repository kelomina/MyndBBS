const fs = require('fs');
const path = require('path');

const zhPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const enPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');

let zhContent = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
let enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));

zhContent.messages.errRateLimit = "发送频率过快，请稍后再试。";
zhContent.messages.requestSent = "已发送申请";

enContent.messages.errRateLimit = "You are sending messages too fast. Please try again later.";
enContent.messages.requestSent = "Request Sent";

fs.writeFileSync(zhPath, JSON.stringify(zhContent, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2));
console.log('Added missing i18n keys');
