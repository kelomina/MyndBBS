/**
 * 控制器模块：SiteSettings（站点展示设置）
 *
 * 函数作用：
 *   - GET /api/public/site-settings：公开读（品牌名/公告/注册开关状态）
 *   - GET|PUT /api/admin/site-settings：管理读写
 *   - POST /register 强制注册开关由 auth 路由的 checkRegistrationOpen 使用
 */
import { Request, Response } from 'express';
import { siteSettingsService } from '../registry';

function sendBusinessError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('ERR_')) {
    res.status(400).json({ error: message });
    return;
  }
  console.error('[siteSettings] error:', message);
  res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
}


export const getPublicSiteSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await siteSettingsService.getSettings();
    res.json({
      siteName: settings.siteName || null,
      announcement: settings.announcement || null,
      registrationDisabled: settings.registrationDisabled,
    });
  } catch (error) {
    console.error('[siteSettings] public read failed:', error);
    // 公开端点失败时返回空设置，前端回落默认值
    res.json({ siteName: null, announcement: null, registrationDisabled: false });
  }
};

export const getSiteSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await siteSettingsService.getSettings());
  } catch (error) {
    sendBusinessError(res, error);
  }
};

export const updateSiteSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await siteSettingsService.updateSettings(req.body ?? {});
    res.json({ message: 'Site settings updated', settings });
  } catch (error) {
    sendBusinessError(res, error);
  }
};
