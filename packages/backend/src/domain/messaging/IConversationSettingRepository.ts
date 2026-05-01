import { ConversationSetting } from './ConversationSetting';

/**
 * 接口名称：IConversationSettingRepository
 *
 * 函数作用：
 *   会话设置聚合的仓储接口。
 * Purpose:
 *   Repository interface for ConversationSetting aggregates.
 *
 * 中文关键词：
 *   会话设置，仓储接口
 * English keywords:
 *   conversation setting, repository interface
 */
export interface IConversationSettingRepository {
  findByUsers(userId: string, partnerId: string): Promise<ConversationSetting | null>;
  save(setting: ConversationSetting): Promise<void>;
}
