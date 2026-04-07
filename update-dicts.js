const fs = require('fs');
const path = require('path');

const zhDictPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const enDictPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');

const zhDict = JSON.parse(fs.readFileSync(zhDictPath, 'utf8'));
const enDict = JSON.parse(fs.readFileSync(enDictPath, 'utf8'));

// Update common
Object.assign(zhDict.common, {
  categoryTech: "技术",
  categoryLife: "生活",
  categoryQA: "问答"
});
Object.assign(enDict.common, {
  categoryTech: "Technology",
  categoryLife: "Life",
  categoryQA: "Q&A"
});

// Update home
zhDict.home = {
  mockPosts: [
    { title: "欢迎来到 MyndBBS！这是我们的设计理念。", author: "管理员", category: "公告", time: "2小时前", excerpt: "我们正在构建一个干净、轻量且安全的论坛。在这篇文章中，我们讨论了为什么选择 Next.js 以及我们如何实现 WebAuthn 无密码登录。" },
    { title: "如何在 monorepo 中正确定义 Prisma 查询的类型？", author: "开发小哥", category: "技术", time: "5小时前", excerpt: "我在纠结如何在后端和前端包之间共享 Prisma 类型。有人有好的模式吗？" },
    { title: "分享你 2026 年极简桌面设置", author: "极简主义者", category: "生活", time: "1天前", excerpt: "既然我们都追求干净/轻盈的美学，让我们看看你写代码的地方。在下面发你的桌面照片吧！" }
  ]
};
enDict.home = {
  mockPosts: [
    { title: "Welcome to MyndBBS! Here is our design philosophy.", author: "Admin", category: "Announcements", time: "2h ago", excerpt: "We are building a clean, light, and secure forum. In this post, we discuss why we chose Next.js and how we implemented WebAuthn for passwordless login." },
    { title: "How to properly type Prisma queries in a monorepo?", author: "DevGuy", category: "Technology", time: "5h ago", excerpt: "I'm struggling with sharing Prisma types between my backend and frontend packages. Does anyone have a good pattern for this?" },
    { title: "Share your minimal desk setups for 2026", author: "Minimalist", category: "Life", time: "1d ago", excerpt: "Since we're all about that clean/light aesthetic here, let's see where you write your code. Post your desk photos below!" }
  ]
};

// auth additions
Object.assign(zhDict.auth, {
  signingIn: "登录中...",
  securityVerificationPassed: "安全验证通过",
  creating: "创建中...",
  completeSecurityVerificationFirst: "请先完成安全验证。",
  passwordLengthError: "密码长度必须在 8 到 128 个字符之间",
  passwordComplexityError: "密码必须包含大小写字母、数字和特殊字符",
  loginFailed: "登录失败",
  networkError: "网络错误",
  passkeyCancelled: "Passkey 身份验证被取消或超时。",
  passkeyFailed: "Passkey 身份验证失败。请确保您的设备支持。",
  passkeyVerificationFailed: "Passkey 验证失败",
  passkeyError: "Passkey 登录时发生错误",
  registrationFailed: "注册失败"
});

Object.assign(enDict.auth, {
  signingIn: "Signing in...",
  securityVerificationPassed: "Security Verification Passed",
  creating: "Creating...",
  completeSecurityVerificationFirst: "Please complete the security verification first.",
  passwordLengthError: "Password must be between 8 and 128 characters",
  passwordComplexityError: "Password must contain uppercase, lowercase, number, and special character",
  loginFailed: "Login failed",
  networkError: "Network error",
  passkeyCancelled: "Passkey authentication was cancelled or timed out.",
  passkeyFailed: "Failed to authenticate with passkey. Ensure your device supports it.",
  passkeyVerificationFailed: "Passkey verification failed",
  passkeyError: "An error occurred during passkey login",
  registrationFailed: "Registration failed"
});

