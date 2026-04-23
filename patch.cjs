const fs = require('fs');
const file = 'server/index.js';
let code = fs.readFileSync(file, 'utf8');

const mappings = [
  { text: "res.status(201).json({ success: true, message: 'User berhasil didaftarkan'", insert: "emitSse('data_update', { type: 'users' });\n    " },
  { text: "res.json({ success: true, message: 'User berhasil diperbarui'", insert: "emitSse('data_update', { type: 'users' });\n    " },
  { text: "res.json({ success: true, message: 'User berhasil dihapus'", insert: "emitSse('data_update', { type: 'users' });\n    " },
  { text: "res.json({ success: true, message: 'Status user berhasil diperbarui'", insert: "emitSse('data_update', { type: 'users' });\n    " },
  
  { text: "res.status(201).json({ success: true, message: 'Absensi berhasil", insert: "emitSse('data_update', { type: 'absensi' });\n      " },
  { text: "res.status(201).json({ success: true, message: 'Presensi Guest berhasil", insert: "emitSse('data_update', { type: 'absensi' });\n      " },
  
  { text: "res.status(201).json({ success: true, message: 'Notulensi berhasil disimpan'", insert: "emitSse('data_update', { type: 'notulensi' });\n    " },
  { text: "res.json({ success: true, message: 'Notula diperbarui'", insert: "emitSse('data_update', { type: 'notulensi' });\n    " },
  { text: "res.json({ success: true, message: 'Notula dihapus'", insert: "emitSse('data_update', { type: 'notulensi' });\n    " },
  
  { text: "res.status(201).json({ success: true, message: 'Undangan berhasil disimpan'", insert: "emitSse('data_update', { type: 'undangan' });\n    " },
  { text: "res.json({ success: true, message: 'Undangan berhasil dihapus'", insert: "emitSse('data_update', { type: 'undangan' });\n    " },
  
  { text: "res.status(201).json({ success: true, message: 'Jadwal berhasil dibuat'", insert: "emitSse('data_update', { type: 'jadwal' });\n      " },
  { text: "res.json({ success: true, message: 'Jadwal berhasil diperbarui'", insert: "emitSse('data_update', { type: 'jadwal' });\n    " },
  { text: "res.json({ success: true, message: 'Jadwal berhasil dihapus'", insert: "emitSse('data_update', { type: 'jadwal' });\n    " }
];

let replacedCount = 0;
mappings.forEach(m => {
  if (code.includes(m.text)) {
    code = code.replace(m.text, m.insert + m.text);
    replacedCount++;
  } else {
    // Try without ending quote
    const shortText = m.text.replace(/'$/, '');
    if (code.includes(shortText)) {
      code = code.replace(shortText, m.insert + shortText);
      replacedCount++;
    }
  }
});

fs.writeFileSync(file, code);
console.log('Patched index.js. Replaced: ' + replacedCount);
