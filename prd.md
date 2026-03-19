# Product Requirements Document (PRD)

## Syntak — Sistem Presensi, Notulensi, Undangan, dan Jadwal Rapat

**Versi Dokumen:** 1.0  
**Tanggal:** 20 Maret 2026  
**Pengelola Produk:** Tim Pengembang Syntak  
**Ditujukan Untuk:** BPS Kota Surabaya (Internal)  
**Status:** Aktif / Production

---

## 1. Ringkasan Eksekutif

Syntak adalah sistem informasi manajemen kehadiran dan administrasi rapat berbasis web yang dikembangkan khusus untuk keperluan internal BPS Kota Surabaya. Sistem ini menyatukan empat fungsi utama dalam satu platform terintegrasi: **Presensi** (kehadiran pegawai, magang, dan tamu), **Notulensi** (pencatatan berita acara rapat), **Undangan** (penyusunan surat undangan kegiatan), dan **Jadwal Rapat** (manajemen agenda dan penjadwalan berulang).

Tujuan utama Syntak adalah menggantikan proses manual pengelolaan presensi dan dokumentasi rapat dengan solusi digital yang efisien, terpusat, dan dapat diaudit.

---

## 2. Latar Belakang & Permasalahan

### 2.1 Kondisi Saat Ini (As-Is)

Sebelum Syntak, pengelolaan presensi dan notulensi di BPS Kota Surabaya dilakukan secara manual menggunakan lembar kertas atau spreadsheet, dengan kendala:

- **Data presensi tidak terpusat** — sulit direkap dan diaudit.
- **Notulensi tersebar** — dokumen rapat tidak mudah dicari dan tidak terarsip dengan baik.
- **Proses surat undangan manual** — memerlukan waktu dan rawan kesalahan format.
- **Tidak ada laporan real-time** — sulit memantau tingkat kehadiran secara langsung.
- **Tamu/undangan luar** tidak tercatat secara digital dan tidak ada mekanisme verifikasi.

### 2.2 Solusi yang Ditawarkan

Syntak menyediakan:

- Platform terpusat untuk seluruh aktivitas presensi, notulensi, dan undangan.
- Dashboard analitik real-time untuk monitoring kehadiran.
- QR Code dinamis untuk memfasilitasi presensi tamu tanpa login.
- Sistem broadcast email otomatis untuk distribusi notulensi.
- Manajemen pengguna berbasis peran (Role-Based Access Control).

---

## 3. Ruang Lingkup Produk

### 3.1 Dalam Lingkup (In Scope)

- Autentikasi user (registrasi OTP email, login, profil).
- Presensi pegawai/magang untuk berbagai jenis kegiatan.
- Presensi tamu via QR Code tanpa login.
- Pencatatan dan pengarsipan notulensi rapat.
- Broadcast notulensi via email ke peserta.
- Penyusunan dan penyimpanan surat undangan.
- Manajemen jadwal rapat (harian, mingguan, berulang).
- Panel Admin untuk manajemen pengguna dan data.
- Dashboard statistik dan grafik interaktif.
- Notifikasi in-app real-time via Server-Sent Events (SSE).
- Export laporan presensi ke PDF/Word.

### 3.2 Luar Lingkup (Out of Scope)

- Integrasi dengan sistem kepegawaian BPS Pusat.
- Aplikasi mobile native (Android/iOS).
- Sistem payroll atau penggajian.
- Manajemen aset atau inventaris kantor.

---

## 4. Pengguna & Peran

### 4.1 Segmen Pengguna

| Peran       | Deskripsi                                              | Akses                                 |
| ----------- | ------------------------------------------------------ | ------------------------------------- |
| **Admin**   | Pengelola sistem, biasanya Kepala Bagian atau staf IT. | Semua fitur + Panel Admin             |
| **Pegawai** | Staf tetap BPS Kota Surabaya yang terdaftar di sistem. | Dashboard, Presensi, Notula, Undangan |
| **Magang**  | Mahasiswa magang yang bekerja di BPS.                  | Dashboard, Presensi, Notula, Undangan |
| **Tamu**    | Undangan atau peserta luar yang hadir dalam kegiatan.  | Presensi via QR Code (tanpa login)    |

