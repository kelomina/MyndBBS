import { defineAbilityFor } from './src/lib/casl';
import { accessibleBy } from '@casl/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
/**
 * Callers: []
 * Callees: [defineAbilityFor, log, stringify, accessibleBy]
 * Description: Handles the main logic for the application.
 * Keywords: main, auto-annotated
 */
async function main() {
  const guestAbility = defineAbilityFor(undefined);
  console.log('Guest accessible posts query:', JSON.stringify(accessibleBy(guestAbility).Post, null, 2));
}
main();
