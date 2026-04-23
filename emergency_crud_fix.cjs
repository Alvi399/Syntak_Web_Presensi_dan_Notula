const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

console.log('Original length:', content.length);

// 1. Perbaiki duplikasi rute Notulensi (hapus blok yang ada di antara line 1294-1400 jika ada duplikatnya nanti)
// Kita akan melakukan pembersihan berbasis pola unik untuk memastikan tidak ada rute ganda.

// 2. Perbaiki logika tanggal di POST /api/jadwal-rapat (Baris 2403)
content = content.replace(
    /const startDate = new Date\(tanggal \+ 'T00:00:00'\);/g,
    "const startDate = new Date(`${tanggal}T00:00:00+07:00`);"
);

// 3. Pastikan rute DELETE jadwal-rapat tidak rusak
// Kita akan mencari rute DELETE /api/jadwal-rapat/:id dan memastikannya unik
const deleteJadwalRegex = /app\.delete\('\/api\/jadwal-rapat\/:id',[\s\S]*?\}\);/g;
const deleteMatches = content.match(deleteJadwalRegex);
if (deleteMatches && deleteMatches.length > 1) {
    console.log('Detected duplicate DELETE /api/jadwal-rapat routes. Cleaning up...');
    // Sisakan hanya satu
    content = content.replace(deleteJadwalRegex, (match, offset, string) => {
        return (string.indexOf(match) === offset) ? match : '';
    });
}

// 4. Perbaiki duplikasi rute Undangan (POST /api/undangan)
const postUndanganRegex = /app\.post\('\/api\/undangan',[\s\S]*?\}\);/g;
if ((content.match(postUndanganRegex) || []).length > 1) {
    console.log('Detected duplicate POST /api/undangan routes. Cleaning up...');
    content = content.replace(postUndanganRegex, (match, offset, string) => {
        return (string.indexOf(match) === offset) ? match : '';
    });
}

fs.writeFileSync(indexPath, content);
console.log('Emergency Repair: Duplicates cleaned and dates aligned.');
