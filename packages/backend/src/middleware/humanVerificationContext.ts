import { AsyncLocalStorage } from 'node:async_hooks'
import { createHmac, randomBytes } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { getTempTokenSecret } from '../lib/securityConfig'
import { VERIFICATION_HANDLE } from '../application/system/HumanVerificationService'

const context = new AsyncLocalStorage<() => string | undefined>()
export function verificationClientIp(req: Request): string {
  return (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/i, '').toLowerCase()
}
function cookieName(): string {
  return process.env.NODE_ENV === 'production' ? '__Host-mynd-hv' : 'mynd-hv'
}
function binding(req: Request): string | undefined {
  const value: unknown = req.cookies?.[cookieName()]
  if (typeof value !== 'string' || !VERIFICATION_HANDLE.test(value)) return undefined
  return createHmac('sha256', getTempTokenSecret())
    .update('human-verification:v1\0' + verificationClientIp(req) + '\0' + value)
    .digest('hex')
}
/** Core-only HttpOnly client binding. Plugin RPC never receives it or request headers. */
export function ensureVerificationBinding(req: Request, res: Response): void {
  const name = cookieName()
  const value: unknown = req.cookies?.[name]
  if (typeof value === 'string' && VERIFICATION_HANDLE.test(value)) return
  const fresh = randomBytes(32).toString('base64url')
  res.cookie(name, fresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 1000,
  })
  req.cookies = { ...req.cookies, [name]: fresh }
}
export function humanVerificationContext(req: Request, _res: Response, next: NextFunction): void {
  context.run(() => binding(req), next)
}
export function currentVerificationBinding(): string | undefined {
  return context.getStore()?.()
}
