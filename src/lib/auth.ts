export interface User {
  id: string;
  nama: string;
  email: string;
  password: string;
  kategori: 'Pegawai' | 'Magang';
  role: 'user' | 'admin';
  tanggalDaftar: string;
  isBlocked?: boolean;
  blockReason?: 'izin' | 'sakit' | 'alpa' | 'izin-telat';
  blockNote?: string;
  blockedUntil?: string;
}

export interface AbsensiRecord {
  id: string;
  userId: string;
  namaUser: string;
  jenisKegiatan: 'senam' | 'apel' | 'rapelan' | 'doa-bersama' | 'rapat';
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
}

export interface ActivityLog {
  id: string;
  userId: string;
  namaUser: string;
  aktivitas: string;
  tanggal: string;
  waktu: string;
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
  createdBy: string;
  createdByName: string;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
}

class AuthService {
  constructor() {
    this.initializeAdmin();
  }

  private initializeAdmin() {
    const users = this.getAllUsers();
    const adminExists = users.some(user => user.email === 'admin@absensi.com');
    
    if (!adminExists) {
      const adminUser: User = {
        id: 'admin-001',
        nama: 'Administrator',
        email: 'admin@absensi.com',
        password: 'admin123',
        kategori: 'Pegawai',
        role: 'admin',
        tanggalDaftar: new Date().toISOString()
      };
      
      users.push(adminUser);
      localStorage.setItem('users', JSON.stringify(users));
    }
  }

  register(nama: string, email: string, password: string, kategori: 'Pegawai' | 'Magang'): { success: boolean; message: string } {
    const users = this.getAllUsers();
    
    if (users.some(user => user.email === email)) {
      return { success: false, message: 'Email sudah terdaftar' };
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      nama,
      email,
      password,
      kategori,
      role: 'user',
      tanggalDaftar: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    this.logActivity(newUser.id, newUser.nama, 'Registrasi akun baru');
    
    return { success: true, message: 'Registrasi berhasil' };
  }

  login(email: string, password: string): { success: boolean; message: string; user?: User } {
    const users = this.getAllUsers();
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return { success: false, message: 'Email atau password salah' };
    }

    // Check if user is blocked
    if (user.isBlocked) {
      // Check if block has expired
      if (user.blockedUntil) {
        const now = new Date();
        const unblockTime = new Date(user.blockedUntil);
        
        if (now >= unblockTime) {
          // Auto unblock
          this.unblockUser(user.id);
          user.isBlocked = false;
          delete user.blockReason;
          delete user.blockNote;
          delete user.blockedUntil;
        } else {
          return { 
            success: false, 
            message: `Akun Anda diblokir sampai ${unblockTime.toLocaleString('id-ID')}. Alasan: ${user.blockReason || 'Tidak ada'}` 
          };
        }
      } else {
        return { 
          success: false, 
          message: `Akun Anda diblokir. Hubungi administrator untuk informasi lebih lanjut.` 
        };
      }
    }

    localStorage.setItem('currentUser', JSON.stringify(user));
    this.logActivity(user.id, user.nama, 'Login ke sistem');
    
    return { success: true, message: 'Login berhasil', user };
  }

