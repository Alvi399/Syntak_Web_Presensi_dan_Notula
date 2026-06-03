import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 jam
const WARNING_BEFORE_MS = 2 * 60 * 1000;       // peringatan 2 menit sebelum logout
const LAST_ACTIVITY_KEY = 'syntak_last_activity';

interface UseInactivityLogoutOptions {
  isActive: boolean;           // hanya jalankan jika user sedang login
  onLogout: () => void;        // callback logout
  onWarning?: () => void;      // callback tampil peringatan
  onWarningDismiss?: () => void; // callback peringatan hilang (user aktif lagi)
}

export function useInactivityLogout({
  isActive,
  onLogout,
  onWarning,
  onWarningDismiss,
}: UseInactivityLogoutOptions) {
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWarningShownRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!isActive) return;

    clearTimers();

    // Simpan timestamp aktivitas terakhir ke localStorage
    // (untuk sinkronisasi antar tab)
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

    // Jika peringatan sedang tampil, hilangkan
    if (isWarningShownRef.current) {
      isWarningShownRef.current = false;
      onWarningDismiss?.();
    }

    // Set timer peringatan (1 jam - 2 menit)
    warningTimerRef.current = setTimeout(() => {
      isWarningShownRef.current = true;
      onWarning?.();
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Set timer logout (1 jam penuh)
    logoutTimerRef.current = setTimeout(() => {
      onLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [isActive, clearTimers, onLogout, onWarning, onWarningDismiss]);

  useEffect(() => {
    if (!isActive) {
      clearTimers();
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      return;
    }

    // Event yang dianggap sebagai aktivitas user
    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    // Throttle: hanya proses satu event per 30 detik untuk efisiensi
    let throttleTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleActivity = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
      }, 30_000);
      resetTimers();
    };

    activityEvents.forEach(event =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    // Cek apakah sudah expired saat tab baru dibuka / reload
    const lastActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || '0', 10);
    const elapsed = Date.now() - lastActivity;
    if (lastActivity > 0 && elapsed >= INACTIVITY_TIMEOUT_MS) {
      // Sudah lebih dari 1 jam tanpa aktivitas → langsung logout
      onLogout();
      return;
    }

    // Mulai timer dari sisa waktu yang tersisa (antar tab/reload)
    const remaining = lastActivity > 0
      ? Math.max(0, INACTIVITY_TIMEOUT_MS - elapsed)
      : INACTIVITY_TIMEOUT_MS;

    clearTimers();
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

    if (remaining <= WARNING_BEFORE_MS) {
      isWarningShownRef.current = true;
      onWarning?.();
    } else {
      warningTimerRef.current = setTimeout(() => {
        isWarningShownRef.current = true;
        onWarning?.();
      }, remaining - WARNING_BEFORE_MS);
    }

    logoutTimerRef.current = setTimeout(() => {
      onLogout();
    }, remaining);

    return () => {
      activityEvents.forEach(event =>
        window.removeEventListener(event, handleActivity)
      );
      clearTimers();
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [isActive, resetTimers, clearTimers, onLogout, onWarning]);
}
