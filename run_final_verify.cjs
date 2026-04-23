const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ path: './server/.env' });

async function verify() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute('SELECT judul, tanggal, created_at FROM jadwal_rapat ORDER BY created_at DESC LIMIT 5');
        let report = '--- VERIFIKASI JADWAL RAРАТ ---\n';
        rows.forEach(r => {
            report += `Judul: ${r.judul} | Tanggal DB: ${r.tanggal} | Created: ${r.created_at}\n`;
        });

        const [qr] = await connection.execute('SELECT nama_kegiatan, expires_at FROM qr_absensi_codes ORDER BY created_at DESC LIMIT 5');
        report += '\n--- VERIFIKASI QR CODES ---\n';
        qr.forEach(q => {
            report += `Nama: ${q.nama_kegiatan} | Expires: ${q.expires_at}\n`;
        });

        fs.writeFileSync('FINAL_DB_VERIFICATION.txt', report);
        console.log('Verification report created: FINAL_DB_VERIFICATION.txt');
    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

verify();