### 4.2 Persona Pengguna Utama

**Persona 1: Admin Sistem (Budi, Staf IT)**

- Tujuan: Mengelola akun user, memantau kehadiran, dan membuat jadwal rapat.
- Pain point: Proses blokir/unblokir user masih manual, sulitnya merekapitulasi presensi.

**Persona 2: Pegawai (Sari, Analis Data)**

- Tujuan: Melakukan presensi sehari-hari dengan cepat, melihat jadwal rapat, dan mencatat notulensi.
- Pain point: Harus mengisi lembar fisik yang kadang hilang atau tidak tersimpan.

**Persona 3: Tamu Undangan (Eko, Dari Instansi Lain)**

- Tujuan: Melakukan presensi kegiatan dengan mudah tanpa perlu membuat akun.
- Pain point: Proses registrasi akun yang panjang untuk event satu kali.

---

## 5. Fitur & Persyaratan Fungsional

### 5.1 Autentikasi & Manajemen Akun

#### 5.1.1 Registrasi Pengguna

- **FR-AUTH-01**: Sistem mengirimkan kode OTP 6 digit ke email user yang belum terdaftar.
- **FR-AUTH-02**: OTP memiliki masa berlaku 5 menit dan hanya bisa digunakan sekali.
- **FR-AUTH-03**: User harus memverifikasi email via OTP sebelum bisa menyelesaikan registrasi.
- **FR-AUTH-04**: User mengisi nama, password, kategori (Pegawai/Magang), dan tim saat registrasi.
- **FR-AUTH-05**: Password disimpan dengan enkripsi bcrypt (salt rounds = 10).

#### 5.1.2 Login

- **FR-AUTH-06**: Login menggunakan email dan password.
- **FR-AUTH-07**: Sistem menolak login jika akun diblokir dan menampilkan alasan blokir dan waktu unblokir.
- **FR-AUTH-08**: Sistem otomatis unblokir akun jika waktu blokir sudah terlewati saat user mencoba login.

#### 5.1.3 Profil Pengguna

- **FR-AUTH-09**: User dapat mengedit nama, tim, dan jabatan dari halaman Dashboard.
- **FR-AUTH-10**: Perubahan profil langsung diperbarui di session aktif tanpa perlu login ulang.

---

### 5.2 Dashboard

- **FR-DASH-01**: Menampilkan salam berdasarkan waktu (Selamat Pagi/Siang/Sore/Malam) dan nama user.
- **FR-DASH-02**: Menampilkan kartu statistik: Presensi Hari Ini, Absensi Bulan Ini, Notula Bulan Ini, Total Kontributor Notula.
- **FR-DASH-03**: Grafik Batang (Bar Chart) kehadiran hari ini berdasarkan kategori (Pegawai vs Magang).
- **FR-DASH-04**: Grafik Garis (Line Chart) tren absensi 5 bulan terakhir per jenis kegiatan (Senam, Apel, Rapat, Sharing Knowledge, Doa Bersama, Rapelan).
- **FR-DASH-05**: Visualisasi tingkat kehadiran hari ini berupa Pie Chart (% Hadir vs Tidak Hadir) dan daftar breakdown per kegiatan.
- **FR-DASH-06**: Tombol "Refresh Data" untuk memuat ulang seluruh data dashboard secara manual.
- **FR-DASH-07**: Tombol "Edit Profil" untuk membuka dialog edit profil langsung dari Dashboard.
- **FR-DASH-08**: Data dashboard admin menampilkan semua user; data dashboard user biasa menampilkan data pribadi saja.

---

### 5.3 Presensi Pegawai & Magang

