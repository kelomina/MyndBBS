import { prisma } from '../db';
import { redis } from './redis';

/**
 * Callers: []
 * Callees: [findMany, pipeline, del, exec, deleteMany]
 * Description: Handles the revoke user sessions logic for the application.
 * Keywords: revokeusersessions, revoke, user, sessions, auto-annotated
 */
export const revokeUserSessions = async (userId: string) => {
  const sessions = await prisma.session.findMany({ where: { userId } });
  if (sessions.length > 0) {
    const pipeline = redis.pipeline();
    for (const session of sessions) {
      pipeline.del(`session:${session.id}`);
    }
    await pipeline.exec();
    await prisma.session.deleteMany({ where: { userId } });
  }
};
