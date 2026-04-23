const fs = require('fs');
const file = 'server/index.js';
const lines = fs.readFileSync(file, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('res.status(201).json({') && line.includes('success: true')) {
    if (line.includes('User berhasil')) {
        lines.splice(i, 0, `      emitSse('data_update', { type: 'users' });`); i++;
    } else if (line.includes('Absensi berhasil') || line.includes('Presensi Guest berhasil')) {
        lines.splice(i, 0, `      emitSse('data_update', { type: 'absensi' });`); i++;
    } else if (line.includes('Notulensi berhasil')) {
        lines.splice(i, 0, `      emitSse('data_update', { type: 'notulensi' });`); i++;
    } else if (line.includes('Undangan berhasil')) {
        lines.splice(i, 0, `      emitSse('data_update', { type: 'undangan' });`); i++;
    } else if (line.includes('Jadwal berhasil')) {
        lines.splice(i, 0, `      emitSse('data_update', { type: 'jadwal' });`); i++;
    }
  } else if (line.includes('res.json({') && line.includes('success: true') && !line.includes('emitSse')) {
    if (line.includes('User berhasil') || line.includes('Status user')) {
        lines.splice(i, 0, `      emitSse('data_update', { type: 'users' });`); i++;
    } else if (line.includes('Notula diperbarui') || line.includes('Notula dihapus')) {
        lines.splice(i, 0, `      emitSse('data_update', { type: 'notulensi' });`); i++;
    } else if (line.includes('Undangan berhasil dihapus')) {
        lines.splice(i, 0, `      emitSse('data_update', { type: 'undangan' });`); i++;
    } else if (line.includes('Jadwal berhasil diperbarui') || line.includes('Jadwal berhasil dihapus')) {
        lines.splice(i, 0, `      emitSse('data_update', { type: 'jadwal' });`); i++;
    }
  }
}

fs.writeFileSync(file, lines.join('\n'));
console.log('Patched index.js successfully via script');