#### 5.3.1 Pengisian Presensi

- **FR-ABS-01**: User memilih jenis kegiatan (Senam, Apel, Rapat, Sharing Knowledge, Doa Bersama, Rapelan).
- **FR-ABS-02**: User mengisi tanda tangan digital (signature pad) sebagai bukti kehadiran.
- **FR-ABS-03**: Sistem mencegah presensi ganda untuk kegiatan yang sama pada hari yang sama.
- **FR-ABS-04**: Sistem mencatat status kehadiran: `hadir` atau `terlambat` (berdasarkan threshold waktu dari jadwal).
- **FR-ABS-05**: Presensi dikaitkan dengan jadwal rapat aktif hari itu jika tersedia.

#### 5.3.2 Peserta Spesifik

- **FR-ABS-06**: Admin dapat membuat sesi presensi yang hanya bisa diisi oleh peserta tertentu (mode `peserta_spesifik`).
- **FR-ABS-07**: Peserta dapat difilter berdasarkan kategori (Pegawai/Magang) saat memilih peserta spesifik.

#### 5.3.3 Riwayat & Laporan Presensi

- **FR-ABS-08**: Admin dapat melihat seluruh riwayat presensi dengan filter tanggal dan jenis kegiatan.
- **FR-ABS-09**: Admin dapat mengekspor laporan presensi ke PDF dengan kolom: No, Nama, Tim/Bagian, Jabatan, TTD.
- **FR-ABS-10**: Auto-populate detail kegiatan (nama, tanggal, hari, tempat) dari jadwal yang dipilih saat export.

---

### 5.4 Presensi Tamu (via QR Code)

- **FR-QR-01**: Admin membuat QR Code presensi untuk suatu kegiatan melalui panel jadwal rapat.
- **FR-QR-02**: QR Code berisi URL unik yang mengarahkan tamu ke halaman presensi tanpa login.
- **FR-QR-03**: Tamu mengisi: Nama, Instansi, Email, dan Tanda Tangan Digital.
- **FR-QR-04**: Sistem mencegah presensi ganda berdasarkan nama dan email tamu untuk kegiatan yang sama.
- **FR-QR-05**: QR Code dapat di-generate ulang (dengan ID baru) jika dibutuhkan.
- **FR-QR-06**: Data tamu yang presensi via QR disimpan di tabel `absensi` dengan flag `is_guest = true`.

---

### 5.5 Notulensi Rapat

#### 5.5.1 Pencatatan Notulensi

- **FR-NOT-01**: User membuat notulensi dengan mengisi field: Judul, Jenis Kegiatan, Ringkasan, Diskusi, Kesimpulan, Tanya Jawab, Agenda, Tempat, Waktu, Hari, Pemandu, dan TTD.
- **FR-NOT-02**: Notulensi dapat menyimpan foto/lampiran yang diunggah.
- **FR-NOT-03**: Notulensi dikaitkan dengan `id_kegiatan` untuk menghubungkan dokumen dengan data presensi.
- **FR-NOT-04**: User dapat melihat, mengedit, dan menghapus notulensi yang dibuatnya.
- **FR-NOT-05**: Admin dapat melihat dan mengelola seluruh notulensi.

#### 5.5.2 Broadcast Notulensi via Email

- **FR-NOT-06**: Admin/pembuat notulensi dapat mengirim broadcast email notulensi ke semua peserta kegiatan.
- **FR-NOT-07**: Penerima broadcast adalah: pegawai yang hadir (dengan email) + tamu yang memiliki email, untuk `id_kegiatan` yang sama.
- **FR-NOT-08**: Progress pengiriman email ditampilkan di progress bar global (SSE real-time).
- **FR-NOT-09**: Sistem menggunakan SMTP Hostinger dengan connection pool (maks. 5 koneksi paralel).
- **FR-NOT-10**: Jika konfigurasi email tidak ada, sistem melewati pengiriman email tanpa error fatal.

