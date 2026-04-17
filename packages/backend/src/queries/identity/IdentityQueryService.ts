import { prisma } from '../../db';
import { rulesToPrisma } from '../../lib/rulesToPrisma';
import type { AppAbility } from '../../lib/casl';
import { UserProfileDTO, BookmarkDTO, PasskeySummaryDTO, UserForLoginDTO, UserWithRoleDTO, SessionDTO, PublicProfileDTO, PasskeyOptionDTO, PasskeyDTO, UserDTO } from './dto';

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
  public async getProfile(userId: string): Promise<UserProfileDTO | null> {
    const user = await prisma.user.findUnique({
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
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      level: user.level,
      role: user.role ? { name: user.role.name } : null,
      isTotpEnabled: user.isTotpEnabled,
      _count: { passkeys: user._count.passkeys },
    };
  }

  /**
   * Callers: [userController.getBookmarkedPosts]
   * Callees: [prisma.bookmark.findMany, prisma.commentBookmark.findMany]
   * Description: Fetches all bookmarks (both posts and comments) for a given user, sorted by date.
   * Keywords: bookmarks, user, findMany
   */
  public async listBookmarks(userId: string): Promise<BookmarkDTO[]> {
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
      ...postBookmarks.map((b) => ({ 
        id: b.post.id,
        type: 'post' as const, 
        bookmarkedAt: b.createdAt,
        title: b.post.title,
        status: b.post.status,
        author: b.post.author,
        category: b.post.category,
      })),
      ...commentBookmarks.map((b) => ({ 
        id: b.comment.id,
        type: 'comment' as const, 
        bookmarkedAt: b.createdAt,
        content: b.comment.content,
        author: b.comment.author,
        post: b.comment.post,
      })),
    ].sort((a, b) => b.bookmarkedAt.getTime() - a.bookmarkedAt.getTime());
  }

  /**
   * Callers: [userController.getPasskeys]
   * Callees: [prisma.passkey.findMany]
   * Description: Lists all passkeys associated with a user.
   * Keywords: passkeys, user, list, findMany
   */
  public async listPasskeys(userId: string): Promise<PasskeySummaryDTO[]> {
    const list = await prisma.passkey.findMany({
      where: { userId },
      select: { id: true, deviceType: true, backedUp: true, createdAt: true },
    });
    return list.map(p => ({
      id: p.id,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Callers: [userController.deletePasskey]
   * Callees: [prisma.passkey.count]
   * Description: Counts the number of passkeys associated with a user.
   * Keywords: passkeys, count, user
   */
  public async countPasskeys(userId: string): Promise<number> {
    return prisma.passkey.count({ where: { userId } });
  }

  /**
   * Callers: [registerController.loginUser]
   * Callees: [prisma.user.findFirst]
   * Description: Fetches user details required for login by email or username.
   * Keywords: user, login, email, username
   */
  public async getUserForLogin(emailOrUsername: string): Promise<UserForLoginDTO | null> {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] },
      include: { passkeys: true, role: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      status: user.status,
      level: user.level,
      roleId: user.roleId,
      isTotpEnabled: user.isTotpEnabled,
      totpSecret: user.totpSecret,
      isPasskeyMandatory: user.isPasskeyMandatory,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      passkeys: user.passkeys.map(p => ({
        id: p.id,
        publicKey: p.publicKey,
        userId: p.userId,
        webAuthnUserID: p.webAuthnUserID,
        counter: p.counter,
        deviceType: p.deviceType,
        backedUp: p.backedUp,
        createdAt: p.createdAt,
      }))
    };
  }

  /**
   * Callers: [registerController.refreshToken]
   * Callees: [prisma.user.findUnique]
   * Description: Fetches user details required for refreshing a session token.
   * Keywords: user, refresh, token
   */
  public async getUserForRefresh(userId: string): Promise<UserWithRoleDTO | null> {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      status: user.status,
      level: user.level,
      roleId: user.roleId,
      isTotpEnabled: user.isTotpEnabled,
      totpSecret: user.totpSecret,
      isPasskeyMandatory: user.isPasskeyMandatory,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
    };
  }

  /**
   * Callers: [registerController.refreshToken]
   * Callees: [prisma.session.findUnique]
   * Description: Fetches a session by its ID.
   * Keywords: session, findUnique, id
   */
  public async getSessionById(sessionId: string): Promise<SessionDTO | null> {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return null;
    return {
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  /**
   * Callers: [userController.getSessions]
   * Callees: [prisma.session.findMany]
   * Description: Lists all active sessions for a user.
   * Keywords: session, list, user
   */
  public async listSessions(userId: string): Promise<SessionDTO[]> {
    const list = await prisma.session.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return list.map(session => ({
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    }));
  }

  /**
   * Callers: [userController.getPublicProfile]
   * Callees: [prisma.user.findUnique, accessibleBy]
   * Description: Fetches the public profile of a user, including their accessible posts.
   * Keywords: public, profile, user, posts
   */
  public async getPublicProfile(username: string, ability: AppAbility): Promise<PublicProfileDTO | null> {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        role: { select: { name: true } },
        createdAt: true,
        posts: {
          where: rulesToPrisma(ability, 'read', 'Post'),
          select: { id: true, title: true, content: true, createdAt: true, category: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { posts: { where: rulesToPrisma(ability, 'read', 'Post') } } },
      },
    });
    if (!user) return null;
    return {
      username: user.username,
      role: user.role ? { name: user.role.name } : null,
      createdAt: user.createdAt,
      posts: user.posts.map(p => ({
        id: p.id,
        title: p.title,
        content: p.content,
        createdAt: p.createdAt,
        category: { name: p.category.name }
      })),
      _count: { posts: user._count.posts }
    };
  }

  /**
   * Callers: [authController, sudoController]
   * Callees: [prisma.user.findUnique]
   * Description: Fetches a user by ID along with their role.
   * Keywords: user, role, findUnique
   */
  public async getUserWithRoleById(userId: string): Promise<UserWithRoleDTO | null> {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      status: user.status,
      level: user.level,
      roleId: user.roleId,
      isTotpEnabled: user.isTotpEnabled,
      totpSecret: user.totpSecret,
      isPasskeyMandatory: user.isPasskeyMandatory,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
    };
  }

  /**
   * Callers: [authController.generatePasskeyRegistrationOptions, sudoController.getSudoPasskeyOptions]
   * Callees: [prisma.passkey.findMany]
   * Description: Lists passkey IDs and public keys for a user for WebAuthn authentication.
   * Keywords: passkeys, options, user, WebAuthn
   */
  public async listUserPasskeyIds(userId: string): Promise<PasskeyOptionDTO[]> {
    const list = await prisma.passkey.findMany({ where: { userId }, select: { id: true, counter: true, publicKey: true } });
    return list.map(p => ({
      id: p.id,
      counter: p.counter,
      publicKey: p.publicKey
    }));
  }

  /**
   * Callers: [authController.verifyPasskeyAuthenticationResponse, sudoController.verifySudo]
   * Callees: [prisma.passkey.findUnique]
   * Description: Fetches a specific passkey by its ID.
   * Keywords: passkey, findUnique, id
   */
  public async getPasskeyById(passkeyId: string): Promise<PasskeyDTO | null> {
    const passkey = await prisma.passkey.findUnique({ where: { id: passkeyId } });
    if (!passkey) return null;
    return {
      id: passkey.id,
      publicKey: passkey.publicKey,
      userId: passkey.userId,
      webAuthnUserID: passkey.webAuthnUserID,
      counter: passkey.counter,
      deviceType: passkey.deviceType,
      backedUp: passkey.backedUp,
      createdAt: passkey.createdAt,
    };
  }

  public async listUserIdsByLevel(minLevel: number): Promise<{ id: string }[]> {
    const users = await prisma.user.findMany({ where: { level: { gte: minLevel } }, select: { id: true } });
    return users.map(u => ({ id: u.id }));
  }

  public async getUserByUsername(username: string): Promise<UserDTO | null> {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      status: user.status,
      level: user.level,
      roleId: user.roleId,
      isTotpEnabled: user.isTotpEnabled,
      totpSecret: user.totpSecret,
      isPasskeyMandatory: user.isPasskeyMandatory,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export const identityQueryService = new IdentityQueryService();