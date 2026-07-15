// test-db.ts
import { Client } from 'pg';

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query('select now();');
    console.log('✅ DATABASE_URL works. Server time:', res.rows[0].now);
  } catch (err) {
    console.error('❌ DATABASE_URL failed:', err);
  } finally {
    await client.end();
  }
}

test();