  logout(): void {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      this.logActivity(currentUser.id, currentUser.nama, 'Logout dari sistem');
    }
    localStorage.removeItem('currentUser');
  }

  getCurrentUser(): User | null {
    const userData = localStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
  }

  getAllUsers(): User[] {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
  }

  getAllUsersForAdmin(): User[] {
    return this.getAllUsers();
  }

  updateUser(userId: string, updates: Partial<User>): boolean {
    const users = this.getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) return false;
    
    users[userIndex] = { ...users[userIndex], ...updates };
    localStorage.setItem('users', JSON.stringify(users));
    
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
    }
    
    return true;
  }

  deleteUser(userId: string): boolean {
    const users = this.getAllUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    
    if (filteredUsers.length === users.length) return false;
    
    localStorage.setItem('users', JSON.stringify(filteredUsers));
    return true;
  }

  resetPassword(userId: string, newPassword: string): boolean {
    return this.updateUser(userId, { password: newPassword });
  }

  // NEW: Block user with reason
  blockUser(userId: string, reason: 'izin' | 'sakit' | 'alpa' | 'izin-telat', note?: string): boolean {
    const users = this.getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) return false;
    
    const user = users[userIndex];
    let blockedUntil: string;
    
    const now = new Date();
    
    if (reason === 'izin-telat') {
      // Block until 3 PM today
      const unblockTime = new Date(now);
      unblockTime.setHours(15, 0, 0, 0);
      
      // If it's already past 3 PM, unblock tomorrow at 3 PM
      if (now.getHours() >= 15) {
        unblockTime.setDate(unblockTime.getDate() + 1);
      }
      
      blockedUntil = unblockTime.toISOString();
    } else {
      // Block until tomorrow at 00:00 (midnight)
      const unblockTime = new Date(now);
      unblockTime.setDate(unblockTime.getDate() + 1);
      unblockTime.setHours(0, 0, 0, 0);
      blockedUntil = unblockTime.toISOString();
    }
    
    users[userIndex] = {
      ...user,
      isBlocked: true,
      blockReason: reason,
      blockNote: note || '',
      blockedUntil
    };
    
    localStorage.setItem('users', JSON.stringify(users));
    
    // Update current user if blocked user is logged in
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
    }
    
    // Log activity
    const admin = this.getCurrentUser();
    if (admin) {
      this.logActivity(admin.id, admin.nama, `Memblokir user ${user.nama} dengan alasan: ${reason}`);
    }
    
    return true;
  }

  // NEW: Unblock user
  unblockUser(userId: string): boolean {
    const users = this.getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) return false;
    
    const user = users[userIndex];
    
    users[userIndex] = {
      ...user,
      isBlocked: false,
      blockReason: undefined,
      blockNote: undefined,
      blockedUntil: undefined
    };
    
    localStorage.setItem('users', JSON.stringify(users));
    
    // Update current user if unblocked user is logged in
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem('currentUser', JSON.stringify(users[userIndex]));
    }
    
    // Log activity
    const admin = this.getCurrentUser();
    if (admin) {
      this.logActivity(admin.id, admin.nama, `Membuka blokir user ${user.nama}`);
    }
    
    return true;
  }

  // NEW: Check if user is blocked
  isUserBlocked(userId: string): boolean {
    const users = this.getAllUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user || !user.isBlocked) return false;
    
    // Check if block has expired
    if (user.blockedUntil) {
      const now = new Date();
      const unblockTime = new Date(user.blockedUntil);
      
      if (now >= unblockTime) {
        // Auto unblock
        this.unblockUser(userId);
        return false;
      }
    }
    
    return true;
  }

  logActivity(userId: string, namaUser: string, aktivitas: string): void {
    const activities = this.getActivities();
    const newActivity: ActivityLog = {
      id: `activity-${Date.now()}`,
      userId,
      namaUser,
      aktivitas,
      tanggal: new Date().toLocaleDateString('id-ID'),
      waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
    
    activities.unshift(newActivity);
    
    if (activities.length > 100) {
      activities.splice(100);
    }
    
    localStorage.setItem('activities', JSON.stringify(activities));
  }

  getActivities(): ActivityLog[] {
    const activities = localStorage.getItem('activities');
    return activities ? JSON.parse(activities) : [];
  }

  deleteActivity(activityId: string): boolean {
    const activities = this.getActivities();
    const filteredActivities = activities.filter(a => a.id !== activityId);
    
    if (filteredActivities.length === activities.length) return false;
    
    localStorage.setItem('activities', JSON.stringify(filteredActivities));
    return true;
  }

  deleteAllActivities(): boolean {
    try {
      localStorage.setItem('activities', JSON.stringify([]));
      return true;
    } catch (error) {
      return false;
    }
  }

  getAvailableActivities(kategori: 'Pegawai' | 'Magang'): Array<{ value: string; label: string; icon: string }> {
    const allActivities = [
      { value: 'senam', label: 'Senam Pagi', icon: '🏃‍♂️' },
      { value: 'apel', label: 'Apel Pagi', icon: '🎖️' },
      { value: 'rapat', label: 'Rapat', icon: '💼' },
      { value: 'rapelan', label: 'Rapelan', icon: '📋' },
      { value: 'doa-bersama', label: 'Doa Bersama', icon: '🤲' }
    ];

    // Magang tidak punya akses ke Rapelan
    if (kategori === 'Magang') {
      return allActivities.filter(activity => activity.value !== 'rapelan');
    }

    return allActivities;
  }
}

export const authService = new AuthService();