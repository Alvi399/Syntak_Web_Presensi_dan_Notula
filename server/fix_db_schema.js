
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

async function fixSchema() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const alterations = [
      { table: 'qr_absensi_codes', column: 'id_kegiatan', type: 'VARCHAR(36) DEFAULT NULL' },
      { table: 'absensi', column: 'id_kegiatan', type: 'VARCHAR(36) DEFAULT NULL' },
      { table: 'notulensi', column: 'id_kegiatan', type: 'VARCHAR(36) DEFAULT NULL' },
      { table: 'undangan', column: 'id_kegiatan', type: 'VARCHAR(36) DEFAULT NULL' }
    ];

    for (const alt of alterations) {
      console.log(`Checking table: ${alt.table}`);
      const [columns] = await connection.execute(`DESCRIBE ${alt.table}`);
      const hasColumn = columns.some(col => col.Field === alt.column);
      
      if (!hasColumn) {
        console.log(`  Adding ${alt.column} to ${alt.table}...`);
        await connection.execute(`ALTER TABLE ${alt.table} ADD COLUMN ${alt.column} ${alt.type}`);
        console.log(`  Successfully added ${alt.column} to ${alt.table}.`);
      } else {
        console.log(`  Table ${alt.table} already has ${alt.column}.`);
      }
    }
  } catch (error) {
    console.error('Error fixing schema:', error);
  } finally {
    await connection.end();
  }
}

fixSchema().catch(console.error);
