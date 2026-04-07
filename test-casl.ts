import { defineAbilityFor } from './packages/backend/src/lib/casl.ts';
const ability = defineAbilityFor({ id: '1', role: 'ADMIN' });
console.log('ADMIN can read AdminPanel:', ability.can('read', 'AdminPanel'));
