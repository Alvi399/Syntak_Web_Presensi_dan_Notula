import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

async function diagnose() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'absensi_notulensi',
    port: process.env.DB_PORT || 3306
  });

  try {
    const [rows] = await connection.execute('SELECT * FROM absensi ORDER BY created_at DESC LIMIT 10');
    const [users] = await connection.execute('SELECT id, nama, email FROM users LIMIT 10');

    const output = {
      absensi: rows.map(r => ({
        id: r.id,
        user_id: r.user_id,
        nama_user: r.nama_user,
        tanggal: r.tanggal,
        is_guest: r.is_guest
      })),
      users: users.map(u => ({
        id: u.id,
        nama: u.nama,
        email: u.email
      }))
    };

    fs.writeFileSync('server/diag_results.json', JSON.stringify(output, null, 2));
    console.log('✅ Diag results written to server/diag_results.json');

  } catch (error) {
    console.error('Diagnosis failed:', error);
  } finally {
    await connection.end();
  }
}

diagnose();
