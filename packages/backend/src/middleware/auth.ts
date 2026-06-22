/**
 * 认证中间件模块。
 *
 * BFF 架构下浏览器只保存一个 httpOnly 的 sessionId Cookie。后端每次
 * 根据这个 sessionId 查询服务器端会话和用户状态，不再让浏览器携带 JWT。
 */
import { Request, Response, NextFunction } from 'express'
import { defineAbilityForContext, AppAbility, Action, AppSubjects } from '../lib/casl'
import { accessControlQueryService } from '../queries/identity/AccessControlQueryService'
import { authApplicationService, authCache, sudoApplicationService } from '../registry'
import { AUTH_SESSION_COOKIE_NAME, clearAuthCookies } from '../lib/authCookies'

const TRUSTED_EXTERNAL_AUTH_MIN_LEVEL = 2

export interface AuthRequest extends Request {
  user?: {
    userId: string
    role: string
    sessionId: string
    trustedExternalAuth: boolean
    effectiveLevel: number
  }
  ability?: AppAbility
}

interface VerifiedSession {
  userId: string
  role: string
  sessionId: string
  trustedExternalAuth: boolean
}

function applyTrustedExternalAuthLevel(level: number, trustedExternalAuth: boolean): number {
  if (trustedExternalAuth && level < TRUSTED_EXTERNAL_AUTH_MIN_LEVEL) {
    return TRUSTED_EXTERNAL_AUTH_MIN_LEVEL
  }
  return level
}

function getSessionId(req: AuthRequest): string | undefined {
  const cookieSessionId = req.cookies?.[AUTH_SESSION_COOKIE_NAME]
  if (typeof cookieSessionId === 'string' && cookieSessionId.length > 0) {
    return cookieSessionId
  }

  return undefined
}

function sessionErrorForReason(reason?: string): Error {
  if (reason === 'USER_BANNED') {
    return new Error('ERR_USER_BANNED')
  }
  if (reason === 'USER_NOT_ACTIVE') {
    return new Error('ERR_ACCOUNT_NOT_ACTIVE')
  }
  return new Error('ERR_SESSION_REVOKED_OR_INVALID')
}

function getAuthErrorCode(error: unknown): string | null {
  if (error instanceof Error && error.message.startsWith('ERR_')) {
    return error.message
  }
  return null
}

export const verifySessionCookie = async (sessionId: string): Promise<VerifiedSession> => {
  const cachedSession = await authCache.getSessionValidity(sessionId)
  if (cachedSession === 'invalid') {
    throw new Error('ERR_SESSION_REVOKED_OR_INVALID')
  }

  const { isValid, user, roleName, reason } = await authApplicationService.validateSession(sessionId)
  if (!isValid || !user) {
    await authCache.setSessionValidity(sessionId, 'invalid', 300)
    throw sessionErrorForReason(reason)
  }

  await authCache.setSessionValidity(sessionId, 'valid', 3600)
  const trustedExternalAuth = await authCache.hasTrustedExternalAuth(sessionId)
  return {
    userId: user.id,
    role: roleName || 'USER',
    sessionId,
    trustedExternalAuth,
  }
}

async function attachAuthenticatedContext(req: AuthRequest, verified: VerifiedSession): Promise<void> {
  req.user = {
    ...verified,
    effectiveLevel: applyTrustedExternalAuthLevel(1, verified.trustedExternalAuth),
  }

  const rulesDTO = await accessControlQueryService.getAbilityRulesForUser(verified.userId)
  if (rulesDTO) {
    const context = {
      ...rulesDTO.context,
      level: applyTrustedExternalAuthLevel(rulesDTO.context.level, verified.trustedExternalAuth),
    }
    req.user.effectiveLevel = context.level
    req.ability = defineAbilityForContext(context, rulesDTO.rules)
  } else {
    req.ability = defineAbilityForContext()
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const sessionId = getSessionId(req)

  if (!sessionId) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED_MISSING_SESSION' })
    return
  }

  try {
    const verified = await verifySessionCookie(sessionId)
    await attachAuthenticatedContext(req, verified)
    next()
  } catch (error) {
    clearAuthCookies(res)
    res.status(401).json({ error: getAuthErrorCode(error) || 'ERR_SESSION_REVOKED_OR_INVALID' })
  }
}

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const sessionId = getSessionId(req)

  if (!sessionId) {
    req.ability = defineAbilityForContext()
    return next()
  }

  try {
    const verified = await verifySessionCookie(sessionId)
    await attachAuthenticatedContext(req, verified)
  } catch {
    delete req.user
    req.ability = defineAbilityForContext()
  }
  next()
}

export const requireSudo = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user || !req.user.sessionId) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' })
    return
  }
  const isSudo = await sudoApplicationService.check(req.user.sessionId)
  if (isSudo) {
    next()
  } else {
    res.status(403).json({ error: 'ERR_SUDO_REQUIRED', message: 'Re-authentication required for this action' })
  }
}

export function requireAbility(action: Action, subject: AppSubjects) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.ability) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED_MISSING_ABILITY' })
      return
    }

    if (!req.ability.can(action, subject)) {
      res.status(403).json({ error: 'ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS' })
      return
    }

    next()
  }
}
