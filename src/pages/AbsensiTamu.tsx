import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Users, UserCircle } from 'lucide-react';
import SignaturePad from '@/components/SignaturePad';
import { dataService } from '@/lib/dataService';
import { authService } from '@/lib/authService';

interface AbsensiTamuProps {
  qrId: string;
}

export default function AbsensiTamu({ qrId }: AbsensiTamuProps) {
  const [mode, setMode] = useState<'choose' | 'syntak' | 'guest'>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [instansi, setInstansi] = useState('');
  const [signature, setSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [qrData, setQrData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    loadQRData();
  }, [qrId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && qrData) {
      // Set ukuran canvas
      const rect = canvas.getBoundingClientRect();
      canvas.width = 600;
      canvas.height = 200;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Setup drawing style
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [qrData]);

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
      setNama(result.user.nama);
      setMode('syntak');
      setMessage({ type: 'success', text: `Selamat datang, ${result.user.nama}!` });
    } else {
      setMessage({ type: 'error', text: result.message || 'Login gagal' });
    }
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      // Touch event
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;
    
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const point = getCanvasPoint(e);
    if (!point) return;
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e) e.preventDefault();
    
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.closePath();
      }
      // Simpan signature sebagai base64
      const signatureData = canvas.toDataURL();
      setSignature(signatureData);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  };

  const jenisKegiatanLabels: Record<string, string> = {
    'senam': 'Senam Pagi',
    'apel': 'Apel Pagi',
    'rapelan': 'Rapelan',
    'rapat': 'Rapat',
    'doa-bersama': 'Doa Bersama'
  };

  const handleSubmit = async () => {
    if (!signature) {
      setMessage({ type: 'error', text: 'Silakan buat tanda tangan terlebih dahulu' });
      return;
    }

    // Validasi untuk mode guest
    if (mode === 'guest') {
      if (!nama.trim()) {
        setMessage({ type: 'error', text: 'Nama tidak boleh kosong' });
        return;
      }

      if (!instansi.trim()) {
        setMessage({ type: 'error', text: 'Asal instansi tidak boleh kosong' });
        return;
      }
    }

    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      let success = false;

      if (mode === 'syntak' && currentUser) {
        // Absensi sebagai user Syntak
        success = await dataService.saveAbsensi(
          qrData.jenisKegiatan,
          qrData.namaKegiatan,
          signature
        );
      } else {
        // Absensi sebagai tamu
        success = await dataService.saveGuestAbsensi(
          nama.trim(),
          instansi.trim(),
          qrData.jenisKegiatan,
          qrData.namaKegiatan,
          signature
        );
      }

      if (success) {
        setMessage({ 
          type: 'success', 
          text: 'Absensi berhasil disimpan! Terima kasih atas kehadiran Anda.' 
        });
        setNama('');
        setInstansi('');
        setSignature('');
        window.location.hash = Math.random().toString();
      } else {
        setMessage({ type: 'error', text: 'Gagal menyimpan absensi' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat data QR Code...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <CardTitle>QR Code Tidak Valid</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              QR Code yang Anda pindai tidak valid atau sudah tidak aktif.
              Silakan hubungi administrator.
            </p>
            {message.text && (
              <Alert className="border-red-500 bg-red-50">
                <AlertDescription className="text-red-700">
                  {message.text}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-xl">
        <CardHeader>
          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Absensi {qrData?.namaKegiatan || 'Kegiatan'}</CardTitle>
            <CardDescription className="text-base mt-2">
              BPS Kota Surabaya
            </CardDescription>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-center">
              <p className="text-sm text-blue-700 mb-1">Jenis Kegiatan:</p>
              <p className="text-lg font-bold text-blue-900">
                {jenisKegiatanLabels[qrData?.jenisKegiatan]}
              </p>
              <p className="text-base font-semibold text-blue-800 mt-2">
                {qrData?.namaKegiatan}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                {new Date().toLocaleDateString('id-ID', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Mode Selection */}
          {mode === 'choose' && (
            <div className="space-y-4">
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-900 font-medium text-center">
                  Pilih cara absensi Anda:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Login Syntak */}
                <button
                  onClick={() => setMode('syntak')}
                  className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UserCircle className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-blue-900 mb-2">
                      Login sebagai Akun Syntak
                    </h3>
                    <p className="text-sm text-blue-700">
                      Untuk pegawai/magang BPS yang sudah terdaftar
                    </p>
                  </div>
                </button>

                {/* Option 2: Guest */}
                <button
                  onClick={() => setMode('guest')}
                  className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:shadow-lg transition-all"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-purple-900 mb-2">
                      Masuk sebagai Tamu
                    </h3>
                    <p className="text-sm text-purple-700">
                      Untuk tamu dari instansi lain
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Login Form - Mode Syntak */}
          {mode === 'syntak' && !isLoggedIn && (
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={() => setMode('choose')}
                className="mb-4"
              >
                ← Kembali
              </Button>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 font-medium">
                  🔐 Login dengan akun Syntak Anda
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@bps.go.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12"
                />
              </div>

              <Button
                onClick={handleLoginSyntak}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isSubmitting}
                size="lg"
              >
                {isSubmitting ? 'Memproses...' : 'Login dan Lanjutkan'}
              </Button>
            </div>
          )}

          {/* Form Absensi - After Login or Guest Mode */}
          {((mode === 'syntak' && isLoggedIn) || mode === 'guest') && (
            <div className="space-y-4">
              {mode === 'guest' && (
                <Button
                  variant="outline"
                  onClick={() => setMode('choose')}
                  className="mb-4"
                >
                  ← Kembali
                </Button>
              )}

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm text-green-900 font-medium">
                  {mode === 'syntak' 
                    ? `✅ Login berhasil sebagai ${currentUser?.nama}`
                    : '📝 Isi data diri Anda'
                  }
                </p>
              </div>

              {/* Form fields for guest */}
              {mode === 'guest' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nama">Nama Lengkap *</Label>
                    <Input
                      id="nama"
                      placeholder="Masukkan nama lengkap"
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instansi">Asal Instansi/Lembaga *</Label>
                    <Input
                      id="instansi"
                      placeholder="Contoh: BPS Provinsi Jawa Timur"
                      value={instansi}
                      onChange={(e) => setInstansi(e.target.value)}
                      className="h-12"
                    />
                  </div>
                </>
              )}

              {/* Signature Pad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Tanda Tangan Digital *</Label>
                  {signature && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearSignature}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Hapus Tanda Tangan
                    </Button>
                  )}
                </div>
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl overflow-hidden hover:border-blue-400 transition-colors">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full cursor-crosshair touch-none"
                    style={{ touchAction: 'none' }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Gunakan mouse atau sentuh layar untuk membuat tanda tangan
                </p>
              </div>

              {/* Submit Button */}
              <Button 
                onClick={handleSubmit} 
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800" 
                disabled={isSubmitting || !signature}
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Submit Absensi
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Message */}
          {message.text && (
            <Alert className={`${
              message.type === 'error' 
                ? 'border-red-300 bg-red-50 border-2' 
                : 'border-green-300 bg-green-50 border-2'
            }`}>
              <AlertDescription className={`font-medium ${
                message.type === 'error' ? 'text-red-700' : 'text-green-700'
              }`}>
                {message.type === 'success' ? '✅ ' : '❌ '}
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {/* Footer Info */}
          <div className="text-center text-xs text-gray-500 pt-4 border-t">
            <p>Data yang Anda masukkan akan tersimpan di database BPS Kota Surabaya</p>
            <p className="mt-1">Terima kasih atas partisipasi Anda</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}