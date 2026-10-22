// Apply only the additive Google identity column, never a schema reset or seed.
const fs = require('node:fs');
const { Client } = require('pg');
const env = require('dotenv').parse(fs.readFileSync(process.argv[2] || 'server/.env'));
const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
(async () => {
  await client.connect();
  await client.query('BEGIN');
  await client.query(fs.readFileSync('server/prisma/migrations/20261022_google_login/migration.sql', 'utf8'));
  const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'googleSubject'");
  if (result.rowCount !== 1) throw new Error('Column check failed');
  await client.query('COMMIT');
  console.log('Google identity column and unique index are ready. Existing users preserved.');
})().catch(async () => {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Google identity migration could not complete. No credentials printed.');
  process.exitCode = 1;
}).finally(() => client.end());
