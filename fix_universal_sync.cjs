const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// Fungsi helper untuk menyuntikkan emitSse sebelum res.json atau res.send pada rute tertentu
function injectSse(routeRegex, type) {
    const sseCode = `\n    emitSse('data_update', { type: '${type}' });`;
    
    // Cari blok rute dan suntikkan kode sebelum respons sukses
    // Kita cari pattern res.json({ success: true ... }) atau res.json(rows) di dalam rute tersebut
    // Ini agak berisiko dengan regex, tapi kita akan targetkan baris res.json yang spesifik.
}

// STRATEGI SEDERHANA: Tambahkan emitSse('data_update') pada rute-rute kunci yang sering digunakan
// 1. Absensi (User & Guest)
content = content.replace(
    /res.json\(\{ success: true, message: 'Presensi berhasil disimpan' \}\);/g,
    "emitSse('data_update', { type: 'absensi' });\n    res.json({ success: true, message: 'Presensi berhasil disimpan' });"
);
content = content.replace(
    /res.json\(\{ success: true, message: 'Presensi tamu berhasil disimpan' \}\);/g,
    "emitSse('data_update', { type: 'absensi' });\n    res.json({ success: true, message: 'Presensi tamu berhasil disimpan' });"
);

// 2. Notulensi (Update & Delete)
content = content.replace(
    /res.json\(\{ success: true \} \); \/\/ After update notulensi/g, // if exists
    "emitSse('data_update', { type: 'notulensi' });\n    res.json({ success: true });"
);
// Manual search for notulensi success responses
content = content.replace(
    /res.json\(\{ success: true \}\);(\s+)\} catch \(error\) \{(\s+)console.error\('Update notulensi error'/g,
    "emitSse('data_update', { type: 'notulensi' });\n    res.json({ success: true });$1} catch (error) {$2console.error('Update notulensi error'"
);
content = content.replace(
    /res.json\(\{ success: true \}\);(\s+)\} catch \(error\) \{(\s+)console.error\('Delete notulensi error'/g,
    "emitSse('data_update', { type: 'notulensi' });\n    res.json({ success: true });$1} catch (error) {$2console.error('Delete notulensi error'"
);

// 3. Undangan (Update & Delete)
content = content.replace(
    /res.json\(\{ success: true \}\);(\s+)\} catch \(error\) \{(\s+)console.error\('Update undangan error'/g,
    "emitSse('data_update', { type: 'undangan' });\n    res.json({ success: true });$1} catch (error) {$2console.error('Update undangan error'"
);
content = content.replace(
    /res.json\(\{ success: true \}\);(\s+)\} catch \(error\) \{(\s+)console.error\('Delete undangan error'/g,
    "emitSse('data_update', { type: 'undangan' });\n    res.json({ success: true });$1} catch (error) {$2console.error('Delete undangan error'"
);

// 4. Jadwal Rapat (Delete)
content = content.replace(
    /res.json\(\{ success: true \}\);(\s+)\} catch \(error\) \{(\s+)console.error\('Delete jadwal rapat error'/g,
    "emitSse('data_update', { type: 'jadwal' });\n    res.json({ success: true });$1} catch (error) {$2console.error('Delete jadwal rapat error'"
);

fs.writeFileSync(indexPath, content);
console.log('Universal Sync Fix Applied Successfully.');
