## Sistem Presensi, Notulensi, Undangan, dan Jadwal Rapat "Syntak"

Aplikasi **Syntak** adalah sistem internal BPS Kota Surabaya untuk:

- **Presensi kegiatan** (pegawai, magang, dan tamu/undangan, termasuk via QR Code)
- **Pencatatan notulensi rapat/kegiatan**
- **Penyusunan dan pengarsipan surat undangan**
- **Manajemen jadwal rapat** (termasuk repeat/berulang)
- **Panel admin** untuk mengelola user, aktivitas, dan data pendukung

Frontend dibangun dengan **React + Vite + TypeScript + Tailwind + shadcn/ui**, dan backend dengan **Node.js (Express) + MySQL**.

---

### Login Admin Default

- **Email**: `admin@absensi.com`  
- **Password**: `admin123`

Akun admin ini dibuat melalui endpoint backend `/api/auth/init-admin` (umumnya sudah dipanggil oleh sistem pada inisialisasi).

---

### Fitur Utama

- **Dashboard**
  - Ringkasan statistik presensi harian dan bulanan.
  - Statistik notulensi (total, per bulan, dan jumlah kontributor).
  - Grafik kehadiran pegawai vs magang.
  - Grafik tren absensi per jenis kegiatan (Senam, Apel, Rapat, Sharing Knowledge, Doa Bersama, Rapelan) untuk 5 bulan terakhir.
  - Visualisasi tingkat kehadiran hari ini (persentase hadir vs tidak hadir) dan breakdown per jenis kegiatan.

- **Presensi Pegawai/Magang**
  - User login (pegawai/magang) dapat melakukan presensi untuk kegiatan tertentu.
  - Sistem mencegah **presensi ganda** untuk kegiatan yang sama pada hari yang sama.
  - Tanda tangan digital disimpan bersama data kehadiran.

- **Presensi Tamu (Guest) via QR**
  - Admin/generator membuat **QR Code presensi** untuk suatu kegiatan.
  - Tamu memindai QR dan mengisi data (nama, instansi, email, tanda tangan).
  - Sistem mencegah presensi ganda untuk tamu pada kegiatan yang sama.

- **Notulensi**
  - Pencatatan berita acara lengkap: judul, jenis kegiatan, ringkasan, diskusi, kesimpulan, tanya jawab, agenda, tempat, waktu, hari, pemandu, serta tanda tangan.
  - Menyimpan foto dan konten notula dalam basis data.
  - **Broadcast notula via email** ke peserta kegiatan (pegawai dan tamu yang memiliki email dan tercatat presensi untuk `id_kegiatan` yang sama).

- **Surat Undangan**
  - Penyusunan surat undangan lengkap: nomor surat, sifat, lampiran, perihal, tujuan (kepada), isi surat, hari/tanggal/waktu kegiatan, tempat kegiatan, isi penutup, tanda tangan, jabatan penandatangan, NIP.
  - Opsional menyimpan file undangan yang diupload (nama file, tipe, ukuran, dan data file).
  - Penyimpanan terstruktur dalam tabel `undangan`.

- **Jadwal Rapat**
  - Pembuatan jadwal rapat dengan judul, deskripsi, tanggal, jam mulai & selesai, tim, dan kategori peserta.
  - Mendukung **repeat**:
    - `none` (sekali),
    - `daily` (harian),
    - `weekly` (mingguan pada hari yang sama),
    - `custom` (berdasarkan hari-hari tertentu dalam seminggu).
  - Endpoint untuk mengambil semua jadwal, serta jadwal **aktif hari ini** yang difilter berdasarkan `tim` dan `kategori` user.

- **Manajemen User & Aktivitas (Panel Admin)**
  - Melihat daftar user: nama, email, kategori (Pegawai/Magang), tim, role, status blokir.
  - Menambah/mengubah/menghapus user, termasuk set role `admin` / `user`.
  - Mekanisme **blokir user** dengan:
    - `reason` (alasan),
    - `note` (catatan),
    - `blocked_until` (otomatis diatur tergantung alasan, mis. "izin-telat" dibuka jam 15.00 hari yang sama).
  - Melihat log aktivitas (`activity_logs`) dan hapus satu/satu semua.

- **Keamanan & Keandalan**
  - **OTP verifikasi email** sebelum registrasi user baru (disimpan di tabel `otps`, dengan masa berlaku 5 menit).
  - Password disimpan dengan **bcrypt hash**.
  - Patch khusus di frontend untuk mencegah error `removeChild/insertBefore` yang disebabkan extension browser.
  - **ErrorBoundary** React untuk menampilkan halaman error yang ramah pengguna dan tombol "Muat Ulang".

---

### Teknologi yang Digunakan

- **Frontend**
  - React 19, React DOM
  - Vite
  - TypeScript
  - Tailwind CSS + tailwind-merge + tailwindcss-animate
  - shadcn/ui (komponen UI: button, card, dialog, form, dsb.)
  - Libraries tambahan: `recharts`, `react-hook-form`, `zod`, `@tanstack/react-query`, `lucide-react`, `react-qr-code`, `html5-qrcode`, `react-signature-canvas`, dll.

