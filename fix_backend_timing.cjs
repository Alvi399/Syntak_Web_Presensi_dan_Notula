const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// 1. Perbaiki filter tanggal aktif di /api/jadwal-rapat/active
// Kita ganti: j.tanggal = CURDATE() 
// Menjadi: j.tanggal = DATE(DATE_ADD(NOW(), INTERVAL 7 HOUR)) agar selalu WIB
content = content.replace(
    /WHERE j\.tanggal = CURDATE\(\) AND j\.is_active = 1/g,
    "WHERE j.tanggal = DATE(DATE_ADD(CONVERT_TZ(NOW(), @@session.time_zone, '+00:00'), INTERVAL 7 HOUR)) AND j.is_active = 1"
);

// 2. Tambahkan Cache-Control header secara global di awal setiap request (Middleware)
// Cari baris app.use(express.json()) dan tambahkan middleware cache busting
if (!content.includes("res.setHeader('Cache-Control', 'no-store')")) {
    content = content.replace(
        /app\.use\(express\.json\(\{ limit: '50mb' \}\)\);/g,
        "app.use(express.json({ limit: '50mb' }));\n\n// Prevent Caching Global Middleware\napp.use((req, res, next) => {\n  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');\n  res.setHeader('Pragma', 'no-cache');\n  res.setHeader('Expires', '0');\n  next();\n});"
    );
}

fs.writeFileSync(indexPath, content);
console.log('Backend Precise Timing & Cache Fix Applied Successfully.');
