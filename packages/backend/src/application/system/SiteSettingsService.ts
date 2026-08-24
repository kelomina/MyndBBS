/**
 * 应用服务：SiteSettingsService
 *
 * 函数作用：
 *   站点展示设置（SitePolicy key = 'site_settings'）的读写与注册开关判定。
 *   60 秒内存缓存；字段：siteName / announcement / registrationDisabled。
 */
import {
  parseSiteSettings,
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_KEY,
} from '../../domain/system/SiteSettings';
import { ISitePolicyRepository } from '../../domain/system/ISitePolicyRepository';

const CACHE_TTL_MS = 60_000;

export class SiteSettingsService {
  private cache: { settings: ReturnType<typeof parseSiteSettings>; loadedAt: number } | null = null;

  constructor(private readonly sitePolicyRepository: ISitePolicyRepository) {}

  public async getSettings() {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache.settings;
    }
    const raw = await this.sitePolicyRepository.get(SITE_SETTINGS_KEY);
    const settings = raw === null ? { ...DEFAULT_SITE_SETTINGS } : parseSiteSettings(raw);
    this.cache = { settings, loadedAt: Date.now() };
    return settings;
  }

  public async updateSettings(patch: Partial<ReturnType<typeof parseSiteSettings>>) {
    const current = await this.getSettings();
    const merged = parseSiteSettings({ ...current, ...patch });
    await this.sitePolicyRepository.set(SITE_SETTINGS_KEY, merged);
    this.cache = { settings: merged, loadedAt: Date.now() };
    return merged;
  }

  /** 注册入口守卫用：管理员是否关闭了开放注册 */
  public async isRegistrationDisabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings.registrationDisabled;
  }
}