---

### 5.6 Surat Undangan

- **FR-UND-01**: User membuat surat undangan dengan mengisi: Nomor Surat, Sifat, Lampiran, Perihal, Tujuan (Kepada), Isi Surat, Hari/Tanggal/Waktu, Tempat, Isi Penutup, Tanda Tangan, Jabatan Penandatangan, NIP.
- **FR-UND-02**: Admin/user dapat mengunggah file undangan (PDF/Word) beserta metadata (nama, tipe, ukuran).
- **FR-UND-03**: Data undangan tersimpan di tabel `undangan` dan dapat dilihat/diedit/dihapus.
- **FR-UND-04**: Daftar undangan ditampilkan dalam tabel yang dapat dicari dan difilter.

---

### 5.7 Jadwal Rapat

#### 5.7.1 Pembuatan Jadwal

- **FR-JAD-01**: Admin membuat jadwal rapat dengan mengisi: Judul, Deskripsi, Tanggal, Jam Mulai, Jam Selesai, Tim, Kategori Peserta, dan Jenis Kegiatan.
- **FR-JAD-02**: Sistem mendukung empat tipe pengulangan:
  - `none` — Sekali (tidak berulang)
  - `daily` — Setiap hari
  - `weekly` — Setiap minggu pada hari yang sama
  - `custom` — Pada hari-hari tertentu dalam seminggu (misal: Senin, Rabu, Jumat)
- **FR-JAD-03**: Admin dapat mengatur `repeat_until` sebagai tanggal berakhirnya pengulangan.

#### 5.7.2 Konfigurasi Absensi

- **FR-JAD-04**: Admin dapat mengatur toleransi keterlambatan dalam menit (`lateness_threshold_minutes`).
- **FR-JAD-05**: Admin dapat mengatur jeda waktu buka (`open_offset_minutes`) dan tutup (`close_offset_minutes`) sesi presensi relatif terhadap jam mulai/selesai kegiatan.
- **FR-JAD-06**: Opsi `allow_stack` memungkinkan presensi lebih dari satu kali untuk kegiatan yang sama dalam satu hari.

#### 5.7.3 Filter Jadwal Aktif

- **FR-JAD-07**: Endpoint `/api/jadwal-rapat/today` mengembalikan jadwal yang aktif hari ini, difilter berdasarkan `tim` dan `kategori` user yang melakukan request.

---

### 5.8 Panel Admin

#### 5.8.1 Manajemen User

- **FR-ADM-01**: Admin melihat daftar semua user beserta nama, email, kategori, tim, jabatan, role, dan status blokir.
- **FR-ADM-02**: Admin dapat menambah user baru (dengan bypass OTP menggunakan kode `ADMIN`).
- **FR-ADM-03**: Admin dapat mengubah data user: nama, email, password, kategori, tim, role.
- **FR-ADM-04**: Admin dapat menghapus user dari sistem.
- **FR-ADM-05**: Admin dapat memblokir user dengan mencatat alasan (`reason`) dan catatan (`note`).
  - Alasan `izin-telat`: otomatis unblokir pukul 15.00 hari yang sama.
  - Alasan lainnya: otomatis unblokir tengah malam (00.00) hari berikutnya.
- **FR-ADM-06**: Admin dapat membuka blokir user secara manual.

#### 5.8.2 Log Aktivitas

- **FR-ADM-07**: Sistem mencatat log aktivitas user ke tabel `activity_logs`.
- **FR-ADM-08**: Admin dapat melihat log aktivitas seluruh user dengan timestamp.
- **FR-ADM-09**: Admin dapat menghapus log aktivitas satu per satu atau seluruh log sekaligus.

#### 5.8.3 Statistik & Data

- **FR-ADM-10**: Admin memiliki akses penuh ke data presensi, notulensi, undangan, dan jadwal seluruh user.
- **FR-ADM-11**: Admin dapat mengekspor laporan presensi per kegiatan ke format PDF.

