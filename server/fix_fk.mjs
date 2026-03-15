// Script sekali pakai: drop FK constraint di qr_absensi_codes.id_kegiatan
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const pool = await mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'absensi_notulensi',
});

// 1. Cari semua FK constraint pada qr_absensi_codes
const [fkRows] = await pool.execute(`
  SELECT CONSTRAINT_NAME 
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'qr_absensi_codes'
    AND REFERENCED_TABLE_NAME IS NOT NULL
`);

if (fkRows.length === 0) {
  console.log('✅ Tidak ada FK constraint di qr_absensi_codes — sudah bersih.');
} else {
  for (const fk of fkRows) {
    console.log(`🔧 Dropping FK: ${fk.CONSTRAINT_NAME}`);
    await pool.execute(`ALTER TABLE qr_absensi_codes DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
    console.log(`✅ FK ${fk.CONSTRAINT_NAME} berhasil di-drop!`);
  }
}

// 2. Tampilkan semua QR terbaru
const [qrs] = await pool.execute(
  `SELECT id, jenis_kegiatan, nama_kegiatan, is_active, expires_at, created_at 
   FROM qr_absensi_codes ORDER BY created_at DESC LIMIT 5`
);
console.log('\n📋 QR Codes terbaru di DB:');
for (const q of qrs) {
  const expired = q.expires_at && new Date() > new Date(q.expires_at);
  console.log(`  [${q.is_active ? 'AKTIF' : 'NONAKTIF'}${expired ? ' EXPIRED' : ''}] ${q.id.substring(0,8)}... | ${q.jenis_kegiatan} | ${q.nama_kegiatan} | expires: ${q.expires_at}`);
}

await pool.end();
console.log('\nSelesai. Silakan restart server dengan: pnpm start');
