/**
 * 类型：站点展示设置（SitePolicy key = 'site_settings'）
 */
export interface SiteSettings {
  /** 品牌名（Header 展示）；空串回落默认 MyndBBS */
  siteName: string;
  /** 首页公告；空串隐藏横幅 */
  announcement: string;
  /** 关闭开放注册 */
  registrationDisabled: boolean;
}

export const SITE_SETTINGS_KEY = 'site_settings';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: '',
  announcement: '',
  registrationDisabled: false,
};

const MAX_ANNOUNCEMENT_LENGTH = 500;

/** 从任意 JSON 解析并钳制字段，非法值回落默认 */
export function parseSiteSettings(json: unknown): SiteSettings {
  if (json === null || typeof json !== 'object') return { ...DEFAULT_SITE_SETTINGS };
  const raw = json as Record<string, unknown>;

  const siteName =
    typeof raw.siteName === 'string' ? raw.siteName.trim().slice(0, 64) : '';
  let announcement =
    typeof raw.announcement === 'string' ? raw.announcement.trim() : '';
  if (announcement.length > MAX_ANNOUNCEMENT_LENGTH) {
    announcement = announcement.slice(0, MAX_ANNOUNCEMENT_LENGTH);
  }

  return {
    siteName,
    announcement,
    registrationDisabled: raw.registrationDisabled === true,
  };
}
