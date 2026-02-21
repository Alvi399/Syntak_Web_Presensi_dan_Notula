import { AbsensiRecord, NotulensiRecord, authService, QRAbsensiCode } from './auth';

type JenisKegiatan = 'senam' | 'apel' | 'rapelan' | 'doa-bersama' | 'rapat';
type JenisNotulensi = 'rapat' | 'doa' | 'rapelan' | 'lainnya';

class DataService {
  // Absensi Management
  saveAbsensi(jenisKegiatan: string, signature: string): boolean {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return false;

    // Validasi: Magang tidak bisa absen Rapelan
    if (currentUser.kategori === 'Magang' && jenisKegiatan === 'rapelan') {
      return false;
    }

    const absensiList = this.getAbsensiList();
    const newAbsensi: AbsensiRecord = {
      id: `absensi-${Date.now()}`,
      userId: currentUser.id,
      namaUser: currentUser.nama,
      jenisKegiatan: jenisKegiatan as JenisKegiatan,
      tanggal: new Date().toLocaleDateString('id-ID'),
      waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      signature,
      status: 'hadir',
      isGuest: false
    };

    absensiList.push(newAbsensi);
    localStorage.setItem('absensi', JSON.stringify(absensiList));
    
    authService.logActivity(currentUser.id, currentUser.nama, `Absen ${jenisKegiatan}`);
    return true;
  }

  saveGuestAbsensi(nama: string, instansi: string, jenisKegiatan: string, signature: string): boolean {
    const absensiList = this.getAbsensiList();
    const newAbsensi: AbsensiRecord = {
      id: `absensi-guest-${Date.now()}`,
      userId: 'guest',
      namaUser: nama,
      jenisKegiatan: jenisKegiatan as JenisKegiatan,
      tanggal: new Date().toLocaleDateString('id-ID'),
      waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      signature,
      status: 'hadir',
      instansi,
      isGuest: true
    };

    absensiList.push(newAbsensi);
    localStorage.setItem('absensi', JSON.stringify(absensiList));
    
    authService.logActivity('guest', nama, `Absen tamu ${jenisKegiatan} dari ${instansi}`);
    return true;
  }

  getAbsensiList(): AbsensiRecord[] {
    const absensi = localStorage.getItem('absensi');
    return absensi ? JSON.parse(absensi) : [];
  }

  getAbsensiToday(): AbsensiRecord[] {
    const today = new Date().toLocaleDateString('id-ID');
    return this.getAbsensiList().filter(a => a.tanggal === today);
  }

  // Untuk grafik - hanya absensi non-tamu
  getAbsensiTodayNonGuest(): AbsensiRecord[] {
    const today = new Date().toLocaleDateString('id-ID');
    return this.getAbsensiList().filter(a => a.tanggal === today && !a.isGuest);
  }

  getAbsensiThisMonth(): AbsensiRecord[] {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return this.getAbsensiList().filter(a => {
      const absensiDate = new Date(a.tanggal.split('/').reverse().join('-'));
      return absensiDate.getMonth() === currentMonth && absensiDate.getFullYear() === currentYear;
    });
  }

  // Untuk grafik - hanya absensi non-tamu bulan ini
  getAbsensiThisMonthNonGuest(): AbsensiRecord[] {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return this.getAbsensiList().filter(a => {
      if (a.isGuest) return false; // Exclude guest
      const absensiDate = new Date(a.tanggal.split('/').reverse().join('-'));
      return absensiDate.getMonth() === currentMonth && absensiDate.getFullYear() === currentYear;
    });
  }

  getAbsensiByUser(userId: string): AbsensiRecord[] {
    return this.getAbsensiList().filter(a => a.userId === userId);
  }

  // NEW: Method untuk menghapus satu absensi
  deleteAbsensi(absensiId: string): boolean {
    const absensiList = this.getAbsensiList();
    const filteredList = absensiList.filter(a => a.id !== absensiId);
    
    if (filteredList.length === absensiList.length) return false;
    
    localStorage.setItem('absensi', JSON.stringify(filteredList));
    return true;
  }

  // NEW: Method untuk menghapus semua absensi
  deleteAllAbsensi(): boolean {
    try {
      localStorage.setItem('absensi', JSON.stringify([]));
      return true;
    } catch (error) {
      return false;
    }
  }

