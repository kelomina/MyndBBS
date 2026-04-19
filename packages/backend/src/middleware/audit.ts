import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { auditApplicationService } from '../registry';
import { RoleName } from '../application/identity/policies/RoleHierarchyPolicy';

export const auditMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  res.on('finish', () => {
    try {
      if (req.user && req.user.role) {
        const role = req.user.role as RoleName;
        // 针对版主（含）以上权限组
        if (['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
          const method = req.method;
          
          // Only log mutating operations
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            const routePath = req.route ? req.route.path : req.path;
            const operationType = `${method} ${routePath}`;
            
            // Mask sensitive data if any
            const payload = {
              body: { ...req.body },
              query: req.query,
              params: req.params,
              statusCode: res.statusCode,
            };

            // Remove password fields from payload if they exist
            if (payload.body && payload.body.password) {
              payload.body.password = '***';
            }
            if (payload.body && payload.body.oldPassword) {
              payload.body.oldPassword = '***';
            }
            
            const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
            
            auditApplicationService.logAudit(
              req.user.userId,
              operationType,
              `Route: ${routePath}`,
              role,
              req.originalUrl,
              ip,
              payload
            ).catch((err) => {
              console.error('Failed to log audit:', err);
            });
          }
        }
      }
    } catch (err) {
      console.error('Audit middleware error:', err);
    }
  });

  next();
};
