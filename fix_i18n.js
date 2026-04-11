const fs = require('fs');
const path = require('path');

const zhPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const enPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');

let zhContent = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
let enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const zhAdditions = {
  conversationSettings: "会话设置",
  allowTwoSidedDelete: "允许双向删除",
  allowTwoSidedDeleteDesc: "开启后，当您删除一条消息时，{username} 的对应消息也会被删除。",
  noExpiration: "不限时",
  oneMinute: "1 分钟",
  oneHour: "1 小时",
  oneDay: "1 天",
  oneWeek: "1 周",
  clearChat: "清空记录",
  confirmClearChat: "确定要清空与该用户的聊天记录吗？",
  deleteMessage: "删除消息",
  download: "下载原图",
  fullScreen: "全屏预览",
  systemNotification: "系统通知",
  friendRequest: "好友请求",
  manageFriends: "管理好友",
  addFriend: "添加好友",
  enterUsernameToAdd: "输入要添加的用户名",
  sendRequest: "发送申请",
  yourFriends: "你的好友与申请",
  noFriendsYet: "暂无好友或待处理的申请。",
  accept: "接受",
  reject: "拒绝",
  chat: "发消息",
  pending: "待处理",
  accepted: "已接受",
  rejected: "已拒绝"
};

const enAdditions = {
  conversationSettings: "Conversation Settings",
  allowTwoSidedDelete: "Allow Two-Sided Delete",
  allowTwoSidedDeleteDesc: "If enabled, when you delete a message, it will also be deleted for {username}.",
  noExpiration: "No Expiration",
  oneMinute: "1 Minute",
  oneHour: "1 Hour",
  oneDay: "1 Day",
  oneWeek: "1 Week",
  clearChat: "Clear Chat",
  confirmClearChat: "Are you sure you want to clear this chat?",
  deleteMessage: "Delete Message",
  download: "Download",
  fullScreen: "Full Screen",
  systemNotification: "System Notification",
  friendRequest: "Friend Request",
  manageFriends: "Manage Friends",
  addFriend: "Add a Friend",
  enterUsernameToAdd: "Enter username to add",
  sendRequest: "Send Request",
  yourFriends: "Your Friends & Requests",
  noFriendsYet: "No friends or pending requests yet.",
  accept: "Accept",
  reject: "Reject",
  chat: "Chat",
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected"
};

Object.assign(zhContent.messages, zhAdditions);
Object.assign(enContent.messages, enAdditions);

fs.writeFileSync(zhPath, JSON.stringify(zhContent, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2));
console.log('i18n updated');
