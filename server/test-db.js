// Quick connection test: node test-db.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 10000,
  };
  if (process.env.DB_SSL === 'true') {
    config.ssl = { rejectUnauthorized: false };
  }

  console.log(`Connecting to ${config.host}:${config.port} db=${config.database} user=${config.user} ssl=${process.env.DB_SSL}`);
  const conn = await mysql.createConnection(config);
  const [rows] = await conn.query('SELECT VERSION() AS version, NOW() AS server_time');
  console.log('Connected successfully:', rows[0]);
  await conn.end();
}

main().catch((err) => {
  console.error('Connection failed:', err.code || '', err.message);
  if (/ssl/i.test(err.message)) {
    console.error('Hint: set DB_SSL=true in .env and retry.');
  }
  process.exit(1);
});
