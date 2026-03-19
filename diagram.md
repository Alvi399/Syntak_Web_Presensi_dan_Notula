# Diagram Sistem Syntak

Dokumentasi visual arsitektur dan alur sistem **Syntak** — Sistem Presensi, Notulensi, Undangan, dan Jadwal Rapat BPS Kota Surabaya.

---

## 1. Use Case Diagram

```mermaid
graph TD
    subgraph Actors["👤 Aktor"]
        A[Admin]
        P[Pegawai / Magang]
        T[Tamu]
    end

    subgraph UC_AUTH["🔐 Autentikasi"]
        UC1([Registrasi dengan OTP])
        UC2([Login])
        UC3([Edit Profil])
        UC4([Logout])
    end

    subgraph UC_DASH["📊 Dashboard"]
        UC5([Lihat Statistik Presensi])
        UC6([Lihat Grafik Kehadiran])
        UC7([Refresh Data Dashboard])
    end

    subgraph UC_ABS["✅ Presensi"]
        UC8([Isi Presensi Kegiatan])
        UC9([Tanda Tangan Digital])
        UC10([Lihat Riwayat Presensi])
        UC11([Export Laporan PDF])
        UC12([Buat QR Code Presensi])
        UC13([Isi Presensi via QR])
    end

    subgraph UC_NOT["📝 Notulensi"]
        UC14([Buat Notulensi])
        UC15([Edit / Hapus Notulensi])
        UC16([Broadcast Email Notulensi])
    end

    subgraph UC_UND["✉️ Undangan"]
        UC17([Buat Surat Undangan])
        UC18([Edit / Hapus Undangan])
        UC19([Upload File Undangan])
    end

    subgraph UC_JAD["📅 Jadwal Rapat"]
        UC20([Lihat Jadwal Rapat])
        UC21([Buat Jadwal Rapat])
        UC22([Atur Jadwal Berulang])
        UC23([Hapus Jadwal])
    end

    subgraph UC_ADM["🛡️ Panel Admin"]
        UC24([Kelola User])
        UC25([Blokir / Unblokir User])
        UC26([Lihat Log Aktivitas])
        UC27([Hapus Log Aktivitas])
        UC28([Set Role Admin])
    end

    %% Admin use cases
    A --> UC1
    A --> UC2
    A --> UC3
    A --> UC4
    A --> UC5
    A --> UC6
    A --> UC7
    A --> UC10
    A --> UC11
    A --> UC12
    A --> UC14
    A --> UC15
    A --> UC16
    A --> UC17
    A --> UC18
    A --> UC19
    A --> UC20
    A --> UC21
    A --> UC22
    A --> UC23
    A --> UC24
    A --> UC25
    A --> UC26
    A --> UC27
    A --> UC28

    %% Pegawai/Magang use cases
    P --> UC1
    P --> UC2
    P --> UC3
    P --> UC4
    P --> UC5
    P --> UC6
    P --> UC7
    P --> UC8
    P --> UC9
    P --> UC10
    P --> UC14
    P --> UC15
    P --> UC17
    P --> UC18
    P --> UC19
    P --> UC20

    %% UC8 includes UC9
    UC8 -->|"includes"| UC9

    %% Tamu use cases
    T --> UC13
    T --> UC9
```

---

