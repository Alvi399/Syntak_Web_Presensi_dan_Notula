import { apiClient } from './apiClient';
import { authService } from './authService';

export interface AbsensiRecord {
  id: string;
  userId: string;
  namaUser: string;
  jenisKegiatan: 'senam' | 'apel' | 'rapelan' | 'doa-bersama' | 'rapat';
  namaKegiatan: string;
  tanggal: string;
  waktu: string;
  signature: string;
  status: 'hadir' | 'tidak-hadir';
  instansi?: string;
  isGuest?: boolean;
}

export interface NotulensiRecord {
  id: string;
  userId: string;
  namaUser: string;
  judul: string;
  jenisKegiatan: 'rapat' | 'doa' | 'rapelan' | 'lainnya';
  isi: string;
  tanggal: string;
  waktu: string;
  foto?: string;
  hari?: string;
  jam?: string;
  tempat?: string;
  agenda?: string;
  signature?: string;
  pemandu?: string;
  linkedAbsensiId?: string;  // ← TAMBAHKAN INI
  isDraft?: boolean;          // ← TAMBAHKAN INI
  daftarHadirOtomatis?: string;
}

export interface UndanganRecord {
  id: string;
  userId: string;
  namaUser: string;
  tempat: string;
  tanggal: string;
  nomorSurat: string;
  sifat: string;
  lampiran?: string;
  perihal: string;
  kepada: string;
  isiSurat: string;
  hariTanggalWaktu: string;
  tempatKegiatan: string;
  tandaTangan?: string;
  jabatanPenandatangan?: string;
  nip?: string;
  createdAt: string;
  isiPenutup?: string;
  isUploadedFile?: boolean;
  uploadedFileName?: string;
  uploadedFileType?: string;
  uploadedFileData?: string;
  uploadedFileSize?: number;
}

export interface QRAbsensiCode {
  id: string;
  jenisKegiatan: 'senam' | 'apel' | 'rapelan' | 'doa-bersama' | 'rapat';
  namaKegiatan: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
}

class DataService {
  // ============================================
  // ABSENSI MANAGEMENT
  // ============================================

  async saveAbsensi(
    jenisKegiatan: string,
    namaKegiatan: string,
    signature: string
  ): Promise<boolean> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return false;

      // Validasi: Magang tidak bisa absen Rapelan
      if (currentUser.kategori === 'Magang' && jenisKegiatan === 'rapelan') {
        return false;
      }

      await apiClient.post('/absensi', {
        userId: currentUser.id,
        namaUser: currentUser.nama,
        jenisKegiatan,
        namaKegiatan,
        signature
      });

      await this.autoCreateDraftNotulensi(
        jenisKegiatan,
        namaKegiatan,
        currentUser.id,
        currentUser.nama
      );

