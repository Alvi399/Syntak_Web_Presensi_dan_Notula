import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import otpGenerator from 'otp-generator';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

// Helper to format date in local timezone (YYYY-MM-DD)
function formatDateLocal(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

// Email transporter (Hostinger SMTP) dengan connection pool untuk handle banyak user
const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 587,
  secure: false,
  pool: true,           // ← gunakan connection pool
  maxConnections: 5,    // ← maksimal 5 koneksi SMTP paralel
  maxMessages: 100,     // ← maks pesan per koneksi
  auth: {
    user: process.env.EMAIL_USER || 'admin_server@bpskotasurabaya.com',
    pass: process.env.EMAIL_PASS || ''
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Fire-and-forget email sender — tidak block response API
const sendOtpEmail = (toEmail, otp) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[EMAIL] ⚠️  EMAIL_USER/PASS tidak diset, email tidak dikirim.');
    return;
  }

  // Kirim tanpa await — response API tidak perlu tunggu email selesai
  transporter.sendMail({
    from: `"Sistem Presensi BPS" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Kode OTP Verifikasi Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1d4ed8; margin: 0;">Verifikasi Email</h2>
          <p style="color: #6b7280; margin: 8px 0 0;">BPS Kota Surabaya</p>
        </div>
        <p style="color: #374151;">Berikut adalah kode OTP Anda:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #1d4ed8; background: #eff6ff; padding: 12px 24px; border-radius: 8px;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Kode ini berlaku selama <strong>5 menit</strong>.</p>
        <p style="color: #6b7280; font-size: 14px;">Jika Anda tidak meminta kode ini, abaikan email ini.</p>
      </div>
    `
  }).then(info => {
    console.log(`[EMAIL] ✅ OTP terkirim ke ${toEmail}. ID: ${info.messageId}`);
  }).catch(err => {
    console.error(`[EMAIL] ❌ Gagal kirim ke ${toEmail}:`, err.message);
  });
};

// Create OTP table if not exists
const createOtpTable = async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS otps (
        id VARCHAR(36) NOT NULL,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL,
        is_verified TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_otp_email (email),
        INDEX idx_otp_expires (expires_at)
      )
    `);
    console.log('✅ OTP table ready');
  } catch (error) {
    console.error('❌ Failed to create OTP table:', error);
  }
};

// Migrate OTP table — fix column names if table was created with different schema
const migrateOtpTable = async () => {
  try {
    const [cols] = await pool.execute("SHOW COLUMNS FROM otps");
    const colNames = cols.map(c => c.Field);

    // If column is named 'code' or 'otp' instead of 'otp_code', rename it
    if (colNames.includes('code') && !colNames.includes('otp_code')) {
      await pool.execute('ALTER TABLE otps CHANGE COLUMN `code` `otp_code` VARCHAR(6) NOT NULL');
      console.log('✅ OTP table migrated: renamed code → otp_code');
    } else if (colNames.includes('otp') && !colNames.includes('otp_code')) {
      await pool.execute('ALTER TABLE otps CHANGE COLUMN `otp` `otp_code` VARCHAR(6) NOT NULL');
      console.log('✅ OTP table migrated: renamed otp → otp_code');
    } else if (colNames.includes('otp_codeTargetFileType')) {
      await pool.execute('ALTER TABLE otps CHANGE COLUMN `otp_codeTargetFileType` `otp_code` VARCHAR(6) NOT NULL');
      console.log('✅ OTP table migrated: fixed corrupted column otp_codeTargetFileType → otp_code');
    }

    // Add is_verified column if missing
    if (!colNames.includes('is_verified')) {
      await pool.execute('ALTER TABLE otps ADD COLUMN is_verified TINYINT(1) DEFAULT 0');
      console.log('✅ OTP table migrated: added is_verified column');
    }
  } catch (error) {
    // Table may not exist yet (handled by createOtpTable), ignore
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('OTP table migration error:', error.message);
    }
  }
};

// Add tim and jabatan columns to users if not exists (migration)
const migrateUsersTable = async () => {
  try {
    await pool.execute(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS tim VARCHAR(255) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS jabatan VARCHAR(255) DEFAULT NULL
    `);
    console.log('✅ Users table migrated (tim + jabatan columns ready)');
  } catch (error) {
    // Column might already exist, ignore
    console.log('ℹ️ Users table migration skipped (columns may already exist)');
  }
};

// Create jadwal_rapat table if not exists
const createJadwalRapatTable = async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS jadwal_rapat (
        id VARCHAR(36) NOT NULL,
        judul VARCHAR(255) NOT NULL,
        deskripsi TEXT,
        tanggal DATE NOT NULL,
        jam_mulai TIME NOT NULL,
        jam_selesai TIME NOT NULL,
        tim JSON NOT NULL,
        peserta JSON NOT NULL,
        repeat_type ENUM('none','daily','weekly','custom') DEFAULT 'none',
        repeat_days JSON,
        repeat_until DATE,
        allow_stack TINYINT(1) DEFAULT 0,
        open_offset_minutes INT DEFAULT 0,
        close_offset_minutes INT DEFAULT 0,
        lateness_threshold_minutes INT DEFAULT 60,
        jenis_kegiatan VARCHAR(50) DEFAULT 'rapat',
        created_by VARCHAR(36) NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_jadwal_tanggal (tanggal),
        INDEX idx_jadwal_active (is_active),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Jadwal Rapat table ready');
  } catch (error) {
    console.error('❌ Failed to create jadwal_rapat table:', error);
  }
};

const migrateJadwalRapatTable = async () => {
  try {
    await pool.execute(`
      ALTER TABLE jadwal_rapat 
      ADD COLUMN IF NOT EXISTS allow_stack TINYINT(1) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS open_offset_minutes INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS close_offset_minutes INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lateness_threshold_minutes INT DEFAULT 60,
      ADD COLUMN IF NOT EXISTS jenis_kelpersahaan VARCHAR(50) DEFAULT 'rapat',
      ADD COLUMN IF NOT EXISTS peserta_mode VARCHAR(30) DEFAULT 'akun',
      ADD COLUMN IF NOT EXISTS peserta_spesifik JSON DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS active_qr_id VARCHAR(36) DEFAULT NULL
    `);
    console.log('✅ Jadwal Rapat table migrated (absen config + jenis_kelpersahaan + peserta_mode + active_qr_id ready)');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ jadwal_rapat table migration check (columns may already exist)', error.message);
    }
  }
};

