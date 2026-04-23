import fs from 'fs';
const BASE_URL = 'http://localhost:5000/api';

async function testFailedRoutes() {
  let results = {};
  try {
    const loginRes = await fetch(BASE_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@absensi.com', password: 'admin123' })
    }).then(r => r.json());
    
    const adminId = loginRes.user.id;
    
    const jadwalRes = await fetch(BASE_URL + '/jadwal-rapat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        judul: 'QR UNDANGAN TEST',
        tanggal: new Date(Date.now() + 7*3600*1000).toISOString().split('T')[0],
        jamMulai: '01:00',
        jamSelesai: '23:59',
        tim: ['Semua'], peserta: ['Semua'], createdBy: adminId
      })
    }).then(r => r.json());
    
    results.jadwalRes = jadwalRes;
    
    if (jadwalRes.ids && jadwalRes.ids.length > 0) {
      const jid = jadwalRes.ids[0];
      
      const undRes = await fetch(BASE_URL + '/undangan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idKegiatan: jid, perihal: 'test', tempatKegiatan: 'Aula' })
      }).then(r => r.json());
      results.undangan = undRes;
      
      const qrGen = await fetch(BASE_URL + '/qr/generate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ idKegiatan: jid, createdBy: adminId })
      }).then(r => r.json());
      results.qrGen = qrGen;
      
      if (qrGen.id) {
         const qrTest = await fetch(BASE_URL + '/qr/' + qrGen.id).then(r => r.json());
         results.qrGet = qrTest;
      }
    }
  } catch (err) {
    results.error = err.toString();
  }
  fs.writeFileSync('debug.json', JSON.stringify(results, null, 2), 'utf-8');
  process.exit(0);
}
testFailedRoutes();