## 2. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS {
        varchar id PK
        varchar nama
        varchar email
        varchar password
        varchar kategori
        varchar tim
        varchar jabatan
        varchar role
        tinyint is_blocked
        varchar block_reason
        varchar block_note
        datetime blocked_until
        datetime tanggal_daftar
        datetime created_at
        datetime updated_at
    }

    OTPS {
        varchar id PK
        varchar email
        varchar otp_code
        datetime expires_at
        tinyint is_verified
        datetime created_at
    }

    ABSENSI {
        varchar id PK
        varchar userId FK
        varchar jenisKegiatan
        date tanggal
        text tandaTangan
        varchar status_kehadiran
        tinyint is_guest
        varchar guest_nama
        varchar guest_instansi
        varchar guest_email
        varchar qr_code_id FK
        varchar id_kegiatan FK
        datetime created_at
    }

    NOTULENSI {
        varchar id PK
        varchar userId FK
        varchar judul
        varchar jenisKegiatan
        text ringkasan
        text diskusi
        text kesimpulan
        text tanya_jawab
        text agenda
        varchar tempat
        varchar waktu
        varchar hari
        varchar pemandu
        text tanda_tangan
        blob foto
        varchar id_kegiatan FK
        datetime created_at
        datetime updated_at
    }

    UNDANGAN {
        varchar id PK
        varchar userId FK
        varchar nomor_surat
        varchar sifat
        varchar lampiran
        varchar perihal
        text kepada
        text isi_surat
        varchar hari
        date tanggal_kegiatan
        varchar waktu
        varchar tempat
        text isi_penutup
        text tanda_tangan
        varchar jabatan_ttd
        varchar nip
        varchar file_nama
        varchar file_tipe
        bigint file_ukuran
        longblob file_data
        datetime created_at
    }

    JADWAL_RAPAT {
        varchar id PK
        varchar created_by FK
        varchar judul
        text deskripsi
        date tanggal
        time jam_mulai
        time jam_selesai
        json tim
        json peserta
        enum repeat_type
        json repeat_days
        date repeat_until
        varchar jenis_kegiatan
        int open_offset_minutes
        int close_offset_minutes
        int lateness_threshold_minutes
        tinyint allow_stack
        varchar peserta_mode
        json peserta_spesifik
        varchar active_qr_id
        tinyint is_active
        datetime created_at
    }

    QR_ABSENSI_CODES {
        varchar id PK
        varchar id_kegiatan
        varchar created_by FK
        tinyint is_active
        datetime created_at
    }

    NOTIFICATIONS {
        varchar id PK
        varchar user_id FK
        varchar type
        varchar title
        text message
        varchar ref_id
        varchar ref_type
        tinyint is_read
        datetime created_at
    }

    ACTIVITY_LOGS {
        varchar id PK
        varchar userId FK
        varchar action
        text description
        datetime created_at
    }

    %% Relationships
    USERS ||--o{ ABSENSI : "melakukan"
    USERS ||--o{ NOTULENSI : "membuat"
    USERS ||--o{ UNDANGAN : "membuat"
    USERS ||--o{ JADWAL_RAPAT : "membuat"
    USERS ||--o{ QR_ABSENSI_CODES : "generate"
    USERS ||--o{ NOTIFICATIONS : "menerima"
    USERS ||--o{ ACTIVITY_LOGS : "menghasilkan"
    JADWAL_RAPAT ||--o{ ABSENSI : "mencatat"
    JADWAL_RAPAT ||--o{ NOTULENSI : "didokumentasikan"
    QR_ABSENSI_CODES ||--o{ ABSENSI : "digunakan oleh"
```

---

## 3. Sequence Diagram — Alur Registrasi dengan OTP

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (React)
    participant BE as Backend (Express)
    participant DB as Database (MySQL)
    participant SMTP as Email Server

    User->>FE: Masukkan email
    FE->>BE: POST /api/auth/send-otp {email}
    BE->>DB: Cek apakah email sudah terdaftar
    DB-->>BE: Email belum ada
    BE->>DB: Simpan OTP (berlaku 5 menit)
    BE-->>FE: {success: true, expiresAt}
    BE-)SMTP: Kirim email OTP (async/fire-and-forget)
    FE-->>User: Tampilkan form OTP

    User->>FE: Masukkan kode OTP
    FE->>BE: POST /api/auth/verify-otp {email, otp}
    BE->>DB: Cek OTP valid & belum expired
    DB-->>BE: OTP valid
    BE->>DB: Tandai OTP as verified
    BE-->>FE: {success: true}
    FE-->>User: Tampilkan form data lengkap

    User->>FE: Isi nama, password, kategori, tim
    FE->>BE: POST /api/auth/register {nama, email, password, kategori, tim, otp}
    BE->>DB: Cek OTP sudah diverifikasi
    BE->>DB: Hash password + INSERT ke tabel users
    BE->>DB: DELETE OTP yang sudah dipakai
    DB-->>BE: User berhasil dibuat
    BE-->>FE: {success: true, message: "Registrasi berhasil"}
    FE-->>User: Redirect ke halaman Login
```

---

## 4. Sequence Diagram — Presensi via QR Code (Tamu)

```mermaid
sequenceDiagram
    actor Admin
    actor Tamu
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database

    Admin->>FE: Klik "Generate QR" pada jadwal rapat
    FE->>BE: POST /api/qr/generate {id_kegiatan}
    BE->>DB: INSERT ke qr_absensi_codes (UUID baru)
    DB-->>BE: QR ID
    BE-->>FE: {qrId, url}
    FE-->>Admin: Tampilkan QR Code (react-qr-code)

    Admin->>Tamu: Bagikan QR Code (cetak / layar)

    Tamu->>FE: Scan QR via kamera / buka URL
    FE->>BE: GET /api/qr/:id
    BE->>DB: Validasi QR aktif
    DB-->>BE: Data QR valid
    BE-->>FE: Data kegiatan
    FE-->>Tamu: Tampilkan form presensi tamu

    Tamu->>FE: Isi Nama, Instansi, Email, Tanda Tangan
    FE->>BE: POST /api/qr/submit {qrId, nama, instansi, email, ttd}
    BE->>DB: Cek presensi ganda (nama + email + id_kegiatan)
    DB-->>BE: Belum ada duplikat
    BE->>DB: INSERT ke tabel absensi (is_guest = 1)
    DB-->>BE: Berhasil
    BE-->>FE: {success: true}
    FE-->>Tamu: Konfirmasi presensi berhasil ✅
```

---

## 5. Sequence Diagram — Broadcast Email Notulensi

```mermaid
sequenceDiagram
    actor Admin
    participant FE as Frontend (SSE Stream)
    participant BE as Backend
    participant DB as Database
    participant SMTP as Email Server (Hostinger)

    Admin->>FE: Klik "Broadcast Email" pada notulensi
    FE->>BE: POST /api/notulensi/:id/broadcast
    BE->>DB: Ambil data notulensi
    BE->>DB: Ambil daftar absensi (id_kegiatan sama)
    DB-->>BE: List peserta (pegawai + tamu dengan email)

    loop Kirim email ke setiap peserta
        BE-)SMTP: Kirim email notulensi (async pool)
        BE-)FE: SSE event: broadcast_progress {current, total}
        FE-->>Admin: Update progress bar real-time
    end

    BE->>DB: Simpan notifikasi ke tabel notifications
    BE-)FE: SSE event: broadcast_complete
    FE-->>Admin: Progress bar 100% + notifikasi selesai ✅
```

---

## 6. Flowchart — Alur Login & Validasi Blokir

```mermaid
flowchart TD
    Start([Mulai]) --> InputForm[User isi Email & Password]
    InputForm --> PostLogin[POST /api/auth/login]
    PostLogin --> CekUser{User ada?}

    CekUser -- Tidak --> ErrCred[❌ Email atau password salah]
    ErrCred --> InputForm

    CekUser -- Ya --> CekPass{Password cocok?}
    CekPass -- Tidak --> ErrCred

    CekPass -- Ya --> CekBlokir{is_blocked = 1?}

    CekBlokir -- Tidak --> LoginBerhasil[✅ Login Berhasil]
    LoginBerhasil --> SaveSession[Simpan data user ke localStorage]
    SaveSession --> Dashboard[Tampilkan Dashboard]

    CekBlokir -- Ya --> CekWaktu{Ada blocked_until?}

    CekWaktu -- Tidak --> ErrBlokir[❌ Akun diblokir permanen\nHubungi admin]

    CekWaktu -- Ya --> CekExpiry{Waktu blokir sudah lewat?}

    CekExpiry -- Ya --> AutoUnblock[UPDATE is_blocked = 0\nHapus block_reason]
    AutoUnblock --> LoginBerhasil

    CekExpiry -- Tidak --> ErrTempBlokir[❌ Akun diblokir sampai...\nTampilkan waktu & alasan]
    ErrTempBlokir --> InputForm
```

---

## 7. Flowchart — Alur Pengisian Presensi Pegawai

```mermaid
flowchart TD
    Start([Buka Halaman Presensi]) --> LoadJadwal[Load jadwal aktif hari ini]
    LoadJadwal --> AmbilData[Tampilkan daftar kegiatan tersedia]

    AmbilData --> PilihKegiatan[User pilih jenis kegiatan]
    PilihKegiatan --> CekPeserta{Mode peserta spesifik?}

    CekPeserta -- Ya --> CekDiundang{User ada di daftar peserta?}
    CekDiundang -- Tidak --> ErrTidakDiundang[❌ Anda tidak termasuk\ndalam peserta kegiatan ini]
    ErrTidakDiundang --> AmbilData

    CekDiundang -- Ya --> CekDuplikat
    CekPeserta -- Tidak --> CekDuplikat{Sudah presensi\nkali ini hari ini?}

    CekDuplikat -- Ya --> ErrDuplikat[❌ Presensi ganda!\nAnda sudah hadir hari ini]
    ErrDuplikat --> AmbilData

    CekDuplikat -- Tidak --> IsianTTD[Tampilkan Signature Pad]
    IsianTTD --> IsiTTD[User tanda tangan digital]
    IsiTTD --> CekTTD{TTD kosong?}
    CekTTD -- Ya --> IsianTTD

    CekTTD -- Tidak --> CekWaktu{Waktu presensi\nvs jam mulai + threshold}
    CekWaktu -- Dalam batas --> StatusHadir[status = 'hadir']
    CekWaktu -- Lewat batas --> StatusTerlambat[status = 'terlambat']

    StatusHadir --> Submit[POST /api/absensi]
    StatusTerlambat --> Submit

    Submit --> DB[(Database)]
    DB --> Sukses[✅ Presensi berhasil dicatat!]
    Sukses --> UpdateDashboard[Dashboard diperbarui]
```

---

## 8. Arsitektur Komponen Frontend

```mermaid
graph TB
    subgraph Entry["Entry Point"]
        main["main.tsx\n(React DOM + ErrorBoundary\n+ DOM Patch)"]
    end

    subgraph Root["Root App"]
        App["App.tsx\n(Layout + Auth + Routing)"]
    end

    subgraph Pages["Halaman Utama"]
        Dashboard["Dashboard.tsx"]
        Presensi["Presensi.tsx"]
        PresensiTamu["PresensiTamu.tsx"]
        Notula["Notula.tsx"]
        Undangan["Undangan.tsx"]
        AdminPanel["AdminPanel.tsx"]
        Login["Login.tsx"]
    end

    subgraph Components["Komponen Bersama"]
        SignaturePad["SignaturePad.tsx"]
        NotifBell["NotificationBell.tsx"]
        BroadcastBar["BroadcastProgressBar.tsx"]
        EditProfile["EditProfileDialog.tsx"]
        UI["shadcn/ui components"]
    end

    subgraph Services["Layanan & State"]
        authService["authService.ts\n(Auth + User Management)"]
        dataService["dataService.ts\n(Presensi + Notula Data)"]
        useNotifs["useNotifications.ts\n(SSE Hook + State)"]
    end

    subgraph Backend["Backend"]
        API["Express API\nserver/index.js"]
        MySQL[("MySQL DB")]
        SMTP["Hostinger SMTP"]
        SSE["SSE Stream"]
    end

    main --> App
    App --> Login
    App --> Dashboard
    App --> Presensi
    App --> PresensiTamu
    App --> Notula
    App --> Undangan
    App --> AdminPanel
    App --> NotifBell
    App --> BroadcastBar

    Dashboard --> EditProfile
    Presensi --> SignaturePad
    PresensiTamu --> SignaturePad
    Notula --> UI
    Undangan --> UI
    AdminPanel --> UI

    Dashboard --> authService
    Dashboard --> dataService
    Presensi --> authService
    Presensi --> dataService
    AdminPanel --> authService

    App --> useNotifs
    useNotifs --> SSE

    authService --> API
    dataService --> API
    API --> MySQL
    API --> SMTP
    API --> SSE
```

---

## 9. State Machine — Siklus Hidup Akun User

```mermaid
stateDiagram-v2
    [*] --> Terdaftar : Registrasi + OTP verifikasi

    Terdaftar --> AktifUser : Login (role=user)
    Terdaftar --> AktifAdmin : Login (role=admin)

    AktifUser --> Diblokir : Admin blokir user
    AktifAdmin --> Diblokir : Admin lain blokir

    Diblokir --> AktifUser : Waktu blokir selesai (auto)\natau Admin unblokir (manual)
    Diblokir --> Diblokir : Mencoba login → ditolak\n(tampilkan alasan + waktu)

    AktifUser --> AktifAdmin : Admin set role=admin
    AktifAdmin --> AktifUser : Admin set role=user

    AktifUser --> [*] : Admin hapus akun
    AktifAdmin --> [*] : Admin hapus akun
    Terdaftar --> [*] : Admin hapus akun
```

---

_Dokumen diagram ini dibuat otomatis berdasarkan analisis source code proyek Syntak._  
_Semua diagram menggunakan format Mermaid dan dapat dirender di GitHub, VSCode, atau Mermaid Live Editor._
