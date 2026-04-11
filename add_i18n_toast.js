const fs = require('fs');
const path = require('path');

const zhPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const enPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');

let zhContent = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
let enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));

zhContent.messages.userNotFound = "未找到该用户，或该用户未初始化私信功能。";
zhContent.messages.failedToSendRequest = "发送好友请求失败。";
zhContent.messages.errorSendingRequest = "发送请求时出错。";

enContent.messages.userNotFound = "User not found or has not initialized messaging.";
enContent.messages.failedToSendRequest = "Failed to send request.";
enContent.messages.errorSendingRequest = "Error sending request.";

fs.writeFileSync(zhPath, JSON.stringify(zhContent, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2));
console.log('Added toast i18n keys');
