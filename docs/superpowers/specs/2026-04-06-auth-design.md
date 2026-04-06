# MyndBBS Authentication & User Registration Design

## 1. 概述 (Overview)
本文档定义了 MyndBBS 论坛系统**用户注册与登录 (Authentication)** 的核心设计规范。基于企业级安全要求与现代 Web 发展趋势，本次设计采用 **"邮箱 + 强密码"** 的基础注册方式，并可选绑定 **Passkey (WebAuthn)** 或 **2FA (Two-Factor Authentication)** 进行双重验证。

**强制无密码策略 (Mandatory Passkey)**：系统将在前端检测用户浏览器的能力（通过 WebAuthn API `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`）。**如果检测到当前设备支持 Passkey，将强制用户在注册时必须完成 Passkey 绑定**，并且在后续具备 Passkey 环境的设备中优先使用 Passkey 进行身份验证。

**跨设备兼容 (Cross-Device Fallback)**：即使启用了 Passkey，用户**仍然必须在注册时设置强密码并绑定 2FA**。这是为了确保当用户在不支持 Passkey（或无法访问原 Passkey 设备）的环境下，依然可以通过“强密码 + 2FA”完成登录。对于纯粹只依赖 Passkey 不想使用密码的用户（少数情况），可以允许 `passwordHash` 为空。

为了防止恶意注册和滥用，系统将**严格限制同一 IP 允许注册的账号数量**，并引入插件化的**人机验证 (Captcha) 机制**防御脚本批量注册。

在会话管理层面，采用 **JWT (JSON Web Token) 配合 HttpOnly Secure Cookie** 的无状态设计，从根源上防御跨站脚本攻击 (XSS)。

## 2. 核心流程设计 (Core Workflows)

### 2.1 注册流程 (Registration)
1. **人机验证 (Captcha)**:
   - 前端在提交注册请求前，必须完成人机验证插件（如 Turnstile, reCAPTCHA, 或自定义图形验证码）的交互，并获取验证票据 (`captchaToken`)。
   - 后端通过可插拔的验证策略，校验 `captchaToken` 的合法性。如果校验失败，直接拒绝请求。
2. **IP 限制检查**:
   - 后端提取客户端真实 IP (处理 `X-Forwarded-For` 等代理头)。
   - 后端校验该 IP 关联的注册账号数量。如果同一 IP 的注册数量超过设定阈值（如：单 IP 最多 3 个账号），直接拒绝注册。
3. **输入阶段**: 用户提供邮箱 (`email`)、展示用户名 (`username`) 和密码 (`password`)。
4. **强密码校验**: 密码必须在服务端和前端进行强校验：
   - 至少 8 个字符。
   - 必须包含大写字母、小写字母、数字以及特殊符号（如 `@$!%*?&`）。
5. **邮箱验证**:
   - 后端生成 OTP (一次性验证码) 并在 Redis 缓存状态，随后通过邮件发送。
   - 用户输入 OTP 完成验证。
6. **强制 Passkey 绑定与降级决策**:
   - 验证通过后，前端执行浏览器环境能力检测 (`window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`)。
   - **无论是否支持 Passkey，均要求用户设置强密码并引导绑定 TOTP (2FA)**，以便于在其他无 Passkey 的设备上登录。
   - **支持 Passkey**：在设置密码后，系统同时向后端申请 Challenge，调用 WebAuthn API 弹出生物识别弹窗，将生成的 `PublicKey` 绑定至用户账户。此时该设备在未来的登录中将**强制要求使用 Passkey**（记录于后台策略中）。
7. **完成注册**:
   - 后端对密码进行 **SHA-512 + 8位随机 Salt** 的强加密处理，并将 `hash` 与 `salt` 一并保存。
   - 将该用户的 ID 绑定至当前 IP 记录。
   - 签发 JWT 并写入 HttpOnly Cookie，完成登录状态。

*(注：系统在后台记录用户是否开启了 Passkey 强制模式。开启强制模式的用户无法仅通过密码登录。)*

