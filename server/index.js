import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'absensi_notulensi',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
  });

// ============================================
// AUTH ROUTES
// ============================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nama, email, password, kategori } = req.body;

    // Check if email exists
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = randomUUID();

    // Insert user
    await pool.execute(
      `INSERT INTO users (id, nama, email, password, kategori, role, tanggal_daftar) 
       VALUES (?, ?, ?, ?, ?, 'user', NOW())`,
      [id, nama, email, hashedPassword, kategori]
    );

    res.json({ success: true, message: 'Registrasi berhasil' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registrasi gagal' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    // Check if blocked
    if (user.is_blocked) {
      if (user.blocked_until) {
        const now = new Date();
        const unblockTime = new Date(user.blocked_until);

        if (now >= unblockTime) {
          // Auto unblock
          await pool.execute(
            'UPDATE users SET is_blocked = 0, block_reason = NULL, block_note = NULL, blocked_until = NULL WHERE id = ?',
            [user.id]
          );
          user.is_blocked = false;
        } else {
          return res.status(403).json({
            success: false,
            message: `Akun Anda diblokir sampai ${unblockTime.toLocaleString('id-ID')}. Alasan: ${user.block_reason || 'Tidak ada'}`
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'Akun Anda diblokir. Hubungi administrator untuk informasi lebih lanjut.'
        });
      }
    }

    // Format user response (remove password)
    const userResponse = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      kategori: user.kategori,
      role: user.role,
      tanggalDaftar: user.tanggal_daftar,
      isBlocked: user.is_blocked,
      blockReason: user.block_reason,
      blockNote: user.block_note,
      blockedUntil: user.blocked_until
    };

    res.json({ success: true, message: 'Login berhasil', user: userResponse });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login gagal' });
  }
});

// Get all users (admin only)
app.get('/api/auth/users', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT * FROM users ORDER BY created_at DESC'
    );

    const formattedUsers = users.map(user => ({
      id: user.id,
      nama: user.nama,
      email: user.email,
      kategori: user.kategori,
      role: user.role,
      tanggalDaftar: user.tanggal_daftar,
      isBlocked: user.is_blocked,
      blockReason: user.block_reason,
      blockNote: user.block_note,
      blockedUntil: user.blocked_until
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data users' });
  }
});

// Update user
app.put('/api/auth/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updateFields = [];
    const updateValues = [];

    if (updates.nama !== undefined) {
      updateFields.push('nama = ?');
      updateValues.push(updates.nama);
    }
    if (updates.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(updates.email);
    }
    if (updates.password !== undefined) {
      const hashedPassword = await bcrypt.hash(updates.password, 10);
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
    }
    if (updates.kategori !== undefined) {
      updateFields.push('kategori = ?');
      updateValues.push(updates.kategori);
    }
    if (updates.role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(updates.role);
    }
    if (updates.isBlocked !== undefined) {
      updateFields.push('is_blocked = ?');
      updateValues.push(updates.isBlocked);
    }
    if (updates.blockReason !== undefined) {
      updateFields.push('block_reason = ?');
      updateValues.push(updates.blockReason);
    }
    if (updates.blockNote !== undefined) {
      updateFields.push('block_note = ?');
      updateValues.push(updates.blockNote);
    }
    if (updates.blockedUntil !== undefined) {
      updateFields.push('blocked_until = ?');
      updateValues.push(updates.blockedUntil);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Gagal update user' });
  }
});

// Delete user
app.delete('/api/auth/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Gagal hapus user' });
  }
});

// Block user
app.post('/api/auth/users/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;

    const now = new Date();
    let blockedUntil;

    if (reason === 'izin-telat') {
      const unblockTime = new Date(now);
      unblockTime.setHours(15, 0, 0, 0);
      if (now.getHours() >= 15) {
        unblockTime.setDate(unblockTime.getDate() + 1);
      }
      blockedUntil = unblockTime.toISOString();
    } else {
      const unblockTime = new Date(now);
      unblockTime.setDate(unblockTime.getDate() + 1);
      unblockTime.setHours(0, 0, 0, 0);
      blockedUntil = unblockTime.toISOString();
    }

    await pool.execute(
      'UPDATE users SET is_blocked = 1, block_reason = ?, block_note = ?, blocked_until = ? WHERE id = ?',
      [reason, note || '', blockedUntil, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ success: false, message: 'Gagal blokir user' });
  }
});

