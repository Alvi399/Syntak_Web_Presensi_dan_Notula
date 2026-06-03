import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Users, UserCircle, Mail, MapPin } from 'lucide-react';
import { dataService } from '@/lib/dataService';
import { authService } from '@/lib/authService';
import { PageLoader } from '@/components/ui/spinner';

const TARGET_LAT = -7.3283539;
const TARGET_LNG = 112.7283419;
const MAX_RADIUS_METERS = 100;

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

interface PresensiTamuProps {
  qrId: string;
}

export default function PresensiTamu({ qrId }: PresensiTamuProps) {
  const [mode, setMode] = useState<'choose' | 'syntak' | 'guest'>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [instansi, setInstansi] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [signature, setSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [qrData, setQrData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [locationStatus, setLocationStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'error'>('idle');
  const [distance, setDistance] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string>('');

  useEffect(() => {
    loadQRData();
    // Auto-detect Syntak login on mount
    const loggedInUser = authService.getCurrentUser();
    if (loggedInUser) {
      setCurrentUser(loggedInUser);
      setIsLoggedIn(true);
      setMode('syntak');
    }
  }, [qrId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && (isLoggedIn || mode === 'guest') && qrData) {
      canvas.width = 600;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [mode, isLoggedIn, qrData]);

  const verifyLocation = useCallback(() => {
    // Cek apakah browser mendukung Geolocation
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Browser Anda tidak mendukung fitur Geolocation. Gunakan Chrome/Firefox terbaru.');
      return;
    }

    // Cek non-secure origin (HTTP bukan localhost)
    const isSecure = window.isSecureContext ||
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (!isSecure) {
      setLocationStatus('error');
      setLocationError('Deteksi lokasi memerlukan koneksi HTTPS. Hubungi admin IT untuk mengaktifkan HTTPS.');
      return;
    }

    setLocationStatus('checking');
    setLocationError('');

    const onSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const d = calculateDistance(latitude, longitude, TARGET_LAT, TARGET_LNG);
      setDistance(Math.round(d));
      if (d <= MAX_RADIUS_METERS) {
        setLocationStatus('valid');
      } else {
        setLocationStatus('invalid');
        setLocationError(`Anda berada di luar area kantor (Jarak: ${Math.round(d)}m dari BPS). Pastikan Anda berada di dalam gedung.`);
      }
    };

    const onError = (error: GeolocationPositionError) => {
      // Percobaan ke-2: coba dengan low-accuracy jika high-accuracy gagal
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (secondError) => {
          setLocationStatus('error');
          switch (secondError.code) {
            case secondError.PERMISSION_DENIED:
              setLocationError(
                'Akses lokasi ditolak. Buka pengaturan browser → Situs → izinkan Lokasi untuk halaman ini, lalu tekan "Coba Lagi".',
              );
              break;
            case secondError.POSITION_UNAVAILABLE:
              setLocationError(
                'Posisi tidak tersedia. Pastikan GPS/WiFi aktif, atau coba dari perangkat yang berbeda.',
              );
              break;
            case secondError.TIMEOUT:
              setLocationError(
                'Waktu deteksi habis. Pastikan sinyal GPS/WiFi stabil, lalu tekan "Coba Lagi".',
              );
              break;
            default:
              setLocationError(`Gagal membaca lokasi (kode: ${secondError.code}). Coba tekan "Coba Lagi".`);
          }
        },
        // Percobaan ke-2: tanpa GPS hardware (Wi-Fi/cell tower saja, jauh lebih cepat)
        { enableHighAccuracy: false, timeout: 20_000, maximumAge: 30_000 },
      );

      // Log error percobaan pertama untuk debugging
      console.warn('[GPS] High-accuracy attempt failed:', error.message, '— retrying with low accuracy...');
    };

    // Percobaan ke-1: high accuracy dengan cache 30 detik agar tidak terlalu lambat
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      onError,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }, []);

  // Menghapus useEffect auto-trigger location agar browser
  // tidak nge-block request GPS karena tidak ada user gesture.
  // Location check sekarang dieksekusi secara manual via tombol.

  const loadQRData = async () => {
    setIsLoading(true);
    try {
      const data = await dataService.getQRAbsensiData(qrId);
      if (data && data.isActive) {
        setQrData(data);
      } else {
        setMessage({ type: 'error', text: 'QR Code tidak valid atau sudah tidak aktif' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal memuat data QR Code' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSyntak = async () => {
    if (!email || !password) {
      setMessage({ type: 'error', text: 'Email dan password harus diisi' });
      return;
    }
    setIsSubmitting(true);
    const result = await authService.login(email, password);
    setIsSubmitting(false);

    if (result.success && result.user) {
      setCurrentUser(result.user);
      setIsLoggedIn(true);
      setMode('syntak');
      setMessage({ type: 'success', text: `Selamat datang, ${result.user.nama}!` });
    } else {
      setMessage({ type: 'error', text: result.message || 'Login gagal' });
    }
  };

  // Drawing logic
  const getCanvasPoint = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!isDrawing) return;
    const point = getCanvasPoint(e);
    if (!point) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL());
    }
  };

  const handleSubmit = async () => {
    if (locationStatus !== 'valid') {
      setMessage({ type: 'error', text: 'Lokasi Anda belum valid. Pastikan berada di area kantor.' });
      return;
    }
    if (!signature) {
      setMessage({ type: 'error', text: 'Silakan buat tanda tangan terlebih dahulu' });
      return;
    }
    if (mode === 'guest' && (!nama.trim() || !instansi.trim() || !guestEmail.trim())) {
      setMessage({ type: 'error', text: 'Lengkapi semua data tamu' });
      return;
    }

    setIsSubmitting(true);
    try {
      let result;
      if (mode === 'syntak' && currentUser) {
        result = await dataService.saveAbsensi(
          qrData.jenisKegiatan,
          qrData.namaKegiatan,
          signature,
          qrData.idKegiatan
        );
      } else {
        result = await dataService.saveGuestAbsensi(
          nama.trim(),
          instansi.trim(),
          guestEmail.trim(),
          qrData.jenisKegiatan,
          qrData.namaKegiatan,
          signature,
          qrData.idKegiatan
        );
      }

      if (result.success) {
        setMessage({ type: 'success', text: 'Presensi berhasil disimpan! Terima kasih.' });
        setSignature('');
      } else {
        const isWarning = result.message?.toLowerCase().includes('sudah presensi');
        setMessage({ 
          type: isWarning ? 'warning' : 'error', 
          text: result.message || 'Gagal menyimpan presensi atau Anda sudah presensi' 
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activityLabels: Record<string, string> = {
    'senam': 'Senam Pagi', 'apel': 'Apel Pagi', 'rapelan': 'Rapelan',
    'rapat': 'Rapat', 'doa-bersama': 'Doa Bersama', 'sharing-knowledge': 'Sharing Knowledge'
  };

  if (isLoading) return <PageLoader text="Memuat data QR..." className="min-h-screen" />;
  if (!qrData) return <div className="min-h-screen flex items-center justify-center p-4"><Card className="p-6 text-center">QR Code Tidak Valid</Card></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-2xl border-0 overflow-hidden">
        <CardHeader className="bg-blue-600 text-white text-center pb-8">
          <CheckCircle className="w-12 h-12 mx-auto mb-4" />
          <CardTitle className="text-2xl">Presensi Digital</CardTitle>
          <CardDescription className="text-blue-100">{qrData.namaKegiatan}</CardDescription>
          <div className="mt-4 inline-block bg-white/20 px-4 py-1 rounded-full text-sm font-bold">
            {activityLabels[qrData.jenisKegiatan] || qrData.jenisKegiatan}
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          {mode === 'choose' ? (
            <div className={`grid grid-cols-1 ${qrData.pesertaMode === 'akun' ? '' : 'md:grid-cols-2'} gap-4`}>
              <Button onClick={() => setMode('syntak')} variant="outline" className="h-32 flex flex-col gap-2 border-2">
                <UserCircle className="w-8 h-8 text-blue-600" />
                <span className="font-bold">Akun Syntak</span>
                <p className="text-xs text-gray-500 font-normal">Pegawai & Magang BPS</p>
              </Button>
              
              {qrData.pesertaMode !== 'akun' && (
                <Button onClick={() => setMode('guest')} variant="outline" className="h-32 flex flex-col gap-2 border-2">
                  <Users className="w-8 h-8 text-purple-600" />
                  <span className="font-bold">Tamu Umum</span>
                  <p className="text-xs text-gray-500 font-normal">Peserta Luar / Public</p>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Button onClick={() => setMode('choose')} variant="ghost" size="sm">← Kembali</Button>
              
              {mode === 'syntak' && !isLoggedIn && (
                <div className="space-y-3">
                  <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                  <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                  <Button onClick={handleLoginSyntak} className="w-full bg-blue-600" disabled={isSubmitting}>Login & Lanjut</Button>
                </div>
              )}

              {((mode === 'syntak' && isLoggedIn) || mode === 'guest') && (
                <div className="space-y-4">
                  {mode === 'guest' && (
                    <div className="grid gap-3">
                      <Input placeholder="Nama Lengkap" value={nama} onChange={e => setNama(e.target.value)} />
                      <Input placeholder="Asal Instansi" value={instansi} onChange={e => setInstansi(e.target.value)} />
                      <Input placeholder="Email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Tanda Tangan *</Label>
                    <div className="bg-white border-2 border-dashed rounded-xl overflow-hidden">
                      <canvas 
                        ref={canvasRef} 
                        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                        className="w-full h-40 cursor-crosshair touch-none"
                      />
                    </div>
                    <Button variant="link" size="sm" onClick={() => {
                       const ctx = canvasRef.current?.getContext('2d');
                       ctx?.clearRect(0, 0, 600, 200);
                       setSignature('');
                    }} className="text-red-500 p-0 h-auto">Hapus Tanda Tangan</Button>
                  </div>

                  <div className={`p-4 rounded-xl border-2 flex items-start gap-4 transition-all ${
                    locationStatus === 'checking' ? 'bg-blue-50 border-blue-200 shadow-inner' :
                    locationStatus === 'valid'    ? 'bg-green-50 border-green-200' :
                    locationStatus === 'invalid'  ? 'bg-amber-50 border-amber-200' :
                    locationStatus === 'error'    ? 'bg-red-50 border-red-200' :
                    /* idle */ 'bg-slate-50 border-slate-200'
                  }`}>
                    <MapPin className={`w-6 h-6 mt-0.5 flex-shrink-0 ${
                      locationStatus === 'checking' ? 'text-blue-500 animate-bounce' :
                      locationStatus === 'idle' ? 'text-slate-500' :
                      locationStatus === 'valid'    ? 'text-green-500' :
                      locationStatus === 'invalid'  ? 'text-amber-500' :
                      'text-red-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        {locationStatus === 'checking' && (
                          <>
                            <span className="inline-block w-3 h-3 rounded-full bg-blue-400 animate-ping" />
                            Memverifikasi Lokasi...
                          </>
                        )}
                        {locationStatus === 'idle' && 'Akses Lokasi (GPS) Diperlukan'}
                        {locationStatus === 'valid'   && '✅ Lokasi Anda Tervalidasi'}
                        {locationStatus === 'invalid' && '⚠️ Di Luar Area Kantor'}
                        {locationStatus === 'error'   && '❌ Gagal Membaca Lokasi'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {locationStatus === 'checking' &&
                          'Mohon tunggu — mencoba GPS, lalu Wi-Fi / jaringan sebagai cadangan...'}
                        {locationStatus === 'idle' &&
                          'Sistem harus memverifikasi lokasi Anda. Mohon izinkan akses GPS saat ditanya.'}
                        {locationStatus === 'valid' &&
                          `Anda berada di area kantor (Jarak: ${distance}m).`}
                        {(locationStatus === 'invalid' || locationStatus === 'error') && locationError}
                      </p>
                      {locationStatus === 'idle' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            verifyLocation();
                          }}
                          className="mt-3 text-xs bg-blue-600 hover:bg-blue-700 h-8"
                        >
                          📍 Izinkan & Cek Lokasi Sekarang
                        </Button>
                      )}
                      {(locationStatus === 'invalid' || locationStatus === 'error') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            setLocationStatus('idle');
                            setLocationError('');
                            setDistance(null);
                          }}
                          className="mt-3 text-xs bg-white h-7"
                        >
                          🔄 Coba Lagi
                        </Button>
                      )}
                    </div>
                  </div>

                  <Button onClick={handleSubmit} className="w-full h-12 bg-blue-600 font-bold" disabled={isSubmitting || !signature || locationStatus !== 'valid'}>
                    {isSubmitting ? 'Mengirim...' : locationStatus !== 'valid' ? 'Menunggu Lokasi Valid...' : 'Kirim Presensi'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {message.text && (
            <Alert className={`${
              message.type === 'error' 
                ? 'border-red-300 bg-red-50 border-2' 
                : message.type === 'warning'
                ? 'border-amber-300 bg-amber-50 border-2'
                : 'border-green-300 bg-green-50 border-2'
            }`}>
              <AlertDescription className={`font-medium ${
                message.type === 'error' ? 'text-red-700' : 
                message.type === 'warning' ? 'text-amber-700' : 'text-green-700'
              }`}>
                {message.type === 'success' ? '✅ ' : message.type === 'warning' ? '⚠️ ' : '❌ '}
                {message.text}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}