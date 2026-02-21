import { apiClient } from './apiClient';

export interface User {
  id: string;
  nama: string;
  email: string;
  password?: string;
  kategori: 'Pegawai' | 'Magang';
  role: 'user' | 'admin';
  tanggalDaftar: string;
  isBlocked?: boolean;
  blockReason?: 'izin' | 'sakit' | 'alpa' | 'izin-telat';
  blockNote?: string;
  blockedUntil?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  namaUser: string;
  aktivitas: string;
  tanggal: string;
  waktu: string;
}

class AuthService {
  private currentUser: User | null = null;
  private adminInitialized = false;

  constructor() {
    this.loadCurrentUser();
    this.ensureAdminExists();
  }

  private loadCurrentUser() {
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('currentUser');
      this.currentUser = userData ? JSON.parse(userData) : null;
    }
  }

  private async ensureAdminExists(): Promise<void> {
    if (this.adminInitialized) return;
    
    try {
      await apiClient.post('/auth/init-admin');
      this.adminInitialized = true;
    } catch (error) {
      console.error('Init admin error:', error);
    }
  }

  async register(
    nama: string,
    email: string,
    password: string,
    kategori: 'Pegawai' | 'Magang'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await apiClient.post<{ success: boolean; message: string }>(
        '/auth/register',
        { nama, email, password, kategori }
      );
      return result;
    } catch (error: any) {
      return { success: false, message: error.message || 'Registrasi gagal' };
    }
  }

  async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const result = await apiClient.post<{ success: boolean; message: string; user?: User }>(
        '/auth/login',
        { email, password }
      );

      if (result.success && result.user) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentUser', JSON.stringify(result.user));
        }
        this.currentUser = result.user;
      }

      return result;
    } catch (error: any) {
      return { success: false, message: error.message || 'Login gagal' };
    }
  }

  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser');
    }
    this.currentUser = null;
  }

  getCurrentUser(): User | null {
    if (!this.currentUser && typeof window !== 'undefined') {
      const userData = localStorage.getItem('currentUser');
      this.currentUser = userData ? JSON.parse(userData) : null;
    }
    return this.currentUser;
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await apiClient.get<User[]>('/auth/users');
    } catch (error) {
      console.error('Get users error:', error);
      return [];
    }
  }

  getAllUsersForAdmin(): Promise<User[]> {
    return this.getAllUsers();
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<boolean> {
    try {
      await apiClient.put(`/auth/users/${userId}`, updates);

      // Update localStorage if current user
      if (this.currentUser && this.currentUser.id === userId) {
        const users = await this.getAllUsers();
        const updatedUser = users.find(u => u.id === userId);
        if (updatedUser) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          }
          this.currentUser = updatedUser;
        }
      }

      return true;
    } catch (error) {
      console.error('Update user error:', error);
      return false;
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/auth/users/${userId}`);
      return true;
    } catch (error) {
      console.error('Delete user error:', error);
      return false;
    }
  }

  async resetPassword(userId: string, newPassword: string): Promise<boolean> {
    return this.updateUser(userId, { password: newPassword });
  }

  async blockUser(
    userId: string,
    reason: 'izin' | 'sakit' | 'alpa' | 'izin-telat',
    note?: string
  ): Promise<boolean> {
    try {
      await apiClient.post(`/auth/users/${userId}/block`, { reason, note });
      return true;
    } catch (error) {
      console.error('Block user error:', error);
      return false;
    }
  }

  async unblockUser(userId: string): Promise<boolean> {
    try {
      await apiClient.post(`/auth/users/${userId}/unblock`);
      return true;
    } catch (error) {
      console.error('Unblock user error:', error);
      return false;
    }
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const users = await this.getAllUsers();
      const user = users.find(u => u.id === userId);
      
      if (!user || !user.isBlocked) return false;

      if (user.blockedUntil) {
        const now = new Date();
        const unblockTime = new Date(user.blockedUntil);

        if (now >= unblockTime) {
          await this.unblockUser(userId);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Check blocked error:', error);
      return false;
    }
  }

  async logActivity(userId: string, namaUser: string, aktivitas: string): Promise<void> {
    // Activity logging disabled untuk menghemat database space
    // Uncomment jika diperlukan untuk audit trail
    return Promise.resolve();
  }

  async getActivities(): Promise<ActivityLog[]> {
    try {
      return await apiClient.get<ActivityLog[]>('/auth/activities');
    } catch (error) {
      console.error('Get activities error:', error);
      return [];
    }
  }

  async deleteActivity(activityId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/auth/activities/${activityId}`);
      return true;
    } catch (error) {
      console.error('Delete activity error:', error);
      return false;
    }
  }

  async deleteAllActivities(): Promise<boolean> {
    try {
      await apiClient.delete('/auth/activities');
      return true;
    } catch (error) {
      console.error('Delete all activities error:', error);
      return false;
    }
  }

  getAvailableActivities(
    kategori: 'Pegawai' | 'Magang'
  ): Array<{ value: string; label: string; icon: string }> {
    const allActivities = [
      { value: 'senam', label: 'Senam Pagi', icon: '🏃‍♂️' },
      { value: 'apel', label: 'Apel Pagi', icon: '🎖️' },
      { value: 'rapat', label: 'Rapat', icon: '💼' },
      { value: 'rapelan', label: 'Rapelan', icon: '📋' },
      { value: 'doa-bersama', label: 'Doa Bersama', icon: '🤲' }
    ];

    if (kategori === 'Magang') {
      return allActivities.filter(activity => activity.value !== 'rapelan');
    }

    return allActivities;
  }
}

export const authService = new AuthService();

