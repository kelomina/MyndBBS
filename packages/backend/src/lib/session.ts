import { prisma } from '../db';
import { redis } from './redis';

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
