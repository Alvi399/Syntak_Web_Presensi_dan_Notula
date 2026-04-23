import fs from 'fs';

const BASE_URL = 'http://localhost:5000/api';
let DUMMY_JADWAL_ID = null;
let DUMMY_QR_ID = null;
let DUMMY_USER_ID = null;
let DUMMY_UNDANGAN_ID = null;
let DUMMY_NOTULENSI_ID = null;

const logs = [];
function addLog(status, name, extra = null) {
  logs.push({ status, name, extra });
  console.log(`${status === 'OK' ? '✅' : '❌'} [${status}] ${name}`);
}

async function check(name, requestFn) {
  try {
    const res = await requestFn();
    const isJson = res.headers.get('content-type')?.includes('application/json');
    let data;
    if (isJson) {
       data = await res.json();
    } else {
       const text = await res.text();
       addLog('FAILED', `${name} (Not JSON)`, { error: text.substring(0, 100) });
       return false;
    }
    
    if (!res.ok || (data.success === false)) {
      addLog('FAILED', name, { response: data });
      return false;
    }
    addLog('OK', name);
    return data;
  } catch (err) {
    addLog('ERROR', name, { error: err.toString() });
    return false;
  }
}

async function runTests() {
  console.log("Starting API Tests...");
  
  // 1. Init Admin
  await check('Init Admin', () => fetch(`${BASE_URL}/auth/init-admin`, { method: 'POST' }));

  // 2. Login Admin
  const loginRes = await check('Login', () => fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@absensi.com', password: 'admin123' })
  }));

  if (!loginRes) return;
  const adminId = loginRes.user?.id;
  DUMMY_USER_ID = adminId;

  // 3. Create Jadwal Rapat
  const jadwalRes = await check('Create Jadwal Rapat', () => fetch(`${BASE_URL}/jadwal-rapat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      judul: 'TEST RAPAT 123',
      deskripsi: 'INI TEST',
      tanggal: new Date(Date.now() + 7*3600*1000).toISOString().split('T')[0],
      jamMulai: '01:00',
      jamSelesai: '23:59',
      tim: ['Semua'],
      peserta: ['Semua'],
      jenisKegiatan: 'rapat',
      createdBy: adminId,
      allowStack: true
    })
  }));
  if (jadwalRes && jadwalRes.ids && jadwalRes.ids.length > 0) DUMMY_JADWAL_ID = jadwalRes.ids[0];

  // 4. Get Jadwal
  await check('Get Jadwal Rapat List', () => fetch(`${BASE_URL}/jadwal-rapat`));
  await check('Get Active Jadwal Rapat', () => fetch(`${BASE_URL}/jadwal-rapat/active`));

  // 5. Update Jadwal
  if (DUMMY_JADWAL_ID) {
    await check('Update Jadwal Rapat', () => fetch(`${BASE_URL}/jadwal-rapat/${DUMMY_JADWAL_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judul: 'TEST RAPAT UPDATED' })
    }));
  }

  // 6. Generate QR Code
  if (DUMMY_JADWAL_ID) {
    const qrRes = await check('Generate QR Code', () => fetch(`${BASE_URL}/qr/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jenisKegiatan: 'rapat',
        namaKegiatan: 'TEST RAPAT UPDATED',
        idKegiatan: DUMMY_JADWAL_ID,
        createdBy: adminId,
        createdByName: 'Admin'
      })
    }));
    if (qrRes) DUMMY_QR_ID = qrRes.id;
  }

  // 7. Get QR
  await check('Get QR List', () => fetch(`${BASE_URL}/qr`));
  if (DUMMY_QR_ID) await check('Get Specific QR', () => fetch(`${BASE_URL}/qr/${DUMMY_QR_ID}`));

  // 8. Create Absensi
  if (DUMMY_JADWAL_ID) {
    await check('Create Absensi', () => fetch(`${BASE_URL}/absensi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: adminId,
        namaUser: 'Admin Test',
        jenisKegiatan: 'rapat',
        namaKegiatan: 'TEST RAPAT UPDATED',
        idKegiatan: DUMMY_JADWAL_ID,
        signature: 'test-signature',
        statusKehadiran: 'hadir'
      })
    }));
  }
  
  await check('Get Absensi by User', () => fetch(`${BASE_URL}/absensi?userId=${adminId}`));

  // 9. Create Notulensi
  if (DUMMY_JADWAL_ID) {
    const notulRes = await check('Create Notulensi', () => fetch(`${BASE_URL}/notulensi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: adminId,
        namaUser: 'Admin Test',
        judul: 'Notulensi Test',
        jenisKegiatan: 'rapat',
        idKegiatan: DUMMY_JADWAL_ID,
        isi: 'Isi Notulensi Test',
        ringkasan: 'Test',
        hari: 'Senin',
        jam: '08:00',
        tempat: 'Aula'
      })
    }));
    
  }

  // 10. Get Notulensi
  const listNotul = await check('Get Notulensi List', () => fetch(`${BASE_URL}/notulensi`));
  if (listNotul && Array.isArray(listNotul)) {
     const myNotul = listNotul.find(n => n.judul === 'Notulensi Test');
     if (myNotul) DUMMY_NOTULENSI_ID = myNotul.id;
  }

  // 11. Create Undangan
  if (DUMMY_JADWAL_ID) {
    const undRes = await check('Create Undangan', () => fetch(`${BASE_URL}/undangan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: adminId,
        namaUser: 'Admin Test',
        idKegiatan: DUMMY_JADWAL_ID, 
        perihal: 'Undangan Test',
        nomorSurat: '001/TEST/2026',
        tempatKegiatan: 'Aula',
        tempat: 'Surabaya',
        tanggal: new Date(Date.now() + 7*3600*1000).toISOString().split('T')[0],
        sifat: 'Penting',
        kepada: 'Semua Pegawai',
        isiSurat: 'Harap hadir',
        hariTanggalWaktu: 'Senin, 08:00 WIB',
        tandaTangan: 'ttd',
        jabatanPenandatangan: 'Kepala Bidang',
        nip: '123456789',
        isiPenutup: 'Terima kasih',
        lampiran: '-'
      })
    }));
    
    // fetch the latest undangan to get ID (as POST doesn't return ID directly based on current code)
    const listUnd = await check('Get Undangan List', () => fetch(`${BASE_URL}/undangan`));
    if (listUnd && Array.isArray(listUnd)) {
      const myUnd = listUnd.find(u => u.perihal === 'Undangan Test');
      if (myUnd) DUMMY_UNDANGAN_ID = myUnd.id;
    }
  }

  // 12. Broadcast Undangan
  if (DUMMY_UNDANGAN_ID && DUMMY_JADWAL_ID) {
    // We should patch the Undangan to point to DUMMY_JADWAL_ID if it somehow failed
    await check('Update Undangan', () => fetch(`${BASE_URL}/undangan/${DUMMY_UNDANGAN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idKegiatan: DUMMY_JADWAL_ID })
    }));

    await check('Broadcast Undangan', () => fetch(`${BASE_URL}/undangan/${DUMMY_UNDANGAN_ID}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broadcasterId: adminId })
    }));
  }

  // CLEANUP DUMMY DATA
  console.log("\\n--- CLEANUP ---");
  // Clean Up manually via DB isn't possible directly over API so we'll use Delete endpoints
  if (DUMMY_UNDANGAN_ID) {
    await check('Cleanup Undangan', () => fetch(`${BASE_URL}/undangan/${DUMMY_UNDANGAN_ID}`, { method: 'DELETE' }));
  }
  if (DUMMY_NOTULENSI_ID) {
     await check('Cleanup Notulensi', () => fetch(`${BASE_URL}/notulensi/${DUMMY_NOTULENSI_ID}`, { method: 'DELETE' }));
  }
  
  if (DUMMY_JADWAL_ID) {
    await check('Cleanup Jadwal Rapat', () => fetch(`${BASE_URL}/jadwal-rapat/${DUMMY_JADWAL_ID}`, { method: 'DELETE' }));
  }
  
  fs.writeFileSync('test_result.json', JSON.stringify(logs, null, 2), 'utf-8');
  console.log('✅ End of Testing. Results saved to test_result.json');
  process.exit(0);
}

runTests();
