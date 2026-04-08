import { defineAbilityFor } from './src/lib/casl';
const ability = defineAbilityFor({ id: '1', role: 'ADMIN' });
console.log('ADMIN can manage User:', ability.can('manage', 'User'));
console.log('ADMIN can read AdminPanel:', ability.can('read', 'AdminPanel'));
