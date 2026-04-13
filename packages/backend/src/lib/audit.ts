import { prisma } from '../db';
import { AuditLog } from '../domain/system/AuditLog';
import { PrismaAuditLogRepository } from '../infrastructure/repositories/PrismaAuditLogRepository';
import { v4 as uuidv4 } from 'uuid';

const auditLogRepository = new PrismaAuditLogRepository();

/**
 * Callers: []
 * Callees: [replace]
 * Description: Handles the mask sensitive data logic for the application.
 * Keywords: masksensitivedata, mask, sensitive, data, auto-annotated
 */
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
/**
 * Callers: [AdminController.banUser, AdminController.unbanUser, AdminController.updateUserLevel, AdminController.updateUserRole, AdminController.hardDeletePost, AdminController.hardDeleteComment, AdminController.restorePost, AdminController.restoreComment]
 * Callees: [AuditLog.create, maskSensitiveData, IAuditLogRepository.save, error]
 * Description: Logs a system action immutably, masking sensitive user data beforehand.
 * Keywords: logaudit, log, audit, system, logging, mask
 */
export const logAudit = async (who: string, action: string, target: string): Promise<void> => {
  try {
    const auditLog = AuditLog.create({
      id: uuidv4(),
      who: maskSensitiveData(who),
      action: maskSensitiveData(action),
      target: maskSensitiveData(target),
      timestamp: new Date()
    });
    await auditLogRepository.save(auditLog);
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};
