/**
 * 模块：CASL 规则 → Prisma 查询
 *
 * 函数作用：
 *   将 CASL ability 规则转换为 Prisma 查询条件（where 子句），
 *   用于在数据库层执行 CASL 权限过滤。
 * Purpose:
 *   Converts CASL ability rules to Prisma query conditions (where clauses)
 *   for database-level CASL permission filtering.
 *
 * 中文关键词：
 *   CASL，Prisma，查询转换，权限过滤，Mongo
 * English keywords:
 *   CASL, Prisma, query conversion, permission filter, Mongo
 */
import { Rule } from '@casl/ability';
import { AppAbility, Action, AppSubjects } from './casl';

/**
 * 函数名称：rulesToPrisma
 *
 * 函数作用：
 *   将 CASL ability 中指定动作和主体的规则转换为 Prisma where 条件。
 *   支持多条规则的 OR 组合。无条件规则返回 {}（不过滤），无匹配规则返回 { id: { in: [] } }（空结果）。
 * Purpose:
 *   Converts CASL ability rules for a given action and subject into Prisma where conditions.
 *   Supports OR combination of multiple rules. Unconditional rules return {} (no filter),
 *   no matching rules return { id: { in: [] } } (empty result).
 *
 * 调用方 / Called by:
 *   - queries/ 中的各种查询服务（如 CommunityQueryService）
 *
 * 被调用方 / Calls:
 *   - ability.rulesFor
 *   - convertMongoToPrisma
 *
 * 参数说明 / Parameters:
 *   - ability: AppAbility, CASL 能力对象
 *   - action: Action, CASL 动作名称
 *   - subject: AppSubjects, CASL 主体名称
 *
 * 返回值说明 / Returns:
 *   Prisma where 条件对象——可直接用于 Prisma 查询的 findMany/findFirst 的 where 参数
 *
 * 错误处理 / Error handling:
 *   无异常——反转规则（inverted）暂时跳过不处理
 *
 * 副作用 / Side effects:
 *   无——纯函数
 *
 * 中文关键词：
 *   CASL，Prisma，查询，权限过滤，OR 条件
 * English keywords:
 *   CASL, Prisma, query, permission filter, OR conditions
 */
export function rulesToPrisma(ability: AppAbility, action: Action, subject: AppSubjects): any {
  const rules = ability.rulesFor(action, subject);
  
  if (rules.length === 0) {
    return { id: { in: [] } }; // return empty
  }

  const orConditions: any[] = [];

  for (const rule of rules) {
    if (rule.inverted) {
      // not handling inverted rules for now, or you can implement it
      continue;
    }

    if (!rule.conditions) {
      return {}; // unconditionally true
    }

    const prismaCondition = convertMongoToPrisma(rule.conditions);
    orConditions.push(prismaCondition);
  }

  if (orConditions.length === 0) {
    return { id: { in: [] } };
  }

  if (orConditions.length === 1) {
    return orConditions[0];
  }

  return { OR: orConditions };
}

/**
 * 函数名称：convertMongoToPrisma
 *
 * 函数作用：
 *   将 CASL 的 MongoDB 风格查询条件（$lte, $gte, $in 等）转换为 Prisma 查询操作符。
 * Purpose:
 *   Converts CASL's MongoDB-style query conditions ($lte, $gte, $in, etc.) to Prisma query operators.
 *
 * 调用方 / Called by:
 *   - rulesToPrisma
 *
 * 被调用方 / Calls:
 *   无——纯对象转换
 *
 * 参数说明 / Parameters:
 *   - conditions: Record<string, any>, CASL MongoDB 风格条件对象
 *     例如: { status: 'PUBLISHED', 'category.minLevel': { $lte: 3 } }
 *
 * 返回值说明 / Returns:
 *   Prisma 查询条件对象
 *     例如: { status: 'PUBLISHED', category: { minLevel: { lte: 3 } } }
 *
 * 错误处理 / Error handling:
 *   不支持的操作符会原样传递（fallback）
 *
 * 副作用 / Side effects:
 *   无——纯函数
 *
 * 中文关键词：
 *   MongoDB，Prisma，查询转换，操作符
 * English keywords:
 *   MongoDB, Prisma, query conversion, operators
 */
function convertMongoToPrisma(conditions: Record<string, any>): any {
  const result: any = {};
  
  for (const [key, value] of Object.entries(conditions)) {
    const keys = key.split('.');
    
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i] as string;
      if (!current[k]) {
        current[k] = {};
      }
      current = current[k];
    }
    
    const lastKey = keys[keys.length - 1] as string;
    if (!lastKey) continue;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const prismaOp: any = {};
      for (const [op, opVal] of Object.entries(value)) {
        if (op === '$lte') prismaOp.lte = opVal;
        else if (op === '$gte') prismaOp.gte = opVal;
        else if (op === '$lt') prismaOp.lt = opVal;
        else if (op === '$gt') prismaOp.gt = opVal;
        else if (op === '$in') prismaOp.in = opVal;
        else if (op === '$nin') prismaOp.notIn = opVal;
        else if (op === '$ne') prismaOp.not = opVal;
        else prismaOp[op] = opVal; // fallback
      }
      current[lastKey] = prismaOp;
    } else {
      current[lastKey] = value;
    }
  }
  
  return result;
}
