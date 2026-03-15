import { apiClient } from './apiClient';
import { authService } from './authService';

export interface AbsensiRecord {
  id: string;
  userId: string;
  namaUser: string;
  jenisKegiatan: 'senam' | 'apel' | 'rapelan' | 'doa-bersama' | 'rapat' | 'sharing-knowledge';
  namaKegiatan: string;
  idKegiatan?: string;
  tanggal: string;
  waktu: string;
  signature: string;
  status: 'hadir' | 'tidak-hadir';
  statusKehadiran?: 'hadir' | 'terlambat';
  instansi?: string;
  email?: string;
  isGuest?: boolean;
}

export interface NotulensiRecord {
  id: string;
  userId: string;
  namaUser: string;
  judul: string;
  jenisKegiatan: 'rapat' | 'doa' | 'rapelan' | 'sharing-knowledge' | 'lainnya';
  idKegiatan?: string;
  ringkasan?: string;
  diskusi?: string;
  kesimpulan?: string;
  tanya_jawab?: string;
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
  linkedAbsensiId?: string;
  isDraft?: boolean;
  daftarHadirOtomatis?: string;
}

export interface UndanganRecord {
  id: string;
  userId: string;
  namaUser: string;
  idKegiatan?: string;
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
  jenisKegiatan: 'senam' | 'apel' | 'rapelan' | 'doa-bersama' | 'rapat' | 'sharing-knowledge';
  namaKegiatan: string;
  idKegiatan?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
  pesertaMode?: 'publik' | 'akun';
}

export interface JadwalRapat {
  id: string;
  judul: string;
  jenisKegiatan?: string;
  deskripsi?: string;
  tanggal: string;
  jamMulai: string;
  jamSelesai: string;
  tim: string[];
  peserta: string[];
  pesertaMode?: 'publik' | 'akun'; // publik = include tamu, akun = Syntak user only
  pesertaSpesifik?: string[]; // array of user ids, if empty = all in that kategori
  repeatType: 'none' | 'daily' | 'weekly' | 'custom';
  repeatDays?: number[];
  repeatUntil?: string;
  allowStack?: boolean;
  openOffsetMinutes?: number;
  closeOffsetMinutes?: number;
  latenessThresholdMinutes?: number;
  absen_state?: 'disabled' | 'open' | 'closed';
  absen_tooltip?: string;
  lateness_status?: 'on_time' | 'late' | 'not_attempted';
  visibility?: boolean;
  createdBy: string;
  isActive: boolean;
  createdAt?: string;
  activeQRId?: string;
}

class DataService {
  // ============================================
  // USER PROFILE MANAGEMENT
  // ============================================