// Unblock user
app.post('/api/auth/users/:id/unblock', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute(
      'UPDATE users SET is_blocked = 0, block_reason = NULL, block_note = NULL, blocked_until = NULL WHERE id = ?',
      [id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ success: false, message: 'Gagal buka blokir user' });
  }
});

// Get activities
app.get('/api/auth/activities', async (req, res) => {
  try {
    const [activities] = await pool.execute(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100'
    );

    const formatted = activities.map(activity => ({
      id: activity.id,
      userId: activity.user_id,
      namaUser: activity.nama_user,
      aktivitas: activity.aktivitas,
      tanggal: new Date(activity.tanggal).toLocaleDateString('id-ID'),
      waktu: activity.waktu
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil activities' });
  }
});

// Delete activity
app.delete('/api/auth/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM activity_logs WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ success: false, message: 'Gagal hapus activity' });
  }
});

// Delete all activities
app.delete('/api/auth/activities', async (req, res) => {
  try {
    await pool.execute('DELETE FROM activity_logs');
    res.json({ success: true });
  } catch (error) {
    console.error('Delete all activities error:', error);
    res.status(500).json({ success: false, message: 'Gagal hapus semua activities' });
  }
});

// ============================================
// ABSENSI ROUTES
// ============================================

// Save absensi
app.post('/api/absensi', async (req, res) => {
  try {
    const { userId, namaUser, jenisKegiatan, namaKegiatan, signature } = req.body;

    const now = new Date();
    const tanggal = now.toISOString().split('T')[0];
    const waktu = now.toTimeString().split(' ')[0];

    const id = randomUUID();

    await pool.execute(
      `INSERT INTO absensi (id, user_id, nama_user, jenis_kegiatan, nama_kegiatan, tanggal, waktu, signature, status, is_guest) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'hadir', 0)`,
      [id, userId, namaUser, jenisKegiatan, namaKegiatan, tanggal, waktu, signature]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save absensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan absensi' });
  }
});

// Save guest absensi
app.post('/api/absensi/guest', async (req, res) => {
  try {
    const { nama, instansi, jenisKegiatan, namaKegiatan, signature } = req.body;

    const now = new Date();
    const tanggal = now.toISOString().split('T')[0];
    const waktu = now.toTimeString().split(' ')[0];

    const id = randomUUID();

    await pool.execute(
      `INSERT INTO absensi (id, user_id, nama_user, jenis_kegiatan, nama_kegiatan, tanggal, waktu, signature, status, instansi, is_guest) 
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'hadir', ?, 1)`,
      [id, nama, jenisKegiatan, namaKegiatan, tanggal, waktu, signature, instansi]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save guest absensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan absensi tamu' });
  }
});

// Get absensi list
app.get('/api/absensi', async (req, res) => {
  try {
    const { today, month, userId } = req.query;

    let query = 'SELECT * FROM absensi WHERE 1=1';
    const params = [];

    if (today === 'true') {
      query += ' AND tanggal = CURDATE()';
    } else if (month === 'true') {
      query += ' AND YEAR(tanggal) = YEAR(CURDATE()) AND MONTH(tanggal) = MONTH(CURDATE())';
    }

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const [absensi] = await pool.execute(query, params);

    const formatted = absensi.map(item => ({
      id: item.id,
      userId: item.user_id || 'guest',
      namaUser: item.nama_user,
      jenisKegiatan: item.jenis_kegiatan,
      namaKegiatan: item.nama_kegiatan || '',
      tanggal: new Date(item.tanggal).toLocaleDateString('id-ID'),
      waktu: item.waktu.substring(0, 5),
      signature: item.signature,
      status: item.status,
      instansi: item.instansi,
      isGuest: item.is_guest
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get absensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data absensi' });
  }
});

// Delete absensi
app.delete('/api/absensi/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM absensi WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete absensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal hapus absensi' });
  }
});

// Delete all absensi
app.delete('/api/absensi', async (req, res) => {
  try {
    await pool.execute('DELETE FROM absensi');
    res.json({ success: true });
  } catch (error) {
    console.error('Delete all absensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal hapus semua absensi' });
  }
});

// ============================================
// NOTULENSI ROUTES
// ============================================

// Save notulensi
app.post('/api/notulensi', async (req, res) => {
  try {
    const { userId, namaUser, judul, jenisKegiatan, isi, foto, hari, jam, tempat, agenda, signature, pemandu } = req.body;

    const now = new Date();
    const tanggal = now.toISOString().split('T')[0];
    const waktu = now.toTimeString().split(' ')[0];

    const id = randomUUID();

    await pool.execute(
      `INSERT INTO notulensi (id, user_id, nama_user, judul, jenis_kegiatan, isi, tanggal, waktu, foto, hari, jam, tempat, agenda, signature, pemandu) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, namaUser, judul, jenisKegiatan, isi, tanggal, waktu, foto, hari, jam, tempat, agenda, signature, pemandu]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save notulensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan notulensi' });
  }
});

// Get notulensi list
app.get('/api/notulensi', async (req, res) => {
  try {
    const { today, month } = req.query;

    let query = 'SELECT * FROM notulensi WHERE 1=1';
    const params = [];

    if (today === 'true') {
      query += ' AND tanggal = CURDATE()';
    } else if (month === 'true') {
      query += ' AND YEAR(tanggal) = YEAR(CURDATE()) AND MONTH(tanggal) = MONTH(CURDATE())';
    }

    query += ' ORDER BY created_at DESC';

    const [notulensi] = await pool.execute(query, params);

    const formatted = notulensi.map(item => ({
      id: item.id,
      userId: item.user_id,
      namaUser: item.nama_user,
      judul: item.judul,
      jenisKegiatan: item.jenis_kegiatan,
      isi: item.isi,
      tanggal: new Date(item.tanggal).toLocaleDateString('id-ID'),
      waktu: item.waktu.substring(0, 5),
      foto: item.foto,
      hari: item.hari,
      jam: item.jam,
      tempat: item.tempat,
      agenda: item.agenda,
      signature: item.signature,
      pemandu: item.pemandu
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get notulensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data notulensi' });
  }
});

// Update notulensi
app.put('/api/notulensi/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updateFields = [];
    const updateValues = [];

    if (updates.judul !== undefined) {
      updateFields.push('judul = ?');
      updateValues.push(updates.judul);
    }
    if (updates.jenisKegiatan !== undefined) {
      updateFields.push('jenis_kegiatan = ?');
      updateValues.push(updates.jenisKegiatan);
    }
    if (updates.isi !== undefined) {
      updateFields.push('isi = ?');
      updateValues.push(updates.isi);
    }
    if (updates.foto !== undefined) {
      updateFields.push('foto = ?');
      updateValues.push(updates.foto);
    }
    if (updates.hari !== undefined) {
      updateFields.push('hari = ?');
      updateValues.push(updates.hari);
    }
    if (updates.jam !== undefined) {
      updateFields.push('jam = ?');
      updateValues.push(updates.jam);
    }
    if (updates.tempat !== undefined) {
      updateFields.push('tempat = ?');
      updateValues.push(updates.tempat);
    }
    if (updates.agenda !== undefined) {
      updateFields.push('agenda = ?');
      updateValues.push(updates.agenda);
    }
    if (updates.signature !== undefined) {
      updateFields.push('signature = ?');
      updateValues.push(updates.signature);
    }
    if (updates.pemandu !== undefined) {
      updateFields.push('pemandu = ?');
      updateValues.push(updates.pemandu);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    await pool.execute(
      `UPDATE notulensi SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update notulensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal update notulensi' });
  }
});

// Delete notulensi
app.delete('/api/notulensi/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM notulensi WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete notulensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal hapus notulensi' });
  }
});

