import { AbilityBuilder, PureAbility } from '@casl/ability';
import { createPrismaAbility, PrismaQuery, Subjects } from '@casl/prisma';

type Action = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'update_status';
type AppSubjects = 'all' | 'AdminPanel' | Subjects<{ Post: { id: string; categoryId: string } }>;
type AppAbility = PureAbility<[Action, AppSubjects], PrismaQuery>;

const { can, cannot, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);
can('update_status', 'Post');
can('manage', 'Post', { categoryId: { in: ['cat1', 'cat2'] } });

const ability = build();

console.log("can update_status on cat3:", ability.can('update_status', { __caslSubjectType__: 'Post', id: '2', categoryId: 'cat3' }));
