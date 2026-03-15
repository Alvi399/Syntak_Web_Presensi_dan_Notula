
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'absensi_notulensi',
  port: process.env.DB_PORT || 3306,
};

async function checkSchema() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const tables = ['qr_absensi_codes', 'absensi', 'notulensi', 'undangan'];
    
    for (const table of tables) {
      console.log(`Checking table: ${table}`);
      try {
        const [columns] = await connection.execute(`DESCRIBE ${table}`);
        const hasIdKegiatan = columns.some(col => col.Field === 'id_kegiatan');
        console.log(`  Table ${table} has id_kegiatan: ${hasIdKegiatan}`);
        if (!hasIdKegiatan) {
            console.log(`  Columns found: ${columns.map(c => c.Field).join(', ')}`);
        }
      } catch (e) {
        console.error(`  Error checking table ${table}: ${e.message}`);
      }
    }
  } finally {
    await connection.end();
  }
}

checkSchema().catch(console.error);
