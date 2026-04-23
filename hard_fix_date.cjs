const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Hard Fix untuk POST /api/jadwal-rapat
// Kita hindari penggunaan objek Date untuk kolom 'tanggal' di INSERT
// Cari bagian INSERT INTO jadwal_rapat
// Ubah agar menggunakan variabel 'tanggal' (string) langsung, bukan 'startDate' (objek Date)
content = content.replace(
    /await connection\.execute\(\s*`INSERT INTO jadwal_rapat\s+\(id, judul, jenis_kegiatan, deskripsi, tanggal,/g,
    "// Hard fix: Use raw date string to prevent timezone shifting\n    await connection.execute(\n      `INSERT INTO jadwal_rapat (id, judul, jenis_kegiatan, deskripsi, tanggal,"
);

// Pastikan di bagian VALUES juga menggunakan 'tanggal' bukan 'startDate'
// Ini butuh pencocokan yang lebih presisi pada blok kodenya
const insertPattern = /VALUES\s*\(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, 1\)`,\s*\[\s*id, judul, jenisKegiatan, deskripsi, startDate,/g;
if (insertPattern.test(content)) {
    content = content.replace(insertPattern, "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, [id, judul, jenisKegiatan, deskripsi, tanggal,");
}

// 2. Fix QR expires_at agar tidak tergeser
content = content.replace(
    /const expiresAtObj = new Date\(`${tanggal}T\${jamSelesai}:00`\);/g,
    "const expiresAtObj = `${tanggal} ${jamSelesai}:00`; // Use local string"
);

fs.writeFileSync(indexPath, content);
console.log('Hard Fix for Date Shifting applied. Using raw strings for SQL dates.');
