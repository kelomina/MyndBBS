import { prisma } from '../../db';
import { accessibleBy } from '@casl/prisma';
import type { AppAbility } from '../../lib/casl';

/**
 * Callers: [userController, registerController, authController, sudoController]
 * Callees: [prisma.user, prisma.bookmark, prisma.commentBookmark, prisma.passkey, prisma.session]
 * Description: Query service for identity domain components (users, sessions, passkeys, bookmarks).
 * Keywords: query, service, identity, users, sessions, passkeys, bookmarks
 */
export class IdentityQueryService {
  /**
   * Callers: [userController.getProfile]
   * Callees: [prisma.user.findUnique]
   * Description: Fetches the detailed profile of the current user.
   * Keywords: user, profile, findUnique
   */
  public async getProfile(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        level: true,
        role: { select: { name: true } },
        isTotpEnabled: true,
        _count: { select: { passkeys: true } },
      },
    });
  }

  /**
   * Callers: [userController.getBookmarkedPosts]
   * Callees: [prisma.bookmark.findMany, prisma.commentBookmark.findMany]
   * Description: Fetches all bookmarks (both posts and comments) for a given user, sorted by date.
   * Keywords: bookmarks, user, findMany
   */
  public async listBookmarks(userId: string) {
    const postBookmarks = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { post: { include: { author: { select: { id: true, username: true } }, category: { select: { id: true, name: true, description: true } } } } },
    });

    const commentBookmarks = await prisma.commentBookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { comment: { include: { author: { select: { id: true, username: true } }, post: { select: { id: true, title: true, status: true } } } } },
    });

    return [
      ...postBookmarks.map((b) => ({ ...b.post, type: 'post' as const, bookmarkedAt: b.createdAt })),
      ...commentBookmarks.map((b) => ({ ...b.comment, type: 'comment' as const, bookmarkedAt: b.createdAt })),
    ].sort((a, b) => b.bookmarkedAt.getTime() - a.bookmarkedAt.getTime());
  }

  /**
   * Callers: [userController.getPasskeys]
   * Callees: [prisma.passkey.findMany]
   * Description: Lists all passkeys associated with a user.
   * Keywords: passkeys, user, list, findMany
   */
  public async listPasskeys(userId: string) {
    return prisma.passkey.findMany({
      where: { userId },
      select: { id: true, deviceType: true, backedUp: true, createdAt: true },
    });
  }

  /**
   * Callers: [userController.deletePasskey]
   * Callees: [prisma.passkey.count]
   * Description: Counts the number of passkeys associated with a user.
   * Keywords: passkeys, count, user
   */
  public async countPasskeys(userId: string) {
    return prisma.passkey.count({ where: { userId } });
  }

  /**
   * Callers: [registerController.loginUser]
   * Callees: [prisma.user.findFirst]
   * Description: Fetches user details required for login by email or username.
   * Keywords: user, login, email, username
   */
  public async getUserForLogin(emailOrUsername: string) {
    return prisma.user.findFirst({
      where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] },
      include: { passkeys: true, role: true },
    });
  }

  /**
   * Callers: [registerController.refreshToken]
   * Callees: [prisma.user.findUnique]
   * Description: Fetches user details required for refreshing a session token.
   * Keywords: user, refresh, token
   */
  public async getUserForRefresh(userId: string) {
    return prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  }

  /**
   * Callers: [registerController.refreshToken]
   * Callees: [prisma.session.findUnique]
   * Description: Fetches a session by its ID.
   * Keywords: session, findUnique, id
   */
  public async getSessionById(sessionId: string) {
    return prisma.session.findUnique({ where: { id: sessionId } });
  }

  /**
   * Callers: [userController.getSessions]
   * Callees: [prisma.session.findMany]
   * Description: Lists all active sessions for a user.
   * Keywords: session, list, user
   */
  public async listSessions(userId: string) {
    return prisma.session.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  /**
   * Callers: [userController.getPublicProfile]
   * Callees: [prisma.user.findUnique, accessibleBy]
   * Description: Fetches the public profile of a user, including their accessible posts.
   * Keywords: public, profile, user, posts
   */
  public async getPublicProfile(username: string, ability: AppAbility) {
    return prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        role: { select: { name: true } },
        createdAt: true,
        posts: {
          where: accessibleBy(ability).Post,
          select: { id: true, title: true, content: true, createdAt: true, category: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { posts: { where: accessibleBy(ability).Post } } },
      },
    });
  }

  /**
   * Callers: [authController, sudoController]
   * Callees: [prisma.user.findUnique]
   * Description: Fetches a user by ID along with their role.
   * Keywords: user, role, findUnique
   */
  public async getUserWithRoleById(userId: string) {
    return prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  }

  /**
   * Callers: [authController.generatePasskeyRegistrationOptions, sudoController.getSudoPasskeyOptions]
   * Callees: [prisma.passkey.findMany]
   * Description: Lists passkey IDs and public keys for a user for WebAuthn authentication.
   * Keywords: passkeys, options, user, WebAuthn
   */
  public async listUserPasskeyIds(userId: string) {
    return prisma.passkey.findMany({ where: { userId }, select: { id: true, counter: true, publicKey: true } });
  }

  /**
   * Callers: [authController.verifyPasskeyAuthenticationResponse, sudoController.verifySudo]
   * Callees: [prisma.passkey.findUnique]
   * Description: Fetches a specific passkey by its ID.
   * Keywords: passkey, findUnique, id
   */
  public async getPasskeyById(passkeyId: string) {
    return prisma.passkey.findUnique({ where: { id: passkeyId } });
  }

  public async listUserIdsByLevel(minLevel: number) {
    return prisma.user.findMany({ where: { level: { gte: minLevel } }, select: { id: true } });
  }

  public async getUserByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  }
}

export const identityQueryService = new IdentityQueryService();