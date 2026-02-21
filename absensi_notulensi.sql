-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Dec 10, 2025 at 04:05 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `absensi_notulensi`
--

-- --------------------------------------------------------

--
-- Table structure for table `absensi`
--

CREATE TABLE `absensi` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `nama_user` varchar(255) NOT NULL,
  `jenis_kegiatan` enum('senam','apel','rapelan','doa-bersama','rapat') NOT NULL,
  `nama_kegiatan` varchar(255) DEFAULT NULL,
  `tanggal` date NOT NULL,
  `waktu` time NOT NULL,
  `signature` text NOT NULL,
  `status` enum('hadir','tidak-hadir') DEFAULT 'hadir',
  `instansi` varchar(255) DEFAULT NULL,
  `is_guest` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `nama_user` varchar(255) NOT NULL,
  `aktivitas` text NOT NULL,
  `tanggal` date NOT NULL,
  `waktu` time NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notulensi`
--

CREATE TABLE `notulensi` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `nama_user` varchar(255) NOT NULL,
  `judul` varchar(500) NOT NULL,
  `jenis_kegiatan` enum('rapat','doa','rapelan','lainnya') NOT NULL,
  `isi` text NOT NULL,
  `tanggal` date NOT NULL,
  `waktu` time NOT NULL,
  `foto` text DEFAULT NULL,
  `hari` varchar(50) DEFAULT NULL,
  `jam` varchar(50) DEFAULT NULL,
  `tempat` varchar(255) DEFAULT NULL,
  `agenda` text DEFAULT NULL,
  `signature` text DEFAULT NULL,
  `pemandu` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `qr_absensi_codes`
--

CREATE TABLE `qr_absensi_codes` (
  `id` varchar(36) NOT NULL,
  `jenis_kegiatan` enum('senam','apel','rapelan','doa-bersama','rapat') NOT NULL,
  `nama_kegiatan` varchar(255) DEFAULT NULL,
  `created_by` varchar(36) NOT NULL,
  `created_by_name` varchar(255) NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `undangan`
--

CREATE TABLE `undangan` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `nama_user` varchar(255) NOT NULL,
  `tempat` varchar(255) NOT NULL,
  `tanggal` date NOT NULL,
  `nomor_surat` varchar(255) NOT NULL,
  `sifat` varchar(100) NOT NULL,
  `lampiran` text DEFAULT NULL,
  `perihal` text NOT NULL,
  `kepada` varchar(255) NOT NULL,
  `isi_surat` text NOT NULL,
  `hari_tanggal_waktu` varchar(255) NOT NULL,
  `tempat_kegiatan` varchar(255) NOT NULL,
  `tanda_tangan` text DEFAULT NULL,
  `jabatan_penandatangan` varchar(255) DEFAULT NULL,
  `nip` varchar(100) DEFAULT NULL,
  `isi_penutup` text DEFAULT NULL,
  `is_uploaded_file` tinyint(1) DEFAULT 0,
  `uploaded_file_name` varchar(255) DEFAULT NULL,
  `uploaded_file_type` varchar(100) DEFAULT NULL,
  `uploaded_file_data` longtext DEFAULT NULL,
  `uploaded_file_size` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `nama` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `kategori` enum('Pegawai','Magang') NOT NULL,
  `role` enum('user','admin') DEFAULT 'user',
  `tanggal_daftar` datetime DEFAULT current_timestamp(),
  `is_blocked` tinyint(1) DEFAULT 0,
  `block_reason` enum('izin','sakit','alpa','izin-telat') DEFAULT NULL,
  `block_note` text DEFAULT NULL,
  `blocked_until` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `nama`, `email`, `password`, `kategori`, `role`, `tanggal_daftar`, `is_blocked`, `block_reason`, `block_note`, `blocked_until`, `created_at`, `updated_at`) VALUES
('e1180a6d-d5cc-11f0-a035-784561ec85a4', 'Administrator', 'admin@absensi.com', '$2b$10$OvAb3WrBd2bVAZIJPkQPSOSeCxkvIzNp1f46s3dg/jrhBz34uHoBy', 'Pegawai', 'admin', '2025-12-10 20:33:57', 0, NULL, NULL, NULL, '2025-12-10 20:33:57', '2025-12-10 20:33:57'),
('ec6e766b-4491-46fd-a19e-47ccf292254a', 'Mohammed Firaz Rajief Bismaka', 'firaz@gmail.com', '$2a$10$EpRbdKgDRKoGlW5x20NxJOCd.iqzxTAbYm2HCiG74rprHK1d3R3UK', 'Magang', 'user', '2025-12-10 21:26:00', 0, NULL, NULL, NULL, '2025-12-10 21:26:00', '2025-12-10 21:26:00');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `absensi`
--
ALTER TABLE `absensi`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_absensi_user_id` (`user_id`),
  ADD KEY `idx_absensi_tanggal` (`tanggal`),
  ADD KEY `idx_absensi_jenis_kegiatan` (`jenis_kegiatan`),
  ADD KEY `idx_absensi_is_guest` (`is_guest`),
  ADD KEY `idx_absensi_created_at` (`created_at`);

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_activity_logs_user_id` (`user_id`),
  ADD KEY `idx_activity_logs_created_at` (`created_at`),
  ADD KEY `idx_activity_logs_tanggal` (`tanggal`);

--
-- Indexes for table `notulensi`
--
ALTER TABLE `notulensi`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notulensi_user_id` (`user_id`),
  ADD KEY `idx_notulensi_tanggal` (`tanggal`),
  ADD KEY `idx_notulensi_jenis_kegiatan` (`jenis_kegiatan`),
  ADD KEY `idx_notulensi_created_at` (`created_at`);

--
-- Indexes for table `qr_absensi_codes`
--
ALTER TABLE `qr_absensi_codes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `idx_qr_codes_is_active` (`is_active`),
  ADD KEY `idx_qr_codes_created_at` (`created_at`),
  ADD KEY `idx_qr_codes_jenis_kegiatan` (`jenis_kegiatan`);

--
-- Indexes for table `undangan`
--
ALTER TABLE `undangan`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_undangan_user_id` (`user_id`),
  ADD KEY `idx_undangan_tanggal` (`tanggal`),
  ADD KEY `idx_undangan_created_at` (`created_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_users_email` (`email`),
  ADD KEY `idx_users_role` (`role`),
  ADD KEY `idx_users_is_blocked` (`is_blocked`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `absensi`
--
ALTER TABLE `absensi`
  ADD CONSTRAINT `absensi_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notulensi`
--
ALTER TABLE `notulensi`
  ADD CONSTRAINT `notulensi_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `qr_absensi_codes`
--
ALTER TABLE `qr_absensi_codes`
  ADD CONSTRAINT `qr_absensi_codes_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `undangan`
--
ALTER TABLE `undangan`
  ADD CONSTRAINT `undangan_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
