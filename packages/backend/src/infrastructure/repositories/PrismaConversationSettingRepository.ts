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

  public async findByUsers(userId: string, partnerId: string): Promise<ConversationSetting | null> {
    const raw = await prisma.conversationSetting.findUnique({
      where: { userId_partnerId: { userId, partnerId } },
    });
    if (!raw) return null;
    return this.toDomain(raw);
  }

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
