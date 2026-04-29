import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { systemQueryService } from '../queries/system/SystemQueryService';

const DEFAULT_AUDIT_PAGE_SIZE = 50;
const MAX_AUDIT_PAGE_SIZE = 100;

/**
 * Callers: [getAuditLogs]
 * Callees: []
 * Description: Parses a required integer pagination query value and optionally clamps it to a safe upper bound.
 * 描述：解析分页整数查询参数，并在需要时把结果限制到安全上限内。
 * Variables: `rawValue` 表示原始查询值；`fieldName` 表示字段名；`defaultValue` 表示默认值；`minValue`/`maxValue` 表示允许范围。
 * 变量：`rawValue` 为原始查询值；`fieldName` 为字段名；`defaultValue` 为默认值；`minValue`/`maxValue` 为允许范围。
 * Integration: Use this helper before passing pagination arguments into Prisma or other data-access layers.
 * 接入方式：在把分页参数传给 Prisma 或其他数据访问层之前调用本函数。
 * Error Handling: Throws `ERR_BAD_REQUEST` when the query value is missing in an invalid form, non-integer, or below the minimum.
 * 错误处理：当查询值格式非法、不是整数或小于最小值时抛出 `ERR_BAD_REQUEST`。
 * Keywords: pagination, query, integer, clamp, validation, 分页, 查询参数, 整数, 限制, 校验
 */
function parseAuditPaginationParam(
  rawValue: unknown,
  _fieldName: 'skip' | 'take',
  defaultValue: number,
  minValue: number,
  maxValue?: number
): number {
  if (rawValue === undefined) {
    return defaultValue;
  }

  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    throw new Error('ERR_BAD_REQUEST');
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < minValue) {
    throw new Error('ERR_BAD_REQUEST');
  }

  if (maxValue !== undefined && parsedValue > maxValue) {
    return maxValue;
  }

  return parsedValue;
}

/**
 * Callers: [getAuditLogs]
 * Callees: []
 * Description: Reads an optional string query value while rejecting array-style query inputs.
 * 描述：读取可选字符串查询参数，并拒绝数组形式的查询输入。
 * Variables: `rawValue` 表示原始查询值。
 * 变量：`rawValue` 表示原始查询值。
 * Integration: Use this helper for optional audit filters before constructing repository query params.
 * 接入方式：在构建审计查询过滤条件前调用本函数读取可选字符串参数。
 * Error Handling: Throws `ERR_BAD_REQUEST` when the caller passes a non-string query value.
 * 错误处理：当调用方传入非字符串查询值时抛出 `ERR_BAD_REQUEST`。
 * Keywords: query, filter, string, validation, optional, 查询, 过滤, 字符串, 校验, 可选
 */
function readOptionalAuditFilter(rawValue: unknown): string | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (typeof rawValue !== 'string') {
    throw new Error('ERR_BAD_REQUEST');
  }

  const normalizedValue = rawValue.trim();
  return normalizedValue ? normalizedValue : undefined;
}

/**
 * Callers: [adminRouter]
 * Callees: [parseAuditPaginationParam, readOptionalAuditFilter, systemQueryService.getAuditLogs]
 * Description: Returns paginated audit logs for SUPER_ADMIN users with validated pagination and filters.
 * 描述：为 `SUPER_ADMIN` 用户返回经过分页和过滤参数校验的审计日志列表。
 * Variables: `skip`/`take` 控制分页；`operatorId`/`operationType` 为可选过滤条件；`params` 为查询服务入参。
 * 变量：`skip`/`take` 控制分页；`operatorId`/`operationType` 是可选过滤条件；`params` 是查询服务参数。
 * Integration: Mounted on `GET /api/admin/audit-logs` after `requireAuth`; callers should pass plain integer query params.
 * 接入方式：本函数挂载在 `GET /api/admin/audit-logs` 且位于 `requireAuth` 之后，调用方应传入纯整数分页参数。
 * Error Handling: Returns `403` for non-super-admin users, `400` for invalid query params, and `500` for unexpected failures.
 * 错误处理：非超级管理员返回 `403`，非法查询参数返回 `400`，其余异常返回 `500`。
 * Keywords: audit logs, pagination, super admin, filter, controller, 审计日志, 分页, 超级管理员, 过滤, 控制器
 */
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Only SUPER_ADMIN can query audit logs
    if (!req.ability?.can('manage', 'all')) {
      res.status(403).json({ error: 'ERR_FORBIDDEN_SUPER_ADMIN_ONLY' });
      return;
    }

    const skip = parseAuditPaginationParam(req.query.skip, 'skip', 0, 0);
    const take = parseAuditPaginationParam(
      req.query.take,
      'take',
      DEFAULT_AUDIT_PAGE_SIZE,
      1,
      MAX_AUDIT_PAGE_SIZE
    );
    const operatorId = readOptionalAuditFilter(req.query.operatorId);
    const operationType = readOptionalAuditFilter(req.query.operationType);

    const params: { skip?: number; take?: number; operatorId?: string; operationType?: string } = { skip, take };
    if (operatorId) params.operatorId = operatorId;
    if (operationType) params.operationType = operationType;

    const result = await systemQueryService.getAuditLogs(params);

    res.json(result);
  } catch (error: any) {
    if (error?.message === 'ERR_BAD_REQUEST') {
      res.status(400).json({ error: 'ERR_BAD_REQUEST' });
      return;
    }

    console.error('Failed to get audit logs:', error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};
