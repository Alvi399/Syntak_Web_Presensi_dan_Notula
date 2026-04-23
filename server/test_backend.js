// Node.js v22 supports built-in fetch
const BASE_URL = 'http://localhost:5000';

async function runTest() {
  console.log('🚀 Memulai pengujian backend (Siklus Penuh - Dinamis)...');

  try {
    // 0. Ambil ID User Valid (Admin)
    console.log('0. Mengambil ID User Valid dari DB...');
    const resUsers = await fetch(`${BASE_URL}/api/auth/users`);
    const users = await resUsers.json();
    if (!users || users.length === 0) throw new Error('Tidak ada user di database untuk pengujian.');
    
    const validUserId = users[0].id;
    console.log('   ID Terpilih: ' + validUserId);

    // 1. Create Jadwal
    console.log('\n1. Membuat Jadwal Rapat (allowStack: true)...');
    const resJadwal = await fetch(`${BASE_URL}/api/jadwal-rapat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        judul: "Test Rapat Antigravity Final",
        deskripsi: "Final verification",
        tanggal: new Date().toISOString().split('T')[0],
        jamMulai: "12:00",
        jamSelesai: "13:00",
        tim: ["Semua"],
        peserta: ["Semua"],
        createdBy: validUserId,
        jenisKegiatan: "rapat",
        allowStack: true
      })
    });
    const dataJadwal = await resJadwal.json();
    console.log('Response Jadwal:', dataJadwal);

    if (!dataJadwal.success) throw new Error('Gagal membuat jadwal: ' + dataJadwal.message);
    const idKegiatan = dataJadwal.ids[0];

    // 2. Generate QR
    console.log('\n2. Membuat QR Code...');
    const resQr = await fetch(`${BASE_URL}/api/qr/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jenisKegiatan: "rapat",
        namaKegiatan: "Test Rapat Antigravity Final",
        idKegiatan: idKegiatan,
        createdBy: validUserId,
        createdByName: "Admin Test",
        expiresAt: "unlimited"
      })
    });
    const dataQr = await resQr.json();
    console.log('Response QR:', dataQr);

    if (!dataQr.success) throw new Error('Gagal membuat QR');
    const qrId = dataQr.id;

    // 3. Validate QR Status
    console.log('\n3. Validasi Status QR...');
    const resVal = await fetch(`${BASE_URL}/api/qr/${qrId}`);
    const dataVal = await resVal.json();
    console.log('Response Validasi:', dataVal);

    if (dataVal.success === false) {
      console.error('❌ QR Tidak Valid:', dataVal.message);
    } else {
      console.log('\n✅ Backend Berjalan Normal!');
      console.log('✅ Jadwal Terbuat: ok');
      console.log('✅ QR ID Didapat: ' + qrId);
      console.log('✅ QR Valid & Aktif: ok (Data: ' + dataVal.namaKegiatan + ')');
    }

  } catch (err) {
    console.error('❌ Terjadi kesalahan saat pengujian:', err.message);
  }
}

runTest();
