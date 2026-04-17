import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: 'postgres://localhost:5432/db' });
const adapter1 = new PrismaPg(pool);
console.log(adapter1 ? 'pool works' : 'pool fails');

const adapter2 = new PrismaPg({ connectionString: 'postgres://localhost:5432/db' });
console.log(adapter2 ? 'connectionString works' : 'connectionString fails');
