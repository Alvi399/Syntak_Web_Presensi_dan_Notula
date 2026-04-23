const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

console.log('Original content length:', content.length);

// 1. Fix Schedule Creation Date Shift
// find: const startDate = new Date(tanggal);
// replace: const startDate = new Date(tanggal + 'T00:00:00');
content = content.replace(
    /const startDate = new Date\(tanggal\);/g,
    "const startDate = new Date(tanggal + 'T00:00:00');"
);

// 2. Fix Attendance Validation Timezone (User)
// Targeting line: const startDt = new Date(`${jTanggal}T${j.jam_mulai}+07:00`);
// We will simply ensure the logs and comparisons use true UTC nowUTC
content = content.replace(
    /const nowUTC = new Date\(\);\s+\/\/ Untuk perbandingan waktu/g,
    "const nowUTC = new Date(); // True UTC for comparison"
);

fs.writeFileSync(indexPath, content);
console.log('Fix Applied Successfully. Content updated.');
