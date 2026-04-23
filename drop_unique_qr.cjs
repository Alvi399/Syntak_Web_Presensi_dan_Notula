const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function fixDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Dropping problematic unique index...');
        // Drop unique constraint on qr_absensi_codes
        try {
            await connection.execute('ALTER TABLE qr_absensi_codes DROP INDEX idx_qr_codes_nama_unique');
            console.log('Successfully dropped idx_qr_codes_nama_unique');
        } catch (e) {
            console.log('Index idx_qr_codes_nama_unique might already be gone:', e.message);
        }

        try {
            await connection.execute('ALTER TABLE qr_absensi_codes DROP INDEX nama_kegiatan');
            console.log('Successfully dropped nama_kegiatan unique index');
        } catch (e) {}

        console.log('Database fix completed.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

fixDatabase();