// Delete all notulensi
app.delete('/api/notulensi', async (req, res) => {
  try {
    await pool.execute('DELETE FROM notulensi');
    res.json({ success: true });
  } catch (error) {
    console.error('Delete all notulensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal hapus semua notulensi' });
  }
});

// ============================================
// UNDANGAN ROUTES
// ============================================

// Save undangan
app.post('/api/undangan', async (req, res) => {
  try {
    const {
      userId, namaUser, tempat, tanggal, nomorSurat, sifat, lampiran, perihal, kepada,
      isiSurat, hariTanggalWaktu, tempatKegiatan, tandaTangan, jabatanPenandatangan,
      nip, isiPenutup, isUploadedFile, uploadedFileName, uploadedFileType,
      uploadedFileData, uploadedFileSize
    } = req.body;

    const id = randomUUID();

    // Tambahkan log ini tepat sebelum pool.execute (baris 640-an)
    console.log('DEBUG: Mencoba simpan undangan...');
    console.log('Data yang masuk:', {
      id, userId, namaUser, perihal,
      fotoLength: uploadedFileData ? uploadedFileData.length : 0,
      signLength: tandaTangan ? tandaTangan.length : 0
    });

    await pool.execute(
      `INSERT INTO undangan ...`,
      [id, userId, namaUser, tempat, tanggal, nomorSurat, sifat, lampiran, perihal, kepada,
        isiSurat, hariTanggalWaktu, tempatKegiatan, tandaTangan, jabatanPenandatangan,
        nip, isiPenutup, isUploadedFile || false, uploadedFileName, uploadedFileType,
        uploadedFileData, uploadedFileSize]
    );

    await pool.execute(
      `INSERT INTO undangan (id, user_id, nama_user, tempat, tanggal, nomor_surat, sifat, lampiran, perihal, kepada, 
       isi_surat, hari_tanggal_waktu, tempat_kegiatan, tanda_tangan, jabatan_penandatangan, nip, isi_penutup,
       is_uploaded_file, uploaded_file_name, uploaded_file_type, uploaded_file_data, uploaded_file_size) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, namaUser, tempat, tanggal, nomorSurat, sifat, lampiran, perihal, kepada,
        isiSurat, hariTanggalWaktu, tempatKegiatan, tandaTangan, jabatanPenandatangan,
        nip, isiPenutup, isUploadedFile || false, uploadedFileName, uploadedFileType,
        uploadedFileData, uploadedFileSize]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save undangan error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan undangan' });
  }
});

// Get undangan list
app.get('/api/undangan', async (req, res) => {
  try {
    const [undangan] = await pool.execute(
      'SELECT * FROM undangan ORDER BY created_at DESC'
    );

    const formatted = undangan.map(item => ({
      id: item.id,
      userId: item.user_id,
      namaUser: item.nama_user,
      tempat: item.tempat,
      tanggal: item.tanggal,
      nomorSurat: item.nomor_surat,
      sifat: item.sifat,
      lampiran: item.lampiran,
      perihal: item.perihal,
      kepada: item.kepada,
      isiSurat: item.isi_surat,
      hariTanggalWaktu: item.hari_tanggal_waktu,
      tempatKegiatan: item.tempat_kegiatan,
      tandaTangan: item.tanda_tangan,
      jabatanPenandatangan: item.jabatan_penandatangan,
      nip: item.nip,
      createdAt: item.created_at,
      isiPenutup: item.isi_penutup,
      isUploadedFile: item.is_uploaded_file,
      uploadedFileName: item.uploaded_file_name,
      uploadedFileType: item.uploaded_file_type,
      uploadedFileData: item.uploaded_file_data,
      uploadedFileSize: item.uploaded_file_size
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get undangan error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data undangan' });
  }
});

// Update undangan
app.put('/api/undangan/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updateFields = [];
    const updateValues = [];

    const fieldMap = {
      tempat: 'tempat',
      tanggal: 'tanggal',
      nomorSurat: 'nomor_surat',
      sifat: 'sifat',
      lampiran: 'lampiran',
      perihal: 'perihal',
      kepada: 'kepada',
      isiSurat: 'isi_surat',
      hariTanggalWaktu: 'hari_tanggal_waktu',
      tempatKegiatan: 'tempat_kegiatan',
      tandaTangan: 'tanda_tangan',
      jabatanPenandatangan: 'jabatan_penandatangan',
      nip: 'nip',
      isiPenutup: 'isi_penutup'
    };

    Object.keys(fieldMap).forEach(key => {
      if (updates[key] !== undefined) {
        updateFields.push(`${fieldMap[key]} = ?`);
        updateValues.push(updates[key]);
      }
    });

    updateValues.push(id);

    await pool.execute(
      `UPDATE undangan SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update undangan error:', error);
    res.status(500).json({ success: false, message: 'Gagal update undangan' });
  }
});

// Delete undangan
app.delete('/api/undangan/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM undangan WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete undangan error:', error);
    res.status(500).json({ success: false, message: 'Gagal hapus undangan' });
  }
});

