import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const basePrisma = new PrismaClient();

export const prisma = basePrisma.$extends({
  query: {
    user: {
      async update({ args, query }) {
        let isPromoting = false;
        if (args.data && args.data.level !== undefined) {
          if (typeof args.data.level === 'number' && args.data.level > 1) isPromoting = true;
          if (typeof args.data.level === 'object' && args.data.level !== null) isPromoting = true; // e.g. { increment: 1 }
        }
        if (isPromoting) {
          const userWhere = args.where;
          if (userWhere) {
            const user = await basePrisma.user.findUnique({ where: userWhere, select: { id: true } });
            if (user) {
              const passkeyCount = await basePrisma.passkey.count({ where: { userId: user.id } });
              if (passkeyCount === 0) {
                throw new Error('ERR_CANNOT_PROMOTE_WITHOUT_PASSKEY');
              }
            }
          }
        }
        return query(args);
      },
      async updateMany({ args, query }) {
        let isPromoting = false;
        if (args.data && args.data.level !== undefined) {
          if (typeof args.data.level === 'number' && args.data.level > 1) isPromoting = true;
          if (typeof args.data.level === 'object' && args.data.level !== null) isPromoting = true; // e.g. { increment: 1 }
        }
        if (isPromoting) {
          // It's too complex to check every user in a batch update, so we prevent batch level promotion entirely.
          throw new Error('ERR_CANNOT_BATCH_PROMOTE_WITHOUT_PASSKEY');
        }
        return query(args);
      }
    }
  }
});