---

### 5.9 Notifikasi Real-Time

- **FR-NOTIF-01**: Sistem menggunakan Server-Sent Events (SSE) untuk mengirim notifikasi real-time ke user yang sedang terhubung.
- **FR-NOTIF-02**: Notifikasi disimpan di tabel `notifications` dengan field: `type`, `title`, `message`, `ref_id`, `ref_type`, `is_read`.
- **FR-NOTIF-03**: User dapat melihat notifikasi via bell icon di header (mobile) atau sidebar.
- **FR-NOTIF-04**: User dapat menandai notifikasi sebagai sudah dibaca (satu per satu atau semua).
- **FR-NOTIF-05**: Jumlah notifikasi belum dibaca ditampilkan sebagai badge pada bell icon.
- **FR-NOTIF-06**: Progress broadcast email ditampilkan secara real-time via SSE di progress bar bawah layar.

---

## 6. Persyaratan Non-Fungsional

### 6.1 Performa

- **NFR-PERF-01**: Halaman dashboard harus memuat dalam < 3 detik pada koneksi normal.
- **NFR-PERF-02**: API response untuk operasi CRUD dasar harus < 500ms.
- **NFR-PERF-03**: Server Express menggunakan connection pool MySQL (maks. 10 koneksi) untuk efisiensi.
- **NFR-PERF-04**: Email broadcast dikirim secara asynchronous agar tidak memblokir response API.

### 6.2 Keamanan

- **NFR-SEC-01**: Password di-hash menggunakan bcrypt sebelum disimpan ke database.
- **NFR-SEC-02**: Registrasi memerlukan verifikasi email via OTP (6 digit, berlaku 5 menit).
- **NFR-SEC-03**: Akun yang diblokir tidak dapat login hingga masa blokir berakhir.
- **NFR-SEC-04**: Panel Admin hanya dapat diakses oleh user dengan role `admin`.
- **NFR-SEC-05**: Request body dibatasi maksimal 50MB untuk menampung tanda tangan digital dan foto.

### 6.3 Keandalan & Ketahanan

- **NFR-REL-01**: Frontend menggunakan `ErrorBoundary` React untuk menangkap error tak terduga dan menampilkan halaman error ramah pengguna.
- **NFR-REL-02**: Patch khusus pada `Node.prototype.removeChild` dan `insertBefore` mencegah crash akibat ekstensi browser (password manager, ad blocker).
- **NFR-REL-03**: Sistem tetap berjalan (degraded mode) jika konfigurasi email tidak tersedia.
- **NFR-REL-04**: Migrasi database dilakukan otomatis saat startup server untuk memastikan skema tabel selalu up-to-date.

### 6.4 Usability

- **NFR-UX-01**: Antarmuka responsif mendukung desktop (≥1024px) dan mobile (<1024px).
- **NFR-UX-02**: Sidebar pada mobile disembunyikan secara default dan dapat dibuka via tombol hamburger.
- **NFR-UX-03**: Semua form menggunakan validasi real-time dengan pesan error yang jelas.
- **NFR-UX-04**: Notifikasi aksi (sukses/gagal) ditampilkan menggunakan Sonner toast.

### 6.5 Skalabilitas

- **NFR-SCAL-01**: Backend dapat menangani hingga 10 koneksi database paralel via pool.
- **NFR-SCAL-02**: SMTP pool memungkinkan pengiriman hingga 5 email secara paralel.

---

## 7. Arsitektur Teknis

### 7.1 Tumpukan Teknologi (Tech Stack)

