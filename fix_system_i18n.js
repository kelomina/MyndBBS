const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/frontend/src/app/messages/[username]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `                                  <div className="flex flex-col gap-1">
                                    <strong className="text-sm border-b border-border/50 pb-1 mb-1">{parsed.title}</strong>
                                    <span className="text-sm">{parsed.content}</span>`;

const replacement = `                                  <div className="flex flex-col gap-1">
                                    <strong className="text-sm border-b border-border/50 pb-1 mb-1">
                                      {parsed.type === 'POST_APPROVED' ? (dict.messages?.postApproved || 'Post Approved') :
                                       parsed.type === 'POST_REJECTED' ? (dict.messages?.postRejected || 'Post Rejected') :
                                       parsed.type === 'SYSTEM' ? (dict.messages?.systemAlert || parsed.title) :
                                       parsed.title}
                                    </strong>
                                    <span className="text-sm">
                                      {parsed.type === 'POST_APPROVED' && dict.messages?.postApprovedDesc ? dict.messages.postApprovedDesc.replace('{title}', parsed.content.match(/"([^"]+)"/)?.[1] || 'Post') :
                                       parsed.type === 'POST_REJECTED' && dict.messages?.postRejectedDesc ? dict.messages.postRejectedDesc.replace('{title}', parsed.content.match(/"([^"]+)"/)?.[1] || 'Post').replace('{reason}', parsed.content.split('Reason: ')[1] || 'N/A') :
                                       parsed.type === 'SYSTEM' && dict.messages?.systemAlertDesc ? dict.messages.systemAlertDesc.replace('{title}', parsed.content.match(/"([^"]+)"/)?.[1] || 'Post') :
                                       parsed.content}
                                    </span>`;

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content);

// Now let's update dictionaries
const zhPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const enPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');

let zhDict = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
let enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));

zhDict.messages.postApproved = "帖子审核通过";
zhDict.messages.postRejected = "帖子未通过审核";
zhDict.messages.systemAlert = "系统通知";
zhDict.messages.postApprovedDesc = "您的帖子 \"{title}\" 已经通过审核并发布。";
zhDict.messages.postRejectedDesc = "您的帖子 \"{title}\" 未通过审核。原因: {reason}";
zhDict.messages.systemAlertDesc = "有新的帖子 \"{title}\" 提交到了人工审核队列，请前往后台处理。";
zhDict.messages.viewPost = "查看帖子";

enDict.messages.postApproved = "Post Approved";
enDict.messages.postRejected = "Post Rejected";
enDict.messages.systemAlert = "System Alert";
enDict.messages.postApprovedDesc = "Your post \"{title}\" has been approved and published.";
enDict.messages.postRejectedDesc = "Your post \"{title}\" has been rejected. Reason: {reason}";
enDict.messages.systemAlertDesc = "A new post \"{title}\" has been submitted for moderation. Please review it.";
enDict.messages.viewPost = "View Post";

fs.writeFileSync(zhPath, JSON.stringify(zhDict, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enDict, null, 2));

console.log('Fixed system message i18n');