### 2.2 登录流程 (Login)
1. **防刷检查**: 在登录接口处同样校验人机验证票据与请求频率。
2. **标识输入**: 用户输入邮箱。
3. **凭证认证路由分发**:
   - 后端查询用户记录：若用户启用了 Passkey 强制模式（`isPasskeyMandatory`），并且**当前请求设备的指纹符合用户已注册 Passkey 的设备**，则优先下发 Challenge 触发 WebAuthn 流程。
   - 若用户在新设备上（无对应 Passkey 记录），或者用户的 `isPasskeyMandatory` 为 false，则展示密码输入框。
4. **2FA 校验**: 对于使用密码登录的用户，验证密码后必须通过 TOTP 动态密码双重验证。
5. **签发令牌**: 验证通过后，下发短效 Access Token (前端内存) 与长效 Refresh Token (HttpOnly Cookie)。

## 3. 会话与 Token 管理 (Session Management)

- **Access Token (短效)**: 
  - 生命周期：15 分钟。
  - 存储位置：前端内存 (内存变量，非 localStorage)。
  - 作用：附带在每个 API 请求的 `Authorization: Bearer <token>` 中。
- **Refresh Token (长效)**: 
  - 生命周期：7 天或 30 天。
  - 存储位置：**HttpOnly, Secure, SameSite=Strict** 的 Cookie (`refreshToken`)。
  - 作用：当 Access Token 过期时，前端通过特定的 `/api/auth/refresh` 接口自动使用 Cookie 换取新的 Access Token。

*这种双 Token 机制既防止了 XSS 直接窃取长效凭证，又能在不影响用户体验的情况下实现会话的无感刷新。*

## 4. 数据库设计 (Prisma Schema 概览)

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  username      String    @unique
  passwordHash  String?   // SHA-512 Hash
  passwordSalt  String?   // 8-byte salt
  role          Role      @default(USER) // 从共享常量引入
  status        Status    @default(ACTIVE)
  registeredIp  String?   // 记录注册时的 IP 地址
  isPasskeyMandatory Boolean @default(false) // 标识是否被强制要求仅使用 Passkey 登录
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  passkeys      Passkey[] // 绑定的 WebAuthn 凭证
  twoFactor     TwoFactor? // 绑定的 TOTP 信息
}

model Passkey {
  id             String  @id // CredentialID
  publicKey      Bytes
  userId         String
  user           User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  webAuthnUserID String
  counter        BigInt
  deviceType     String
  backedUp       Boolean
  createdAt      DateTime @default(now())
}
```

## 5. API 接口定义 (API Contract)

所有接口统一在 `/api/v1/auth` 路由下：

- `POST /register/send-code`: 发送邮箱验证码
- `POST /register/verify-code`: 验证邮箱并准备 WebAuthn 注册挑战
- `POST /register/passkey`: 验证 WebAuthn 注册响应，创建用户
- `POST /login/challenge`: 获取 WebAuthn 登录挑战
- `POST /login/passkey`: 验证 WebAuthn 登录响应并设置 Cookie
- `POST /refresh`: 刷新 Access Token (携带 HttpOnly Cookie 自动生效)
- `POST /logout`: 清除 HttpOnly Cookie 并在 Redis 中将该 Refresh Token 加入黑名单

## 6. 安全隔离与防御 (Security Isolations)
1. **CSRF 防御**: `SameSite=Strict` Cookie 属性从浏览器层面防御跨站请求伪造。同时，因 Access Token 在前端内存中并由请求头发送，双重保障。
2. **XSS 防御**: 任何持久化凭证 (`Refresh Token`) 绝对不暴露给 JS，采用 `HttpOnly`。
3. **暴力破解与注册滥用防御**: 
   - 对于所有 `/auth` 相关的接口启用严格的 **Rate Limiting**。
   - **人机验证拦截**: 在控制层引入可插拔的 `verifyCaptcha` 中间件或服务函数拦截脚本请求。
   - **强密码策略**: 前后端共用同一套正则校验 `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$`。加密算法限定为 `SHA-512` 加 `8-byte` 盐值。
   - **IP 限制**: 后端校验请求 IP，每个 IP 最多允许注册 N 个账号（如 3 个），超出直接抛出 403 异常。