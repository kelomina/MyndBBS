import { Request } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

/**
 * Callers: [postLimiter, uploadLimiter, friendRequestLimiter]
 * Callees: [ipKeyGenerator, map, split, trim]
 * Description: Extracts the best possible IP address from the request for rate limiting, bypassing trust proxy reliance.
 * Keywords: rate, limit, ip, extract, proxy
 */
export const getClientIp = (req: Request): string => {
  return req.ip || req.socket.remoteAddress || 'unknown';
};

/**
 * Callers: [postRoutes, commentRoutes]
 * Callees: [rateLimit, getClientIp]
 * Description: Rate limiter for post creation and commenting, allowing 10 actions per 5 minutes.
 * Keywords: limit, post, comment, rate
 */
export const postLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many posts or comments from this IP, please try again later.' }
});

/**
 * Callers: [uploadRoutes]
 * Callees: [rateLimit, getClientIp]
 * Description: Rate limiter for file uploads, allowing 5 uploads per 10 minutes.
 * Keywords: limit, upload, file, rate
 */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many uploads from this IP, please try again later.' }
});

/**
 * Callers: [friendRoutes]
 * Callees: [rateLimit, getClientIp]
 * Description: Rate limiter for friend requests, allowing 20 requests per hour.
 * Keywords: limit, friend, request, rate
 */
export const friendRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many friend requests from this IP, please try again later.' }
});
