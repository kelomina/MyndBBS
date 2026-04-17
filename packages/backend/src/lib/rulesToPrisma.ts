import { Rule } from '@casl/ability';
import { AppAbility, Action, AppSubjects } from './casl';

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