// two factor additions
zhDict.twoFactor = {
  title: "双重身份验证",
  waitingPasskeyLogin: "等待 Passkey 登录...",
  useAuthenticatorApp: "使用身份验证器应用代替",
  enterTotpHint: "输入来自您的身份验证器应用的 6 位验证码。",
  enter6DigitCode: "输入 6 位验证码",
  verifying: "验证中...",
  verify: "验证",
  tryPasskeyAgain: "再次尝试 Passkey",
  setupTitle: "设置双重身份验证",
  waitingPasskeySetup: "等待 Passkey 设置...",
  scanQrHint: "使用您的身份验证器应用（如 Google Authenticator，Authy）扫描此二维码。",
  enterSecretManually: "或手动输入此密钥：",
  verifyAndComplete: "验证并完成",
  passkeySetupFailed: "Passkey 设置失败",
  failedGenerateTotp: "生成 TOTP 设置失败",
  invalidTotpCode: "无效的 TOTP 验证码"
};

enDict.twoFactor = {
  title: "Two-Factor Authentication",
  waitingPasskeyLogin: "Waiting for passkey login...",
  useAuthenticatorApp: "Use Authenticator App instead",
  enterTotpHint: "Enter the 6-digit code from your Authenticator App.",
  enter6DigitCode: "Enter 6-digit code",
  verifying: "Verifying...",
  verify: "Verify",
  tryPasskeyAgain: "Try Passkey again",
  setupTitle: "Set up Two-Factor Authentication",
  waitingPasskeySetup: "Waiting for passkey setup...",
  scanQrHint: "Scan this QR code with your Authenticator App (e.g. Google Authenticator, Authy).",
  enterSecretManually: "Or enter this secret manually:",
  verifyAndComplete: "Verify & Complete",
  passkeySetupFailed: "Passkey setup failed",
  failedGenerateTotp: "Failed to generate TOTP setup",
  invalidTotpCode: "Invalid TOTP code"
};

// slider captcha
zhDict.captcha = {
  securityVerification: "安全验证",
  verified: "已验证",
  networkError: "网络错误。请重试。",
  verificationFailed: "验证失败",
  serverError: "服务器错误"
};

enDict.captcha = {
  securityVerification: "SECURITY VERIFICATION",
  verified: "VERIFIED",
  networkError: "Network error. Please try again.",
  verificationFailed: "Verification failed",
  serverError: "Server error"
};

// Post detail & Compose
zhDict.post = {
  hoursAgo: "小时前",
  comments: "评论",
  writeComment: "写下你的评论...",
  postComment: "发表评论",
  reply: "回复",
  backToHome: "返回首页",
  publish: "发布",
  selectCategory: "选择分类...",
  postTitle: "帖子标题",
  writeContent: "在这里写下你的内容... (支持 Markdown)"
};

enDict.post = {
  hoursAgo: "hours ago",
  comments: "Comments",
  writeComment: "Write a comment...",
  postComment: "Post Comment",
  reply: "Reply",
  backToHome: "Back to Home",
  publish: "Publish",
  selectCategory: "Select Category...",
  postTitle: "Post Title",
  writeContent: "Write your content here... (Markdown supported)"
};

// Profile & Settings
zhDict.profile = {
  joined: "加入于",
  posts: "帖子",
  noPostsYet: "暂无帖子。",
  uncategorized: "未分类",
  accountSettings: "账号设置",
  basicProfile: "基本资料",
  securityPasskeys: "安全与 Passkeys",
  activeSessions: "活跃会话",
  appearance: "外观",
  notifications: "通知",
  adminDashboard: "管理员仪表盘"
};

enDict.profile = {
  joined: "Joined",
  posts: "Posts",
  noPostsYet: "No posts yet.",
  uncategorized: "Uncategorized",
  accountSettings: "Account Settings",
  basicProfile: "Basic Profile",
  securityPasskeys: "Security & Passkeys",
  activeSessions: "Active Sessions",
  appearance: "Appearance",
  notifications: "Notifications",
  adminDashboard: "Admin Dashboard"
};

fs.writeFileSync(zhDictPath, JSON.stringify(zhDict, null, 2), 'utf8');
fs.writeFileSync(enDictPath, JSON.stringify(enDict, null, 2), 'utf8');

console.log("Dictionaries updated.");
