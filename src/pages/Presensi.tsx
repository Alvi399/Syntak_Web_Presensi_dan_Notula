import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Clock, Users, Calendar, QrCode as QrIcon, Share2, TrendingUp, Zap, Award, Ban, AlertCircle, Filter, Camera, Bell, X, Plus } from 'lucide-react';
import QRCode from 'react-qr-code';
import { authService } from '@/lib/authService';
import { dataService, type JadwalRapat } from '@/lib/dataService';

export default function Presensi() {
  const [selectedKegiatan, setSelectedKegiatan] = useState('');
  const [namaKegiatan, setNamaKegiatan] = useState('');
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
  const [userAbsensiHistory, setUserAbsensiHistory] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Jadwal & Notifikasi states
  const [activeJadwal, setActiveJadwal] = useState<JadwalRapat[]>([]);
  
  // Kamera Scan states
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState('');
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  // Jadwal Form states
  const [isJadwalDialogOpen, setIsJadwalDialogOpen] = useState(false);
  const [jadwalForm, setJadwalForm] = useState({
    judul: '',
    jenisKegiatan: 'rapat',
    deskripsi: '',
    tanggal: '',
    jamMulai: '',
    jamSelesai: '',
    tim: [] as string[],
    peserta: [] as string[],
    pesertaMode: 'akun' as 'publik' | 'akun',
    pesertaSpesifik: [] as string[],
    repeatType: 'none' as 'none' | 'daily' | 'weekly' | 'custom',
    repeatDays: [] as number[],
    repeatUntil: '',
    allowStack: false,
    openOffsetMinutes: 0,
    closeOffsetMinutes: 0,
    latenessThresholdMinutes: 60
  });

  const [magangUsers, setMagangUsers] = useState<any[]>([]);
  const [pegawaiUsers, setPegawaiUsers] = useState<any[]>([]);

  const timOptions = ['Distribusi', 'ZI', 'PSS', 'POTIK', 'Produksi', 'Sosial', 'TU', 'Neraca'];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  
  const currentUser = authService.getCurrentUser();

  const jenisKegiatan = currentUser 
    ? authService.getAvailableActivities(currentUser.kategori)
    : [];

  useEffect(() => {
    loadTodayData();
    loadHistoryData();
    loadActiveJadwal();
    if (currentUser) {
      checkUserBlockStatus();
      if (currentUser.role === 'admin') {
        checkActiveQR();
      }
    }
  }, [currentUser]);

  useEffect(() => {
    loadHistoryData();
  }, [filterDate]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const loadActiveJadwal = async () => {
    try {
      const tim = currentUser?.tim;
      const kategori = currentUser?.kategori;
      const jadwal = await dataService.getActiveJadwal(tim, kategori);
      setActiveJadwal(jadwal);
    } catch (error) {
      console.error('Load active jadwal error:', error);
    }
  };

  const checkActiveQR = async () => {
    try {
      const qrList = await dataService.getQRAbsensiList();
      const activeQR = qrList.find(qr => qr.isActive && qr.createdBy === currentUser?.id);
      
      if (activeQR) {
        // Validation: If expiresAt is in the past, consider it inactive on client side
        if (activeQR.expiresAt && new Date() > new Date(activeQR.expiresAt)) {
          setGeneratedQRId('');
          return;
        }

        setGeneratedQRId(activeQR.id);
        setSelectedKegiatan(activeQR.jenisKegiatan);
        setNamaKegiatan(activeQR.namaKegiatan);
      } else {
        setGeneratedQRId('');
      }
    } catch (error) {
      console.error('Check active QR error:', error);
    }
  };

  const loadTodayData = async () => {
    const today = await dataService.getAbsensiToday();
    setTodayAbsensi(today);
  };

  const compareDates = (itemDate: string, filterDate: string): boolean => {
    if (!filterDate) return true;
    return itemDate === filterDate;
  };

  const formatDateDisplay = (dateString: string) => {
    try {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  const loadHistoryData = async () => {
    if (currentUser) {
      const userHistory = await dataService.getAbsensiList(currentUser.id);
      const filteredHistory = userHistory.filter(a => compareDates(a.tanggal, filterDate));
      setUserAbsensiHistory(filteredHistory);
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

  const resetJadwalForm = () => {
    setJadwalForm({
      judul: '', jenisKegiatan: 'rapat', deskripsi: '', tanggal: '', jamMulai: '', jamSelesai: '',
      tim: [], peserta: [], repeatType: 'none', repeatDays: [], repeatUntil: '',
      allowStack: false, openOffsetMinutes: 0, closeOffsetMinutes: 0, latenessThresholdMinutes: 60,
      pesertaMode: 'akun', pesertaSpesifik: []
    });
    setMagangUsers([]);
    setPegawaiUsers([]);
  };

  const toggleJadwalTim = (tim: string) => {
    setJadwalForm(prev => ({
      ...prev,
      tim: prev.tim.includes(tim) ? prev.tim.filter(t => t !== tim) : [...prev.tim, tim]
    }));
  };

  const toggleJadwalPeserta = async (p: string) => {
    const isNowSelected = !jadwalForm.peserta.includes(p);
    
    setJadwalForm(prev => {
      const newPeserta = isNowSelected ? [...prev.peserta, p] : prev.peserta.filter(x => x !== p);
      
      // If 'Semua' is toggled, it clears others (existing behavior usually simplifies this)
      if (p === 'Semua') {
        return { ...prev, peserta: isNowSelected ? ['Semua'] : [], pesertaSpesifik: [] };
      } else {
        const filtered = newPeserta.filter(x => x !== 'Semua');
        const finalPeserta = filtered;
        
        // Reset specific if Magang or Pegawai is removed
        let finalSpesifik = prev.pesertaSpesifik;
        if ((p === 'Magang' || p === 'Pegawai') && !isNowSelected) {
           finalSpesifik = [];
        }
        
        return { ...prev, peserta: finalPeserta, pesertaSpesifik: finalSpesifik };
      }
    });

    // If Magang or Pegawai is selected and list is empty, fetch them
    if (p === 'Magang' && isNowSelected && magangUsers.length === 0) {
      const users = await dataService.getUsersByKategori('Magang');
      setMagangUsers(users);
    }
    if (p === 'Pegawai' && isNowSelected && pegawaiUsers.length === 0) {
      const users = await dataService.getUsersByKategori('Pegawai');
      setPegawaiUsers(users);
    }
  };

  const togglePesertaSpesifikUser = (userId: string) => {
    setJadwalForm(prev => ({
      ...prev,
      pesertaSpesifik: prev.pesertaSpesifik.includes(userId)
        ? prev.pesertaSpesifik.filter(id => id !== userId)
        : [...prev.pesertaSpesifik, userId]
    }));
  };

  const toggleRepeatDay = (day: number) => {
    setJadwalForm(prev => ({
      ...prev,
      repeatDays: prev.repeatDays.includes(day) ? prev.repeatDays.filter(d => d !== day) : [...prev.repeatDays, day]
    }));
  };

  const handleSaveJadwal = async () => {
    if (!jadwalForm.judul || !jadwalForm.tanggal || !jadwalForm.jamMulai || !jadwalForm.jamSelesai || !jadwalForm.jenisKegiatan) {
      setMessage({ type: 'error', text: 'Judul, tanggal, jam, dan jenis harus diisi' });
      return;
    }
    if (jadwalForm.tim.length === 0) {
      setMessage({ type: 'error', text: 'Pilih minimal satu tim' });
      return;
    }
    if (jadwalForm.peserta.length === 0) {
      setMessage({ type: 'error', text: 'Pilih minimal satu kategori peserta' });
      return;
    }

    const result = await dataService.saveJadwalRapat(jadwalForm);
    if (result.success) {
      const today = new Date().toISOString().split('T')[0];
      const isToday = jadwalForm.tanggal === today;

      if (isToday) {
        // Langsung generate QR untuk jadwal hari ini
        // Set expiry sesuai jamSelesai kegiatan
        const expiryDate = new Date();
        const [h, m] = (jadwalForm.jamSelesai || '23:59').split(':').map(Number);
        expiryDate.setHours(h, m, 0, 0);

        // Jika jam selesai sudah lewat, extend ke akhir hari ini (23:59:59)
        if (expiryDate < new Date()) {
          expiryDate.setHours(23, 59, 59, 999);
        }

        const qrResult = await dataService.generateAbsensiQR(
          jadwalForm.jenisKegiatan,
          jadwalForm.judul,
          expiryDate.toISOString(),
          result.ids && result.ids.length > 0 ? result.ids[0] : undefined
        );

        if (qrResult.success && qrResult.id) {
          // Update jadwal dengan QR id
          if (result.ids && result.ids.length > 0) {
            await dataService.updateJadwalRapat(result.ids[0], { activeQRId: qrResult.id } as any);
          }
          setGeneratedQRId(qrResult.id);
          setSelectedKegiatan(jadwalForm.jenisKegiatan);
          setNamaKegiatan(jadwalForm.judul);
          setShowQRDialog(true);
          setMessage({ type: 'success', text: 'Jadwal disimpan & QR aktif!' });
        } else {
          setMessage({ type: 'success', text: result.message || 'Jadwal berhasil dibuat! Silakan Generate QR dari Tab QR Spontan.' });
        }
      } else {
        setMessage({ type: 'success', text: result.message || 'Jadwal berhasil dibuat!' });
      }

      resetJadwalForm();
      await loadActiveJadwal();
    } else {
      setMessage({ type: 'error', text: result.message || 'Gagal membuat jadwal' });
    }
  };


  const handleGenerateQR = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      setMessage({ type: 'error', text: 'Hanya admin yang dapat membuat QR Code presensi' });
      return;
    }

    if (!selectedKegiatan || !namaKegiatan.trim()) {
      setMessage({ type: 'error', text: 'Pilih jenis dan nama kegiatan' });
      return;
    }

    const result = await dataService.generateAbsensiQR(selectedKegiatan, namaKegiatan.trim());
    
    if (result.success && result.id) {
      setGeneratedQRId(result.id);
      setShowQRDialog(true);
      setMessage({ type: 'success', text: 'QR Code berhasil dibuat!' });
    } else {
      setMessage({ type: 'error', text: result.message || 'Gagal membuat QR Code' });
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

  // ============================================
  // KAMERA SCAN QR
  // ============================================
  const startScanner = async () => {
    setShowScanner(true);
    setScanResult('');
    
    // Dynamically import to avoid SSR issues
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Wait for DOM element
      setTimeout(async () => {
        if (!videoRef.current) return;
        
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        
        try {
          await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
              // Stop scanner after successful scan
              await stopScanner();
              setScanResult(decodedText);
              
              // Parse QR URL and navigate
              handleScanResult(decodedText);
            },
            () => {} // ignore scan failure
          );
        } catch (err) {
          console.error('Camera start error:', err);
          setMessage({ type: 'error', text: 'Gagal membuka kamera. Pastikan izin kamera diberikan.' });
          setShowScanner(false);
        }
      }, 300);
    } catch (err) {
      console.error('Import html5-qrcode error:', err);
      setMessage({ type: 'error', text: 'Gagal memuat scanner' });
      setShowScanner(false);
    }
  };
  
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  const handleScanResult = async (url: string) => {
    try {
      // Parse QR URL: {origin}/#/absensi-qr/{qrId}
      const match = url.match(/absensi-qr\/([a-f0-9-]+)/i);
      if (!match) {
        setMessage({ type: 'error', text: 'QR Code tidak valid' });
        return;
      }
      
      const qrId = match[1];
      const qrData = await dataService.getQRAbsensiData(qrId);
      
      if (!qrData || !qrData.isActive) {
        setMessage({ type: 'error', text: 'Sesi presensi tidak aktif atau sudah ditutup' });
        return;
      }

      // Navigate to QR attendance page
      window.location.hash = `#/absensi-qr/${qrId}`;
      setMessage({ type: 'success', text: `✅ QR terdeteksi: ${qrData.namaKegiatan}. Mengarahkan ke halaman presensi...` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal memproses QR Code' });
    }
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
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <h1 className="text-4xl font-bold mb-2">Presensi Digital</h1>
            <p className="text-blue-100 text-lg">
              {isBlocked ? 'Akun Anda sedang diblokir' : 'Lakukan presensi melalui QR Code'}
            </p>
          </div>
        </div>
      </div>

      {isBlocked && (
        <Alert className="border-2 border-red-300 bg-red-50 shadow-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-800 ml-2">
            <p className="font-bold">⚠️ Akun Anda Diblokir</p>
            <p><strong>Alasan:</strong> {getBlockReasonLabel(blockInfo.reason)}</p>
            {blockInfo.blockedUntil && <p><strong>Sampai:</strong> {formatBlockedUntil(blockInfo.blockedUntil)}</p>}
          </AlertDescription>
        </Alert>
      )}

      {/* Notifikasi Jadwal Aktif Hari Ini (Visibilitas Kalender) */}
      {activeJadwal.length > 0 && !isBlocked && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span>Agenda Tim Hari Ini ({activeJadwal.length})</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeJadwal.map(jadwal => {
              const isBgDisabled = jadwal.absen_state === 'disabled' || jadwal.absen_state === 'closed';
              const bgClass = isBgDisabled ? 'bg-gray-50 border-gray-300 opacity-80' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-orange-400';
              const iconClass = jadwal.absen_state === 'disabled' ? 'text-gray-400' : jadwal.absen_state === 'closed' ? 'text-red-500' : 'text-orange-600';
              
              return (
                <div 
                  key={jadwal.id}
                  className={`flex flex-col p-4 border-l-4 rounded-xl shadow-sm ${bgClass} transition-all relative overflow-hidden`}
                  title={jadwal.absen_tooltip || ''}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${isBgDisabled ? 'bg-gray-200' : 'bg-orange-100'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      {jadwal.absen_state === 'disabled' ? (
                        <Clock className={`w-5 h-5 ${iconClass}`} />
                      ) : jadwal.absen_state === 'closed' ? (
                        <CheckCircle className={`w-5 h-5 ${iconClass}`} />
                      ) : (
                        <Zap className={`w-5 h-5 ${iconClass} animate-pulse`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-gray-900 truncate pr-2">{jadwal.judul}</p>
                        <Badge 
                          variant={jadwal.absen_state === 'open' ? 'default' : 'secondary'} 
                          className={jadwal.absen_state === 'open' ? 'bg-green-500 hover:bg-green-600 text-[10px]' : 'text-[10px]'}
                        >
                          {jadwal.absen_state === 'open' ? 'Aktif' : jadwal.absen_state === 'disabled' ? 'Belum Buka' : 'Selesai'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center flex-wrap gap-2 text-xs text-gray-600 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {jadwal.jamMulai} – {jadwal.jamSelesai}
                        </span>
                        
                        <Badge variant="outline" className="text-[10px] border-gray-300">
                          {Array.isArray(jadwal.tim) ? jadwal.tim.join(', ') : jadwal.tim}
                        </Badge>
                        
                        {jadwal.lateness_status === 'late' && jadwal.absen_state === 'open' && (
                          <Badge variant="destructive" className="bg-red-500 text-[10px]">
                            Terlambat
                          </Badge>
                        )}
                      </div>
                      
                      {jadwal.absen_tooltip && jadwal.absen_state === 'disabled' && (
                        <p className="text-[11px] font-medium text-orange-600 mt-2 bg-orange-100/50 p-1.5 rounded border border-orange-200 inline-block">
                          ⏳ {jadwal.absen_tooltip}
                        </p>
                      )}
                      
                      {/* Tombol Absen Manual Jika Open (Langsung ke QR presensi) */}
                      {jadwal.absen_state === 'open' && (
                        <div className="mt-3">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full text-xs h-8 border-orange-300 text-orange-700 hover:bg-orange-100"
                            onClick={() => {
                              if (jadwal.activeQRId) {
                                window.location.href = `${window.location.origin}/#/absensi-qr/${jadwal.activeQRId}`;
                              } else {
                                setSelectedKegiatan(jadwal.jenisKegiatan || 'rapat');
                                setNamaKegiatan(jadwal.judul);
                                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                              }
                            }}
                          >
                            Isi Presensi Sekarang
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg bg-white overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                <Users className="w-6 h-6 text-blue-600 group-hover:text-white" />
              </div>
              <Badge className="bg-blue-100 text-blue-700">Terbaru</Badge>
            </div>
            <h3 className="text-4xl font-bold text-gray-900 mb-1">{todayAbsensi.length}</h3>
            <p className="text-sm text-gray-600">Total presensi hari ini</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white overflow-hidden group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-600 transition-colors">
                <CheckCircle className="w-6 h-6 text-green-600 group-hover:text-white" />
              </div>
              <Badge className="bg-green-100 text-green-700">Aktif</Badge>
            </div>
            <h3 className="text-4xl font-bold text-gray-900 mb-1">{userAbsensiHistory.length}</h3>
            <p className="text-sm text-gray-600">Presensi Anda pada {filterDate}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-600 to-orange-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">Real-time</span>
            </div>
            <h3 className="text-4xl font-bold mb-1">
              {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </h3>
            <p className="text-orange-100 text-sm">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tombol Scan QR untuk semua user */}
      {!isBlocked && (
        <Card className="border-0 shadow-lg border-t-4 border-t-emerald-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Camera className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Scan QR Code</h3>
                  <p className="text-sm text-gray-500">Buka kamera untuk scan QR presensi</p>
                </div>
              </div>
              <Button 
                onClick={startScanner}
                className="bg-emerald-600 hover:bg-emerald-700 shadow-md"
                disabled={showScanner}
              >
                <Camera className="w-4 h-4 mr-2" />
                {showScanner ? 'Scanning...' : 'Buka Kamera'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <Card className="border-0 shadow-2xl overflow-hidden">
          <CardHeader className="bg-emerald-600 text-white p-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Kamera Scan QR
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={stopScanner} className="text-white hover:bg-white/20 h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div 
              id="qr-reader" 
              ref={videoRef} 
              className="w-full rounded-xl overflow-hidden"
              style={{ minHeight: 300 }}
            />
            {scanResult && (
              <Alert className="mt-3 bg-green-50 border-green-200">
                <AlertDescription className="text-green-800">
                  ✅ QR Terdeteksi! Memproses...
                </AlertDescription>
              </Alert>
            )}
            <p className="text-center text-xs text-gray-400 mt-3">
              Arahkan kamera ke QR Code presensi
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generate QR (Admin only) */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gray-50/50 border-b">
            <CardTitle className="text-xl flex items-center gap-2">
              <QrIcon className="w-5 h-5 text-indigo-600" />
              {currentUser?.role === 'admin' ? 'Generate Presensi' : 'Status Presensi'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
             {currentUser?.role === 'admin' && !isBlocked ? (
               <div className="space-y-6">
                 {/* Sesi Presensi Aktif (Kini terpisah, muncul di atas form) */}
                 {generatedQRId && (
                   <div className="bg-green-50 p-6 rounded-2xl border-2 border-green-100 text-center animate-in fade-in zoom-in duration-300 shadow-sm">
                      <div className="flex items-center justify-center gap-2 text-green-800 font-bold mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                        <span>Sesi Presensi Sedang Aktif</span>
                      </div>
                      <p className="text-green-700 text-sm mb-4 font-medium">{namaKegiatan}</p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button onClick={() => setShowQRDialog(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 shadow-md">
                          <QrIcon className="w-4 h-4 mr-2" />
                          Lihat QR Code
                        </Button>
                        <Button onClick={handleClosePresence} variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 shadow-sm">
                          <X className="w-4 h-4 mr-2" />
                          Tutup Sesi
                        </Button>
                      </div>
                   </div>
                 )}

                 {/* Form Pembuatan Jadwal & Aktivasi Presensi */}
                 <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 mb-2 text-indigo-700 border-b border-indigo-100 pb-2">
                      <Plus className="w-4 h-4" />
                      <span className="font-bold text-xs uppercase tracking-wider">Buat Jadwal & Generate Presensi</span>
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-sm">Judul Kegiatan <span className="text-red-500">*</span></Label>
                            <Input
                              placeholder="Judul"
                              value={jadwalForm.judul}
                              onChange={e => setJadwalForm({...jadwalForm, judul: e.target.value})}
                              className="border-gray-300 h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Jenis <span className="text-red-500">*</span></Label>
                            <Select onValueChange={v => setJadwalForm({...jadwalForm, jenisKegiatan: v})} value={jadwalForm.jenisKegiatan}>
                              <SelectTrigger className="h-10 border-gray-300">
                                <SelectValue placeholder="Pilih" />
                              </SelectTrigger>
                              <SelectContent>
                                {jenisKegiatan.map(k => (
                                  <SelectItem key={k.value} value={k.value}>{k.icon} {k.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2 col-span-1">
                            <Label className="text-sm">Tanggal <span className="text-red-500">*</span></Label>
                            <Input
                              type="date"
                              value={jadwalForm.tanggal}
                              onChange={e => setJadwalForm({...jadwalForm, tanggal: e.target.value})}
                              className="border-gray-300 h-10 px-2"
                            />
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label className="text-sm">Jam (Mulai - Selesai) <span className="text-red-500">*</span></Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="time"
                                value={jadwalForm.jamMulai}
                                onChange={e => setJadwalForm({...jadwalForm, jamMulai: e.target.value})}
                                className="border-gray-300 h-10 px-2 flex-1"
                              />
                              <span className="text-gray-500">-</span>
                              <Input
                                type="time"
                                value={jadwalForm.jamSelesai}
                                onChange={e => setJadwalForm({...jadwalForm, jamSelesai: e.target.value})}
                                className="border-gray-300 h-10 px-2 flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Tim Diundang <span className="text-red-500">*</span></Label>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={jadwalForm.tim.includes('Semua') ? 'default' : 'outline'}
                              onClick={() => setJadwalForm({...jadwalForm, tim: jadwalForm.tim.includes('Semua') ? [] : ['Semua']})}
                              className={`h-7 px-2 text-xs ${jadwalForm.tim.includes('Semua') ? 'bg-indigo-600' : ''}`}
                            >
                              Semua
                            </Button>
                            {!jadwalForm.tim.includes('Semua') && timOptions.map(t => (
                              <Button
                                key={t}
                                type="button"
                                size="sm"
                                variant={jadwalForm.tim.includes(t) ? 'default' : 'outline'}
                                onClick={() => toggleJadwalTim(t)}
                                className={`h-7 px-2 text-xs ${jadwalForm.tim.includes(t) ? 'bg-indigo-600' : ''}`}
                              >
                                {t}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Peserta <span className="text-red-500">*</span></Label>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={jadwalForm.peserta.includes('Semua') ? 'default' : 'outline'}
                              onClick={() => toggleJadwalPeserta('Semua')}
                              className={`h-7 px-2 text-xs ${jadwalForm.peserta.includes('Semua') ? 'bg-indigo-600' : ''}`}
                            >
                              Semua
                            </Button>
                            {!jadwalForm.peserta.includes('Semua') && ['Pegawai', 'Magang'].map(p => (
                              <Button
                                key={p}
                                type="button"
                                size="sm"
                                variant={jadwalForm.peserta.includes(p) ? 'default' : 'outline'}
                                onClick={() => toggleJadwalPeserta(p)}
                                className={`h-7 px-2 text-xs ${jadwalForm.peserta.includes(p) ? 'bg-indigo-600' : ''}`}
                              >
                                {p}
                              </Button>
                            ))}
                          </div>

                          {/* Sub-options for 'Semua' */}
                          {jadwalForm.peserta.includes('Semua') && (
                            <div className="mt-2 p-2 bg-indigo-50/50 rounded-md border border-indigo-100 flex items-center gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="pesertaMode"
                                  checked={jadwalForm.pesertaMode === 'publik'}
                                  onChange={() => setJadwalForm(prev => ({ ...prev, pesertaMode: 'publik' }))}
                                  className="w-3 h-3 text-indigo-600"
                                />
                                <span className="text-[10px] font-medium text-indigo-900">Publik (Termasuk Tamu)</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="pesertaMode"
                                  checked={jadwalForm.pesertaMode === 'akun'}
                                  onChange={() => setJadwalForm(prev => ({ ...prev, pesertaMode: 'akun' }))}
                                  className="w-3 h-3 text-indigo-600"
                                />
                                <span className="text-[10px] font-medium text-indigo-900">Akun Syntak Saja</span>
                              </label>
                            </div>
                          )}

                          {/* Sub-options for 'Pegawai' */}
                          {jadwalForm.peserta.includes('Pegawai') && pegawaiUsers.length > 0 && (
                            <div className="mt-2 p-2 bg-blue-50/50 rounded-md border border-blue-100">
                              <div className="text-[10px] font-bold text-blue-900 mb-1 flex justify-between items-center">
                                <span>Pilih Pegawai (Opsional):</span>
                                <span className="text-[9px] font-normal text-blue-700">Kosongkan untuk mengundang SEMUA</span>
                              </div>
                              <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-x-4 gap-y-1 pr-2 custom-scrollbar">
                                {pegawaiUsers
                                  .filter(user => jadwalForm.tim.length === 0 || jadwalForm.tim.includes('Semua') || (user.tim && jadwalForm.tim.includes(user.tim)))
                                  .map(user => (
                                  <label key={user.id} className="flex items-center gap-2 cursor-pointer hover:bg-blue-100/50 p-0.5 rounded transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={jadwalForm.pesertaSpesifik.includes(user.id)}
                                      onChange={() => togglePesertaSpesifikUser(user.id)}
                                      className="w-3 h-3 text-blue-600 rounded"
                                    />
                                    <span className="text-[10px] truncate" title={user.nama}>{user.nama}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Sub-options for 'Magang' */}
                          {jadwalForm.peserta.includes('Magang') && magangUsers.length > 0 && (
                            <div className="mt-2 p-2 bg-amber-50/50 rounded-md border border-amber-100">
                              <div className="text-[10px] font-bold text-amber-900 mb-1 flex justify-between items-center">
                                <span>Pilih Mahasiswa Magang (Opsional):</span>
                                <span className="text-[9px] font-normal text-amber-700">Kosongkan untuk mengundang SEMUA</span>
                              </div>
                              <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-x-4 gap-y-1 pr-2 custom-scrollbar">
                                {magangUsers
                                  .filter(user => jadwalForm.tim.length === 0 || jadwalForm.tim.includes('Semua') || (user.tim && jadwalForm.tim.includes(user.tim)))
                                  .map(user => (
                                  <label key={user.id} className="flex items-center gap-2 cursor-pointer hover:bg-amber-100/50 p-0.5 rounded transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={jadwalForm.pesertaSpesifik.includes(user.id)}
                                      onChange={() => togglePesertaSpesifikUser(user.id)}
                                      className="w-3 h-3 text-amber-600 rounded"
                                    />
                                    <span className="text-[10px] truncate" title={user.nama}>{user.nama}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={jadwalForm.allowStack}
                                onChange={e => setJadwalForm({...jadwalForm, allowStack: e.target.checked})}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                id="stackCheckbox"
                              />
                              <label htmlFor="stackCheckbox" className="text-xs cursor-pointer font-medium text-gray-700">
                                Izinkan Bentrok (Tidak ada validasi waktu overlap)
                              </label>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-gray-500">Toleransi Buka/Tutup (Menit)</Label>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      value={jadwalForm.openOffsetMinutes}
                                      onChange={e => setJadwalForm({...jadwalForm, openOffsetMinutes: parseInt(e.target.value) || 0})}
                                      className="text-xs h-8 px-2"
                                      title="Buka menit sebelumnya"
                                    />
                                    <span className="text-[10px] text-gray-400">s/d</span>
                                    <Input
                                      type="number"
                                      value={jadwalForm.closeOffsetMinutes}
                                      onChange={e => setJadwalForm({...jadwalForm, closeOffsetMinutes: parseInt(e.target.value) || 0})}
                                      className="text-xs h-8 px-2"
                                      title="Tutup menit setelahnya"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-gray-500">Batas Terlambat (Menit)</Label>
                                  <Input
                                    type="number"
                                    value={jadwalForm.latenessThresholdMinutes}
                                    onChange={e => setJadwalForm({...jadwalForm, latenessThresholdMinutes: parseInt(e.target.value) || 0})}
                                    className="text-xs h-8 px-2"
                                    min="0"
                                  />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 items-end">
                          <div className="space-y-2">
                            <Label className="text-xs">Ulangi Kegiatan</Label>
                            <Select onValueChange={v => setJadwalForm({...jadwalForm, repeatType: v as any})} value={jadwalForm.repeatType}>
                              <SelectTrigger className="h-9 border-gray-300 text-xs text-left">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs">Sekali Saja</SelectItem>
                                <SelectItem value="daily" className="text-xs">Harian</SelectItem>
                                <SelectItem value="weekly" className="text-xs">Mingguan</SelectItem>
                                <SelectItem value="custom" className="text-xs">Kustom Hari</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {jadwalForm.repeatType !== 'none' && (
                            <div className="space-y-2">
                              <Label className="text-xs">Sampai Tanggal</Label>
                              <Input
                                type="date"
                                value={jadwalForm.repeatUntil}
                                onChange={e => setJadwalForm({...jadwalForm, repeatUntil: e.target.value})}
                                className="border-gray-300 h-9 px-2 text-xs"
                              />
                            </div>
                          )}
                        </div>

                        {jadwalForm.repeatType === 'custom' && (
                          <div className="space-y-2 mt-2">
                            <Label className="text-xs">Pilih Hari</Label>
                            <div className="flex gap-1">
                              {dayNames.map((name, idx) => (
                                <Button
                                  key={idx}
                                  type="button"
                                  size="sm"
                                  variant={jadwalForm.repeatDays.includes(idx) ? 'default' : 'outline'}
                                  onClick={() => toggleRepeatDay(idx)}
                                  className={`w-7 h-7 p-0 text-[10px] ${jadwalForm.repeatDays.includes(idx) ? 'bg-indigo-600' : ''}`}
                                >
                                  {name.charAt(0)}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        <Button onClick={handleSaveJadwal} className="w-full mt-4 bg-teal-600 hover:bg-teal-700 h-10 shadow border-0">
                          <Plus className="w-4 h-4 mr-2" />
                          Simpan Jadwal Kegiatan
                        </Button>
                    </div>
                 </div>
               </div>
             ) : (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                   <p className="text-gray-500">Scan QR Code dari admin untuk melakukan presensi.</p>
                </div>
             )}

             {message.text && (
               <Alert className={message.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
                 <AlertDescription>{message.text}</AlertDescription>
               </Alert>
             )}
          </CardContent>
        </Card>

        {/* History */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gray-50/50 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              Riwayat Presensi
            </CardTitle>
            <div className="relative">
              <Input 
                type="date" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)}
                className="h-9 w-40 text-sm border-2"
              />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {userAbsensiHistory.length > 0 ? (
              <div className="space-y-3">
                {userAbsensiHistory.map(abs => (
                  <div key={abs.id} className="p-4 bg-gray-50 rounded-xl border-l-4 border-green-500 flex justify-between items-center shadow-sm">
                    <div>
                      <p className="font-bold text-gray-900">{abs.namaKegiatan}</p>
                      <div className="flex gap-3 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {abs.waktu}</span>
                        <span className="flex items-center gap-2 uppercase">
                          <Badge variant="outline" className="text-[10px] h-4">{abs.jenisKegiatan}</Badge>
                          <span>{formatDateDisplay(abs.tanggal)}</span>
                        </span>
                      </div>
                    </div>
                    <Badge className="bg-green-600">Hadir</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Tidak ada riwayat presensi pada tanggal ini.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Dialog */}
      {showQRDialog && (
        <Card className="fixed inset-x-6 bottom-6 z-50 md:inset-x-auto md:right-6 md:w-96 shadow-2xl border-2 border-indigo-100 animate-in slide-in-from-bottom duration-300">
          <CardHeader className="bg-indigo-600 text-white p-4 rounded-t-xl">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm">QR Code Aktif</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowQRDialog(false)} className="text-white hover:bg-white/20 h-6 w-6 p-0">✕</Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 text-center space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-inner inline-block mx-auto border">
              <QRCode value={getQRUrl()} size={180} />
            </div>
            <div>
              <p className="text-xs font-mono bg-gray-50 p-2 rounded border break-all select-all">{getQRUrl()}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCopyQRLink} variant="outline" className="flex-1 text-xs">Salin Link</Button>
              <Button onClick={() => setShowQRDialog(false)} className="flex-1 text-xs bg-indigo-600">Sembunyikan</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}