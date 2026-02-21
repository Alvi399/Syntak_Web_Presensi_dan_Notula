import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle, Clock, Users, Calendar, QrCode as QrIcon, Share2, TrendingUp, Zap, Award, Ban, AlertCircle } from 'lucide-react';
import QRCode from 'react-qr-code';
// import SignaturePad from '@/components/SignaturePad';
import { authService } from '@/lib/authService';
import { dataService } from '@/lib/dataService';

export default function Absensi() {
  const [selectedKegiatan, setSelectedKegiatan] = useState('');
  const [namaKegiatan, setNamaKegiatan] = useState('');
  // const [signature, setSignature] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [generatedQRId, setGeneratedQRId] = useState('');
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockInfo, setBlockInfo] = useState<{
    reason?: string;
    note?: string;
    blockedUntil?: string;
  }>({});
  const [todayAbsensi, setTodayAbsensi] = useState<any[]>([]);
  const [userTodayAbsensi, setUserTodayAbsensi] = useState<any[]>([]);
  
  const currentUser = authService.getCurrentUser();

  const jenisKegiatan = currentUser 
    ? authService.getAvailableActivities(currentUser.kategori)
    : [];

  useEffect(() => {
    // Load data on mount
    loadAbsensiData();
    checkUserBlockStatus();
    checkActiveQR();
  }, [currentUser]);

  const checkActiveQR = async () => {
    if (currentUser?.role === 'admin') {
      const activeQR = await dataService.getActiveQR(currentUser.id);
      if (activeQR) {
        setGeneratedQRId(activeQR.id);
        setSelectedKegiatan(activeQR.jenisKegiatan);
        setNamaKegiatan(activeQR.namaKegiatan);
        // Don't auto-show dialog on nav back, just set state so UI shows "Active Session"
        // setShowQRDialog(true); 
      }
    }
  };

  const loadAbsensiData = async () => {
    const today = await dataService.getAbsensiToday();
    setTodayAbsensi(today);
    
    if (currentUser) {
      const userToday = today.filter(a => a.userId === currentUser.id);
      setUserTodayAbsensi(userToday);
    }
  };


  const checkUserBlockStatus = async () => {
    if (currentUser) {
      const blocked = await authService.isUserBlocked(currentUser.id);
      setIsBlocked(blocked);
      
      if (blocked) {
        const users = await authService.getAllUsersForAdmin();
        const userData = users.find(u => u.id === currentUser.id);
        if (userData) {
          setBlockInfo({
            reason: userData.blockReason,
            note: userData.blockNote,
            blockedUntil: userData.blockedUntil
          });
        }
      }
    }
  };

  const handleGenerateQR = async () => {
  // Cek apakah user adalah admin
    if (!currentUser || currentUser.role !== 'admin') {
      setMessage({ 
        type: 'error', 
        text: 'Hanya admin yang dapat membuat QR Code absensi' 
      });
      return;
    }

    if (!selectedKegiatan) {
      setMessage({ type: 'error', text: 'Pilih jenis kegiatan terlebih dahulu' });
      return;
    }

    if (!namaKegiatan.trim()) {
      setMessage({ type: 'error', text: 'Masukkan nama kegiatan terlebih dahulu' });
      return;
    }

    const qrId = await dataService.generateAbsensiQR(
      selectedKegiatan as any, 
      namaKegiatan.trim()
    );
    
    if (qrId) {
      setGeneratedQRId(qrId);
      setShowQRDialog(true);
      setMessage({ type: 'success', text: 'QR Code berhasil dibuat!' });
    } else {
      setMessage({ type: 'error', text: 'Gagal membuat QR Code' });
    }
  };

  const handleClosePresence = async () => {
    if (generatedQRId) {
      const success = await dataService.deactivateQRCode(generatedQRId);
      if (success) {
        setGeneratedQRId('');
        setNamaKegiatan('');
        setSelectedKegiatan('');
        setShowQRDialog(false);
        setMessage({ type: 'success', text: 'Presensi berhasil ditutup' });
      } else {
        setMessage({ type: 'error', text: 'Gagal menutup presensi' });
      }
    }
  };

  const getQRUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/#/absensi-qr/${generatedQRId}`;
  };

  const handleCopyQRLink = () => {
    navigator.clipboard.writeText(getQRUrl());
    setMessage({ type: 'success', text: 'Link QR berhasil disalin!' });
  };

  const getBlockReasonLabel = (reason?: string) => {
    const reasons: Record<string, string> = {
      'izin': '✅ Izin',
      'sakit': '🏥 Sakit',
      'alpa': '❌ Alpa',
      'izin-telat': '⏰ Izin Telat'
    };
    return reason ? reasons[reason] || reason : '';
  };

  const formatBlockedUntil = (blockedUntil?: string) => {
    if (!blockedUntil) return '';
    const date = new Date(blockedUntil);
    return date.toLocaleString('id-ID', { 
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // FIX COMPLETE: Struktur JSX Absensi.tsx yang Benar

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              {isBlocked ? (
                <Badge className="bg-red-500/90 text-white border-0 hover:bg-red-500">
                  <Ban className="w-3 h-3 mr-2" />
                  Akun Diblokir
                </Badge>
              ) : (
                <Badge className="bg-green-500/90 text-white border-0 hover:bg-green-500">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                  Sistem Aktif
                </Badge>
              )}
            </div>
            <h1 className="text-4xl font-bold mb-2">Absensi Digital</h1>
            <p className="text-blue-100 text-lg">
              {isBlocked 
                ? 'Akun Anda sedang diblokir oleh administrator'
                : 'Scan QR Code untuk melakukan absensi'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Block Warning Alert */}
      {isBlocked && (
        <Alert className="border-2 border-red-300 bg-red-50 shadow-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-800 ml-2">
            <div className="space-y-2">
              <p className="font-bold text-lg">⚠️ Akun Anda Diblokir</p>
              <div className="space-y-1 text-sm">
                <p><strong>Alasan:</strong> {getBlockReasonLabel(blockInfo.reason)}</p>
                {blockInfo.note && (
                  <p><strong>Catatan:</strong> {blockInfo.note}</p>
                )}
                {blockInfo.blockedUntil && (
                  <p><strong>Blokir sampai:</strong> {formatBlockedUntil(blockInfo.blockedUntil)}</p>
                )}
                <p className="mt-3 text-red-700">
                  Anda tidak dapat melakukan absensi sampai blokir dibuka oleh administrator atau waktu blokir berakhir.
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Total Hari Ini */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                <TrendingUp className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </div>
            <h3 className="text-4xl font-bold text-gray-900 mb-1">{todayAbsensi.length}</h3>
            <p className="text-sm text-gray-600">Orang telah absen hari ini</p>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500" 
                style={{width: `${Math.min((todayAbsensi.length / 50) * 100, 100)}%`}}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Absensi Anda */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-transparent rounded-full -mr-16 -mt-16" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              {userTodayAbsensi.length > 0 && !isBlocked && (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                  <Award className="w-3 h-3 mr-1" />
                  Aktif
                </Badge>
              )}
              {isBlocked && (
                <Badge className="bg-red-100 text-red-700 hover:bg-red-200">
                  <Ban className="w-3 h-3 mr-1" />
                  Blokir
                </Badge>
              )}
            </div>
            <h3 className="text-4xl font-bold text-gray-900 mb-1">{userTodayAbsensi.length}</h3>
            <p className="text-sm text-gray-600">Kegiatan yang Anda ikuti</p>
            {userTodayAbsensi.length > 0 && !isBlocked ? (
              <div className="mt-4 flex items-center gap-2 text-green-600">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-medium">Tetap semangat! 🔥</span>
              </div>
            ) : isBlocked ? (
              <div className="mt-4 text-xs text-red-600 font-medium">
                ⚠️ Akun diblokir
              </div>
            ) : (
              <div className="mt-4 text-xs text-gray-400">
                Belum ada absensi hari ini
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Waktu Real-time */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-600 to-orange-700 text-white hover:shadow-xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-10" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <Badge className="bg-white/20 text-white border-0">
                WIB
              </Badge>
            </div>
            <h3 className="text-4xl font-bold mb-1">
              {new Date().toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </h3>
            <p className="text-sm text-orange-100">
              {new Date().toLocaleDateString('id-ID', { 
                weekday: 'long'
              })}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-orange-100">Sistem Aktif</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Form Generate QR atau Info */}
        <Card className={`border-2 shadow-lg ${isBlocked ? 'border-red-200 opacity-60' : 'border-blue-100'}`}>
          <CardHeader className={`border-b ${isBlocked ? 'bg-gradient-to-r from-red-50 to-white' : 'bg-gradient-to-r from-blue-50 to-white'}`}>
            <CardTitle className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBlocked ? 'bg-red-600' : 'bg-blue-600'}`}>
                {isBlocked ? <Ban className="w-5 h-5 text-white" /> : <QrIcon className="w-5 h-5 text-white" />}
              </div>
              {currentUser?.role === 'admin' ? 'Generate QR Absensi' : 'Info Absensi'}
            </CardTitle>
            <CardDescription>
              {isBlocked 
                ? 'Akun diblokir - Tidak dapat melakukan absensi' 
                : currentUser?.role === 'admin'
                ? 'Buat QR Code untuk absensi kegiatan'
                : 'Scan QR Code dari admin untuk melakukan absensi'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Petunjuk */}
            <div className={`p-5 rounded-xl border-2 ${isBlocked ? 'bg-gradient-to-br from-red-50 to-pink-50 border-red-100' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isBlocked ? 'bg-red-600' : 'bg-blue-600'}`}>
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <h3 className={`font-semibold ${isBlocked ? 'text-red-900' : 'text-blue-900'}`}>
                  {isBlocked ? 'Status Blokir' : currentUser?.role === 'admin' ? 'Petunjuk Generate QR' : 'Petunjuk Absensi'}
                </h3>
              </div>
              {isBlocked ? (
                <div className="text-sm text-red-800 space-y-2">
                  <p>Akun Anda sedang diblokir dan tidak dapat membuat QR absensi.</p>
                  <p className="font-semibold">Silakan hubungi administrator untuk informasi lebih lanjut.</p>
                </div>
              ) : currentUser?.role === 'admin' ? (
                <ol className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>Pilih jenis kegiatan dari dropdown</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>Masukkan nama kegiatan (contoh: "Apel Pagi Senin 10 Desember")</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>Klik "Generate QR Code" untuk membuat QR absensi</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">4.</span>
                    <span>Bagikan link QR kepada peserta untuk melakukan absensi</span>
                  </li>
                </ol>
              ) : (
                <ol className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>Tunggu admin membagikan QR Code atau Link Absensi</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>Scan QR Code atau buka link yang diberikan</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>Lakukan tanda tangan digital pada halaman absensi</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">4.</span>
                    <span>Klik tombol "Kirim Absensi" untuk menyelesaikan</span>
                  </li>
                </ol>
              )}
            </div>

            {/* Info Kategori User */}
            {currentUser && (
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border-l-4 border-blue-600">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-white">
                    {currentUser.role === 'admin' ? 'Administrator' : currentUser.kategori}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {currentUser.role === 'admin' ? 'Akses Penuh' : 'Status Kepegawaian'}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {currentUser.role === 'admin' 
                        ? 'ℹ️ Anda dapat membuat QR absensi untuk kegiatan' 
                        : 'ℹ️ Silakan scan QR dari admin untuk absensi'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Form Input - Hanya Untuk Admin */}
            {currentUser && currentUser.role === 'admin' && !isBlocked && (
              <>
                {generatedQRId ? (
                  <div className="space-y-4">
                     <Alert className="border-2 border-green-300 bg-green-50">
                      <AlertDescription className="text-green-800">
                        <div className="flex flex-col gap-2">
                          <p className="font-bold text-lg">✅ Sesi Absensi Aktif</p>
                          <p>Anda sedang membuka sesi absensi untuk:</p>
                          <div className="bg-white p-3 rounded-lg border border-green-200">
                             <p className="font-semibold">{namaKegiatan}</p>
                             <Badge className="mt-1 bg-green-600">
                               {jenisKegiatan.find(k => k.value === selectedKegiatan)?.label}
                             </Badge>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => setShowQRDialog(true)}
                        className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        <QrIcon className="w-5 h-5 mr-2" />
                        Tampilkan QR
                      </Button>
                      <Button
                        onClick={handleClosePresence}
                        className="h-12 bg-red-600 hover:bg-red-700 text-white font-semibold"
                      >
                        Tutup Presensi
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                  {/* Pilih Kegiatan */}
                  <div className="space-y-2">
                    <Label htmlFor="kegiatan" className="text-base font-semibold">
                      Jenis Kegiatan *
                    </Label>
                    <Select 
                      onValueChange={setSelectedKegiatan} 
                      value={selectedKegiatan}
                    >
                      <SelectTrigger className="h-12 border-2 hover:border-blue-400 transition-colors">
                        <SelectValue placeholder="Pilih jenis kegiatan" />
                      </SelectTrigger>
                      <SelectContent>
                        {jenisKegiatan.map((kegiatan) => (
                          <SelectItem key={kegiatan.value} value={kegiatan.value}>
                            <span className="flex items-center gap-2 text-base">
                              <span className="text-xl">{kegiatan.icon}</span>
                              {kegiatan.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Nama Kegiatan */}
                  <div className="space-y-2">
                    <Label htmlFor="namaKegiatan" className="text-base font-semibold">
                      Nama Kegiatan *
                    </Label>
                    <Input
                      id="namaKegiatan"
                      placeholder="Contoh: Apel Pagi Senin 10 Desember 2024"
                      value={namaKegiatan}
                      onChange={(e) => setNamaKegiatan(e.target.value)}
                      className="h-12 border-2 hover:border-blue-400 transition-colors"
                    />
                    <p className="text-xs text-gray-500">
                      Masukkan nama kegiatan yang spesifik dan mudah dikenali
                    </p>
                  </div>

                  {/* Generate QR Button */}
                  <Button
                    onClick={handleGenerateQR}
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                    disabled={!selectedKegiatan || !namaKegiatan.trim()}
                  >
                    <QrIcon className="w-5 h-5 mr-2" />
                    Generate QR Code untuk Absensi
                  </Button>
                  </>
                )}
              </>
            )}

            {/* Message */}
            {message.text && (
              <Alert className={`${message.type === 'error' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'} border-2`}>
                <AlertDescription className={`${message.type === 'error' ? 'text-red-700' : 'text-green-700'} font-medium`}>
                  {message.type === 'success' ? '✅ ' : '❌ '}
                  {message.text}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Riwayat Absensi Anda */}
        <Card className="border-2 border-green-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-white border-b">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              Riwayat Absensi Anda
            </CardTitle>
            <CardDescription>
              Daftar kegiatan yang sudah Anda ikuti hari ini
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {userTodayAbsensi.length > 0 ? (
              <div className="space-y-3">
                {userTodayAbsensi.map((absensi) => (
                  <div 
                    key={absensi.id} 
                    className="group relative overflow-hidden p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all hover:shadow-md"
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-400/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform" />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                          <span className="text-xl">
                            {jenisKegiatan.find(k => k.value === absensi.jenisKegiatan)?.icon || '✓'}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-green-900">
                            {jenisKegiatan.find(k => k.value === absensi.jenisKegiatan)?.label}
                          </p>
                          <p className="text-sm text-green-700 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {absensi.waktu}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-600 text-white hover:bg-green-700">
                        ✓ Hadir
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-gray-600 font-medium mb-2">Belum ada absensi hari ini</p>
                <p className="text-sm text-gray-400">
                  {isBlocked ? 'Akun diblokir - Tidak dapat melakukan absensi' : 'Scan QR Code untuk melakukan absensi'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Code Dialog */}
      {showQRDialog && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-xl">
          <CardHeader className="border-b bg-white/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                    <QrIcon className="w-5 h-5 text-white" />
                  </div>
                  QR Code Absensi
                </CardTitle>
                <CardDescription>
                  Bagikan QR Code ini untuk absensi
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleClosePresence}
                  variant="destructive"
                  size="sm"
                  className="hover:bg-red-700"
                >
                  Tutup Presensi
                </Button>
                <Button
                  onClick={() => setShowQRDialog(false)}
                  variant="ghost"
                  size="sm"
                  className="hover:bg-purple-100"
                >
                  Sembunyikan ✕
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* QR Code Display */}
              <div className="bg-white p-6 rounded-xl border-2 border-purple-200 shadow-md">
                <div className="bg-white p-4 rounded-xl mb-4 flex justify-center">
                  <div className="bg-white p-2 rounded-lg shadow-inner">
                    <QRCode
                      value={getQRUrl()}
                      size={200}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox={`0 0 256 256`}
                    />
                  </div>
                </div>
                <div className="text-center mb-4">
                  <Badge className="bg-purple-600 text-white">
                    {jenisKegiatan.find(k => k.value === selectedKegiatan)?.label}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg border-2 border-gray-200">
                    <p className="text-xs text-gray-600 font-medium mb-2">📎 Link Absensi:</p>
                    <p className="text-xs font-mono break-all text-blue-600 bg-white p-2 rounded border">
                      {getQRUrl()}
                    </p>
                  </div>

                  <Button
                    onClick={handleCopyQRLink}
                    variant="outline"
                    className="w-full border-2 hover:bg-purple-50 hover:border-purple-400"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Salin Link
                  </Button>
                </div>
              </div>

              {/* Instruksi */}
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-xl border-2 border-amber-200 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">📋</span>
                    <h4 className="font-semibold text-amber-900">Cara Menggunakan</h4>
                  </div>
                  <ol className="text-sm text-amber-800 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">1.</span>
                      <span>Salin dan bagikan link QR Code</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">2.</span>
                      <span>Peserta membuka link di browser</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">3.</span>
                      <span>Pilih login Syntak atau Tamu</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">4.</span>
                      <span>Buat tanda tangan digital</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">5.</span>
                      <span>Data masuk ke sistem otomatis</span>
                    </li>
                  </ol>
                </div>

                <div className="bg-white p-5 rounded-xl border-2 border-green-200 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">✅</span>
                    <h4 className="font-semibold text-green-900">Keuntungan</h4>
                  </div>
                  <ul className="text-sm text-green-800 space-y-2">
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>User Syntak bisa login</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Tamu tidak perlu registrasi</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Proses cepat dan mudah</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Data tersimpan otomatis</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// CATATAN PENTING:
// Pastikan semua function helper ada di atas return:
// - getBlockReasonLabel()
// - formatBlockedUntil()
// - getQRUrl()
// - handleCopyQRLink()
// - handleGenerateQR()
//   return (
//     <div className="space-y-6">
//       {/* Header with Gradient */}
//       <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl">
//         <div className="flex items-start gap-4">
//           <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
//             <CheckCircle className="w-8 h-8 text-white" />
//           </div>
//           <div className="flex-1">
//             <div className="flex items-center gap-3 mb-3">
//               {isBlocked ? (
//                 <Badge className="bg-red-500/90 text-white border-0 hover:bg-red-500">
//                   <Ban className="w-3 h-3 mr-2" />
//                   Akun Diblokir
//                 </Badge>
//               ) : (
//                 <Badge className="bg-green-500/90 text-white border-0 hover:bg-green-500">
//                   <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
//                   Sistem Aktif
//                 </Badge>
//               )}
//             </div>
//             <h1 className="text-4xl font-bold mb-2">Absensi Digital</h1>
//             <p className="text-blue-100 text-lg">
//               {isBlocked 
//                 ? 'Akun Anda sedang diblokir oleh administrator'
//                 : 'Lakukan absensi dengan tanda tangan digital yang aman dan tervalidasi'
//               }
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Block Warning Alert */}
//       {isBlocked && (
//         <Alert className="border-2 border-red-300 bg-red-50 shadow-lg">
//           <AlertCircle className="h-5 w-5 text-red-600" />
//           <AlertDescription className="text-red-800 ml-2">
//             <div className="space-y-2">
//               <p className="font-bold text-lg">⚠️ Akun Anda Diblokir</p>
//               <div className="space-y-1 text-sm">
//                 <p><strong>Alasan:</strong> {getBlockReasonLabel(blockInfo.reason)}</p>
//                 {blockInfo.note && (
//                   <p><strong>Catatan:</strong> {blockInfo.note}</p>
//                 )}
//                 {blockInfo.blockedUntil && (
//                   <p><strong>Blokir sampai:</strong> {formatBlockedUntil(blockInfo.blockedUntil)}</p>
//                 )}
//                 <p className="mt-3 text-red-700">
//                   Anda tidak dapat melakukan absensi sampai blokir dibuka oleh administrator atau waktu blokir berakhir.
//                 </p>
//               </div>
//             </div>
//           </AlertDescription>
//         </Alert>
//       )}

//       {/* Enhanced Stats Cards with Gradient */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//         {/* Card 1: Total Hari Ini */}
//         <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
//           <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full -mr-16 -mt-16" />
//           <CardContent className="p-6 relative">
//             <div className="flex items-center justify-between mb-4">
//               <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
//                 <Users className="w-6 h-6 text-blue-600" />
//               </div>
//               <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
//                 <TrendingUp className="w-3 h-3 mr-1" />
//                 Live
//               </Badge>
//             </div>
//             <h3 className="text-4xl font-bold text-gray-900 mb-1">{todayAbsensi.length}</h3>
//             <p className="text-sm text-gray-600">Orang telah absen hari ini</p>
//             <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
//               <div 
//                 className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500" 
//                 style={{width: `${Math.min((todayAbsensi.length / 50) * 100, 100)}%`}}
//               />
//             </div>
//           </CardContent>
//         </Card>

//         {/* Card 2: Absensi Anda */}
//         <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
//           <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-transparent rounded-full -mr-16 -mt-16" />
//           <CardContent className="p-6 relative">
//             <div className="flex items-center justify-between mb-4">
//               <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
//                 <CheckCircle className="w-6 h-6 text-green-600" />
//               </div>
//               {userTodayAbsensi.length > 0 && !isBlocked && (
//                 <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
//                   <Award className="w-3 h-3 mr-1" />
//                   Aktif
//                 </Badge>
//               )}
//               {isBlocked && (
//                 <Badge className="bg-red-100 text-red-700 hover:bg-red-200">
//                   <Ban className="w-3 h-3 mr-1" />
//                   Blokir
//                 </Badge>
//               )}
//             </div>
//             <h3 className="text-4xl font-bold text-gray-900 mb-1">{userTodayAbsensi.length}</h3>
//             <p className="text-sm text-gray-600">Kegiatan yang Anda ikuti</p>
//             {userTodayAbsensi.length > 0 && !isBlocked ? (
//               <div className="mt-4 flex items-center gap-2 text-green-600">
//                 <Zap className="w-4 h-4" />
//                 <span className="text-xs font-medium">Tetap semangat! 🔥</span>
//               </div>
//             ) : isBlocked ? (
//               <div className="mt-4 text-xs text-red-600 font-medium">
//                 ⚠️ Akun diblokir
//               </div>
//             ) : (
//               <div className="mt-4 text-xs text-gray-400">
//                 Belum ada absensi hari ini
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         {/* Card 3: Waktu Real-time */}
//         <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-600 to-orange-700 text-white hover:shadow-xl transition-all duration-300 hover:scale-105">
//           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-10" />
//           <CardContent className="p-6 relative">
//             <div className="flex items-center justify-between mb-4">
//               <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
//                 <Clock className="w-6 h-6 text-white" />
//               </div>
//               <Badge className="bg-white/20 text-white border-0">
//                 WIB
//               </Badge>
//             </div>
//             <h3 className="text-4xl font-bold mb-1">
//               {new Date().toLocaleTimeString('id-ID', { 
//                 hour: '2-digit', 
//                 minute: '2-digit' 
//               })}
//             </h3>
//             <p className="text-sm text-orange-100">
//               {new Date().toLocaleDateString('id-ID', { 
//                 weekday: 'long'
//               })}
//             </p>
//             <div className="mt-4 flex items-center gap-2">
//               <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
//               <span className="text-xs text-orange-100">Sistem Aktif</span>
//             </div>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Main Content Grid - 2 columns */}
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         {/* Column 1: Form Absensi */}
//         <Card className={`border-2 shadow-lg ${isBlocked ? 'border-red-200 opacity-60' : 'border-blue-100'}`}>
//           <CardHeader className={`border-b ${isBlocked ? 'bg-gradient-to-r from-red-50 to-white' : 'bg-gradient-to-r from-blue-50 to-white'}`}>
//             <CardTitle className="flex items-center gap-2">
//               <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBlocked ? 'bg-red-600' : 'bg-blue-600'}`}>
//                 {isBlocked ? <Ban className="w-5 h-5 text-white" /> : <CheckCircle className="w-5 h-5 text-white" />}
//               </div>
//               Form Absensi Digital
//             </CardTitle>
//             <CardDescription>
//               {isBlocked ? 'Akun diblokir - Tidak dapat melakukan absensi' : 'Pilih kegiatan dan buat tanda tangan untuk absen'}
//             </CardDescription>
//           </CardHeader>
//           <CardContent className="space-y-6 pt-6">
//             {/* Petunjuk - Update text */}
//             <div className={`p-5 rounded-xl border-2 ${isBlocked ? 'bg-gradient-to-br from-red-50 to-pink-50 border-red-100' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'}`}>
//               <div className="flex items-center gap-2 mb-3">
//                 <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isBlocked ? 'bg-red-600' : 'bg-blue-600'}`}>
//                   <span className="text-white text-xs font-bold">!</span>
//                 </div>
//                 <h3 className={`font-semibold ${isBlocked ? 'text-red-900' : 'text-blue-900'}`}>
//                   {isBlocked ? 'Status Blokir' : 'Petunjuk Generate QR'}
//                 </h3>
//               </div>
//               {isBlocked ? (
//                 <div className="text-sm text-red-800 space-y-2">
//                   <p>Akun Anda sedang diblokir dan tidak dapat membuat QR absensi.</p>
//                   <p className="font-semibold">Silakan hubungi administrator untuk informasi lebih lanjut.</p>
//                 </div>
//               ) : currentUser?.role !== 'admin' ? (
//                 <div className="text-sm text-amber-800 space-y-2">
//                   <p className="font-semibold">⚠️ Hanya Admin yang dapat membuat QR Code</p>
//                   <p>Untuk melakukan absensi, silakan scan QR Code yang dibuat oleh admin.</p>
//                 </div>
//               ) : (
//                 <ol className="text-sm text-blue-800 space-y-2">
//                   <li className="flex items-start gap-2">
//                     <span className="font-bold">1.</span>
//                     <span>Pilih jenis kegiatan dari dropdown</span>
//                   </li>
//                   <li className="flex items-start gap-2">
//                     <span className="font-bold">2.</span>
//                     <span>Masukkan nama kegiatan (contoh: "Apel Pagi Senin 10 Desember")</span>
//                   </li>
//                   <li className="flex items-start gap-2">
//                     <span className="font-bold">3.</span>
//                     <span>Klik "Generate QR Code" untuk membuat QR absensi</span>
//                   </li>
//                   <li className="flex items-start gap-2">
//                     <span className="font-bold">4.</span>
//                     <span>Bagikan link QR kepada peserta untuk melakukan absensi</span>
//                   </li>
//                 </ol>
//               )}
//             </div>

//             {/* Info Kategori User */}
//             {currentUser && (
//               <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border-l-4 border-blue-600">
//                 <div className="flex items-center gap-3">
//                   <Badge variant="outline" className="bg-white">
//                     {currentUser.role === 'admin' ? 'Administrator' : currentUser.kategori}
//                   </Badge>
//                   <div>
//                     <p className="text-sm font-medium text-gray-700">
//                       {currentUser.role === 'admin' ? 'Akses Penuh' : 'Status Kepegawaian'}
//                     </p>
//                     {currentUser.role !== 'admin' && (
//                       <p className="text-xs text-amber-600 mt-1">
//                         ℹ️ Absensi dilakukan melalui QR yang dibuat admin
//                       </p>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Form Input - Hanya untuk Admin */}
//             {currentUser?.role === 'admin' && !isBlocked && (
//               <>
//                 {/* Pilih Kegiatan */}
//                 <div className="space-y-2">
//                   <Label htmlFor="kegiatan" className="text-base font-semibold">
//                     Jenis Kegiatan *
//                   </Label>
//                   <Select 
//                     onValueChange={setSelectedKegiatan} 
//                     value={selectedKegiatan}
//                   >
//                     <SelectTrigger className="h-12 border-2 hover:border-blue-400 transition-colors">
//                       <SelectValue placeholder="Pilih jenis kegiatan" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {jenisKegiatan.map((kegiatan) => (
//                         <SelectItem key={kegiatan.value} value={kegiatan.value}>
//                           <span className="flex items-center gap-2 text-base">
//                             <span className="text-xl">{kegiatan.icon}</span>
//                             {kegiatan.label}
//                           </span>
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 {/* Nama Kegiatan - INPUT BARU */}
//                 <div className="space-y-2">
//                   <Label htmlFor="namaKegiatan" className="text-base font-semibold">
//                     Nama Kegiatan *
//                   </Label>
//                   <Input
//                     id="namaKegiatan"
//                     placeholder="Contoh: Apel Pagi Senin 10 Desember 2024"
//                     value={namaKegiatan}
//                     onChange={(e) => setNamaKegiatan(e.target.value)}
//                     className="h-12 border-2 hover:border-blue-400 transition-colors"
//                   />
//                   <p className="text-xs text-gray-500">
//                     Masukkan nama kegiatan yang spesifik dan mudah dikenali
//                   </p>
//                 </div>

//                 {/* Generate QR Button */}
//                 <Button
//                   onClick={handleGenerateQR}
//                   className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
//                   disabled={!selectedKegiatan || !namaKegiatan.trim()}
//                 >
//                   <QrCode className="w-5 h-5 mr-2" />
//                   Generate QR Code untuk Absensi
//                 </Button>
//               </>
//             )}

//             {/* Message */}
//             {message.text && (
//               <Alert className={`${message.type === 'error' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'} border-2`}>
//                 <AlertDescription className={`${message.type === 'error' ? 'text-red-700' : 'text-green-700'} font-medium`}>
//                   {message.type === 'success' ? '✅ ' : '❌ '}
//                   {message.text}
//                 </AlertDescription>
//               </Alert>
//             )}
//           </CardContent>

//         {/* Column 2: Riwayat Absensi Akun */}
//         <Card className="border-2 border-green-100 shadow-lg">
//           <CardHeader className="bg-gradient-to-r from-green-50 to-white border-b">
//             <CardTitle className="flex items-center gap-2">
//               <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
//                 <Calendar className="w-5 h-5 text-white" />
//               </div>
//               Riwayat Absensi Anda
//             </CardTitle>
//             <CardDescription>
//               Daftar kegiatan yang sudah Anda ikuti hari ini
//             </CardDescription>
//           </CardHeader>
//           <CardContent className="pt-6">
//             {userTodayAbsensi.length > 0 ? (
//               <div className="space-y-3">
//                 {userTodayAbsensi.map((absensi, index) => (
//                   <div 
//                     key={absensi.id} 
//                     className="group relative overflow-hidden p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all hover:shadow-md"
//                   >
//                     <div className="absolute top-0 right-0 w-20 h-20 bg-green-400/10 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform" />
//                     <div className="relative flex items-center justify-between">
//                       <div className="flex items-center gap-3">
//                         <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
//                           <span className="text-xl">
//                             {jenisKegiatan.find(k => k.value === absensi.jenisKegiatan)?.icon || '✓'}
//                           </span>
//                         </div>
//                         <div>
//                           <p className="font-semibold text-green-900">
//                             {jenisKegiatan.find(k => k.value === absensi.jenisKegiatan)?.label}
//                           </p>
//                           <p className="text-sm text-green-700 flex items-center gap-1">
//                             <Clock className="w-3 h-3" />
//                             {absensi.waktu}
//                           </p>
//                         </div>
//                       </div>
//                       <Badge className="bg-green-600 text-white hover:bg-green-700">
//                         ✓ Hadir
//                       </Badge>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <div className="text-center py-12">
//                 <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
//                   <Calendar className="w-10 h-10 text-gray-300" />
//                 </div>
//                 <p className="text-gray-600 font-medium mb-2">Belum ada absensi hari ini</p>
//                 <p className="text-sm text-gray-400">
//                   {isBlocked ? 'Akun diblokir - Tidak dapat melakukan absensi' : 'Lakukan absensi untuk kegiatan pertama Anda'}
//                 </p>
//               </div>
//             )}
//           </CardContent>
//         </Card>
//       </div>

//       {/* QR Code Dialog */}
//       {showQRDialog && (
//         <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-xl">
//           <CardHeader className="border-b bg-white/50">
//             <div className="flex items-center justify-between">
//               <div>
//                 <CardTitle className="flex items-center gap-2">
//                   <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
//                     <QrCode className="w-5 h-5 text-white" />
//                   </div>
//                   QR Code Absensi Tamu
//                 </CardTitle>
//                 <CardDescription>
//                   Bagikan QR Code ini untuk absensi tamu
//                 </CardDescription>
//               </div>
//               <Button
//                 onClick={() => {
//                   setShowQRDialog(false);
//                   setGeneratedQRId('');
//                 }}
//                 variant="ghost"
//                 size="sm"
//                 className="hover:bg-purple-100"
//               >
//                 Tutup ✕
//               </Button>
//             </div>
//           </CardHeader>
//           <CardContent className="pt-6">
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               {/* QR Code Display */}
//               <div className="bg-white p-6 rounded-xl border-2 border-purple-200 shadow-md">
//                 <div className="bg-gradient-to-br from-purple-100 to-indigo-100 p-8 rounded-xl mb-4 text-center">
//                   <QrCode className="w-32 h-32 mx-auto text-purple-600 mb-4" />
//                   <Badge className="bg-purple-600 text-white">
//                     {jenisKegiatan.find(k => k.value === selectedKegiatan)?.label}
//                   </Badge>
//                 </div>
                
//                 <div className="space-y-3">
//                   <div className="bg-gray-50 p-3 rounded-lg border-2 border-gray-200">
//                     <p className="text-xs text-gray-600 font-medium mb-2">📎 Link Absensi:</p>
//                     <p className="text-xs font-mono break-all text-blue-600 bg-white p-2 rounded border">
//                       {getQRUrl()}
//                     </p>
//                   </div>

//                   <Button
//                     onClick={handleCopyQRLink}
//                     variant="outline"
//                     className="w-full border-2 hover:bg-purple-50 hover:border-purple-400"
//                   >
//                     <Share2 className="w-4 h-4 mr-2" />
//                     Salin Link
//                   </Button>
//                 </div>
//               </div>

//               {/* Instruksi absensi */}
//               <div className="space-y-4">
//                 <div className="bg-white p-5 rounded-xl border-2 border-amber-200 shadow-md">
//                   <div className="flex items-center gap-2 mb-3">
//                     <span className="text-2xl">📋</span>
//                     <h4 className="font-semibold text-amber-900">Cara Menggunakan</h4>
//                   </div>
//                   <ol className="text-sm text-amber-800 space-y-2">
//                     <li className="flex items-start gap-2">
//                       <span className="font-bold text-amber-600">1.</span>
//                       <span>Salin dan bagikan link QR Code kepada tamu</span>
//                     </li>
//                     <li className="flex items-start gap-2">
//                       <span className="font-bold text-amber-600">2.</span>
//                       <span>Tamu membuka link tersebut di browser</span>
//                     </li>
//                     <li className="flex items-start gap-2">
//                       <span className="font-bold text-amber-600">3.</span>
//                       <span>Tamu mengisi nama dan instansi</span>
//                     </li>
//                     <li className="flex items-start gap-2">
//                       <span className="font-bold text-amber-600">4.</span>
//                       <span>Tamu membuat tanda tangan digital</span>
//                     </li>
//                     <li className="flex items-start gap-2">
//                       <span className="font-bold text-amber-600">5.</span>
//                       <span>Data absensi langsung masuk ke sistem</span>
//                     </li>
//                   </ol>
//                 </div>

//                 <div className="bg-white p-5 rounded-xl border-2 border-green-200 shadow-md">
//                   <div className="flex items-center gap-2 mb-3">
//                     <span className="text-2xl">✅</span>
//                     <h4 className="font-semibold text-green-900">Keuntungan</h4>
//                   </div>
//                   <ul className="text-sm text-green-800 space-y-2">
//                     <li className="flex items-start gap-2">
//                       <span>•</span>
//                       <span>Tamu tidak perlu registrasi/login</span>
//                     </li>
//                     <li className="flex items-start gap-2">
//                       <span>•</span>
//                       <span>Proses absensi cepat dan mudah</span>
//                     </li>
//                     <li className="flex items-start gap-2">
//                       <span>•</span>
//                       <span>Data tersimpan otomatis</span>
//                     </li>
//                     <li className="flex items-start gap-2">
//                       <span>•</span>
//                       <span>QR Code tetap aktif sampai dihapus</span>
//                     </li>
//                   </ul>
//                 </div>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       )}

//       {/* Daftar Absensi Hari Ini */}
//       <Card className="border-2 border-gray-200 shadow-lg">
//         <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
//           <div className="flex items-center justify-between">
//             <div>
//               <CardTitle className="flex items-center gap-2">
//                 <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
//                   <Users className="w-5 h-5 text-white" />
//                 </div>
//                 Daftar Absensi Hari Ini
//               </CardTitle>
//               <CardDescription>
//                 Semua absensi yang masuk hari ini (termasuk tamu)
//               </CardDescription>
//             </div>
//             <Badge variant="outline" className="text-lg px-4 py-2">
//               {todayAbsensi.length} orang
//             </Badge>
//           </div>
//         </CardHeader>
//         <CardContent className="pt-6">
//           {todayAbsensi.length > 0 ? (
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//               {todayAbsensi.map((absensi) => (
//                 <div 
//                   key={absensi.id} 
//                   className="group p-4 border-2 rounded-xl bg-gradient-to-br from-white to-gray-50 hover:border-blue-400 hover:shadow-md transition-all"
//                 >
//                   <div className="flex items-center justify-between mb-3">
//                     <h3 className="font-semibold text-gray-900 truncate">{absensi.namaUser}</h3>
//                     <Badge variant="outline" className="text-lg">
//                       {jenisKegiatan.find(k => k.value === absensi.jenisKegiatan)?.icon || '📋'}
//                     </Badge>
//                   </div>
//                   <p className="text-sm text-gray-700 font-medium mb-2">
//                     {jenisKegiatan.find(k => k.value === absensi.jenisKegiatan)?.label || absensi.jenisKegiatan}
//                   </p>
//                   {absensi.isGuest && absensi.instansi && (
//                     <p className="text-xs text-blue-600 mb-2 flex items-center gap-1">
//                       <span>🏢</span>
//                       <span className="font-medium">{absensi.instansi}</span>
//                     </p>
//                   )}
//                   <div className="flex items-center justify-between">
//                     <p className="text-xs text-gray-500 flex items-center gap-1">
//                       <Clock className="w-3 h-3" />
//                       {absensi.waktu}
//                     </p>
//                     {absensi.isGuest && (
//                       <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
//                         Tamu
//                       </Badge>
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           ) : (
//             <div className="text-center py-12">
//               <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
//                 <Users className="w-10 h-10 text-gray-300" />
//               </div>
//               <p className="text-gray-600 font-medium">Belum ada absensi masuk hari ini</p>
//               <p className="text-sm text-gray-400 mt-2">Data absensi akan muncul di sini secara real-time</p>
//             </div>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// }