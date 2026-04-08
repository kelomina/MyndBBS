import { defineAbilityFor } from './src/lib/casl';
const ability = defineAbilityFor({ id: '1', role: 'MODERATOR' });
console.log('MODERATOR can manage User:', ability.can('manage', 'User'));
console.log('MODERATOR can read AdminPanel:', ability.can('read', 'AdminPanel'));
