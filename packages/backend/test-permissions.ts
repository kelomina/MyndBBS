import { defineAbilityFor } from './src/lib/casl';
import { subject } from '@casl/ability';

console.log('--- Guest ---');
const guestAbility = defineAbilityFor(undefined);
console.log('Guest can read Category minLevel 0:', guestAbility.can('read', subject('Category', { minLevel: 0 } as any)));
console.log('Guest can read Category minLevel 1:', guestAbility.can('read', subject('Category', { minLevel: 1 } as any)));

console.log('--- USER L1 ---');
const l1Ability = defineAbilityFor({ id: '1', role: 'USER', level: 1 });
console.log('L1 can read Category minLevel 1:', l1Ability.can('read', subject('Category', { minLevel: 1 } as any)));
console.log('L1 can read Category minLevel 2:', l1Ability.can('read', subject('Category', { minLevel: 2 } as any)));

console.log('--- ADMIN ---');
const adminAbility = defineAbilityFor({ id: '2', role: 'ADMIN', level: 1 });
console.log('ADMIN can read Category minLevel 6:', adminAbility.can('read', subject('Category', { minLevel: 6 } as any)));


console.log('--- Guest Post ---');
console.log('Guest read Post in minLevel 0:', guestAbility.can('read', subject('Post', { status: 'PUBLISHED', category: { minLevel: 0 } } as any)));
console.log('Guest read Post in minLevel 1:', guestAbility.can('read', subject('Post', { status: 'PUBLISHED', category: { minLevel: 1 } } as any)));

