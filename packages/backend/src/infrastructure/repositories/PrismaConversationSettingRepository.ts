/**
 * 类名称：PrismaConversationSettingRepository
 *
 * 函数作用：
 *   Prisma 实现的会话设置仓储。
 * Purpose:
 *   Prisma-based conversation setting repository.
 *
 * 中文关键词：
 *   Prisma，会话设置，仓储
 * English keywords:
 *   Prisma, conversation setting, repository
 */
import { IConversationSettingRepository } from '../../domain/messaging/IConversationSettingRepository';
import { ConversationSetting, ConversationSettingProps } from '../../domain/messaging/ConversationSetting';
import { prisma } from '../../db';

export class PrismaConversationSettingRepository implements IConversationSettingRepository {
  private toDomain(raw: any): ConversationSetting {
    const props: ConversationSettingProps = {
      userId: raw.userId,
      partnerId: raw.partnerId,
      allowTwoSidedDelete: raw.allowTwoSidedDelete,
    };
    return ConversationSetting.load(props);
  }

  /** 按用户和伙伴查找会话设置 / Finds conversation settings by user and partner */
  public async findByUsers(userId: string, partnerId: string): Promise<ConversationSetting | null> {
    const raw = await prisma.conversationSetting.findUnique({
      where: { userId_partnerId: { userId, partnerId } },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

  /** 保存会话设置（创建/更新）/ Saves conversation settings (upsert) */
  public async save(setting: ConversationSetting): Promise<void> {
    await prisma.conversationSetting.upsert({
      where: { userId_partnerId: { userId: setting.userId, partnerId: setting.partnerId } },
      create: {
        userId: setting.userId,
        partnerId: setting.partnerId,
        allowTwoSidedDelete: setting.allowTwoSidedDelete,
      },
      update: {
        allowTwoSidedDelete: setting.allowTwoSidedDelete,
      },
    });
  }
}
