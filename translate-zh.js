const fs = require('fs');
const path = require('path');

const zhDictPath = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');
const zhDict = JSON.parse(fs.readFileSync(zhDictPath, 'utf8'));

if (zhDict.apiErrors) {
  for (const key in zhDict.apiErrors) {
    const enText = zhDict.apiErrors[key];
    let zhText = enText;
    
    // Quick translations
    zhText = zhText.replace(/User not found/gi, '用户未找到');
    zhText = zhText.replace(/Missing parameters/gi, '缺少参数');
    zhText = zhText.replace(/Invalid role/gi, '无效角色');
    zhText = zhText.replace(/Server error/gi, '服务器错误');
    zhText = zhText.replace(/Internal server error/gi, '内部服务器错误');
    zhText = zhText.replace(/Unauthorized/gi, '未授权');
    zhText = zhText.replace(/Post not found/gi, '帖子未找到');
    zhText = zhText.replace(/Forbidden/gi, '禁止访问');
    zhText = zhText.replace(/token expired/gi, '令牌已过期');
    zhText = zhText.replace(/Invalid TOTP code/gi, '无效的 TOTP 验证码');
    zhText = zhText.replace(/Challenge ID is required/gi, '需要挑战ID');
    zhText = zhText.replace(/Challenge expired/gi, '挑战已过期');
    zhText = zhText.replace(/Challenge not found/gi, '挑战未找到');
    zhText = zhText.replace(/Verification failed/gi, '验证失败');
    zhText = zhText.replace(/Passkey not found/gi, 'Passkey 未找到');
    zhText = zhText.replace(/Passkey does not belong to user/gi, 'Passkey 不属于该用户');
    zhText = zhText.replace(/Failed to generate captcha/gi, '生成验证码失败');
    zhText = zhText.replace(/Email or username already in use/gi, '邮箱或用户名已被使用');
    zhText = zhText.replace(/Missing required fields/gi, '缺少必填字段');
    zhText = zhText.replace(/Password must be between/gi, '密码长度必须介于');
    zhText = zhText.replace(/Password must contain/gi, '密码必须包含');
    zhText = zhText.replace(/Invalid credentials/gi, '无效凭证');
    zhText = zhText.replace(/Account is banned/gi, '账号被封禁');
    zhText = zhText.replace(/Refresh token required/gi, '需要刷新令牌');
    zhText = zhText.replace(/Session revoked or invalid/gi, '会话已撤销或无效');
    zhText = zhText.replace(/Invalid refresh token/gi, '无效的刷新令牌');
    zhText = zhText.replace(/Too many requests/gi, '请求过多');
    zhText = zhText.replace(/please try again later/gi, '请稍后再试');
    zhText = zhText.replace(/Email already in use/gi, '邮箱已被使用');
    zhText = zhText.replace(/Username already in use/gi, '用户名已被使用');
    
    zhDict.apiErrors[key] = zhText;
  }
}

fs.writeFileSync(zhDictPath, JSON.stringify(zhDict, null, 2), 'utf8');
console.log('Translated zh api errors');