// ============================================
// QR CODE ROUTES
// ============================================

// Generate QR code
app.post('/api/qr/generate', async (req, res) => {
  try {
    const { jenisKegiatan, namaKegiatan, createdBy, createdByName } = req.body;

    const id = randomUUID();

    await pool.execute(
      `INSERT INTO qr_absensi_codes (id, jenis_kegiatan, nama_kegiatan, created_by, created_by_name, is_active) 
       VALUES (?, ?, ?, ?, ?, 1)`,
      [id, jenisKegiatan, namaKegiatan, createdBy, createdByName]
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ success: false, message: 'Gagal generate QR code' });
  }
});

// Get active QR code for user
app.get('/api/qr/active', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const [codes] = await pool.execute(
      'SELECT * FROM qr_absensi_codes WHERE created_by = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (codes.length === 0) {
      return res.json({ success: true, active: null });
    }

    const item = codes[0];
    res.json({
      success: true,
      active: {
        id: item.id,
        jenisKegiatan: item.jenis_kegiatan,
        namaKegiatan: item.nama_kegiatan || '',
        createdBy: item.created_by,
        createdByName: item.created_by_name,
        createdAt: item.created_at,
        expiresAt: item.expires_at,
        isActive: item.is_active
      }
    });
  } catch (error) {
    console.error('Get active QR error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil active QR code' });
  }
});

