import { prisma } from '../../db';
import redis from '../../lib/redis';
import { AbilityRulesDTO, RuleDescriptorDTO } from './dto';

const CACHE_TTL_SECONDS = 900; // 15 minutes

/**
 * Callers: [requireAuth, optionalAuth]
 * Callees: [redis.get, redis.set, prisma.user.findUnique, JSON.parse, JSON.stringify]
 * Description: Query service responsible for fetching and formatting RBAC rules and user context into DTOs. Utilizes Redis caching.
 * Keywords: query, service, rbac, access, control, ability, rules, cache
 */
export class AccessControlQueryService {
  /**
   * Callers: [requireAuth, optionalAuth]
   * Callees: [redis.get, prisma.user.findUnique, parsePermissions, redis.set]
   * Description: Fetches the ability rules and access context for a specific user, utilizing Redis cache.
   * Keywords: ability, rules, user, cache, query
   */
  public async getAbilityRulesForUser(userId: string): Promise<AbilityRulesDTO | null> {
    const cacheKey = `ability_rules:user:${userId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached) as AbilityRulesDTO;
      } catch (err) {
        // Fallback to db query if JSON is malformed
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        },
        moderatedCategories: true
      }
    });

    if (!user) return null;

    const moderatedCategoryIds = user.moderatedCategories.map(mc => mc.categoryId);
    const rawActions = user.role?.permissions?.map(rp => rp.permission.action) || [];
    const rules = this.parsePermissions(rawActions);

    const dto: AbilityRulesDTO = {
      context: {
        userId: user.id,
        roleName: user.role?.name || null,
        level: user.level,
        moderatedCategoryIds,
      },
      rules
    };

    await redis.set(cacheKey, JSON.stringify(dto), 'EX', CACHE_TTL_SECONDS);

    return dto;
  }

  /**
   * Callers: [getAbilityRulesForUser]
   * Callees: []
   * Description: Parses raw action strings (e.g. 'delete:Post') into RuleDescriptorDTO objects. Malformed strings are skipped.
   * Keywords: parse, permissions, rules, action, subject
   */
  private parsePermissions(actions: string[]): RuleDescriptorDTO[] {
    const rules: RuleDescriptorDTO[] = [];
    for (const actionStr of actions) {
      const parts = actionStr.split(':');
      if (parts.length >= 2) {
        const action = parts[0]!.trim();
        const subject = parts.slice(1).join(':').trim(); // Rejoin in case subject contains ':'
        if (action && subject) {
          rules.push({ action, subject });
        }
      }
    }
    return rules;
  }
}

export const accessControlQueryService = new AccessControlQueryService();