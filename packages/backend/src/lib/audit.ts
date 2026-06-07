/**
 * 函数名称：logAudit
 *
 * 函数作用：
 *   审计日志快捷函数——记录用户操作的简易封装。
 * Purpose:
 *   Audit log helper — simple wrapper for recording user operations.
 *
 * 调用方 / Called by:
 *   - 各 controller 中需要手动记录审计日志的场景
 *
 * 被调用方 / Calls:
 *   - auditApplicationService.logAudit
 *
 * 参数说明 / Parameters:
 *   - who: string, 操作用户 ID
 *   - action: string, 操作类型（如 'update_profile'）
 *   - target: string, 操作目标描述
 *
 * 返回值说明 / Returns:
 *   Promise<void>
 *
 * 副作用 / Side effects:
 *   写数据库——创建审计日志记录
 *
 * 中文关键词：
 *   审计，日志，工具函数
 * English keywords:
 *   audit, log, helper
 */
import { auditApplicationService } from '../registry';

export const logAudit = async (who: string, action: string, target: string): Promise<void> => {
  await auditApplicationService.logAudit(who, action, target);
};