// Get QR codes
app.get('/api/qr', async (req, res) => {
  try {
    const [codes] = await pool.execute(
      'SELECT * FROM qr_absensi_codes ORDER BY created_at DESC'
    );

    const formatted = codes.map(item => ({
      id: item.id,
      jenisKegiatan: item.jenis_kegiatan,
      namaKegiatan: item.nama_kegiatan || '',
      createdBy: item.created_by,
      createdByName: item.created_by_name,
      createdAt: item.created_at,
      expiresAt: item.expires_at,
      isActive: item.is_active
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get QR codes error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil QR codes' });
  }
});

// Get QR code by ID
app.get('/api/qr/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [codes] = await pool.execute(
      'SELECT * FROM qr_absensi_codes WHERE id = ?',
      [id]
    );

    if (codes.length === 0) {
      return res.status(404).json({ success: false, message: 'QR code tidak ditemukan' });
    }

    const item = codes[0];
    res.json({
      id: item.id,
      jenisKegiatan: item.jenis_kegiatan,
      namaKegiatan: item.nama_kegiatan || '',
      createdBy: item.created_by,
      createdByName: item.created_by_name,
      createdAt: item.created_at,
      expiresAt: item.expires_at,
      isActive: item.is_active
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil QR code' });
  }
});

// Deactivate QR code
app.put('/api/qr/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE qr_absensi_codes SET is_active = 0 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Deactivate QR error:', error);
    res.status(500).json({ success: false, message: 'Gagal deactivate QR code' });
  }
});

// Initialize admin user
app.post('/api/auth/init-admin', async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      ['admin@absensi.com']
    );

    if (existing.length > 0) {
      return res.json({ success: true, message: 'Admin sudah ada' });
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    const id = randomUUID();

    await pool.execute(
      `INSERT INTO users (id, nama, email, password, kategori, role, tanggal_daftar) 
       VALUES (?, 'Administrator', 'admin@absensi.com', ?, 'Pegawai', 'admin', NOW())`,
      [id, hashedPassword]
    );

    res.json({ success: true, message: 'Admin berhasil dibuat' });
  } catch (error) {
    console.error('Init admin error:', error);
    res.status(500).json({ success: false, message: 'Gagal membuat admin' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

