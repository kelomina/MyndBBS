/**
 * 中间件：注册开放开关
 *
 * 函数作用：
 *   管理员可在治理设置中关闭开放注册；开启后 POST /register 返回 403。
 */
import type { Request, Response, NextFunction } from 'express';
import { siteSettingsService } from '../registry';

export async function checkRegistrationOpen(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (await siteSettingsService.isRegistrationDisabled()) {
      res.status(403).json({ error: 'ERR_REGISTRATION_DISABLED' });
      return;
    }
    next();
  } catch (err) {
    console.error('[registrationGuard] check failed:', err);
    next(); // fail-open：配置读取失败不阻断注册
  }
}