  getDailyAbsensiByCategory(): Array<{ date: string; Pegawai: number; Magang: number }> {
    const absensiList = this.getAbsensiThisMonthNonGuest(); // Gunakan non-guest
    const users = authService.getAllUsersForAdmin();
    const dailyData: Record<string, { Pegawai: number; Magang: number }> = {};

    absensiList.forEach(absensi => {
      const user = users.find(u => u.id === absensi.userId);
      const kategori = user?.kategori || 'Pegawai';
      
      if (!dailyData[absensi.tanggal]) {
        dailyData[absensi.tanggal] = { Pegawai: 0, Magang: 0 };
      }
      
      dailyData[absensi.tanggal][kategori]++;
    });

    return Object.entries(dailyData).map(([date, counts]) => ({
      date: date.split('/').slice(0, 2).join('/'),
      ...counts
    })).sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-'));
      const dateB = new Date(b.date.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });
  }

  getMonthlyAbsensiByActivity(): Array<{ activity: string; count: number }> {
    const absensiList = this.getAbsensiThisMonthNonGuest(); // Gunakan non-guest
    const activityCounts: Record<string, number> = {};

    absensiList.forEach(absensi => {
      const activity = absensi.jenisKegiatan.replace('-', ' ').toUpperCase();
      activityCounts[activity] = (activityCounts[activity] || 0) + 1;
    });

    return Object.entries(activityCounts).map(([activity, count]) => ({
      activity,
      count
    }));
  }

  // QR Code / Barcode Management untuk Absensi
  generateAbsensiQR(jenisKegiatan: JenisKegiatan): string {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return '';

    const qrCode: QRAbsensiCode = {
      id: `qr-${Date.now()}`,
      jenisKegiatan,
      createdBy: currentUser.id,
      createdByName: currentUser.nama,
      createdAt: new Date().toISOString(),
      expiresAt: undefined,
      isActive: true
    };

    const qrList = this.getQRAbsensiList();
    qrList.push(qrCode);
    localStorage.setItem('qr-absensi-codes', JSON.stringify(qrList));

    authService.logActivity(currentUser.id, currentUser.nama, `Membuat QR Code untuk ${jenisKegiatan}`);
    
    return qrCode.id;
  }

  getQRAbsensiList(): QRAbsensiCode[] {
    const qrData = localStorage.getItem('qr-absensi-codes');
    return qrData ? JSON.parse(qrData) : [];
  }

  getQRAbsensiData(qrId: string): QRAbsensiCode | null {
    const qrList = this.getQRAbsensiList();
    return qrList.find(qr => qr.id === qrId) || null;
  }

  deactivateQRCode(qrId: string): boolean {
    const qrList = this.getQRAbsensiList();
    const index = qrList.findIndex(qr => qr.id === qrId);
    
    if (index === -1) return false;

    qrList[index].isActive = false;
    localStorage.setItem('qr-absensi-codes', JSON.stringify(qrList));
    return true;
  }

  // Notulensi Management
  saveNotulensi(judul: string, jenisKegiatan: string, isi: string, foto?: string, 
    hari?: string, jam?: string, tempat?: string, agenda?: string, signature?: string): boolean {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return false;

    const notulensiList = this.getNotulensiList();
    const newNotulensi: NotulensiRecord = {
      id: `notulensi-${Date.now()}`,
      userId: currentUser.id,
      namaUser: currentUser.nama,
      judul,
      jenisKegiatan: jenisKegiatan as JenisNotulensi,
      isi,
      tanggal: new Date().toLocaleDateString('id-ID'),
      waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      foto,
      hari,
      jam,
      tempat,
      agenda,
      signature,
    };

    notulensiList.push(newNotulensi);
    localStorage.setItem('notulensi', JSON.stringify(notulensiList));
    
    authService.logActivity(currentUser.id, currentUser.nama, `Buat notulensi: ${judul}`);
    return true;
  }

  getNotulensiList(): NotulensiRecord[] {
    const notulensi = localStorage.getItem('notulensi');
    return notulensi ? JSON.parse(notulensi) : [];
  }

  getNotulensiToday(): NotulensiRecord[] {
    const today = new Date().toLocaleDateString('id-ID');
    return this.getNotulensiList().filter(n => n.tanggal === today);
  }

  getNotulensiThisMonth(): NotulensiRecord[] {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return this.getNotulensiList().filter(n => {
      const notulensiDate = new Date(n.tanggal.split('/').reverse().join('-'));
      return notulensiDate.getMonth() === currentMonth && notulensiDate.getFullYear() === currentYear;
    });
  }

  updateNotulensi(id: string, updates: Partial<NotulensiRecord>): boolean {
    const notulensiList = this.getNotulensiList();
    const index = notulensiList.findIndex(n => n.id === id);
    
    if (index === -1) return false;

    notulensiList[index] = { ...notulensiList[index], ...updates };
    localStorage.setItem('notulensi', JSON.stringify(notulensiList));
    
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      authService.logActivity(currentUser.id, currentUser.nama, `Update notulensi: ${notulensiList[index].judul}`);
    }
    
    return true;
  }

  deleteNotulensi(id: string): boolean {
    const notulensiList = this.getNotulensiList();
    const notulensi = notulensiList.find(n => n.id === id);
    
    if (!notulensi) return false;

    const filteredList = notulensiList.filter(n => n.id !== id);
    localStorage.setItem('notulensi', JSON.stringify(filteredList));
    
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      authService.logActivity(currentUser.id, currentUser.nama, `Hapus notulensi: ${notulensi.judul}`);
    }
    
    return true;
  }

  // NEW: Method untuk menghapus semua notulensi
  deleteAllNotulensi(): boolean {
    try {
      localStorage.setItem('notulensi', JSON.stringify([]));
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        authService.logActivity(currentUser.id, currentUser.nama, 'Menghapus semua data notulensi');
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // Statistics
  getAbsensiStats() {
    const today = this.getAbsensiTodayNonGuest(); // Non-guest untuk stats
    const thisMonth = this.getAbsensiThisMonthNonGuest(); // Non-guest untuk stats
    
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

  getNotulensiStats() {
    const all = this.getNotulensiList();
    const today = this.getNotulensiToday();
    const thisMonth = this.getNotulensiThisMonth();
    
    const contributors = new Set(all.map(n => n.userId)).size;

    return {
      totalAll: all.length,
      totalToday: today.length,
      totalThisMonth: thisMonth.length,
      contributors
    };
  }

  exportAbsensiToPDF(data: AbsensiRecord[], title: string) {
    console.log('Exporting absensi to PDF:', { data, title });
  }

  exportNotulensiToPDF(notulensi: NotulensiRecord) {
    console.log('Exporting notulensi to PDF:', notulensi);
  }
}

export const dataService = new DataService();