const migrateAbsensiTable = async () => {
  try {
    await pool.execute("ALTER TABLE absensi ADD COLUMN status_kehadiran ENUM('hadir', 'terlambat') DEFAULT 'hadir'");
    console.log('✅ absensi table migrated (status_kehadiran column ready)');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ absensi table migration check (columns may already exist)', error.message);
    }
  }
};

// Remove FK constraint on qr_absensi_codes.id_kegiatan if it exists
// This constraint causes ER_NO_REFERENCED_ROW_2 when id_kegiatan UUID is not in jadwal_rapat
const migrateQRAbsensiCodes = async () => {
  try {
    // Get foreign key name for qr_absensi_codes.id_kegiatan
    const [fkRows] = await pool.execute(`
      SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'qr_absensi_codes'
        AND COLUMN_NAME = 'id_kegiatan'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    for (const fk of fkRows) {
      await pool.execute(`ALTER TABLE qr_absensi_codes DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      console.log(`✅ Dropped FK constraint ${fk.CONSTRAINT_NAME} from qr_absensi_codes`);
    }
    if (fkRows.length === 0) {
      console.log('✅ qr_absensi_codes: no FK constraint to drop (already clean)');
    }
  } catch (error) {
    console.log('ℹ️ qr_absensi_codes FK migration skipped:', error.message);
  }
};

// Create notifications table
const createNotificationsTable = async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'info',
        title VARCHAR(255) NOT NULL,
        message TEXT,
        ref_id VARCHAR(36) DEFAULT NULL,
        ref_type VARCHAR(50) DEFAULT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_notif_user_id (user_id),
        INDEX idx_notif_is_read (is_read),
        INDEX idx_notif_created_at (created_at)
      )
    `);
    console.log('✅ Notifications table ready');
  } catch (error) {
    console.error('❌ Failed to create notifications table:', error);
  }
};

// ============================================
// SSE (Server-Sent Events) Infrastructure
// ============================================

// Map of userId → array of SSE response objects
const sseClients = new Map();

// Register an SSE client
const addSseClient = (userId, res) => {
  if (!sseClients.has(userId)) sseClients.set(userId, []);
  sseClients.get(userId).push(res);
};

// Remove an SSE client
const removeSseClient = (userId, res) => {
  if (!sseClients.has(userId)) return;
  const clients = sseClients.get(userId).filter(c => c !== res);
  if (clients.length === 0) sseClients.delete(userId);
  else sseClients.set(userId, clients);
};

// Emit SSE event to specific user(s) or all users
const emitSse = (event, data, targetUserIds = null) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  if (targetUserIds === null) {
    // Broadcast to all connected clients
    for (const clients of sseClients.values()) {
      clients.forEach(res => { try { res.write(payload); } catch {} });
    }
  } else {
    // Send only to specified user IDs
    targetUserIds.forEach(uid => {
      const clients = sseClients.get(uid) || [];
      clients.forEach(res => { try { res.write(payload); } catch {} });
    });
  }
};

createOtpTable();
migrateOtpTable();
migrateUsersTable();
createJadwalRapatTable();
migrateJadwalRapatTable();
migrateAbsensiTable();
migrateQRAbsensiCodes();
createNotificationsTable();

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

// Send OTP to email
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email diperlukan' });
    }

    // Check if email already registered
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });
    }

    // Generate OTP
    // Generate OTP - manual numeric only to be 100% sure
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete old OTPs for this email
    await pool.execute('DELETE FROM otps WHERE email = ?', [email]);

    // Insert new OTP
    await pool.execute(
      'INSERT INTO otps (id, email, otp_code, expires_at) VALUES (?, ?, ?, ?)',
      [id, email, otp, expiresAt]
    );

    // Kirim email secara async (fire-and-forget) — tidak block response
    sendOtpEmail(email, otp);

    console.log(`[OTP DEBUG] OTP untuk ${email}: ${otp}`);

    // Langsung respond tanpa tunggu email selesai
    res.json({ success: true, message: 'OTP dikirim ke email', expiresAt });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengirim OTP' });
  }
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email dan OTP diperlukan' });
    }

    // Find valid OTP
    const [otps] = await pool.execute(
      'SELECT * FROM otps WHERE email = ? AND otp_code = ? AND expires_at > NOW() AND is_verified = 0 ORDER BY created_at DESC LIMIT 1',
      [email, otp]
    );

    if (otps.length === 0) {
      return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah expired' });
    }

    // Mark OTP as verified
    await pool.execute(
      'UPDATE otps SET is_verified = 1 WHERE id = ?',
      [otps[0].id]
    );

    res.json({ success: true, message: 'OTP terverifikasi' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Gagal verifikasi OTP' });
  }
});

// Register with OTP verification
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nama, email, password, kategori, tim, otp, role } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email dan OTP diperlukan' });
    }

    // Check if OTP is 'ADMIN' (bypass for admin panel)
    if (otp !== 'ADMIN') {
      // Check if OTP is verified
      const [otps] = await pool.execute(
        'SELECT * FROM otps WHERE email = ? AND is_verified = 1 ORDER BY created_at DESC LIMIT 1',
        [email]
      );

      if (otps.length === 0) {
        return res.status(400).json({ success: false, message: 'OTP belum diverifikasi' });
      }
    }

    // Check if email exists
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });
    }

    // If nama/password not provided, just verify email is ready
    if (!nama || !password) {
      return res.json({ success: true, message: 'Email terverifikasi, lanjutkan registrasi' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = randomUUID();

    // Set default jabatan based on kategori
    const defaultJabatan = kategori === 'Magang' ? 'Mahasiswa' : null;

    // Insert user
    await pool.execute(
      `INSERT INTO users (id, nama, email, password, kategori, tim, jabatan, role, tanggal_daftar) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, nama, email, hashedPassword, kategori, tim || null, defaultJabatan, role || 'user']
    );

    // Delete used OTP if not bypass
    if (otp !== 'ADMIN') {
      await pool.execute('DELETE FROM otps WHERE email = ?', [email]);
    }

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
      tim: user.tim,
      jabatan: user.jabatan,
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
      tim: user.tim,
      jabatan: user.jabatan,
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