| Layer            | Teknologi                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| **Frontend**     | React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, Recharts, React Hook Form, Zod, TanStack Query |
| **Backend**      | Node.js, Express.js                                                                                 |
| **Database**     | MySQL (via `mysql2/promise`)                                                                        |
| **Auth**         | bcryptjs (password hashing), OTP via email                                                          |
| **Email**        | Nodemailer + Hostinger SMTP                                                                         |
| **Realtime**     | Server-Sent Events (SSE)                                                                            |
| **QR Code**      | `react-qr-code` (generate), `html5-qrcode` (scan)                                                   |
| **PDF/Word**     | jsPDF, docxtemplater, PizZip                                                                        |
| **Tanda Tangan** | react-signature-canvas                                                                              |

### 7.2 Struktur Direktori

```
syntak/
├── src/                      # Frontend (React + TypeScript)
│   ├── App.tsx               # Root komponen, routing, sidebar, layout
│   ├── main.tsx              # Entry point React + ErrorBoundary + DOM patch
│   ├── pages/                # Halaman utama
│   │   ├── Dashboard.tsx     # Halaman dashboard statistik
│   │   ├── Presensi.tsx      # Halaman presensi pegawai/magang
│   │   ├── PresensiTamu.tsx  # Halaman presensi tamu via QR
│   │   ├── Notula.tsx        # Halaman notulensi
│   │   ├── Undangan.tsx      # Halaman surat undangan
│   │   ├── AdminPanel.tsx    # Halaman panel admin
│   │   └── Login.tsx         # Halaman login & registrasi
│   ├── components/           # Komponen reusable
│   │   ├── ui/               # shadcn/ui components
│   │   ├── SignaturePad.tsx   # Komponen tanda tangan digital
│   │   ├── NotificationBell.tsx # Komponen bell notifikasi
│   │   └── BroadcastProgressBar.tsx # Progress bar broadcast email
│   ├── hooks/                # Custom React hooks
│   │   └── useNotifications.ts # Hook manajemen notifikasi SSE
│   └── lib/                  # Service & utility
│       ├── authService.ts    # Layanan autentikasi
│       └── dataService.ts    # Layanan data presensi & notula
│
└── server/                   # Backend (Node.js + Express)
    ├── index.js              # Server utama, semua API routes
    └── .env                  # Konfigurasi environment (DB, email, port)
```

### 7.3 Skema Database (Tabel Utama)

| Tabel              | Deskripsi                                                                        |
| ------------------ | -------------------------------------------------------------------------------- |
| `users`            | Data pengguna (nama, email, password hash, kategori, tim, jabatan, role, blokir) |
| `otps`             | Kode OTP untuk verifikasi email registrasi                                       |
| `absensi`          | Data presensi pegawai, magang, dan tamu                                          |
| `notulensi`        | Dokumen notulensi rapat                                                          |
| `undangan`         | Data surat undangan                                                              |
| `jadwal_rapat`     | Jadwal kegiatan/rapat (termasuk konfigurasi absensi)                             |
| `qr_absensi_codes` | QR Code yang dibuat untuk presensi tamu                                          |
| `notifications`    | Notifikasi in-app per user                                                       |
| `activity_logs`    | Log aktivitas user di sistem                                                     |

### 7.4 API Routes

