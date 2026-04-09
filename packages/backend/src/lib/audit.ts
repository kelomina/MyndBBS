import { prisma } from '../db';

const maskSensitiveData = (data: string) => {
  return data
    .replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, '***@***.***')
    .replace(/(token|password|secret|code)[=:]\s*([^&\s]+)/gi, '$1=***')
    .replace(/(eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,})/gi, '***');
};

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
        who: maskSensitiveData(who),
        action: maskSensitiveData(action),
        target: maskSensitiveData(target),
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};
