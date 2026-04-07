import { prisma } from '../db';

/**
 * Helper function to record actions in the AuditLog table
 * @param who - The ID or username of the user performing the action
 * @param action - A description of the action being performed
 * @param target - The target of the action (e.g., User ID, Category ID, etc.)
 */
export const logAudit = async (who: string, action: string, target: string): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        who,
        action,
        target,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};