      return true;
    } catch (error) {
      console.error('Save absensi error:', error);
      return false;
    }
  }

  // ============================================
  // HELPER: AUTO-CREATE DRAFT NOTULENSI
  // ============================================

  async autoCreateDraftNotulensi(
    jenisKegiatan: string,
    namaKegiatan: string,
    userId: string,
    namaUser: string
  ): Promise<boolean> {
    try {
      console.log('🔄 Attempting to create draft notulensi...', { jenisKegiatan, namaKegiatan });

      // Hanya untuk rapat dan doa-bersama
      if (jenisKegiatan !== 'rapat' && jenisKegiatan !== 'doa-bersama') {
        console.log('❌ Not rapat/doa-bersama, skipping...');
        return false;
      }

      // Cek apakah draft sudah ada untuk kegiatan ini hari ini
      const today = new Date().toLocaleDateString('id-ID');
      const existingNotulensi = await this.getNotulensiToday();

      // Cek berdasarkan judul yang mengandung [DRAFT]
      const alreadyExists = existingNotulensi.some(n =>
        n.judul.includes(`[DRAFT] ${namaKegiatan}`) &&
        n.tanggal === today
      );

      if (alreadyExists) {
        console.log('⚠️ Draft already exists for this activity today');
        return false;
      }

      // Konversi jenis kegiatan
      const jenisNotulensi = jenisKegiatan === 'doa-bersama' ? 'doa' : 'rapat';

      console.log('✅ Creating draft notulensi...', { jenisNotulensi, namaKegiatan });

      // Buat draft notulensi - HANYA kirim field yang didukung
      await apiClient.post('/notulensi', {
        userId,
        namaUser,
        judul: `[DRAFT] ${namaKegiatan}`,  // ← Tandai dengan prefix
        jenisKegiatan: jenisNotulensi,
        isi: `[DRAFT OTOMATIS - Belum Dilengkapi]\n\nNotulensi untuk kegiatan: ${namaKegiatan}\nTanggal: ${today}\n\n📝 PETUNJUK PENGISIAN:\n1. Klik tombol "Edit" untuk melengkapi notulensi ini\n2. Hapus tanda [DRAFT] di judul setelah selesai mengisi\n3. Isi kesimpulan rapat atau informasi doa bersama\n4. Klik "Muat Daftar Hadir Otomatis" untuk menambahkan daftar peserta\n\n--- Silakan lengkapi isi notulensi di bawah ini ---\n\n`
        // TIDAK kirim field ini karena backend belum support:
        // isDraft, linkedAbsensiId, daftarHadirOtomatis
      });

      console.log('✅ Draft notulensi created successfully!');
      return true;
    } catch (error) {
      console.error('❌ Auto create draft notulensi error:', error);
      return false;
    }
  }

  async getDaftarHadirByKegiatan(
    jenisKegiatan: string,
    namaKegiatan: string,
    tanggal: string
  ): Promise<string> {
    try {
      const absensiList = await this.getAbsensiList();
      const users = await authService.getAllUsersForAdmin();

      // Filter absensi sesuai kegiatan dan tanggal
      const filtered = absensiList.filter(a =>
        a.jenisKegiatan === jenisKegiatan &&
        a.namaKegiatan === namaKegiatan &&
        a.tanggal === tanggal
      );

      if (filtered.length === 0) {
        return 'Belum ada peserta yang hadir.';
      }

      // Format daftar hadir
      let daftarHadir = `DAFTAR HADIR ${namaKegiatan.toUpperCase()}\n`;
      daftarHadir += `Tanggal: ${tanggal}\n`;
      daftarHadir += `Total Peserta: ${filtered.length} orang\n\n`;
      daftarHadir += `Daftar Peserta:\n`;

      filtered.forEach((absen, index) => {
        const user = users.find(u => u.id === absen.userId);
        const kategori = absen.isGuest ? 'Tamu' : (user?.kategori || 'N/A');
        const instansi = absen.isGuest && absen.instansi ? ` (${absen.instansi})` : '';

        daftarHadir += `${index + 1}. ${absen.namaUser}${instansi} - ${kategori} - ${absen.waktu}\n`;
      });

      return daftarHadir;
    } catch (error) {
      console.error('Get daftar hadir error:', error);
      return '';
    }
  }

  async saveGuestAbsensi(
    nama: string,
    instansi: string,
    jenisKegiatan: string,
    namaKegiatan: string,
    signature: string
  ): Promise<boolean> {
    try {
      await apiClient.post('/absensi/guest', {
        nama,
        instansi,
        jenisKegiatan,
        namaKegiatan,
        signature
      });

      return true;
    } catch (error) {
      console.error('Save guest absensi error:', error);
      return false;
    }
  }

  async getAbsensiList(): Promise<AbsensiRecord[]> {
    try {
      return await apiClient.get<AbsensiRecord[]>('/absensi');
    } catch (error) {
      console.error('Get absensi list error:', error);
      return [];
    }
  }

  async getAbsensiToday(): Promise<AbsensiRecord[]> {
    try {
      return await apiClient.get<AbsensiRecord[]>('/absensi?today=true');
    } catch (error) {
      console.error('Get absensi today error:', error);
      return [];
    }
  }

  async getAbsensiTodayNonGuest(): Promise<AbsensiRecord[]> {
    const today = await this.getAbsensiToday();
    return today.filter(a => !a.isGuest);
  }

  async getAbsensiThisMonth(): Promise<AbsensiRecord[]> {
    try {
      return await apiClient.get<AbsensiRecord[]>('/absensi?month=true');
    } catch (error) {
      console.error('Get absensi this month error:', error);
      return [];
    }
  }

  async getAbsensiThisMonthNonGuest(): Promise<AbsensiRecord[]> {
    const thisMonth = await this.getAbsensiThisMonth();
    return thisMonth.filter(a => !a.isGuest);
  }

  async getAbsensiByUser(userId: string): Promise<AbsensiRecord[]> {
    try {
      return await apiClient.get<AbsensiRecord[]>(`/absensi?userId=${userId}`);
    } catch (error) {
      console.error('Get absensi by user error:', error);
      return [];
    }
  }

  async deleteAbsensi(absensiId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/absensi/${absensiId}`);
      return true;
    } catch (error) {
      console.error('Delete absensi error:', error);
      return false;
    }
  }

  async deleteAllAbsensi(): Promise<boolean> {
    try {
      await apiClient.delete('/absensi');
      return true;
    } catch (error) {
      console.error('Delete all absensi error:', error);
      return false;
    }
  }

  async getDailyAbsensiByCategory(): Promise<
    Array<{ date: string; Pegawai: number; Magang: number }>
  > {
    try {
      const absensiList = await this.getAbsensiThisMonthNonGuest();
      const users = await authService.getAllUsersForAdmin();
      const dailyData: Record<string, { Pegawai: number; Magang: number }> = {};

      absensiList.forEach(absensi => {
        const user = users.find(u => u.id === absensi.userId);
        const kategori = user?.kategori || 'Pegawai';

        if (!dailyData[absensi.tanggal]) {
          dailyData[absensi.tanggal] = { Pegawai: 0, Magang: 0 };
        }

        dailyData[absensi.tanggal][kategori]++;
      });

      return Object.entries(dailyData)
        .map(([date, counts]) => ({
          date: date.split('/').slice(0, 2).join('/'),
          ...counts
        }))
        .sort((a, b) => {
          const dateA = new Date(a.date.split('/').reverse().join('-'));
          const dateB = new Date(b.date.split('/').reverse().join('-'));
          return dateA.getTime() - dateB.getTime();
        });
    } catch (error) {
      console.error('Get daily absensi by category error:', error);
      return [];
    }
  }

  async getMonthlyAbsensiByActivity(): Promise<
    Array<{ activity: string; count: number }>
  > {
    try {
      const absensiList = await this.getAbsensiThisMonthNonGuest();
      const activityCounts: Record<string, number> = {};

      absensiList.forEach(absensi => {
        const activity = absensi.jenisKegiatan.replace('-', ' ').toUpperCase();
        activityCounts[activity] = (activityCounts[activity] || 0) + 1;
      });

      return Object.entries(activityCounts).map(([activity, count]) => ({
        activity,
        count
      }));
    } catch (error) {
      console.error('Get monthly absensi by activity error:', error);
      return [];
    }
  }

  // ============================================
  // QR CODE MANAGEMENT
  // ============================================

  async generateAbsensiQR(
    jenisKegiatan: 'senam' | 'apel' | 'rapelan' | 'doa-bersama' | 'rapat',
    namaKegiatan: string
  ): Promise<string> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') return '';

      const result = await apiClient.post<{ success: boolean; id: string }>('/qr/generate', {
        jenisKegiatan,
        namaKegiatan,
        createdBy: currentUser.id,
        createdByName: currentUser.nama
      });

      return result.id || '';
    } catch (error) {
      console.error('Generate QR error:', error);
      return '';
    }
  }

  async getQRAbsensiList(): Promise<QRAbsensiCode[]> {
    try {
      return await apiClient.get<QRAbsensiCode[]>('/qr');
    } catch (error) {
      console.error('Get QR list error:', error);
      return [];
    }
  }

  async getQRAbsensiData(qrId: string): Promise<QRAbsensiCode | null> {
    try {
      return await apiClient.get<QRAbsensiCode>(`/qr/${qrId}`);
    } catch (error) {
      console.error('Get QR data error:', error);
      return null;
    }
  }

  async getActiveQR(userId: string): Promise<QRAbsensiCode | null> {
    try {
      const response = await apiClient.get<{ success: boolean; active: QRAbsensiCode | null }>(`/qr/active?userId=${userId}`);
      if (response.success && response.active) {
        return response.active;
      }
      return null;
    } catch (error) {
      console.error('Get active QR error:', error);
      return null;
    }
  }

  async deactivateQRCode(qrId: string): Promise<boolean> {
    try {
      await apiClient.put(`/qr/${qrId}/deactivate`);
      return true;
    } catch (error) {
      console.error('Deactivate QR error:', error);
      return false;
    }
  }

  // ============================================
  // NOTULENSI MANAGEMENT
  // ============================================

  async saveNotulensi(
    judul: string,
    jenisKegiatan: string,
    isi: string,
    foto?: string,
    hari?: string,
    jam?: string,
    tempat?: string,
    agenda?: string,
    signature?: string,
    pemandu?: string
  ): Promise<boolean> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return false;

      await apiClient.post('/notulensi', {
        userId: currentUser.id,
        namaUser: currentUser.nama,
        judul,
        jenisKegiatan,
        isi,
        foto,
        hari,
        jam,
        tempat,
        agenda,
        signature,
        pemandu
      });

      return true;
    } catch (error) {
      console.error('Save notulensi error:', error);
      return false;
    }
  }

  async getNotulensiList(): Promise<NotulensiRecord[]> {
    try {
      return await apiClient.get<NotulensiRecord[]>('/notulensi');
    } catch (error) {
      console.error('Get notulensi list error:', error);
      return [];
    }
  }

  async getNotulensiToday(): Promise<NotulensiRecord[]> {
    try {
      return await apiClient.get<NotulensiRecord[]>('/notulensi?today=true');
    } catch (error) {
      console.error('Get notulensi today error:', error);
      return [];
    }
  }

  async getNotulensiThisMonth(): Promise<NotulensiRecord[]> {
    try {
      return await apiClient.get<NotulensiRecord[]>('/notulensi?month=true');
    } catch (error) {
      console.error('Get notulensi this month error:', error);
      return [];
    }
  }

  async updateNotulensi(
    id: string,
    updates: Partial<NotulensiRecord>
  ): Promise<boolean> {
    try {
      await apiClient.put(`/notulensi/${id}`, updates);
      return true;
    } catch (error) {
      console.error('Update notulensi error:', error);
      return false;
    }
  }

  async deleteNotulensi(id: string): Promise<boolean> {
    try {
      await apiClient.delete(`/notulensi/${id}`);
      return true;
    } catch (error) {
      console.error('Delete notulensi error:', error);
      return false;
    }
  }

  async deleteAllNotulensi(): Promise<boolean> {
    try {
      await apiClient.delete('/notulensi');
      return true;
    } catch (error) {
      console.error('Delete all notulensi error:', error);
      return false;
    }
  }

  // ============================================
  // UNDANGAN MANAGEMENT
  // ============================================

  async saveUndangan(undangan: Omit<UndanganRecord, 'id'>): Promise<boolean> {
    try {
      await apiClient.post('/undangan', {
        userId: undangan.userId,
        namaUser: undangan.namaUser,
        tempat: undangan.tempat,
        tanggal: undangan.tanggal,
        nomorSurat: undangan.nomorSurat,
        sifat: undangan.sifat,
        lampiran: undangan.lampiran,
        perihal: undangan.perihal,
        kepada: undangan.kepada,
        isiSurat: undangan.isiSurat,
        hariTanggalWaktu: undangan.hariTanggalWaktu,
        tempatKegiatan: undangan.tempatKegiatan,
        tandaTangan: undangan.tandaTangan,
        jabatanPenandatangan: undangan.jabatanPenandatangan,
        nip: undangan.nip,
        isiPenutup: undangan.isiPenutup,
        isUploadedFile: undangan.isUploadedFile,
        uploadedFileName: undangan.uploadedFileName,
        uploadedFileType: undangan.uploadedFileType,
        uploadedFileData: undangan.uploadedFileData,
        uploadedFileSize: undangan.uploadedFileSize
      });

      return true;
    } catch (error) {
      console.error('Save undangan error:', error);
      return false;
    }
  }

  async getUndanganList(): Promise<UndanganRecord[]> {
    try {
      return await apiClient.get<UndanganRecord[]>('/undangan');
    } catch (error) {
      console.error('Get undangan list error:', error);
      return [];
    }
  }

  async updateUndangan(
    id: string,
    updates: Partial<UndanganRecord>
  ): Promise<boolean> {
    try {
      await apiClient.put(`/undangan/${id}`, updates);
      return true;
    } catch (error) {
      console.error('Update undangan error:', error);
      return false;
    }
  }

  async deleteUndangan(id: string): Promise<boolean> {
    try {
      await apiClient.delete(`/undangan/${id}`);
      return true;
    } catch (error) {
      console.error('Delete undangan error:', error);
      return false;
    }
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getAbsensiStats() {
    const today = await this.getAbsensiTodayNonGuest();
    const thisMonth = await this.getAbsensiThisMonthNonGuest();

    const todayByActivity = today.reduce((acc, curr) => {
      acc[curr.jenisKegiatan] = (acc[curr.jenisKegiatan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalToday: today.length,
      totalThisMonth: thisMonth.length,
      todayByActivity
    };
  }

  async getNotulensiStats() {
    const all = await this.getNotulensiList();
    const today = await this.getNotulensiToday();
    const thisMonth = await this.getNotulensiThisMonth();

    const contributors = new Set(all.map(n => n.userId)).size;

    return {
      totalAll: all.length,
      totalToday: today.length,
      totalThisMonth: thisMonth.length,
      contributors
    };
  }

  // Export functions (placeholders)
  exportAbsensiToPDF(data: AbsensiRecord[], title: string) {
    console.log('Exporting absensi to PDF:', { data, title });
  }

  exportNotulensiToPDF(notulensi: NotulensiRecord) {
    console.log('Exporting notulensi to PDF:', notulensi);
  }
}

export const dataService = new DataService();

