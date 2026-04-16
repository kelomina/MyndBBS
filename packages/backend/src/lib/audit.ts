import { auditApplicationService } from '../registry';

export const logAudit = async (who: string, action: string, target: string): Promise<void> => {
  await auditApplicationService.logAudit(who, action, target);
};
