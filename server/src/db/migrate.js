const pool = require('./connection');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Running attendance schema migration...');

    // Run main schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);

    // Run additional migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        console.log(`Running migration: ${file}...`);
        const migrationPath = path.join(migrationsDir, file);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        await client.query(migrationSql);
      }
    }

    console.log('Migration completed successfully!');
    console.log('Attendance table is ready.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
