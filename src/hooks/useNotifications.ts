import { useState, useEffect, useRef, useCallback } from 'react';
import { authService } from '@/lib/authService';
import { apiClient } from '@/lib/apiClient';

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  refId?: string;
  refType?: string;
  isRead: boolean;
  createdAt: string;
}

export interface BroadcastProgress {
  active: boolean;
  broadcastId?: string;
  judulKegiatan?: string;
  perihal?: string;
  sent: number;
  total: number;
  percent: number;
}

const INITIAL_PROGRESS: BroadcastProgress = {
  active: false,
  sent: 0,
  total: 0,
  percent: 0,
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [broadcastProgress, setBroadcastProgress] = useState<BroadcastProgress>(INITIAL_PROGRESS);
  const [unreadCount, setUnreadCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const computeUnread = (list: AppNotification[]) =>
    list.filter(n => !n.isRead).length;

  // Load existing notifications from DB
  const loadNotifications = useCallback(async () => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;
    try {
      const data = await apiClient.get<AppNotification[]>(`/notifications?userId=${currentUser.id}`);
      setNotifications(data);
      setUnreadCount(computeUnread(data));
    } catch {
      // silent
    }
  }, []);

  // Mark a single notification as read
  const markRead = useCallback(async (notifId: string) => {
    try {
      await apiClient.put(`/notifications/${notifId}/read`, {});
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  }, []);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;
    try {
      await apiClient.put('/notifications/read-all', { userId: currentUser.id });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, []);

  // Subscribe to SSE
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    loadNotifications();

    const backendBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
    const es = new EventSource(`${backendBase}/api/events?userId=${currentUser.id}`);
    esRef.current = es;

    // New notification pushed to this user
    es.addEventListener('notification', (e) => {
      const notif: AppNotification = JSON.parse(e.data);
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    // Broadcast lifecycle events (visible to ALL users)
    es.addEventListener('broadcast_start', (e) => {
      const data = JSON.parse(e.data);
      setBroadcastProgress({
        active: true,
        broadcastId: data.broadcastId,
        judulKegiatan: data.judulKegiatan,
        perihal: data.perihal,
        sent: 0,
        total: data.total,
        percent: 0,
      });
    });

    es.addEventListener('broadcast_progress', (e) => {
      const data = JSON.parse(e.data);
      setBroadcastProgress(prev => ({
        ...prev,
        sent: data.sent,
        total: data.total,
        percent: data.percent,
      }));
    });

    es.addEventListener('broadcast_complete', (e) => {
      const data = JSON.parse(e.data);
      setBroadcastProgress(prev => ({
        ...prev,
        active: false,
        sent: data.sent,
        total: data.total,
        percent: 100,
      }));
      // After 4 seconds, hide the bar
      setTimeout(() => setBroadcastProgress(INITIAL_PROGRESS), 4000);
    });

    es.addEventListener('broadcast_error', () => {
      setBroadcastProgress(INITIAL_PROGRESS);
    });

    // Data update event — dikirim backend setelah setiap CRUD berhasil
    // Dispatch ke window agar halaman mana pun bisa subscribe tanpa prop drilling
    es.addEventListener('data_update', (e) => {
      try {
        const detail = JSON.parse(e.data);
        console.log('[SSE] Data update received:', detail);
        // Dispatch original type
        window.dispatchEvent(new CustomEvent('syntak:data_update', { detail }));
        // Also dispatch a global 'all' update to be absolutely sure all components refresh
        window.dispatchEvent(new CustomEvent('syntak:data_update', { detail: { type: 'all' } }));
      } catch {}
    });

    return () => {
      if (esRef.current) {
        esRef.current.close();
      }
      esRef.current = null;
    };
  }, []);

  return {
    notifications,
    broadcastProgress,
    unreadCount,
    loadNotifications,
    markRead,
    markAllRead,
  };
}
