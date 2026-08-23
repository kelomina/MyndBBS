/**
 * 启动引导：bootstrapBadgeSeed
 *
 * 函数作用：
 *   服务启动时幂等播种内置徽章（SYSTEM 类型）。已存在的内置徽章仅同步
 *   名称/描述/图标/颜色/获取方式/条件等不可变字段，保留管理员的启停状态
 *   与排序设置。
 *
 * Purpose:
 *   Idempotently seeds built-in (SYSTEM) badges at startup, preserving
 *   admin-controlled isActive/sortOrder while syncing immutable fields.
 */
import { randomUUID } from 'crypto';
import { BUILT_IN_BADGES } from '../domain/badge/BuiltInBadges';
import { Badge } from '../domain/badge/Badge';
import { PrismaBadgeRepository } from '../infrastructure/repositories/PrismaBadgeRepository';

export async function bootstrapBadgeSeed(): Promise<void> {
  const repository = new PrismaBadgeRepository();

  for (const definition of BUILT_IN_BADGES) {
    try {
      const existing = await repository.findByCode(definition.code);
      if (existing) {
        existing.syncSystemDefinition({
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          color: definition.color,
          grantType: definition.grantType,
          condition: definition.condition,
        });
        await repository.save(existing);
      } else {
        await repository.save(
          Badge.createSystem({
            id: randomUUID(),
            code: definition.code,
            name: definition.name,
            description: definition.description,
            icon: definition.icon,
            color: definition.color,
            grantType: definition.grantType,
            condition: definition.condition,
            isActive: true,
            sortOrder: definition.sortOrder,
          }),
        );
      }
    } catch (err) {
      console.error(`[BadgeSeed] Failed to seed badge ${definition.code}:`, err);
    }
  }
}
