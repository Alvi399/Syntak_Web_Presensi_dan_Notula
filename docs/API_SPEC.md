# API Specification - Syntak

Base URL: `http://localhost:3001/api` (Development)

## Authentication

### POST `/api/auth/send-otp`
Sends a 6-digit OTP to the specified email.
- **Body**: `{ email }`
- **Response**: `{ success, message, expiresAt }`

### POST `/api/auth/verify-otp`
Verifies an OTP code.
- **Body**: `{ email, otp }`
- **Response**: `{ success, message }`

### POST `/api/auth/register`
Registers a new user.
- **Body**: `{ nama, email, password, kategori, tim, otp, role }`
- **Response**: `{ success, message }`

### POST `/api/auth/login`
Authenticates a user.
- **Body**: `{ email, password }`
- **Response**: `{ success, message, user: { id, nama, role, ... } }`

## Attendance (Absensi)

### GET `/api/absensi`
Lists attendance records.
- **Query**: `userId`, `tanggal`, `jenisKegiatan`
- **Response**: `Array<Absensi>`

### POST `/api/absensi`
Records manual or user check-in.
- **Body**: `{ userId, namaUser, jenisKegiatan, tanggal, waktu, signature, ... }`

### POST `/api/absensi/guest`
Records guest check-in via QR scan.
- **Body**: `{ namaUser, instansi, email, jenisKegiatan, signature, ... }`

## Activities (Jadwal Rapat)

### GET `/api/jadwal-rapat`
Retrieves all schedules.
- **Response**: `Array<Jadwal>`

### GET `/api/jadwal-rapat/active`
Retrieves schedules relevant to the user for the current day.
- **Query**: `tim`, `kategori`

### POST `/api/jadwal-rapat`
Creates a meeting schedule (supports recurrence).
- **Body**: `{ judul, tanggal, jamMulai, jamSelesai, repeatType, ... }`

## Minutes (Notulensi)

### GET `/api/notulensi`
Lists all meeting minutes.

### POST `/api/notulensi`
Saves new minutes.
- **Body**: `{ judul, ringkasan, diskusi, kesimpulan, foto (Array), ... }`

### POST `/api/notulensi/:id/broadcast`
Blasts the minutes content to all participants via email.

## Invitations (Undangan)

### POST `/api/undangan`
Creates or updates an invitation letter.
- **Body**: `{ id_kegiatan, perihal, nomor_surat, kepada, isi_surat, ... }`

### POST `/api/undangan/:id/broadcast`
Triggers real-time notification and email blast to all invited users.

## QR System

### POST `/api/qr/generate`
Generates an attendance QR code for a specific activity.
- **Body**: `{ jenisKegiatan, namaKegiatan, expiresAt, idKegiatan }`

### GET `/api/qr/:id`
Retrieves QR data for scanning (checks expiry).

## System

### GET `/api/sse/:userId`
SSE stream for real-time updates and notifications.
- **Events**: `notification`, `data_update`, `broadcast_progress`, `broadcast_complete`.
