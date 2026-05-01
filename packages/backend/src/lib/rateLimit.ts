/**
 * 模块：Rate Limit
 *
 * 函数作用：
 *   请求频率限制工具——提供客户端 IP 提取函数和各场景的频率限制器。
 * Purpose:
 *   Rate limiting utilities — provides client IP extraction and rate limiters for various scenarios.
 *
 * 中文关键词：
 *   频率限制，IP 提取，发帖限制，上传限制，好友请求限制
 * English keywords:
 *   rate limit, IP extraction, post limit, upload limit, friend request limit
 */
import { Request } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

/**
 * 函数名称：getClientIp
 *
 * 函数作用：
 *   从请求中提取客户端真实 IP，不依赖 Express trust proxy 设置。
 * Purpose:
 *   Extracts the real client IP from the request without relying on Express trust proxy settings.
 *
 * 调用方 / Called by:
 *   本文件中的 postLimiter / uploadLimiter / friendRequestLimiter
 *   以及 routes/auth.ts 中的各限流器
 *
 * 被调用方 / Calls:
 *   - ipKeyGenerator
 *
 * 参数说明 / Parameters:
 *   - req: Request, Express 请求对象
 *
 * 返回值说明 / Returns:
 *   string 客户端 IP 字符串
 *
 * 副作用 / Side effects:
 *   无
 *
 * 中文关键词：
 *   IP，提取，频率限制，代理
 * English keywords:
 *   IP, extract, rate limit, proxy
 */
export const getClientIp = (req: Request): string => {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown');
};

/**
 * 函数名称：postLimiter
 *
 * 函数作用：
 *   发帖和评论的频率限制器——每 5 分钟最多 10 次。
 * Purpose:
 *   Rate limiter for post creation and commenting — max 10 actions per 5 minutes.
 *
 * 调用方 / Called by:
 *   routes/post.ts
 *
 * 中文关键词：
 *   发帖限制，评论限制，频率
 * English keywords:
 *   post limit, comment limit, rate
 */
export const postLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many posts or comments from this IP, please try again later.' }
});

/**
 * 函数名称：uploadLimiter
 *
 * 函数作用：
 *   文件上传的频率限制器——每 10 分钟最多 5 次上传。
 * Purpose:
 *   Rate limiter for file uploads — max 5 uploads per 10 minutes.
 *
 * 调用方 / Called by:
 *   routes/upload.ts
 *
 * 中文关键词：
 *   上传限制，文件，频率
 * English keywords:
 *   upload limit, file, rate
 */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many uploads from this IP, please try again later.' }
});

/**
 * 函数名称：friendRequestLimiter
 *
 * 函数作用：
 *   好友请求的频率限制器——每小时最多 20 次请求。
 * Purpose:
 *   Rate limiter for friend requests — max 20 requests per hour.
 *
 * 调用方 / Called by:
 *   routes/friend.ts
 *
 * 中文关键词：
 *   好友请求限制，频率
 * English keywords:
 *   friend request limit, rate
 */
export const friendRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many friend requests from this IP, please try again later.' }
});
