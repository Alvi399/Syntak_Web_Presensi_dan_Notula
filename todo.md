# Website Absensi Digital - Todo List

## MVP Implementation Plan

### 1. Core Components (8 files max)
- **src/pages/Login.tsx** - Halaman login dan registrasi
- **src/pages/Dashboard.tsx** - Dashboard utama dengan grafik dan statistik
- **src/pages/Absensi.tsx** - Halaman absensi dengan signature pad
- **src/pages/Notulensi.tsx** - Halaman notulensi dengan CRUD
- **src/pages/AdminPanel.tsx** - Panel admin untuk monitoring dan pengelolaan
- **src/components/SignaturePad.tsx** - Komponen tanda tangan digital
- **src/lib/auth.ts** - Authentication logic dan session management
- **src/lib/data.ts** - Data management dan local storage

### 2. Features to Implement
#### Authentication System
- [x] Login form dengan email/password
- [x] Registrasi dengan nama, email, password, kategori (Pegawai/Magang)
- [x] Role-based access (user/admin)
- [x] Session management dengan localStorage
- [x] Logout functionality

#### Dashboard
- [x] Grafik absensi hari ini (pie chart)
- [x] Total absensi hari ini
- [x] Rekap absensi bulan ini
- [x] Rekap notulen hari ini
- [x] Aktivitas terbaru (5-10 aktivitas terakhir)

#### Halaman Absensi
- [x] Form pilihan jenis kegiatan (senam, apel, rapelan, doa bersama)
- [x] Signature pad untuk tanda tangan digital
- [x] Petunjuk absensi
- [x] Submit dan simpan data otomatis

#### Halaman Notulensi
- [x] Statistik notulensi (total, bulan ini, kontributor)
- [x] Daftar notulensi terpisah (rapat vs doa/laporan)
- [x] CRUD operations (tambah, edit, hapus, baca)
- [x] Upload foto bukti
- [x] Export PDF functionality

#### Admin Panel
- [x] Monitoring absensi (laporan harian/mingguan/bulanan)
- [x] Filter dan export data
- [x] Monitoring notulensi
- [x] Pengelolaan user (tambah, edit, hapus, reset password)
- [x] Activity log/audit trail
- [x] Pengaturan sistem

### 3. Technical Implementation
- Frontend: React + TypeScript + Tailwind CSS + shadcn/ui
- State Management: localStorage untuk data persistence
- Charts: Recharts (sudah tersedia di template)
- Signature: Canvas-based signature pad
- PDF Export: jsPDF library
- Responsive design untuk mobile dan desktop

### 4. UI/UX Design
- Layout bersih dan profesional
- Sidebar navigasi dengan menu sesuai role
- Color scheme: biru/abu-abu profesional
- Responsive untuk HP dan komputer
- Modern card-based design