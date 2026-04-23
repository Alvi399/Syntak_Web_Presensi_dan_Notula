import { useEffect, useRef } from 'react';

/**
 * useDataSync — subscribe ke event real-time dari backend (via SSE → CustomEvent)
 *
 * @param types  Tipe data yang ingin di-watch: 'jadwal' | 'undangan' | 'absensi' | 'notulensi' | 'users' | 'all'
 * @param onUpdate Callback yang dipanggil saat ada update data
 *
 * Contoh pemakaian:
 *   useDataSync(['jadwal', 'absensi'], () => loadData());
 */
export function useDataSync(
  types: string[],
  onUpdate: () => void
) {
  // Selalu simpan referensi terbaru dari callback di ref
  // agar tidak ada stale closure dan tidak ada TDZ error pada production build
  const callbackRef = useRef<() => void>(onUpdate);

  useEffect(() => {
    callbackRef.current = onUpdate;
  });

  useEffect(() => {
    const typesKey = types.join(',');

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type?: string };
      // Jika type 'all' cocok dengan semua tipe, atau tipe spesifik cocok
      if (!detail?.type || typesKey.includes('all') || typesKey.split(',').includes(detail.type)) {
        callbackRef.current();
      }
    };

    window.addEventListener('syntak:data_update', handler);
    return () => window.removeEventListener('syntak:data_update', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.join(',')]);
}
