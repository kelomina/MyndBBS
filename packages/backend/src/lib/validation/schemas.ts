/**
 * 模块：Validation Schemas
 *
 * 函数作用：
 *   所有 HTTP API 请求体的 Zod 校验模式定义。
 *   覆盖注册、登录、密码重置、管理配置、帖子、分类、邮件配置等场景。
 * Purpose:
 *   Zod validation schema definitions for all HTTP API request bodies.
 *   Covers registration, login, password reset, admin config, posts, categories, email config, etc.
 *
 * 中文关键词：
 *   校验，Zod，模式，请求体验证，API
 * English keywords:
 *   validation, Zod, schema, request body validation, API
 */
import { z } from 'zod';
import { STRICT_PASSWORD_REGEX } from '@myndbbs/shared';

// ── 认证 ──

/** 注册请求校验：邮箱、用户名、密码（8-128位，含大小写字母+数字+特殊字符）、验证码 ID */
export const registerSchema = z.object({
  email: z.string().email('ERR_INVALID_EMAIL').max(255),
  username: z.string().min(1, 'ERR_USERNAME_REQUIRED').max(64),
  password: z
    .string()
    .min(8, 'ERR_PASSWORD_TOO_SHORT')
    .max(128, 'ERR_PASSWORD_TOO_LONG')
    .regex(STRICT_PASSWORD_REGEX, 'ERR_PASSWORD_WEAK'),
  captchaId: z.string().min(1, 'ERR_CAPTCHA_REQUIRED'),
});

/** 登录请求校验：邮箱/用户名、密码 */
export const loginSchema = z.object({
  email: z.string().min(1, 'ERR_EMAIL_REQUIRED'),
  password: z.string().min(1, 'ERR_PASSWORD_REQUIRED'),
});

/** 忘记密码请求校验：邮箱 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('ERR_INVALID_EMAIL').max(255),
});

/** 重置密码请求校验：令牌、新密码 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'ERR_TOKEN_REQUIRED'),
  password: z
    .string()
    .min(8, 'ERR_PASSWORD_TOO_SHORT')
    .max(128, 'ERR_PASSWORD_TOO_LONG')
    .regex(STRICT_PASSWORD_REGEX, 'ERR_PASSWORD_WEAK'),
});

/** 邮箱验证请求校验：令牌 */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'ERR_TOKEN_REQUIRED'),
});

// ── 管理后台配置 ──

/** 数据库配置校验：主机、端口、用户名、密码、数据库名 */
export const dbConfigSchema = z.object({
  host: z.string().min(1, 'ERR_HOST_REQUIRED'),
  port: z.number().int().min(1).max(65535).or(
    z.string().regex(/^\d+$/).transform(Number).pipe(
      z.number().int().min(1).max(65535)
    )
  ),
  username: z.string().min(1, 'ERR_USERNAME_REQUIRED'),
  password: z.string().min(1, 'ERR_PASSWORD_REQUIRED'),
  database: z.string().min(1, 'ERR_DATABASE_NAME_REQUIRED'),
});

/** 域名配置校验：协议、主机名、RP ID、反向代理模式 */
export const domainConfigSchema = z.object({
  protocol: z.enum(['http', 'https']).optional(),
  hostname: z.string().min(1, 'ERR_HOSTNAME_REQUIRED').optional(),
  rpId: z.string().min(1, 'ERR_RP_ID_REQUIRED').optional(),
  reverseProxyMode: z.boolean().optional(),
});

// ── 管理-用户管理 ──

/** 变更用户角色/等级校验 */
export const changeUserRoleSchema = z.object({
  role: z.string().min(1, 'ERR_ROLE_REQUIRED'),
  level: z.number().int().min(0).optional(),
});

/** 变更用户状态校验 */
export const changeUserStatusSchema = z.object({
  status: z.string().min(1, 'ERR_STATUS_REQUIRED'),
});

// ── 帖子 ──

/** 创建帖子请求校验 */
export const createPostSchema = z.object({
  title: z.string().min(1, 'ERR_TITLE_REQUIRED').max(200),
  content: z.string().min(1, 'ERR_CONTENT_REQUIRED'),
  categoryId: z.string().min(1, 'ERR_CATEGORY_REQUIRED'),
  captchaId: z.string().optional(),
  captchaCode: z.string().optional(),
});

/** 更新帖子状态校验 */
export const updatePostStatusSchema = z.object({
  status: z.string().min(1, 'ERR_STATUS_REQUIRED'),
});

// ── 分类 ──

/** 创建分类请求校验 */
export const createCategorySchema = z.object({
  name: z.string().min(1, 'ERR_NAME_REQUIRED').max(100),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  minLevel: z.number().int().min(0).optional(),
});

/** 更新分类请求校验 */
export const updateCategorySchema = z.object({
  name: z.string().min(1, 'ERR_NAME_REQUIRED').max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  minLevel: z.number().int().min(0).optional(),
});

// ── 邮件配置 ──

/** SMTP 配置校验：主机、端口、TLS、用户名、密码、发件人 */
export const emailConfigSchema = z.object({
  host: z.string().min(1, 'ERR_HOST_REQUIRED'),
  port: z.number().int().min(1).max(65535).or(
    z.string().regex(/^\d+$/).transform(Number).pipe(
      z.number().int().min(1).max(65535)
    )
  ),
  secure: z.boolean().optional(),
  user: z.string().optional(),
  pass: z.string().optional(),
  from: z.string().min(1, 'ERR_FROM_REQUIRED'),
});

/** 邮件模板更新校验：类型、主题、文本正文、HTML 正文 */
export const emailTemplateSchema = z.object({
  type: z.string().min(1, 'ERR_TYPE_REQUIRED'),
  subject: z.string().min(1, 'ERR_SUBJECT_REQUIRED'),
  textBody: z.string().min(1, 'ERR_TEXT_BODY_REQUIRED'),
  htmlBody: z.string().min(1, 'ERR_HTML_BODY_REQUIRED'),
});

/** 测试邮件发送校验：目标邮箱、可选 SMTP 配置 */
export const testEmailSchema = z.object({
  targetEmail: z.string().email('ERR_INVALID_EMAIL'),
  smtpConfig: emailConfigSchema.optional(),
});