- **Backend**
  - Node.js + Express
  - MySQL (melalui `mysql2/promise`)
  - `bcryptjs` untuk hashing password
  - `nodemailer` untuk pengiriman email (Hostinger SMTP)
  - `dotenv` untuk konfigurasi environment

---

### Prasyarat

Pastikan software berikut sudah terpasang:

- **XAMPP** (atau server MySQL lain)
  - MySQL aktif dan dapat diakses di `localhost`.
- **Node.js** (disarankan versi terbaru LTS)
- **pnpm**
  - Install: `npm install -g pnpm`
  - Verifikasi: `pnpm --version`

Selain itu, siapkan:

- Database MySQL, misalnya dengan nama **`absensi_notulensi`**.
- Konfigurasi file **`server/.env`**.

Contoh minimal isi `server/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=absensi_notulensi

EMAIL_USER=admin_server@bpskotasurabaya.com
EMAIL_PASS=your_smtp_password
PORT=3001
```

> **Catatan**:  
> - Jika `EMAIL_USER` atau `EMAIL_PASS` tidak diset, pengiriman email OTP/broadcast akan dilewati (tidak error fatal, tapi fitur email tidak berjalan).  
> - Sesuaikan kredensial database dengan konfigurasi MySQL di XAMPP Anda.

---

### Instalasi

1. **Clone atau salin proyek ini** ke komputer Anda.
2. **Install dependency frontend (root)**:

   ```bash
   pnpm install
   ```

3. **Install dependency backend**:

   ```bash
   cd server
   pnpm install
   cd ..
   ```

4. **(Opsional)** Pastikan `concurrently` sudah terinstall di root (biasanya sudah dari `package.json`):

   ```bash
   pnpm add -D concurrently
   ```

---

### Menjalankan Proyek

Pastikan:

- MySQL sudah berjalan (mis. melalui XAMPP).
- Database `absensi_notulensi` sudah dibuat.  
  Script di backend akan otomatis membuat/memodifikasi beberapa tabel yang dibutuhkan:
  - `otps`
  - `users` (penambahan kolom `tim` bila belum ada)
  - `jadwal_rapat`
  - (Tabel lain seperti `absensi`, `notulensi`, `undangan`, `qr_absensi_codes`, `activity_logs` juga diperlukan; disesuaikan dengan skema yang sudah ada di server Anda.)

#### 1. Jalankan server + frontend bersamaan

Di root proyek:

```bash
pnpm start
```

Perintah ini akan menjalankan:

- Backend: `node ./server/index.js` (port default `3001`)
- Frontend: `vite` (port default `5173`)

#### 2. Jalankan terpisah (opsional)

- **Frontend saja**:

  ```bash
  pnpm dev
  ```

- **Backend saja**:

  ```bash
  pnpm dev:backend
  # atau dari folder server:
  # node index.js
  ```

---

### Alur Penggunaan Singkat

- **Admin**
  - Login dengan kredensial:
    - Email: `admin@absensi.com`
    - Password: `admin123`
  - Mengelola user (tambah/ubah/hapus, blokir/unblokir, set role admin/user).
  - Membuat jadwal rapat dan QR Code presensi.
  - Mengelola data presensi, notulensi, undangan.

- **User Pegawai/Magang**
  - Registrasi dengan verifikasi email via OTP.
  - Login, lalu:
    - Melihat dashboard pribadi.
    - Melakukan presensi kegiatan.
    - Menulis notulensi (jika diberi akses/fungsi tersebut).

- **Tamu/Undangan**
  - Mengisi presensi via QR Code yang dibuat admin (tanpa login).

---

### Struktur Proyek (Ringkas)

- `src/main.tsx`  
  Entry point React, dengan patch DOM dan `ErrorBoundary`.

- `src/App.tsx`  
  Layout utama aplikasi, sidebar navigasi, logic halaman aktif (`Dashboard`, `Presensi`, `Notula`, `Undangan`, `AdminPanel`, `PresensiTamu`).

- `src/pages/*`  
  Halaman-halaman utama:
  - `Dashboard.tsx`
  - `Presensi.tsx`
  - `PresensiTamu.tsx`
  - `Notula.tsx`
  - `Undangan.tsx`
  - `AdminPanel.tsx`
  - `Login.tsx`

- `src/components/ui/*`  
  Komponen UI dari shadcn/ui dan kostumisasi.

- `server/index.js`  
  Server Express + semua route utama:
  - `/api/auth/*` (OTP, register, login, user management, activity logs, init admin)
  - `/api/absensi/*`
  - `/api/notulensi/*`
  - `/api/undangan/*`
  - `/api/qr/*`
  - `/api/jadwal-rapat/*`

---

### Catatan Pengembangan

- Jalankan **`pnpm lint`** untuk cek masalah eslint pada kode frontend.
- Jika terjadi error tak terduga di UI, halaman error khusus akan muncul dengan tombol **"Muat Ulang"**.
- Patch pada `Node.prototype.removeChild` / `insertBefore` di `main.tsx` digunakan untuk menghindari crash akibat extension browser (password manager, ad blocker, dll.).

---

Jika Anda membutuhkan dokumentasi tambahan (misalnya diagram ERD database atau daftar lengkap endpoint API beserta contoh request/response), beri tahu saya dan saya bisa menambahkan bagian tersebut.