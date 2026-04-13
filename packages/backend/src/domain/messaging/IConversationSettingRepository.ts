import { ConversationSetting } from './ConversationSetting';

/**
 * Callers: [MessagingApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of ConversationSetting Aggregates.
 * Keywords: conversationsetting, repository, interface, contract, domain, messaging
 */
export interface IConversationSettingRepository {
  findByUsers(userId: string, partnerId: string): Promise<ConversationSetting | null>;
  save(setting: ConversationSetting): Promise<void>;
}
