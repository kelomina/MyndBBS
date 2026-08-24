/**
 * 中间件：IP 封禁检查
 *
 * 函数作用：
 *   对注册/登录入口做 IP 封禁判定。命中封禁返回 403 ERR_IP_BANNED。
 *   判定结果由 IpBanApplicationService 的 60 秒缓存兜底，热路径开销低。
 */
import type { Request, Response, NextFunction } from 'express';
import { getClientIp } from '../lib/rateLimit';
import { ipBanApplicationService } from '../registry';

export function checkIpBan(purpose: 'LOGIN' | 'REGISTRATION') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ip = getClientIp(req);
      if (ip && (await ipBanApplicationService.isBanned(ip, purpose))) {
        res.status(403).json({ error: 'ERR_IP_BANNED' });
        return;
      }
      next();
    } catch (err) {
      // 封禁检查失败不阻断主流程（fail-open），仅记录
      console.error('[ipBan] check failed:', err);
      next();
    }
  };
}
