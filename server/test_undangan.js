import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: '+07:00'
  });
  try {
    await pool.execute(
      `INSERT INTO undangan (id, user_id, nama_user, id_kegiatan, tempat, tanggal, nomor_surat, sifat, lampiran, perihal, kepada, 
       isi_surat, hari_tanggal_waktu, tempat_kegiatan, tanda_tangan, jabatan_penandatangan, nip, isi_penutup,
       is_uploaded_file, uploaded_file_name, uploaded_file_type, uploaded_file_data, uploaded_file_size) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['test-id-123', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, null, null, null, null]
    );
    console.log('Insert success');
    await pool.execute('DELETE FROM undangan WHERE id = ?', ['test-id-123']);
  } catch (err) {
    console.log('MySQL Error:', err.message);
  }
  process.exit(0);
})();