| Grup           | Endpoint                            | Deskripsi                          |
| -------------- | ----------------------------------- | ---------------------------------- |
| **Auth**       | `POST /api/auth/send-otp`           | Kirim OTP ke email                 |
|                | `POST /api/auth/verify-otp`         | Verifikasi OTP                     |
|                | `POST /api/auth/register`           | Registrasi user baru               |
|                | `POST /api/auth/login`              | Login                              |
|                | `GET /api/auth/users`               | Daftar semua user (admin)          |
|                | `PUT /api/auth/users/:id`           | Update data user                   |
|                | `DELETE /api/auth/users/:id`        | Hapus user                         |
|                | `POST /api/auth/users/:id/block`    | Blokir user                        |
|                | `POST /api/auth/users/:id/unblock`  | Buka blokir user                   |
|                | `PUT /api/auth/profile/:id`         | Update profil sendiri              |
|                | `GET /api/auth/activities`          | Log aktivitas                      |
| **Absensi**    | `GET /api/absensi`                  | Daftar semua absensi               |
|                | `POST /api/absensi`                 | Tambah presensi baru               |
|                | `GET /api/absensi/stats`            | Statistik presensi                 |
|                | `GET /api/absensi/today`            | Presensi hari ini                  |
| **Notulensi**  | `GET /api/notulensi`                | Daftar notulensi                   |
|                | `POST /api/notulensi`               | Buat notulensi baru                |
|                | `PUT /api/notulensi/:id`            | Update notulensi                   |
|                | `DELETE /api/notulensi/:id`         | Hapus notulensi                    |
|                | `POST /api/notulensi/:id/broadcast` | Broadcast notula via email         |
| **Undangan**   | `GET /api/undangan`                 | Daftar undangan                    |
|                | `POST /api/undangan`                | Buat undangan baru                 |
|                | `PUT /api/undangan/:id`             | Update undangan                    |
|                | `DELETE /api/undangan/:id`          | Hapus undangan                     |
| **QR**         | `POST /api/qr/generate`             | Generate QR Code presensi          |
|                | `POST /api/qr/submit`               | Submit presensi tamu via QR        |
|                | `GET /api/qr/:id`                   | Get data QR Code                   |
| **Jadwal**     | `GET /api/jadwal-rapat`             | Daftar semua jadwal                |
|                | `POST /api/jadwal-rapat`            | Buat jadwal baru                   |
|                | `PUT /api/jadwal-rapat/:id`         | Update jadwal                      |
|                | `DELETE /api/jadwal-rapat/:id`      | Hapus jadwal                       |
|                | `GET /api/jadwal-rapat/today`       | Jadwal aktif hari ini (filter tim) |
| **Notifikasi** | `GET /api/notifications/:userId`    | Daftar notifikasi user             |
|                | `PUT /api/notifications/:id/read`   | Tandai notifikasi sudah dibaca     |
|                | `GET /api/sse/:userId`              | SSE stream notifikasi real-time    |

---

## 8. Alur Pengguna (User Flow)

### 8.1 Alur Registrasi Pegawai/Magang

```
Halaman Login
  → Klik "Daftar"
    → Masukkan Email
      → Sistem kirim OTP via email
        → Masukkan kode OTP (6 digit, berlaku 5 menit)
          → Isi form: Nama, Password, Kategori, Tim
            → Registrasi berhasil → Auto-redirect ke Login
```

### 8.2 Alur Presensi Pegawai

```
Login
  → Dashboard (lihat statistik)
    → Klik "Presensi" di sidebar
      → Pilih Jenis Kegiatan
        → Isi Tanda Tangan Digital
          → Submit Presensi
            → Muncul konfirmasi sukses / peringatan presensi ganda
```

### 8.3 Alur Presensi Tamu (QR)

```
Admin → Buat QR Code di Jadwal Rapat
  → Tampilkan / cetak / bagikan QR Code
    → Tamu scan QR
      → Browser buka URL presensi tamu (tanpa login)
        → Isi: Nama, Instansi, Email, Tanda Tangan
          → Submit → Presensi tamu tercatat
```

### 8.4 Alur Broadcast Notulensi

```
Buat Notulensi (isi form lengkap + simpan)
  → Klik "Broadcast Email"
    → Sistem mengidentifikasi peserta (presensi + email)
      → Email dikirim satu per satu secara async
        → Progress bar SSE menampilkan kemajuan real-time
          → Notifikasi selesai muncul
```

---

## 9. Konfigurasi & Deployment

### 9.1 Variabel Environment (server/.env)

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=absensi_notulensi

# Email SMTP
EMAIL_USER=admin_server@bpskotasurabaya.com
EMAIL_PASS=your_smtp_password