// Update profile (nama, tim, jabatan) - for self-edit by user
app.put('/api/auth/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, tim, jabatan } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (nama !== undefined) {
      updateFields.push('nama = ?');
      updateValues.push(nama);
    }
    if (tim !== undefined) {
      updateFields.push('tim = ?');
      updateValues.push(tim || null);
    }
    if (jabatan !== undefined) {
      updateFields.push('jabatan = ?');
      updateValues.push(jabatan || null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah' });
    }

    updateValues.push(id);
    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Return updated user data
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    const updatedUser = rows[0];
    const userResponse = {
      id: updatedUser.id,
      nama: updatedUser.nama,
      email: updatedUser.email,
      kategori: updatedUser.kategori,
      tim: updatedUser.tim,
      jabatan: updatedUser.jabatan,
      role: updatedUser.role,
      tanggalDaftar: updatedUser.tanggal_daftar,
      isBlocked: updatedUser.is_blocked,
      blockReason: updatedUser.block_reason,
      blockNote: updatedUser.block_note,
      blockedUntil: updatedUser.blocked_until
    };

    res.json({ success: true, message: 'Profil berhasil diperbarui', user: userResponse });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui profil' });
  }
});

// Get users by kategori (for specific attendee selection)
app.get('/api/users/by-kategori', async (req, res) => {
  try {
    const { kategori } = req.query;
    let query = 'SELECT id, nama, email, kategori, tim, role FROM users WHERE (is_blocked = 0 OR is_blocked IS NULL)';
    const params = [];
    if (kategori) {
      query += ' AND kategori = ?';
      params.push(kategori);
    }
    query += ' ORDER BY nama ASC';
    const [users] = await pool.execute(query, params);
    res.json(users.map(u => ({ id: u.id, nama: u.nama, email: u.email, kategori: u.kategori, tim: u.tim, role: u.role })));
  } catch (error) {
    console.error('Get users by kategori error:', error);
    res.status(500).json([]);
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
    if (updates.tim !== undefined) {
      updateFields.push('tim = ?');
      updateValues.push(updates.tim);
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
    const { userId, namaUser, jenisKegiatan, namaKegiatan, signature, idKegiatan } = req.body;

    const now = new Date();
    const tanggal = now.toISOString().split('T')[0];
    const waktu = now.toTimeString().split(' ')[0];

    // Check for duplicate attendance
    const [existing] = await pool.execute(
      'SELECT id FROM absensi WHERE user_id = ? AND (id_kegiatan = ? OR (nama_kegiatan = ? AND tanggal = ?))',
      [userId, idKegiatan || null, namaKegiatan, tanggal]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Anda sudah melakukan presensi untuk kegiatan ini hari ini.' 
      });
    }

    const id = randomUUID();

    // Check for lateness and session validity if idKegiatan is provided
    let statusKehadiran = 'hadir';
    if (idKegiatan) {
      const [jadwal] = await pool.execute(
        'SELECT jam_mulai, jam_selesai, lateness_threshold_minutes, tanggal, peserta_mode, peserta_spesifik FROM jadwal_rapat WHERE id = ?',
        [idKegiatan]
      );
      
      if (jadwal.length > 0) {
        const j = jadwal[0];

        // 1. Participant Validation (Specific User Check)
        const pSpesifik = j.peserta_spesifik ? (typeof j.peserta_spesifik === 'string' ? JSON.parse(j.peserta_spesifik) : j.peserta_spesifik) : null;
        if (pSpesifik && pSpesifik.length > 0 && !pSpesifik.includes(userId)) {
          return res.status(403).json({ 
            success: false, 
            message: 'Maaf, Anda tidak terdaftar sebagai peserta spesifik untuk kegiatan ini.' 
          });
        }

        const jTanggal = formatDateLocal(j.tanggal);
        const startDt = new Date(`${jTanggal}T${j.jam_mulai}`);
        const endDt = new Date(`${jTanggal}T${j.jam_selesai}`);
        
        // Strict session check: Can't attend if past end time (even if QR is active)
        if (now > endDt) {
          return res.status(400).json({ 
            success: false, 
            message: 'Kegiatan ini sudah berakhir. Sesi presensi telah ditutup.' 
          });
        }

        const latenessThreshold = j.lateness_threshold_minutes || 60;
        const latenessTime = new Date(startDt.getTime() + (latenessThreshold * 60000));
        
        if (now > latenessTime) {
          statusKehadiran = 'terlambat';
        }
      }
    }

    await pool.execute(
      `INSERT INTO absensi (id, user_id, nama_user, jenis_kegiatan, nama_kegiatan, id_kegiatan, tanggal, waktu, signature, status, is_guest, status_kehadiran) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'hadir', 0, ?)`,
      [id, userId, namaUser, jenisKegiatan, namaKegiatan, idKegiatan || null, tanggal, waktu, signature, statusKehadiran]
    );

    res.json({ success: true, message: 'Presensi berhasil disimpan' });
  } catch (error) {
    console.error('Save absensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan absensi' });
  }
});

// Save guest absensi
app.post('/api/absensi/guest', async (req, res) => {
  try {
    const { nama, instansi, email, jenisKegiatan, namaKegiatan, signature, idKegiatan } = req.body;

    const now = new Date();
    const tanggal = now.toISOString().split('T')[0];
    const waktu = now.toTimeString().split(' ')[0];

    // Check for duplicate guest attendance (by email and activity)
    if (email) {
      const [existing] = await pool.execute(
        'SELECT id FROM absensi WHERE nama_user = ? AND instansi = ? AND (id_kegiatan = ? OR (nama_kegiatan = ? AND tanggal = ?))',
        [nama, instansi, idKegiatan || null, namaKegiatan, tanggal]
      );

      if (existing.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Anda sudah melakukan presensi untuk kegiatan ini.' 
        });
      }
    }

    const id = randomUUID();

    // Check for lateness and session validity if idKegiatan is provided
    let statusKehadiran = 'hadir';
    if (idKegiatan) {
      const [jadwal] = await pool.execute(
        'SELECT jam_mulai, jam_selesai, lateness_threshold_minutes, tanggal, peserta_mode, peserta_spesifik FROM jadwal_rapat WHERE id = ?',
        [idKegiatan]
      );
      
      if (jadwal.length > 0) {
        const j = jadwal[0];

        // 1. Participant Mode Validation (Guest check)
        if (j.peserta_mode === 'akun') {
          return res.status(403).json({ 
            success: false, 
            message: 'Kegiatan ini hanya untuk pengguna akun Syntak. Tamu/Public tidak diperbolehkan.' 
          });
        }

        const jTanggal = formatDateLocal(j.tanggal);
        const startDt = new Date(`${jTanggal}T${j.jam_mulai}`);
        const endDt = new Date(`${jTanggal}T${j.jam_selesai}`);
        
        // Strict session check: Can't attend if past end time (even if QR is active)
        if (now > endDt) {
          return res.status(400).json({ 
            success: false, 
            message: 'Kegiatan ini sudah berakhir. Sesi presensi telah ditutup.' 
          });
        }

        const latenessThreshold = j.lateness_threshold_minutes || 60;
        const latenessTime = new Date(startDt.getTime() + (latenessThreshold * 60000));
        
        if (now > latenessTime) {
          statusKehadiran = 'terlambat';
        }
      }
    }

    await pool.execute(
      `INSERT INTO absensi (id, user_id, nama_user, jenis_kegiatan, nama_kegiatan, id_kegiatan, tanggal, waktu, signature, status, instansi, email, is_guest, status_kehadiran)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'hadir', ?, ?, 1, ?)`,
      [id, nama, jenisKegiatan, namaKegiatan, idKegiatan || null, tanggal, waktu, signature, instansi || null, email || null, statusKehadiran]
    );

    res.json({ success: true, message: 'Presensi tamu berhasil disimpan' });
  } catch (error) {
    console.error('Save guest absensi error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan absensi tamu' });
  }
});

