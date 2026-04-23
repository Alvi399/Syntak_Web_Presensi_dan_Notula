const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Perbaiki parsing 'tanggal' di POST /api/jadwal-rapat agar tidak tergeser
// Kita cari line: const startDate = new Date(tanggal);
// Dan ubah menjadi: const startDate = new Date(`${tanggal}T00:00:00+07:00`); 
// Agar dipaksa masuk wilayah WIB (7 April) bukannya terdeteksi 6 April malam
content = content.replace(
    /const startDate = new Date\(tanggal\);/g,
    "const startDate = new Date(`${tanggal}T00:00:00+07:00`); // Force WIB"
);

// 2. Perbaiki expiresAt di QR generation 
// Ganti konversi ISOString yang menghilangkan offset zona waktu
content = content.replace(
    /expiresAt: new Date\(`${tanggal}T\${jamSelesai}:00`\)\.toISOString\(\)/g,
    "expiresAt: new Date(`${tanggal}T${jamSelesai}:00+07:00`).toISOString().replace('Z', '+07:00')"
);

fs.writeFileSync(indexPath, content);
console.log('Backend Date Shifting Fix Applied Successfully.');