# Server
PORT=3001
```

### 9.2 Port Default

| Service           | Port   |
| ----------------- | ------ |
| Frontend (Vite)   | `5173` |
| Backend (Express) | `3001` |

### 9.3 Perintah Menjalankan Proyek

```bash
# Install semua dependency
pnpm install && cd server && pnpm install && cd ..

# Jalankan frontend + backend bersamaan
pnpm start

# Jalankan hanya frontend
pnpm dev

# Jalankan hanya backend
pnpm dev:backend

# Build production
pnpm build
```

### 9.4 Inisialisasi Database

- Import file SQL: `absensi_notulensi.sql`
- Database: `absensi_notulensi`
- Migrasi otomatis dijalankan saat server startup

### 9.5 Akun Admin Default

| Field    | Value               |
| -------- | ------------------- |
| Email    | `admin@absensi.com` |
| Password | `admin123`          |

---

## 10. Kriteria Penerimaan (Acceptance Criteria)

| ID    | Fitur                     | Kriteria Penerimaan                                                               |
| ----- | ------------------------- | --------------------------------------------------------------------------------- |
| AC-01 | Registrasi via OTP        | User baru berhasil terdaftar hanya setelah OTP yang valid diverifikasi            |
| AC-02 | Pencegahan presensi ganda | Sistem menolak presensi kedua untuk kegiatan yang sama pada hari yang sama        |
| AC-03 | QR Code tamu              | Tamu dapat mengisi presensi via QR tanpa memiliki akun                            |
| AC-04 | Broadcast email notulensi | Email terkirim ke semua peserta dengan email yang hadir di kegiatan yang dimaksud |
| AC-05 | Blokir/Unblokir otomatis  | Akun ter-unblokir sesuai waktu yang ditentukan tanpa intervensi admin             |
| AC-06 | Dashboard real-time       | Data statistik dashboard berubah setelah refresh tanpa reload halaman             |
| AC-07 | Jadwal berulang           | Jadwal dengan tipe `weekly` muncul setiap minggu pada hari yang tepat             |
| AC-08 | Notifikasi SSE            | User menerima notifikasi baru tanpa perlu me-refresh halaman                      |
| AC-09 | Export PDF presensi       | PDF yang dihasilkan berisi data yang benar dengan format kolom yang ditentukan    |
| AC-10 | Panel admin terlindungi   | Halaman Panel Admin tidak dapat diakses oleh user dengan role `user`              |

---

## 11. Risiko & Mitigasi

| Risiko                          | Dampak | Kemungkinan | Mitigasi                                                         |
| ------------------------------- | ------ | ----------- | ---------------------------------------------------------------- |
| Server SMTP down                | Tinggi | Sedang      | Pengiriman email async; sistem tetap berjalan tanpa email        |
| Database tidak tersedia         | Tinggi | Rendah      | Gunakan connection pool; tampilkan pesan error yang informatif   |
| Crash akibat ekstensi browser   | Sedang | Tinggi      | Patch `removeChild`/`insertBefore` di `main.tsx`                 |
| QR Code disalahgunakan          | Sedang | Rendah      | Pencegahan presensi ganda berdasarkan nama + email tamu          |
| Kebocoran data password         | Tinggi | Rendah      | bcrypt hash; password tidak pernah dikirim dalam response API    |
| Kapasitas koneksi DB terlampaui | Sedang | Rendah      | Connection pool (max 10); queue unlimited untuk request berlebih |

---

## 12. Riwayat Perubahan Dokumen

| Versi | Tanggal       | Perubahan               | Penulis               |
| ----- | ------------- | ----------------------- | --------------------- |
| 1.0   | 20 Maret 2026 | Dokumen awal PRD dibuat | Tim Pengembang Syntak |

---

_Dokumen ini merupakan Product Requirements Document resmi untuk sistem Syntak yang dikembangkan sebagai proyek internal BPS Kota Surabaya. Segala perubahan fitur atau arsitektur yang signifikan harus diperbarui di dokumen ini._
