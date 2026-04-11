const fs = require('fs');
const path = require('path');

const zhPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const enPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');

let zhContent = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
let enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));

zhContent.messages.errLevelTooLow = "您的等级不足（需 >= 2 级）无法发送私信。";
zhContent.messages.errFriendLimit = "非好友最多发送 3 条消息，请先添加对方为好友。";

enContent.messages.errLevelTooLow = "Your level is too low (>= 2 required) to send private messages.";
enContent.messages.errFriendLimit = "Non-friends can only send up to 3 messages. Please add as a friend first.";

fs.writeFileSync(zhPath, JSON.stringify(zhContent, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2));
console.log('i18n updated with error messages');
