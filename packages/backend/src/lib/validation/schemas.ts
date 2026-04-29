import { z } from 'zod';
import { STRICT_PASSWORD_REGEX } from '@myndbbs/shared';

// ── Auth ──

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

export const loginSchema = z.object({
  email: z.string().min(1, 'ERR_EMAIL_REQUIRED'),
  password: z.string().min(1, 'ERR_PASSWORD_REQUIRED'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('ERR_INVALID_EMAIL').max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'ERR_TOKEN_REQUIRED'),
  password: z
    .string()
    .min(8, 'ERR_PASSWORD_TOO_SHORT')
    .max(128, 'ERR_PASSWORD_TOO_LONG')
    .regex(STRICT_PASSWORD_REGEX, 'ERR_PASSWORD_WEAK'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'ERR_TOKEN_REQUIRED'),
});

// ── Admin Configuration ──

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

export const domainConfigSchema = z.object({
  protocol: z.enum(['http', 'https']).optional(),
  hostname: z.string().min(1, 'ERR_HOSTNAME_REQUIRED').optional(),
  rpId: z.string().min(1, 'ERR_RP_ID_REQUIRED').optional(),
  reverseProxyMode: z.boolean().optional(),
});

// ── Admin User Management ──

export const changeUserRoleSchema = z.object({
  role: z.string().min(1, 'ERR_ROLE_REQUIRED'),
  level: z.number().int().min(0).optional(),
});

export const changeUserStatusSchema = z.object({
  status: z.string().min(1, 'ERR_STATUS_REQUIRED'),
});

// ── Post ──

export const createPostSchema = z.object({
  title: z.string().min(1, 'ERR_TITLE_REQUIRED').max(200),
  content: z.string().min(1, 'ERR_CONTENT_REQUIRED'),
  categoryId: z.string().min(1, 'ERR_CATEGORY_REQUIRED'),
  captchaId: z.string().optional(),
  captchaCode: z.string().optional(),
});

export const updatePostStatusSchema = z.object({
  status: z.string().min(1, 'ERR_STATUS_REQUIRED'),
});

// ── Category ──

export const createCategorySchema = z.object({
  name: z.string().min(1, 'ERR_NAME_REQUIRED').max(100),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  minLevel: z.number().int().min(0).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, 'ERR_NAME_REQUIRED').max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  minLevel: z.number().int().min(0).optional(),
});
