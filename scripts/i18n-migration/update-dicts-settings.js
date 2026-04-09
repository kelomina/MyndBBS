const fs = require('fs');
const path = require('path');

const zhDictPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const enDictPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');

const zhDict = JSON.parse(fs.readFileSync(zhDictPath, 'utf8'));
const enDict = JSON.parse(fs.readFileSync(enDictPath, 'utf8'));

// Settings strings
zhDict.settings = {
  loadingProfile: "加载资料中...",
  manageProfile: "管理您的公开资料和登录详情。",
  username: "用户名",
  email: "邮箱",
  changePassword: "更改密码",
  leaveBlankToKeep: "留空以保留当前密码。",
  newPassword: "新密码",
  saving: "保存中...",
  saveChanges: "保存更改",
  profileUpdated: "资料更新成功",
  failedUpdateProfile: "更新资料失败",

  loadingSecurity: "加载安全设置中...",
  manageSecurity: "管理您的双重身份验证和无密码登录方式。",
  passkeys: "Passkeys",
  passkeysDesc: "Passkeys 允许您使用设备的指纹、面部扫描或屏幕锁定安全登录。",
  noPasskeys: "尚未注册任何 Passkeys。",
  added: "添加于",
  removePasskey: "移除 Passkey",
  addNewPasskey: "添加新的 Passkey",
  passkeyAdded: "成功添加 Passkey",
  passkeyRemoved: "成功移除 Passkey",
  confirmRemovePasskey: "确定要移除此 Passkey 吗？",
  
  totpTitle: "身份验证器应用 (TOTP)",
  totpDesc: "使用身份验证器应用（如 Google Authenticator 或 Authy）生成用于 2FA 的一次性验证码。",
  totpEnabled: "已启用身份验证器应用",
  accountProtected: "您的账号受到 2FA 保护",
  disable: "停用",
  enableTotp: "启用身份验证器应用",
  cancelSetup: "取消设置",
  confirmDisableTotp: "确定要停用身份验证器应用 (TOTP) 吗？",
  totpDisabled: "成功停用身份验证器应用",

  loadingSessions: "加载会话中...",
  manageSessions: "管理当前登录您账号的设备。",
  noActiveSessions: "未找到活跃会话。",
  unknownDevice: "未知设备",
  unknownIp: "未知",
  expires: "过期",
  started: "开始于",
  signOutDevice: "注销设备",
  confirmRevokeSession: "确定要注销此会话吗？",
  sessionRevoked: "会话注销成功",
  failedFetchSessions: "加载会话失败",
  failedRevokeSession: "注销会话失败"
};

enDict.settings = {
  loadingProfile: "Loading profile...",
  manageProfile: "Manage your public profile and login details.",
  username: "Username",
  email: "Email",
  changePassword: "Change Password",
  leaveBlankToKeep: "Leave blank to keep your current password.",
  newPassword: "New Password",
  saving: "Saving...",
  saveChanges: "Save Changes",
  profileUpdated: "Profile updated successfully",
  failedUpdateProfile: "Failed to update profile",

  loadingSecurity: "Loading security settings...",
  manageSecurity: "Manage your two-factor authentication and passwordless login methods.",
  passkeys: "Passkeys",
  passkeysDesc: "Passkeys allow you to securely sign in using your device's fingerprint, face scan, or screen lock.",
  noPasskeys: "No passkeys registered yet.",
  added: "Added",
  removePasskey: "Remove Passkey",
  addNewPasskey: "Add New Passkey",
  passkeyAdded: "Passkey added successfully",
  passkeyRemoved: "Passkey removed successfully",
  confirmRemovePasskey: "Are you sure you want to remove this passkey?",
  
  totpTitle: "Authenticator App (TOTP)",
  totpDesc: "Use an authenticator app (like Google Authenticator or Authy) to generate one-time codes for 2FA.",
  totpEnabled: "Authenticator App Enabled",
  accountProtected: "Your account is protected with 2FA",
  disable: "Disable",
  enableTotp: "Enable Authenticator App",
  cancelSetup: "Cancel Setup",
  confirmDisableTotp: "Are you sure you want to disable Authenticator App (TOTP)?",
  totpDisabled: "Authenticator App disabled successfully",

  loadingSessions: "Loading sessions...",
  manageSessions: "Manage devices currently logged into your account.",
  noActiveSessions: "No active sessions found.",
  unknownDevice: "Unknown Device",
  unknownIp: "Unknown",
  expires: "Expires",
  started: "Started",
  signOutDevice: "Sign out device",
  confirmRevokeSession: "Are you sure you want to sign out of this session?",
  sessionRevoked: "Session revoked successfully",
  failedFetchSessions: "Error loading sessions",
  failedRevokeSession: "Failed to revoke session"
};

fs.writeFileSync(zhDictPath, JSON.stringify(zhDict, null, 2), 'utf8');
fs.writeFileSync(enDictPath, JSON.stringify(enDict, null, 2), 'utf8');

console.log("Settings Dictionaries updated.");
