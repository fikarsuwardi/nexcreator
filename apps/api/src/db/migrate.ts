import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './connection';

const MIGRATIONS = [
  '001_initial_schema.sql',
  '002_outreach_tables.sql',
  '003_pipeline_tables.sql',
];

async function migrate() {
  const client = await pool.connect();
  try {
    // Track applied migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const filename of MIGRATIONS) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename]
      );
      if (rowCount && rowCount > 0) {
        console.log(`  Skipping ${filename} (already applied)`);
        continue;
      }

      console.log(`  Applying ${filename}...`);
      const sql = readFileSync(
        join(__dirname, 'migrations', filename),
        'utf-8'
      );
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [filename]
      );
      console.log(`  Applied ${filename}`);
    }

    console.log('\nMigrations complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
