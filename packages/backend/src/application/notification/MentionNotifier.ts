/**
 * 适配器/服务：MentionNotifier
 *
 * 函数作用：
 *   从帖子/评论内容解析 @用户名 提及，为存在的目标用户创建 MENTION
 *   站内通知（大小写不敏感匹配、去重、排除作者本人、单条上限 10 人）。
 *   作为 CommunityApplicationService 的可选 mentionNotifier 注入；
 *   失败静默——提及属增强功能，不得阻断发帖/评论主流程。
 */
import { randomUUID as uuidv4 } from 'crypto';
import { prisma } from '../../db';
import { MentionedEvent } from '../../domain/shared/events/DomainEvents';
import { getEventBus } from '../../infrastructure/events/EventBusFactory';

const MAX_MENTIONS_PER_CONTENT = 10;
const MENTION_REGEX = /(?:^|[^\p{L}\p{N}_@])@([\p{L}\p{N}_-]{1,32})/gu;

export class MentionNotifier {
  public async notifyMentions(params: {
    content: string;
    authorId: string;
    postId: string;
    commentId: string | null;
    postAuthorId?: string | null;
  }): Promise<void> {
    try {
      const usernames = this.extractMentions(params.content);
      if (usernames.length === 0) return;

      const users = await prisma.user.findMany({
        where: { username: { in: usernames, mode: 'insensitive' }, status: 'ACTIVE' },
        select: { id: true },
      });

      if (users.length === 0) return;
      const snippet = params.content.replace(/\s+/g, ' ').trim().slice(0, 120);
      const title = params.commentId ? '评论中提到了你' : '帖子中提到了你';

      let notified = 0;
      for (const user of users) {
        if (user.id === params.authorId) continue;
        // 去重冻结（Q5：@==帖主跳 MENTION，同 commentId 下帖主已收 POST_REPLIED，不再重复行）
        if (params.postAuthorId && user.id === params.postAuthorId) continue;
        if (notified >= MAX_MENTIONS_PER_CONTENT) break;

        await prisma.notification.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            type: 'MENTION',
            title,
            content: snippet,
            relatedId: params.postId,
            commentId: params.commentId,
            isRead: false,
          },
        });
        notified += 1;
        // WS 补 MENTION 推送（邮件链路不变，仍不发邮件；离线靠 unread-count 兜底）
        try {
          await getEventBus().publish(
            new MentionedEvent(user.id, params.postId, params.commentId, params.authorId),
          );
        } catch (err) {
          console.error('[MentionNotifier] publish MentionedEvent failed:', err);
        }
      }
    } catch (err) {
      console.error('[MentionNotifier] failed:', err);
    }
  }

  /** 提取内容中的 @用户名（小写规范化、去重、限量） */
  private extractMentions(content: string): string[] {
    const found = new Set<string>();
    for (const match of content.matchAll(MENTION_REGEX)) {
      const name = match[1];
      if (name) found.add(name.toLowerCase());
      if (found.size >= MAX_MENTIONS_PER_CONTENT) break;
    }
    return [...found];
  }
}
