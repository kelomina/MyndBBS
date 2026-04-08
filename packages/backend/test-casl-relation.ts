import { PrismaQuery, createPrismaAbility } from '@casl/prisma';
import { AbilityBuilder, PureAbility } from '@casl/ability';

const { can, build } = new AbilityBuilder<PureAbility<[string, any], PrismaQuery>>(createPrismaAbility);
can('read', 'Post', { category: { is: { minLevel: { lte: 2 } } } });
const ability = build();
console.log(ability.rules);