  async updateProfile(userId: string, data: { nama?: string; tim?: string; jabatan?: string }): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      const result = await apiClient.put<{ success: boolean; message: string; user?: any }>(`/auth/profile/${userId}`, data);
      // Update stored current user in localStorage
      const currentUser = authService.getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        const updatedUser = { ...currentUser, ...data };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      }
      return result;
    } catch (error: any) {
      console.error('Update profile error:', error);
      return { success: false, message: error.response?.data?.message || 'Gagal memperbarui profil' };
    }
  }

  // ============================================
  // ABSENSI MANAGEMENT
  // ============================================

  async saveAbsensi(
    jenisKegiatan: string,
    namaKegiatan: string,
    signature: string,
    idKegiatan?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return { success: false, message: 'User not logged in' };

      // Validasi: Magang tidak bisa absen Rapelan
      if (currentUser.kategori === 'Magang' && jenisKegiatan === 'rapelan') {
        return { success: false, message: 'Magang tidak diperbolehkan melakukan Rapelan.' };
      }

      const response = await apiClient.post<{ success: boolean; message: string }>('/absensi', {
        userId: currentUser.id,
        namaUser: currentUser.nama,
        jenisKegiatan,
        namaKegiatan,
        signature,
        idKegiatan
      });

      // Auto-create draft notula if linked via id_kegiatan
      if (idKegiatan) {
        await this.autoCreateDraftNotulensi(
          jenisKegiatan,
          namaKegiatan,
          currentUser.id,
          currentUser.nama,
          idKegiatan
        );
      }

      return response;
    } catch (error: any) {
      console.error('Save absensi error:', error);
      return { success: false, message: error.response?.data?.message || 'Gagal menyimpan presensi' };
    }
  }

  // ============================================
  // HELPER: AUTO-CREATE DRAFT NOTULENSI
  // ============================================

  async autoCreateDraftNotulensi(
    jenisKegiatan: string,
    namaKegiatan: string,
    userId: string,
    namaUser: string,
    idKegiatan?: string
  ): Promise<boolean> {
    try {
      // Hanya untuk rapat dan doa-bersama
      if (jenisKegiatan !== 'rapat' && jenisKegiatan !== 'doa-bersama' && jenisKegiatan !== 'sharing-knowledge') {
        return false;
      }

      // Cek apakah draft sudah ada (bisa lewat id_kegiatan)
      if (idKegiatan) {
        const existing = await this.getNotulensiList();
        if (existing.some(n => n.idKegiatan === idKegiatan)) {
          return false;
        }
      }

      // Konversi jenis kegiatan
      let jenisNotulensi = 'lainnya';
      if (jenisKegiatan === 'doa-bersama') jenisNotulensi = 'doa';
      else if (jenisKegiatan === 'rapat') jenisNotulensi = 'rapat';
      else if (jenisKegiatan === 'sharing-knowledge') jenisNotulensi = 'sharing-knowledge';

      // Buat draft notulensi
      await apiClient.post('/notulensi', {
        userId,
        namaUser,
        judul: `Notula: ${namaKegiatan}`,
        jenisKegiatan: jenisNotulensi,
        idKegiatan,
        isi: `[DRAFT OTOMATIS]\n\nKegiatan: ${namaKegiatan}\n\nSilakan isi rincian kegiatan di bawah ini.`
      });

      return true;
    } catch (error) {
      console.error('Auto create draft notulensi error:', error);
      return false;
    }
  }

  async saveGuestAbsensi(
    nama: string,
    instansi: string,
    email: string,
    jenisKegiatan: string,
    namaKegiatan: string,
    signature: string,
    idKegiatan?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await apiClient.post<{ success: boolean; message: string }>('/absensi/guest', {
        nama,
        instansi,
        email,
        jenisKegiatan,
        namaKegiatan,
        signature,
        idKegiatan
      });
    } catch (error: any) {
      console.error('Save guest absensi error:', error);
      return { success: false, message: error.response?.data?.message || 'Gagal menyimpan presensi tamu' };
    }
  }

  async getAbsensiList(userId?: string): Promise<AbsensiRecord[]> {
    try {
      const url = userId ? `/absensi?userId=${userId}` : '/absensi';
      return await apiClient.get<AbsensiRecord[]>(url);
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
    try {
      const records = await this.getAbsensiToday();
      return records.filter(r => !r.isGuest);
    } catch (error) {
      console.error('Get absensi today non-guest error:', error);
      return [];
    }
  }

  async getAbsensiThisMonthNonGuest(): Promise<AbsensiRecord[]> {
    try {
      const records = await apiClient.get<AbsensiRecord[]>('/absensi?month=true');
      return records.filter(r => !r.isGuest);
    } catch (error) {
      console.error('Get absensi month non-guest error:', error);
      return [];
    }
  }

  async getAbsensiStats(): Promise<{ totalToday: number; totalThisMonth: number; todayByActivity: Record<string, number> }> {
    try {
      const today = await this.getAbsensiTodayNonGuest();
      const thisMonth = await this.getAbsensiThisMonthNonGuest();
      
      const todayByActivity = today.reduce((acc, curr) => {
        acc[curr.jenisKegiatan] = (acc[curr.jenisKegiatan] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return { totalToday: today.length, totalThisMonth: thisMonth.length, todayByActivity };
    } catch (error) {
      console.error('Get absensi stats error:', error);
      return { totalToday: 0, totalThisMonth: 0, todayByActivity: {} };
    }
  }

  async getNotulensiStats(): Promise<{ totalAll: number; totalToday: number; totalThisMonth: number; contributors: number }> {
    try {
      const all = await this.getNotulensiList();
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const totalToday = all.filter(n => n.tanggal === today).length;
      const totalThisMonth = all.filter(n => {
        const [year, month] = n.tanggal.split('-').map(Number);
        return month - 1 === currentMonth && year === currentYear;
      }).length;
      const contributors = new Set(all.map(n => n.userId)).size;

      return { totalAll: all.length, totalToday, totalThisMonth, contributors };
    } catch (error) {
      console.error('Get notulensi stats error:', error);
      return { totalAll: 0, totalToday: 0, totalThisMonth: 0, contributors: 0 };
    }
  }

  async getDailyAbsensiByCategory(): Promise<Array<{ date: string; Pegawai: number; Magang: number }>> {
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
        
        dailyData[absensi.tanggal][kategori as 'Pegawai' | 'Magang']++;
      });

      return Object.entries(dailyData).map(([date, counts]) => ({
        date,
        ...counts
      })).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('Get daily absensi by category error:', error);
      return [];
    }
  }

  async getMonthlyAbsensiByActivity(): Promise<Array<{ activity: string; count: number }>> {
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

  async deleteAbsensi(absensiId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/absensi/${absensiId}`);
      return true;
    } catch (error) {
      console.error('Delete absensi error:', error);
      return false;
    }
  }

  // ============================================
  // QR CODE MANAGEMENT
  // ============================================

  async generateAbsensiQR(
    jenisKegiatan: string,
    namaKegiatan: string,
    expiresAt?: string,
    idKegiatan?: string
  ): Promise<{ success: boolean; id?: string; message?: string }> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, message: 'Hanya admin yang dapat generate QR' };
      }

      const result = await apiClient.post<{ success: boolean; id: string; message?: string }>('/qr/generate', {
        jenisKegiatan,
        namaKegiatan,
        expiresAt,
        idKegiatan,
        createdBy: currentUser.id,
        createdByName: currentUser.nama
      });

      return result;
    } catch (error: any) {
      console.error('Generate QR error:', error);
      return { success: false, message: error.response?.data?.message || 'Gagal generate QR' };
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

  async saveNotulensi(data: Partial<NotulensiRecord>): Promise<boolean> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return false;

      await apiClient.post('/notulensi', {
        ...data,
        userId: currentUser.id,
        namaUser: currentUser.nama
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

  async broadcastNotulensi(id: string): Promise<{ success: boolean; message: string }> {
    try {
      return await apiClient.post<{ success: boolean; message: string }>(`/notulensi/${id}/broadcast`);
    } catch (error: any) {
      console.error('Broadcast error:', error);
      return { success: false, message: error.response?.data?.message || 'Gagal broadcast notula' };
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

  // ============================================
  // UNDANGAN MANAGEMENT
  // ============================================

  async saveUndangan(undangan: Omit<UndanganRecord, 'id' | 'createdAt'>): Promise<boolean> {
    try {
      await apiClient.post('/undangan', undangan);
      return true;
    } catch (error) {
      console.error('Save undangan error:', error);
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

  async getUndanganList(): Promise<UndanganRecord[]> {
    try {
      return await apiClient.get<UndanganRecord[]>('/undangan');
    } catch (error) {
      console.error('Get undangan list error:', error);
      return [];
    }
  }

  // ============================================
  // JADWAL RAPAT MANAGEMENT
  // ============================================

  async saveJadwalRapat(data: {
    judul: string;
    jenisKegiatan?: string;
    deskripsi?: string;
    tanggal: string;
    jamMulai: string;
    jamSelesai: string;
    tim: string[];
    peserta: string[];
    pesertaMode?: 'publik' | 'akun';
    pesertaSpesifik?: string[];
    repeatType?: string;
    repeatDays?: number[];
    repeatUntil?: string;
    allowStack?: boolean;
    openOffsetMinutes?: number;
    closeOffsetMinutes?: number;
    latenessThresholdMinutes?: number;
  }): Promise<{ success: boolean; ids?: string[]; message?: string }> {
    try {
      const currentUser = authService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, message: 'Hanya admin yang dapat membuat jadwal' };
      }

      return await apiClient.post<{ success: boolean; ids?: string[]; message?: string }>('/jadwal-rapat', {
        ...data,
        createdBy: currentUser.id
      });
    } catch (error: any) {
      console.error('Save jadwal rapat error:', error);
      return { success: false, message: error.response?.data?.message || 'Gagal menyimpan jadwal' };
    }
  }

  async getJadwalRapat(): Promise<JadwalRapat[]> {
    try {
      return await apiClient.get<JadwalRapat[]>('/jadwal-rapat');
    } catch (error) {
      console.error('Get jadwal rapat error:', error);
      return [];
    }
  }

  async getUsersByKategori(kategori?: string): Promise<any[]> {
    try {
      const url = kategori ? `/users/by-kategori?kategori=${encodeURIComponent(kategori)}` : '/users/by-kategori';
      return await apiClient.get<any[]>(url);
    } catch (error) {
      console.error('Get users by kategori error:', error);
      return [];
    }
  }

  async getActiveJadwal(tim?: string, kategori?: string): Promise<JadwalRapat[]> {
    try {
      const params = new URLSearchParams();
      if (tim) params.append('tim', tim);
      if (kategori) params.append('kategori', kategori);
      const query = params.toString() ? `?${params.toString()}` : '';
      return await apiClient.get<JadwalRapat[]>(`/jadwal-rapat/active${query}`);
    } catch (error) {
      console.error('Get active jadwal error:', error);
      return [];
    }
  }

  async updateJadwalRapat(id: string, updates: Partial<JadwalRapat>): Promise<boolean> {
    try {
      await apiClient.put(`/jadwal-rapat/${id}`, updates);
      return true;
    } catch (error) {
      console.error('Update jadwal rapat error:', error);
      return false;
    }
  }

  async deleteJadwalRapat(id: string): Promise<boolean> {
    try {
      await apiClient.delete(`/jadwal-rapat/${id}`);
      return true;
    } catch (error) {
      console.error('Delete jadwal rapat error:', error);
      return false;
    }
  }
}

export const dataService = new DataService();
