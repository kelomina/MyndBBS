/**
 * JWT 令牌载荷（仅在已验证签名后使用）。
 * JWT token payload (only use after signature verification).
 * 注意：此类型当前未在任何前后端代码中被直接使用，后端使用 jsonwebtoken 自动推断的类型。
 * Note: This type is currently not directly used by any frontend/backend code. The backend uses jsonwebtoken's inferred types.
 */
export interface JwtPayload {
  userId: string;
  role: string;
}

/**
 * @deprecated 未在实际代码中使用，请参考实际 API 响应结构。
 * Not used in actual code. Refer to real API response structure instead.
 */
export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
  }
}

/**
 * @deprecated 未在实际代码中使用，字段名 passwordHash 易误导（客户端应发送明文密码，后端使用 Argon2 哈希）。
 * Not used in actual code. Field name `passwordHash` is misleading — clients should send plaintext password, backend hashes with Argon2.
 */
export interface RegisterRequest {
  email: string;
  username: string;
  passwordHash?: string; // Optional only for pure passwordless accounts (future-proofing)
  captchaToken: string;
  supportsWebAuthn: boolean;
}
