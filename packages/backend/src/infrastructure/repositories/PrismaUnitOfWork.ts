import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';
import { basePrisma, prismaTxLocalStorage } from '../../db';
import { IAuditLogRepository } from '../../domain/system/IAuditLogRepository';
import { PrismaAuditLogRepository } from './PrismaAuditLogRepository';

/**
 * Prisma implementation of the UnitOfWork pattern.
 * It uses AsyncLocalStorage to propagate the transaction context
 * to the repositories without needing to pass it explicitly.
 */
export class PrismaUnitOfWork implements IUnitOfWork {
  public readonly auditLogs: IAuditLogRepository;

  constructor() {
    this.auditLogs = new PrismaAuditLogRepository();
  }

  /**
   * Executes the given work block within a Prisma transaction context.
   * If a transaction is already active in the current AsyncLocalStorage context,
   * it simply executes the work block within the existing transaction.
   * Otherwise, it starts a new transaction.
   *
   * @param work The function to execute within the transaction.
   * @returns The result of the work function.
   */
  public async execute<T>(work: () => Promise<T>): Promise<T> {
    const existingTx = prismaTxLocalStorage.getStore();
    
    // If we're already inside a transaction, just execute the work
    if (existingTx) {
      return work();
    }

    // Otherwise, start a new transaction and run the work inside it
    return basePrisma.$transaction(async (tx) => {
      return prismaTxLocalStorage.run(tx, () => {
        return work();
      });
    });
  }
}
