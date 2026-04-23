const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// Fungsi untuk menghapus duplikasi rute berdasarkan endpoint dan method
function deduplicateRoute(text, method, endpoint) {
    const escapedEndpoint = endpoint.replace(/\//g, '\\/').replace(/:id/g, ':id');
    const regex = new RegExp(`app\\.${method}\\('${escapedEndpoint}',[\\s\\S]*?\\}\\);`, 'g');
    const matches = text.match(regex);
    if (matches && matches.length > 1) {
        console.log(`Deduplicating ${method.toUpperCase()} ${endpoint}...`);
        return text.replace(regex, (match, offset, string) => {
            return (string.indexOf(match) === offset) ? match : '';
        });
    }
    return text;
}

// Bersihkan area rute yang sering duplikat
content = deduplicateRoute(content, 'get', '/api/notulensi');
content = deduplicateRoute(content, 'put', '/api/notulensi/:id');
content = deduplicateRoute(content, 'delete', '/api/notulensi/:id');
content = deduplicateRoute(content, 'post', '/api/notulensi');
content = deduplicateRoute(content, 'delete', '/api/jadwal-rapat/:id');

fs.writeFileSync(indexPath, content);
console.log('Final CRUD Recovery: All route duplicates removed.');