// Get absensi list
app.get('/api/absensi', async (req, res) => {
  try {
    const { today, month, userId } = req.query;

    let query = "SELECT *, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal_iso FROM absensi WHERE 1=1";
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
      tanggal: item.tanggal_iso,
      waktu: item.waktu.substring(0, 5),
      signature: item.signature,
      status: item.status,
      statusKehadiran: item.status_kehadiran || 'hadir',
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
    const { userId, namaUser, judul, jenisKegiatan, isi, ringkasan, diskusi, kesimpulan, tanya_jawab, foto, hari, jam, tempat, agenda, signature, pemandu, idKegiatan } = req.body;

    const now = new Date();
    const tanggal = now.toISOString().split('T')[0];
    const waktu = now.toTimeString().split(' ')[0];

    const id = randomUUID();

    await pool.execute(
      `INSERT INTO notulensi (id, user_id, nama_user, judul, jenis_kegiatan, id_kegiatan, ringkasan, diskusi, kesimpulan, tanya_jawab, isi, tanggal, waktu, foto, hari, jam, tempat, agenda, signature, pemandu) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, namaUser, judul, jenisKegiatan, idKegiatan || null, ringkasan || null, diskusi || null, kesimpulan || null, tanya_jawab || null, isi, tanggal, waktu, foto, hari, jam, tempat, agenda, signature, pemandu]
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

    let query = "SELECT *, DATE_FORMAT(tanggal, '%Y-%m-%d') as tanggal_iso FROM notulensi WHERE 1=1";
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
      idKegiatan: item.id_kegiatan,
      ringkasan: item.ringkasan,
      diskusi: item.diskusi,
      kesimpulan: item.kesimpulan,
      tanya_jawab: item.tanya_jawab,
      isi: item.isi,
      tanggal: item.tanggal_iso,
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
    if (updates.ringkasan !== undefined) {
      updateFields.push('ringkasan = ?');
      updateValues.push(updates.ringkasan);
    }
    if (updates.diskusi !== undefined) {
      updateFields.push('diskusi = ?');
      updateValues.push(updates.diskusi);
    }
    if (updates.kesimpulan !== undefined) {
      updateFields.push('kesimpulan = ?');
      updateValues.push(updates.kesimpulan);
    }
    if (updates.tanya_jawab !== undefined) {
      updateFields.push('tanya_jawab = ?');
      updateValues.push(updates.tanya_jawab);
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
      userId, namaUser, idKegiatan, tempat, tanggal, nomorSurat, sifat, lampiran, perihal, kepada,
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
      `INSERT INTO undangan (id, user_id, nama_user, id_kegiatan, tempat, tanggal, nomor_surat, sifat, lampiran, perihal, kepada, 
       isi_surat, hari_tanggal_waktu, tempat_kegiatan, tanda_tangan, jabatan_penandatangan, nip, isi_penutup,
       is_uploaded_file, uploaded_file_name, uploaded_file_type, uploaded_file_data, uploaded_file_size) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId ?? null,
        namaUser ?? null,
        idKegiatan ?? null,
        tempat ?? null,
        tanggal ?? null,
        nomorSurat ?? null,
        sifat ?? null,
        lampiran ?? null,
        perihal ?? null,
        kepada ?? null,
        isiSurat ?? null,
        hariTanggalWaktu ?? null,
        tempatKegiatan ?? null,
        tandaTangan ?? null,
        jabatanPenandatangan ?? null,
        nip ?? null,
        isiPenutup ?? null,
        isUploadedFile ? 1 : 0,
        uploadedFileName ?? null,
        uploadedFileType ?? null,
        uploadedFileData ?? null,
        uploadedFileSize ?? null
      ]
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
      idKegiatan: item.id_kegiatan,
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
// SERVER-SENT EVENTS (SSE)
// ============================================

// SSE connection endpoint — client subscribes with userId
app.get('/api/events', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send a heartbeat immediately
  res.write(`event: connected\ndata: {"msg":"connected"}\n\n`);

  // Heartbeat every 25 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch { clearInterval(heartbeat); }
  }, 25000);

  addSseClient(userId, res);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSseClient(userId, res);
  });
});

// ============================================
// BROADCAST UNDANGAN ROUTES
// ============================================

// Broadcast undangan to all participants of the linked jadwal
app.post('/api/undangan/:id/broadcast', async (req, res) => {
  try {
    const { id } = req.params;
    const { broadcasterId } = req.body; // user who triggered broadcast

    // 1. Get undangan
    const [undanganRows] = await pool.execute('SELECT * FROM undangan WHERE id = ?', [id]);
    if (undanganRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Undangan tidak ditemukan' });
    }
    const undangan = undanganRows[0];

    if (!undangan.id_kegiatan) {
      return res.status(400).json({ success: false, message: 'Undangan ini tidak terhubung ke jadwal kegiatan' });
    }

    // 2. Get jadwal + participants
    const [jadwalRows] = await pool.execute(
      'SELECT * FROM jadwal_rapat WHERE id = ?',
      [undangan.id_kegiatan]
    );
    if (jadwalRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Jadwal kegiatan tidak ditemukan' });
    }
    const jadwal = jadwalRows[0];

    // Build list of target user IDs
    let targetUserIds = [];
    const pesertaMode = jadwal.peserta_mode || 'akun';

    if (pesertaMode === 'spesifik' && jadwal.peserta_spesifik) {
      const spesifik = typeof jadwal.peserta_spesifik === 'string'
        ? JSON.parse(jadwal.peserta_spesifik)
        : jadwal.peserta_spesifik;
      targetUserIds = Array.isArray(spesifik) ? spesifik.map(p => typeof p === 'string' ? p : p.id) : [];
    } else {
      // All non-admin users in the matching kategori (peserta is JSON array of ["Pegawai","Magang"] etc.)
      const pesertaKategori = typeof jadwal.peserta === 'string'
        ? JSON.parse(jadwal.peserta)
        : (jadwal.peserta || []);
      
      let userQuery = 'SELECT id FROM users WHERE role != ? AND (is_blocked = 0 OR is_blocked IS NULL)';
      const userParams = ['admin'];
      if (Array.isArray(pesertaKategori) && pesertaKategori.length > 0) {
        userQuery += ` AND kategori IN (${pesertaKategori.map(() => '?').join(',')})`;
        userParams.push(...pesertaKategori);
      }
      const [allUsers] = await pool.execute(userQuery, userParams);
      targetUserIds = allUsers.map(u => u.id);
    }

    if (targetUserIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada peserta untuk dikirimi undangan' });
    }

    // 3. Fetch full user info (nama + email)
    const placeholders = targetUserIds.map(() => '?').join(',');
    const [targetUsers] = await pool.execute(
      `SELECT id, nama, email FROM users WHERE id IN (${placeholders})`,
      targetUserIds
    );

    // 4. Respond immediately; process async
    res.json({ success: true, total: targetUsers.length, message: `Memulai broadcast ke ${targetUsers.length} peserta` });

    // 5. Emit broadcast start to ALL clients (so all can see progress bar)
    emitSse('broadcast_start', {
      broadcastId: id,
      judulKegiatan: jadwal.judul,
      perihal: undangan.perihal,
      total: targetUsers.length
    });

    // 6. Send notification + email to each participant one by one
    let sent = 0;
    const notifTitle = `📨 Undangan: ${undangan.perihal || jadwal.judul}`;
    const notifMessage = `Anda mendapat undangan untuk kegiatan "${jadwal.judul}" pada ${jadwal.tanggal}. ${undangan.perihal || ''}`;

    const canSendEmail = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    const tanggalFormatted = jadwal.tanggal
      ? new Date(jadwal.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '-';

    for (const user of targetUsers) {
      try {
        // a. Insert in-app notification
        const notifId = randomUUID();
        await pool.execute(
          `INSERT INTO notifications (id, user_id, type, title, message, ref_id, ref_type)
           VALUES (?, ?, 'undangan', ?, ?, ?, 'undangan')`,
          [notifId, user.id, notifTitle, notifMessage, id]
        );
        sent++;

        // b. Emit progress to ALL
        emitSse('broadcast_progress', {
          broadcastId: id,
          sent,
          total: targetUsers.length,
          percent: Math.round((sent / targetUsers.length) * 100)
        });

        // c. Emit notification SSE directly to this user
        emitSse('notification', {
          id: notifId, type: 'undangan', title: notifTitle,
          message: notifMessage, refId: id, refType: 'undangan',
          isRead: false, createdAt: new Date().toISOString()
        }, [user.id]);

        // d. Send email — fire and forget (tidak block loop)
        if (canSendEmail && user.email) {
          transporter.sendMail({
            from: `"Syntak - BPS Kota Surabaya" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `📨 Undangan: ${undangan.perihal || jadwal.judul}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e40af, #4f46e5); padding: 28px 32px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 0.5px;">📨 Undangan Rapat</h1>
                  <p style="color: #bfdbfe; margin: 6px 0 0; font-size: 14px;">BPS Kota Surabaya — Sistem Presensi Digital</p>
                </div>

                <!-- Body -->
                <div style="background: white; padding: 32px;">
                  <p style="color: #374151; font-size: 15px;">Yth. <strong>${user.nama}</strong>,</p>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.7;">
                    Anda diundang untuk menghadiri kegiatan berikut:
                  </p>

                  <!-- Detail card -->
                  <div style="background: #f0f4ff; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 20px 24px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
                      <tr>
                        <td style="padding: 6px 0; width: 130px; color: #6b7280;">📋 Perihal</td>
                        <td style="padding: 6px 0;"><strong>${undangan.perihal || '-'}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280;">📅 Kegiatan</td>
                        <td style="padding: 6px 0;">${jadwal.judul || '-'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280;">🗓️ Tanggal</td>
                        <td style="padding: 6px 0;">${tanggalFormatted}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280;">⏰ Waktu</td>
                        <td style="padding: 6px 0;">${jadwal.jam_mulai || '-'} – ${jadwal.jam_selesai || '-'} WIB</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280;">📍 Tempat</td>
                        <td style="padding: 6px 0;">${undangan.tempat_kegiatan || jadwal.tempat || '-'}</td>
                      </tr>
                      ${undangan.nomor_surat ? `<tr>
                        <td style="padding: 6px 0; color: #6b7280;">📄 No. Surat</td>
                        <td style="padding: 6px 0;">${undangan.nomor_surat}</td>
                      </tr>` : ''}
                    </table>
                  </div>

                  <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
                    Mohon untuk hadir tepat waktu dan melakukan presensi melalui aplikasi Syntak.
                    Notifikasi ini dikirim otomatis oleh sistem.
                  </p>
                </div>

                <!-- Footer -->
                <div style="background: #f1f5f9; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    Sistem Presensi &amp; Notulensi Digital — BPS Kota Surabaya
                  </p>
                </div>
              </div>
            `
          }).catch(err => {
            console.error(`[BROADCAST EMAIL] Gagal kirim ke ${user.email}:`, err.message);
          });
        } else if (!canSendEmail) {
          console.warn(`[BROADCAST EMAIL] ⚠️ EMAIL_USER/PASS tidak diset, email tidak dikirim ke ${user.email}`);
        }

      } catch (err) {
        console.error(`[BROADCAST] Failed to notify user ${user.id}:`, err.message);
      }
    }

    // 7. Emit broadcast complete to ALL
    emitSse('broadcast_complete', {
      broadcastId: id,
      judulKegiatan: jadwal.judul,
      sent,
      total: targetUsers.length
    });

  } catch (error) {
    console.error('Broadcast undangan error:', error);
    emitSse('broadcast_error', { message: error.message });
  }
});

// ============================================
// NOTIFICATION ROUTES
// ============================================

// Get notifications for a user
app.get('/api/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId diperlukan' });

    const [rows] = await pool.execute(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    res.json(rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      title: r.title,
      message: r.message,
      refId: r.ref_id,
      refType: r.ref_type,
      isRead: !!r.is_read,
      createdAt: r.created_at
    })));
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil notifikasi' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: 'Gagal update notifikasi' });
  }
});

// Mark all notifications as read for a user
app.put('/api/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId diperlukan' });
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Gagal update semua notifikasi' });
  }
});

// ============================================
// QR CODE ROUTES
// ============================================

// Generate QR code
app.post('/api/qr/generate', async (req, res) => {
  try {
    const { jenisKegiatan, namaKegiatan, createdBy, createdByName, expiresAt, idKegiatan: providedIdKegiatan } = req.body;

    const safeJenis = jenisKegiatan || null;
    const safeNama = namaKegiatan || null;

    // Check if there is already an active, non-expired QR for this activity name and type
    // This supports the requirement: "untuk kegiatan berulang cukup 1 kode qr saja"
    const [existing] = safeJenis && safeNama ? await pool.execute(
      'SELECT id FROM qr_absensi_codes WHERE jenis_kegiatan = ? AND nama_kegiatan = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1',
      [safeJenis, safeNama]
    ) : [[]];

    if (existing.length > 0) {
      // If already exists, reuse it but update id_kegiatan to the new jadwal
      // so peserta_spesifik is read from the correct/latest jadwal
      const reuseId = existing[0].id;
      if (providedIdKegiatan) {
        await pool.execute(
          'UPDATE qr_absensi_codes SET id_kegiatan = ? WHERE id = ?',
          [providedIdKegiatan, reuseId]
        );
      }
      return res.json({ success: true, id: reuseId, message: 'Menggunakan QR yang sudah ada (Reuse)' });
    }

    const id = randomUUID();
    const idKegiatan = providedIdKegiatan || randomUUID(); // Use provided ID or generate new

    // If expiresAt is provided, use it. Otherwise, default to 4 hours from now.
    // If explicitly set to null/unlimited, it will be permanent
    const query = (expiresAt !== undefined) 
      ? `INSERT INTO qr_absensi_codes (id, jenis_kegiatan, nama_kegiatan, id_kegiatan, created_by, created_by_name, is_active, expires_at) 
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      : `INSERT INTO qr_absensi_codes (id, jenis_kegiatan, nama_kegiatan, id_kegiatan, created_by, created_by_name, is_active, expires_at) 
         VALUES (?, ?, ?, ?, ?, ?, 1, DATE_ADD(NOW(), INTERVAL 4 HOUR))`;
    
    // Convert 'unlimited' or 'null' string to actual null
    // If it's a valid ISO string, parse to JS Date so mysql2 converts it to local DB time correctly
    let finalExpiresAt = (expiresAt === 'unlimited' || expiresAt === 'null' || !expiresAt) 
      ? (expiresAt === 'unlimited' ? null : undefined) 
      : new Date(expiresAt);

    const params = (finalExpiresAt !== undefined)
      ? [id, safeJenis, safeNama, idKegiatan, createdBy, createdByName, finalExpiresAt]
      : [id, safeJenis, safeNama, idKegiatan, createdBy, createdByName];


    await pool.execute(query, params);

    res.json({ success: true, id, idKegiatan });
  } catch (error) {


    console.error('Generate QR error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Nama kegiatan sudah digunakan. Gunakan nama yang unik.' });
    }
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
      'SELECT * FROM qr_absensi_codes WHERE created_by = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1',
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
      `SELECT q.*, j.peserta_mode 
       FROM qr_absensi_codes q 
       LEFT JOIN jadwal_rapat j ON q.id_kegiatan = j.id 
       WHERE q.id = ?`,
      [id]
    );

    if (codes.length === 0) {
      return res.status(404).json({ success: false, message: 'QR code tidak ditemukan' });
    }

    const item = codes[0];

    // Check expiration
    if (item.expires_at && new Date() > new Date(item.expires_at)) {
      return res.status(400).json({ success: false, message: 'QR Code ini sudah kedaluwarsa.' });
    }

    if (!item.is_active) {
      return res.status(400).json({ success: false, message: 'Sesi presensi untuk QR Code ini sudah ditutup.' });
    }

    res.json({
      id: item.id,
      jenisKegiatan: item.jenis_kegiatan,
      namaKegiatan: item.nama_kegiatan || '',
      idKegiatan: item.id_kegiatan,
      createdBy: item.created_by,
      createdByName: item.created_by_name,
      createdAt: item.created_at,
      expiresAt: item.expires_at,
      isActive: item.is_active,
      pesertaMode: item.peserta_mode || 'publik'
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

// Broadcast Notula to Participants
app.post('/api/notulensi/:id/broadcast', async (req, res) => {
  try {
    const { id } = req.params;

    // Get notula
    const [notulaResult] = await pool.execute('SELECT * FROM notulensi WHERE id = ?', [id]);
    if (notulaResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Notula tidak ditemukan' });
    }
    const notula = notulaResult[0];

    // Get participants (users and guests with email)
    let participants = [];
    if (notula.id_kegiatan) {
      const [absensi] = await pool.execute(
        `SELECT DISTINCT a.email as guest_email, u.email as user_email, a.nama_user 
         FROM absensi a 
         LEFT JOIN users u ON a.user_id = u.id 
         WHERE a.id_kegiatan = ?`,
        [notula.id_kegiatan]
      );
      participants = absensi.map(p => ({
        email: p.user_email || p.guest_email,
        nama: p.nama_user
      })).filter(p => p.email);
    }

    if (participants.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada peserta dengan email yang valid untuk kegiatan ini.' });
    }

    // Send emails
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      for (const p of participants) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: p.email,
          subject: `Notula Kegiatan: ${notula.judul}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Notula Kegiatan</h2>
              <p>Halo <strong>${p.nama}</strong>,</p>
              <p>Berikut adalah ringkasan dari kegiatan <strong>${notula.judul}</strong>:</p>
              <hr/>
              <p><strong>Ringkasan:</strong> ${notula.ringkasan || '-'}</p>
              <p><strong>Diskusi:</strong> ${notula.diskusi || '-'}</p>
              <p><strong>Kesimpulan:</strong> ${notula.kesimpulan || '-'}</p>
              <p><strong>Tanya Jawab:</strong> ${notula.tanya_jawab || '-'}</p>
              <hr/>
              <p>Terima kasih atas partisipasi Anda.</p>
            </div>
          `
        });
      }
    }

    res.json({ success: true, message: `Berhasil mengirim notula ke ${participants.length} peserta.` });
  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ success: false, message: 'Gagal menyebarkan notula.' });
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

// ============================================
// JADWAL RAPAT ROUTES
// ============================================

// Create jadwal rapat
app.post('/api/jadwal-rapat', async (req, res) => {
  try {
    const { 
      judul, deskripsi, tanggal, jamMulai, jamSelesai, tim, peserta, 
      repeatType, repeatDays, repeatUntil, createdBy, jenisKegiatan = 'rapat',
      allowStack = false, openOffsetMinutes = 0, closeOffsetMinutes = 0, latenessThresholdMinutes = 60,
      pesertaMode = 'akun', pesertaSpesifik = []
    } = req.body;

    if (!judul || !tanggal || !jamMulai || !jamSelesai || !tim || !peserta || !createdBy) {
      return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    const entriesToInsert = [];

    // Helper: generate entries based on repeat pattern
    if (repeatType === 'none' || !repeatType) {
      entriesToInsert.push(tanggal);
    } else {
      const startDate = new Date(tanggal);
      const endDate = repeatUntil ? new Date(repeatUntil) : new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000); // default 90 days

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay(); // 0=Sun
        if (repeatType === 'daily') {
          entriesToInsert.push(d.toISOString().split('T')[0]);
        } else if (repeatType === 'weekly') {
          if (dayOfWeek === startDate.getDay()) {
            entriesToInsert.push(d.toISOString().split('T')[0]);
          }
        } else if (repeatType === 'custom' && Array.isArray(repeatDays)) {
          if (repeatDays.includes(dayOfWeek)) {
            entriesToInsert.push(d.toISOString().split('T')[0]);
          }
        }
      }
    }

    // Conflict Check Logic (unless allowStack = true)
    if (!allowStack) {
      for (const dateStr of entriesToInsert) {
        const [existing] = await pool.execute(`
          SELECT * FROM jadwal_rapat 
          WHERE tanggal = ? AND is_active = 1
          AND (
            (jam_mulai <= ? AND jam_selesai > ?) OR 
            (jam_mulai < ? AND jam_selesai >= ?) OR
            (jam_mulai >= ? AND jam_selesai <= ?)
          )
        `, [dateStr, jamSelesai, jamMulai, jamSelesai, jamMulai, jamMulai, jamSelesai]);

        if (existing.length > 0) {
          // Check overlap in tim or peserta
          const hasOverlap = existing.some(e => {
            const eTim = typeof e.tim === 'string' ? JSON.parse(e.tim) : e.tim;
            const ePeserta = typeof e.peserta === 'string' ? JSON.parse(e.peserta) : e.peserta;
            
            const timOverlap = eTim.includes('Semua') || tim.includes('Semua') || eTim.some(t => tim.includes(t));
            const pesertaOverlap = ePeserta.includes('Semua') || peserta.includes('Semua') || ePeserta.some(p => peserta.includes(p));
            
            return timOverlap && pesertaOverlap;
          });

          if (hasOverlap) {
             return res.status(400).json({ 
               success: false, 
               status: 'rejected',
               reason: 'conflict',
               message: `Konflik jadwal terdeteksi pada ${dateStr}. Terdapat jadwal lain yang beririsan untuk tim/kategori yang sama.`
             });
          }
        }
      }
    }

    const insertedIds = [];
    for (const dateStr of entriesToInsert) {
      const id = randomUUID();
      await pool.execute(
        `INSERT INTO jadwal_rapat 
         (id, judul, deskripsi, tanggal, jam_mulai, jam_selesai, tim, peserta, repeat_type, repeat_days, repeat_until, allow_stack, open_offset_minutes, close_offset_minutes, lateness_threshold_minutes, jenis_kegiatan, peserta_mode, peserta_spesifik, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, judul, deskripsi || null, dateStr, jamMulai, jamSelesai, 
          JSON.stringify(tim), JSON.stringify(peserta), repeatType || 'none', 
          repeatDays ? JSON.stringify(repeatDays) : null, repeatUntil || null,
          allowStack ? 1 : 0, openOffsetMinutes, closeOffsetMinutes, latenessThresholdMinutes, jenisKegiatan,
          pesertaMode || 'akun',
          pesertaSpesifik && pesertaSpesifik.length > 0 ? JSON.stringify(pesertaSpesifik) : null,
          createdBy
        ]
      );
      insertedIds.push(id);
    }

    res.json({ success: true, message: `${insertedIds.length} jadwal berhasil dibuat`, ids: insertedIds });
  } catch (error) {
    console.error('Create jadwal rapat error:', error);
    res.status(500).json({ success: false, message: 'Gagal membuat jadwal rapat' });
  }
});

// Get all jadwal rapat
app.get('/api/jadwal-rapat', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM jadwal_rapat ORDER BY tanggal DESC, jam_mulai ASC'
    );

    const formatted = rows.map(r => ({
      id: r.id,
      judul: r.judul,
      deskripsi: r.deskripsi,
      tanggal: r.tanggal ? formatDateLocal(r.tanggal) : null,
      jamMulai: r.jam_mulai,
      jamSelesai: r.jam_selesai,
      tim: typeof r.tim === 'string' ? JSON.parse(r.tim) : r.tim,
      peserta: typeof r.peserta === 'string' ? JSON.parse(r.peserta) : r.peserta,
      repeatType: r.repeat_type,
      repeatDays: r.repeat_days ? (typeof r.repeat_days === 'string' ? JSON.parse(r.repeat_days) : r.repeat_days) : null,
      repeatUntil: r.repeat_until ? (typeof r.repeat_until === 'string' ? r.repeat_until : new Date(r.repeat_until).toISOString().split('T')[0]) : null,
      allowStack: !!r.allow_stack,
      openOffsetMinutes: r.open_offset_minutes,
      closeOffsetMinutes: r.close_offset_minutes,
      latenessThresholdMinutes: r.lateness_threshold_minutes,
      jenisKegiatan: r.jenis_kegiatan,
      pesertaMode: r.peserta_mode || 'akun',
      pesertaSpesifik: r.peserta_spesifik ? (typeof r.peserta_spesifik === 'string' ? JSON.parse(r.peserta_spesifik) : r.peserta_spesifik) : [],
      createdBy: r.created_by,
      isActive: !!r.is_active,
      createdAt: r.created_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Get jadwal rapat error:', error);
    res.status(500).json([]);
  }
});

// Get active jadwal rapat for today
app.get('/api/jadwal-rapat/active', async (req, res) => {
  try {
    const { tim, kategori } = req.query;

     let [rows] = await pool.execute(
      `SELECT j.*, q.id as active_qr_id 
       FROM jadwal_rapat j
       LEFT JOIN qr_absensi_codes q ON (
         j.active_qr_id = q.id AND q.is_active = 1 AND (q.expires_at IS NULL OR q.expires_at > NOW())
       )
       WHERE j.tanggal = CURDATE() AND j.is_active = 1 
       GROUP BY j.id, j.judul, j.jam_mulai, j.jam_selesai, j.jenis_kegiatan
       ORDER BY j.jam_mulai ASC`
    );

    let formatted = rows.map(r => ({
      id: r.id,
      judul: r.judul,
      deskripsi: r.deskripsi,
      tanggal: r.tanggal ? formatDateLocal(r.tanggal) : null,
      jamMulai: r.jam_mulai,
      jamSelesai: r.jam_selesai,
      tim: typeof r.tim === 'string' ? JSON.parse(r.tim) : r.tim,
      peserta: typeof r.peserta === 'string' ? JSON.parse(r.peserta) : r.peserta,
      repeatType: r.repeat_type,
      allowStack: !!r.allow_stack,
      openOffsetMinutes: r.open_offset_minutes,
      closeOffsetMinutes: r.close_offset_minutes,
      latenessThresholdMinutes: r.lateness_threshold_minutes,
      jenisKegiatan: r.jenis_kegiatan,
      pesertaMode: r.peserta_mode || 'akun',
      pesertaSpesifik: r.peserta_spesifik ? (typeof r.peserta_spesifik === 'string' ? JSON.parse(r.peserta_spesifik) : r.peserta_spesifik) : [],
      createdBy: r.created_by,
      isActive: !!r.is_active,
      activeQRId: r.active_qr_id
    }));


    // Filter by visibilitas: Check if user's tim & kategori overlaps with event
    if (tim && tim !== 'Semua') {
      formatted = formatted.filter(j => {
        const jTim = j.tim;
        return jTim.includes('Semua') || jTim.includes(tim);
      });
    }

    if (kategori && kategori !== 'Semua') {
      formatted = formatted.filter(j => {
        const jPeserta = j.peserta;
        return jPeserta.includes('Semua') || jPeserta.includes(kategori);
      });
    }

    // Assign UI visibility & absen state attributes based on time
    // Get current local time from MySQL (ensures correct timezone)
    const [[{ localNow }]] = await pool.execute("SELECT NOW() as localNow");
    const now = new Date(localNow);
    const currentDateStr = now.toISOString().split('T')[0];
    
    formatted = formatted.map(j => {
       // Parse jam as local time using local date string to avoid UTC offset issues
       const [startH, startM, startS] = (j.jamMulai || '00:00:00').split(':').map(Number);
       const [endH, endM, endS] = (j.jamSelesai || '00:00:00').split(':').map(Number);
       
       const startDt = new Date(now);
       startDt.setHours(startH, startM, startS || 0, 0);
       
       const endDt = new Date(now);
       endDt.setHours(endH, endM, endS || 0, 0);
       
       const openTime = new Date(startDt.getTime() + ((j.openOffsetMinutes || 0) * 60000));
       let closeTime = new Date(endDt.getTime() + ((j.closeOffsetMinutes || 0) * 60000));
       const latenessTime = new Date(startDt.getTime() + ((j.latenessThresholdMinutes || 60) * 60000));

       let state = 'closed';
       if (now < openTime) state = 'disabled';
       else if (now >= openTime && now <= closeTime) state = 'open';

       // Construct tooltip and extra attributes
       const openTimeString = openTime.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });

       return {
         ...j,
         visibility: true, // If it passed the filter above, it's visible
         absen_state: state,
         absen_tooltip: state === 'disabled' ? `Absen akan aktif pada ${openTimeString}` : '',
         lateness_status: now > latenessTime ? 'late' : 'on_time'
       };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Get active jadwal error:', error);
    res.status(500).json([]);
  }
});

// Update jadwal rapat
app.put('/api/jadwal-rapat/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      judul, deskripsi, tanggal, jamMulai, jamSelesai, tim, peserta, isActive,
      allowStack, openOffsetMinutes, closeOffsetMinutes, latenessThresholdMinutes,
      jenisKegiatan, jenis_kelpersahaan, activeQRId
    } = req.body;

    const updates = [];
    const values = [];

    if (judul !== undefined) { updates.push('judul = ?'); values.push(judul); }
    if (deskripsi !== undefined) { updates.push('deskripsi = ?'); values.push(deskripsi); }
    if (tanggal !== undefined) { updates.push('tanggal = ?'); values.push(tanggal); }
    if (jamMulai !== undefined) { updates.push('jam_mulai = ?'); values.push(jamMulai); }
    if (jamSelesai !== undefined) { updates.push('jam_selesai = ?'); values.push(jamSelesai); }
    if (tim !== undefined) { updates.push('tim = ?'); values.push(JSON.stringify(tim)); }
    if (peserta !== undefined) { updates.push('peserta = ?'); values.push(JSON.stringify(peserta)); }
    if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
    if (allowStack !== undefined) { updates.push('allow_stack = ?'); values.push(allowStack ? 1 : 0); }
    if (openOffsetMinutes !== undefined) { updates.push('open_offset_minutes = ?'); values.push(openOffsetMinutes); }
    if (closeOffsetMinutes !== undefined) { updates.push('close_offset_minutes = ?'); values.push(closeOffsetMinutes); }
    if (latenessThresholdMinutes !== undefined) { updates.push('lateness_threshold_minutes = ?'); values.push(latenessThresholdMinutes); }
    // Accept both camelCase (jenisKegiatan) from frontend and legacy typo (jenis_kelpersahaan)
    const jenisVal = jenisKegiatan ?? jenis_kelpersahaan;
    if (jenisVal !== undefined) { updates.push('jenis_kegiatan = ?'); values.push(jenisVal); }
    if (activeQRId !== undefined) { updates.push('active_qr_id = ?'); values.push(activeQRId); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada data untuk diupdate' });
    }

    values.push(id);
    await pool.execute(`UPDATE jadwal_rapat SET ${updates.join(', ')} WHERE id = ?`, values);


    res.json({ success: true, message: 'Jadwal berhasil diupdate' });
  } catch (error) {
    console.error('Update jadwal rapat error:', error);
    res.status(500).json({ success: false, message: 'Gagal update jadwal' });
  }
});

// Delete jadwal rapat
app.delete('/api/jadwal-rapat/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM jadwal_rapat WHERE id = ?', [id]);
    res.json({ success: true, message: 'Jadwal berhasil dihapus' });
  } catch (error) {
    console.error('Delete jadwal rapat error:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus jadwal' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

