import React, { useState, useEffect, useRef } from 'react';
import { useDataSync } from '@/hooks/useDataSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  BarChart3, 
  FileText, 
  Activity, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  RefreshCw,
  Shield,
  Calendar,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  Filter,
  Trash,
  Settings,
  CheckCircle2,
  Ban,
  Unlock,
  AlertCircle,
  QrCode,
  Link,
  Copy,
  ExternalLink
} from 'lucide-react';
import QRCode from 'react-qr-code';

import { authService, type User, type ActivityLog } from '@/lib/authService';
import { dataService, type AbsensiRecord, type NotulensiRecord, type JadwalRapat } from '@/lib/dataService';
import SignatureCanvas from 'react-signature-canvas';
import jsPDF from 'jspdf';

type UserRole = 'user' | 'admin' | 'tamu';
type UserKategori = 'Pegawai' | 'Magang';
type JenisKegiatan = 'senam' | 'apel' | 'rapelan' | 'doa-bersama' | 'rapat' | 'sharing-knowledge' | 'all';
type BlockReason = 'izin' | 'sakit' | 'alpa' | 'izin-telat' | '';

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [absensiData, setAbsensiData] = useState<AbsensiRecord[]>([]);
  const [notulensiData, setNotulensiData] = useState<NotulensiRecord[]>([]);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [blockingUser, setBlockingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    nama: '',
    email: '',
    password: '',
    kategori: '' as UserKategori | '',
    tim: '',
    role: '' as UserRole | ''
  });
  const [blockForm, setBlockForm] = useState({
    reason: '' as BlockReason,
    note: ''
  });
  const [exportForm, setExportForm] = useState({
    judulKegiatan: '',
    hari: '',
    tanggal: '',
    tempat: '',
    waktu: '',
    exportType: 'pdf' as 'pdf' | 'excel'
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filterDate, setFilterDate] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterKegiatan, setFilterKegiatan] = useState<JenisKegiatan>('all');
  const [filterKategori, setFilterKategori] = useState<'all' | 'Pegawai' | 'Magang'>('all');
  const [filterNamaKegiatan, setFilterNamaKegiatan] = useState('');
  const [filterTim, setFilterTim] = useState<string>('all');

  // QR Modal states
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedQR, setSelectedQR] = useState<{id: string, judul: string, jenis: string} | null>(null);


  // Jadwal Rapat states
  const [jadwalRapatData, setJadwalRapatData] = useState<JadwalRapat[]>([]);
  
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const [adminSignature, setAdminSignature] = useState<string>('');

  useEffect(() => {
    loadAdminData();
    
    // Check for expired blocks every minute
    const interval = setInterval(() => {
      checkAndUnblockExpiredUsers();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Real-time synchronization
  useDataSync(['all'], () => {
    loadAdminData();
  });

  const checkAndUnblockExpiredUsers = async () => {
    const users = await authService.getAllUsersForAdmin();
    let hasChanges = false;
    
    for (const user of users) {
      if (user.isBlocked && user.blockedUntil) {
        const now = new Date();
        const unblockTime = new Date(user.blockedUntil);
        
        if (now >= unblockTime) {
          await authService.unblockUser(user.id);
          hasChanges = true;
        }
      }
    }
    
    if (hasChanges) {
      loadAdminData();
    }
  };

  const loadAdminData = async () => {
    // Fetch semua data secara paralel — tiap call dibungkus try-catch sendiri
    // agar satu kegagalan tidak menghalangi update state yang lain
    const [usersData, activitiesData, absensiList, notulensiList, jadwalList] = await Promise.all([
      authService.getAllUsersForAdmin().catch(e => { console.error('loadAdminData: users failed', e); return []; }),
      authService.getActivities().catch(e => { console.error('loadAdminData: activities failed', e); return []; }),
      dataService.getAbsensiList().catch(e => { console.error('loadAdminData: absensi failed', e); return []; }),
      dataService.getNotulensiList().catch(e => { console.error('loadAdminData: notulensi failed', e); return []; }),
      dataService.getJadwalRapat().catch(e => { console.error('loadAdminData: jadwal failed', e); return []; })
    ]);
    
    setUsers(usersData);
    setActivities(activitiesData);
    setAbsensiData(absensiList);
    setNotulensiData(notulensiList);
    setJadwalRapatData(jadwalList);
  };

  const handleDeleteJadwal = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus jadwal ini?')) {
      // Optimistic update: hapus dari state lokal segera
      const previousData = [...jadwalRapatData];
      setJadwalRapatData(prev => prev.filter(j => j.id !== id));
      
      const success = await dataService.deleteJadwalRapat(id);
      if (success) {
        setMessage({ type: 'success', text: 'Jadwal berhasil dihapus' });
        // Re-verify with server after a short delay to ensure DB consistency
        setTimeout(() => loadAdminData(), 500);
      } else {
        setMessage({ type: 'error', text: 'Gagal menghapus jadwal' });
        // Rollback
        setJadwalRapatData(previousData);
      }
    }
  };

  const handleCopyLink = (qrId: string) => {
    const link = `${window.location.origin}/#/absensi-qr/${qrId}`;
    navigator.clipboard.writeText(link);
    setMessage({ type: 'success', text: 'Tautan presensi berhasil disalin!' });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const openQRDialog = (j: JadwalRapat) => {
    if (j.activeQRId) {
      setSelectedQR({ id: j.activeQRId, judul: j.judul, jenis: j.jenisKegiatan || 'rapat' });
      setShowQRDialog(true);
    }
  };

  const handleQuickGenerateQR = async (j: JadwalRapat) => {
    setMessage({ type: 'info', text: 'Sedang generate QR...' });
    
    // For manual generation from schedule:
    // 1. If recurring, make it permanent
    // 2. If single, set expiry to jamSelesai of that specific day
    let expiresAt: string | undefined = (j.repeatType && j.repeatType !== 'none') ? 'unlimited' : undefined;
    
    if (j.repeatType === 'none' || !j.repeatType) {
      const [endH, endM] = (j.jamSelesai || '00:00').split(':').map(Number);
      const expDate = new Date(j.tanggal);
      expDate.setHours(endH, endM, 0, 0);
      expiresAt = expDate.toISOString();
    }
    
    const result = await dataService.generateAbsensiQR(
      j.jenisKegiatan || 'rapat',
      j.judul,
      expiresAt,
      j.id
    );

    if (result.success) {
      setMessage({ type: 'success', text: 'QR Code berhasil dibuat!' });
      await loadAdminData();
      if (result.id) {
        setSelectedQR({ id: result.id, judul: j.judul, jenis: j.jenisKegiatan || 'rapat' });
        setShowQRDialog(true);
      }
    } else {
      setMessage({ type: 'error', text: result.message || 'Gagal generate QR' });
    }
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };



  const timOptions = ['Distribusi', 'ZI', 'PSS', 'POTIK', 'Produksi', 'Sosial', 'TU', 'Neraca','Humas','IPDS','Umum','UKK'];
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      let success = false;

      if (editingUser) {
        // Optimistic update: perbarui user di state lokal segera
        setUsers(prev =>
          prev.map(u =>
            u.id === editingUser.id
              ? { ...u, nama: userForm.nama, email: userForm.email, kategori: userForm.kategori as UserKategori, tim: userForm.tim, role: userForm.role as UserRole }
              : u
          )
        );
        success = await authService.updateUser(editingUser.id, {
          nama: userForm.nama,
          email: userForm.email,
          kategori: userForm.kategori as UserKategori,
          tim: userForm.tim,
          role: userForm.role as UserRole,
          ...(userForm.password && { password: userForm.password })
        });
      } else {
        // Optimistic insert: tambahkan user sementara ke list segera
        const tempUser: User = {
          id: `temp-${Date.now()}`,
          nama: userForm.nama,
          email: userForm.email,
          kategori: userForm.kategori as UserKategori,
          tim: userForm.tim,
          role: userForm.role as UserRole,
          tanggalDaftar: new Date().toISOString(),
          isBlocked: false,
        };
        setUsers(prev => [...prev, tempUser]);
        const result = await authService.register(
          userForm.nama,
          userForm.email,
          userForm.password,
          userForm.kategori as UserKategori,
          userForm.tim,
          'ADMIN' // bypass OTP
        );
        success = result.success;
      }

      if (success) {
        setMessage({
          type: 'success',
          text: editingUser ? 'User berhasil diperbarui!' : 'User berhasil ditambahkan!'
        });
        resetUserForm();
        setIsUserDialogOpen(false);
        // Refresh di background untuk replace data temp dengan data asli dari server
        loadAdminData();
      } else {
        setMessage({ type: 'error', text: 'Gagal menyimpan data user' });
        // Rollback optimistic update
        loadAdminData();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem' });
      loadAdminData();
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      nama: user.nama,
      email: user.email,
      password: '',
      kategori: user.kategori,
      tim: user.tim || '',
      role: user.role
    });
    setIsUserDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus user ini?')) {
      // Optimistic update
      const previousUsers = [...users];
      setUsers(prev => prev.filter(u => u.id !== userId));
      
      const success = await authService.deleteUser(userId);
      if (success) {
        setMessage({ type: 'success', text: 'User berhasil dihapus!' });
        setTimeout(() => loadAdminData(), 500);
      } else {
        setMessage({ type: 'error', text: 'Gagal menghapus user' });
        setUsers(previousUsers); // Rollback
      }
    }
  };

  const handleResetPassword = async (userId: string) => {
    const newPassword = prompt('Masukkan password baru:');
    if (newPassword) {
      const success = await authService.resetPassword(userId, newPassword);
      if (success) {
        setMessage({ type: 'success', text: 'Password berhasil direset!' });
      } else {
        setMessage({ type: 'error', text: 'Gagal reset password' });
      }
    }
  };

  const handleOpenBlockDialog = (user: User) => {
    setBlockingUser(user);
    setBlockForm({ reason: '', note: '' });
    setIsBlockDialogOpen(true);
  };

  const handleBlockUser = async () => {
    if (!blockingUser || !blockForm.reason) {
      setMessage({ type: 'error', text: 'Pilih alasan pemblokiran!' });
      return;
    }

    const success = await authService.blockUser(blockingUser.id, blockForm.reason, blockForm.note);
    
    if (success) {
      setMessage({ 
        type: 'success', 
        text: `User ${blockingUser.nama} berhasil diblokir dengan alasan: ${blockForm.reason}` 
      });
      setIsBlockDialogOpen(false);
      setBlockingUser(null);
      setBlockForm({ reason: '', note: '' });
      await loadAdminData();
    } else {
      setMessage({ type: 'error', text: 'Gagal memblokir user' });
    }
  };

  const handleUnblockUser = async (userId: string) => {
    if (window.confirm('Apakah Anda yakin ingin membuka blokir user ini?')) {
      const success = await authService.unblockUser(userId);
      if (success) {
        setMessage({ type: 'success', text: 'User berhasil dibuka blokirnya!' });
        await loadAdminData();
      } else {
        setMessage({ type: 'error', text: 'Gagal membuka blokir user' });
      }
    }
  };

  const handleDeleteAbsensi = async (absensiId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data absensi ini?')) {
      // Optimistic update
      const previousData = [...absensiData];
      setAbsensiData(prev => prev.filter(a => a.id !== absensiId));
      
      const success = await dataService.deleteAbsensi(absensiId);
      if (success) {
        setMessage({ type: 'success', text: 'Data absensi berhasil dihapus!' });
        setTimeout(() => loadAdminData(), 500);
      } else {
        setMessage({ type: 'error', text: 'Gagal menghapus data absensi' });
        setAbsensiData(previousData); // Rollback
      }
    }
  };

  const handleDeleteNotulensi = async (notulensiId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus notulensi ini?')) {
      // Optimistic update
      const previousData = [...notulensiData];
      setNotulensiData(prev => prev.filter(n => n.id !== notulensiId));
      
      const success = await dataService.deleteNotulensi(notulensiId);
      if (success) {
        setMessage({ type: 'success', text: 'Notulensi berhasil dihapus!' });
        setTimeout(() => loadAdminData(), 500);
      } else {
        setMessage({ type: 'error', text: 'Gagal menghapus notulensi' });
        setNotulensiData(previousData); // Rollback
      }
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus log aktivitas ini?')) {
      const success = await authService.deleteActivity(activityId);
      if (success) {
        setMessage({ type: 'success', text: 'Log aktivitas berhasil dihapus!' });
        await loadAdminData();
      } else {
        setMessage({ type: 'error', text: 'Gagal menghapus log aktivitas' });
      }
    }
  };

  const handleDeleteAllAbsensi = async () => {
    if (window.confirm('Yakin ingin menghapus SEMUA data presensi? Tindakan ini tidak dapat dibatalkan!')) {
      const success = await dataService.deleteAbsensi('all'); // Assuming deleteAbsensi('all') handles full deletion
      if (success) {
        setMessage({ type: 'success', text: 'Semua data presensi berhasil dihapus!' });
        await loadAdminData();
      } else {
        setMessage({ type: 'error', text: 'Gagal menghapus semua data absensi' });
      }
    }
  };

  const handleDeleteAllNotulensi = async () => {
    if (window.confirm('Yakin ingin menghapus SEMUA data notula? Tindakan ini tidak dapat dibatalkan!')) {
      const success = await dataService.deleteNotulensi('all'); // Assuming deleteNotulensi('all') handles full deletion
      if (success) {
        setMessage({ type: 'success', text: 'Semua data notula berhasil dihapus!' });
        await loadAdminData();
      } else {
        setMessage({ type: 'error', text: 'Gagal menghapus semua data notulensi' });
      }
    }
  };

  const handleDeleteAllActivities = async () => {
    if (window.confirm('Yakin ingin menghapus SEMUA log aktivitas? Tindakan ini tidak dapat dibatalkan!')) {
      const success = await authService.deleteAllActivities();
      if (success) {
        setMessage({ type: 'success', text: 'Semua log aktivitas berhasil dihapus!' });
        await loadAdminData();
      } else {
        setMessage({ type: 'error', text: 'Gagal menghapus semua log aktivitas' });
      }
    }
  };

  const resetUserForm = () => {
    setUserForm({ nama: '', email: '', password: '', kategori: '', tim: '', role: '' });
    setEditingUser(null);
    setMessage({ type: '', text: '' });
  };

  const resetExportForm = () => {
    setExportForm({
      judulKegiatan: '',
      hari: '',
      tanggal: '',
      tempat: '',
      waktu: '',
      exportType: 'pdf'
    });
  };

  const handleExportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!exportForm.judulKegiatan || !exportForm.hari || !exportForm.tanggal || !exportForm.tempat) {
      setMessage({ type: 'error', text: 'Semua field harus diisi!' });
      return;
    }

    const filtered = getFilteredAbsensi();
    
    if (filtered.length === 0) {
      setMessage({ type: 'error', text: 'Tidak ada data absensi untuk di-export!' });
      return;
    }

    if (exportForm.exportType === 'pdf') {
      setIsExportDialogOpen(false);
      setIsSignatureDialogOpen(true);
    } else {
      exportAbsensiToExcel(filtered);
      setIsExportDialogOpen(false);
      setMessage({ type: 'success', text: 'Data berhasil di-export!' });
      resetExportForm();
    }
  };

  const handleSignatureSubmit = () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setMessage({ type: 'error', text: 'Mohon tanda tangan terlebih dahulu!' });
      return;
    }

    const signatureData = signaturePadRef.current.toDataURL();
    setAdminSignature(signatureData);

    const filtered = getFilteredAbsensi();
    exportAbsensiToPDFWithSignature(filtered, signatureData);

    setIsSignatureDialogOpen(false);
    setMessage({ type: 'success', text: 'PDF berhasil di-export dengan tanda tangan!' });
    resetExportForm();
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const clearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const exportAbsensiToPDFWithSignature = (data: AbsensiRecord[], signature: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('BADAN PUSAT STATISTIK', pageWidth / 2, 20, { align: 'center' });
    doc.text('KOTA SURABAYA', pageWidth / 2, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Jl. Ahmad Yani, No.152 E, Surabaya, 60231', pageWidth / 2, 35, { align: 'center' });
    doc.text('Telepon: (031) 82516020', pageWidth / 2, 40, { align: 'center' });
    doc.text('Email: bps3578@bps.go.id | Website: surabayakota.bps.go.id', pageWidth / 2, 45, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(14, 48, pageWidth - 14, 48);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DAFTAR HADIR (PRESENSI)', pageWidth / 2, 56, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Judul Kegiatan', 14, 65);
    // Adjusted X to 45 so things align better horizontally
    doc.text(`: ${exportForm.judulKegiatan}`, 45, 65);
    doc.text('Hari/Tanggal', 14, 72);
    doc.text(`: ${exportForm.hari}, ${exportForm.tanggal}`, 45, 72);
    doc.text('Tempat', 14, 79);
    doc.text(`: ${exportForm.tempat}`, 45, 79);
    doc.text('Waktu', 14, 86);
    doc.text(`: ${exportForm.waktu}`, 45, 86);
    
    const startY = 95;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    // Kolom: No(10), Nama(40), Waktu Presensi(28), Tim/Bagian(32), Jabatan(38), TTD(32)
    const colWidths = [10, 40, 28, 32, 38, 32];
    const headers = ['No', 'Nama', 'Waktu Presensi', 'Tim/Bagian', 'Jabatan', 'TTD'];
    let currentX = 14;
    
    headers.forEach((header, i) => {
      doc.rect(currentX, startY, colWidths[i], 8);
      doc.text(header, currentX + colWidths[i] / 2, startY + 5.5, { align: 'center' });
      currentX += colWidths[i];
    });
    
    doc.setFont('helvetica', 'normal');
    let currentY = startY + 8;
    
    data.forEach((item, index) => {
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 20;
      }
      
      const user = users.find(u => u.id === item.userId);
      const nama = item.isGuest && item.instansi ? `${item.namaUser} (${item.instansi})` : item.namaUser;
      
      // Hitung wrapping nama dan jabatan agar muat di kolom tanpa terpotong
      const lineHeight = 5;
      const cellPad = 3;
      const namaLines = doc.splitTextToSize(nama, colWidths[1] - 4);
      
      const jabatan = item.isGuest ? '-' : ((user as any)?.jabatan || '-');
      const jabatanLines = doc.splitTextToSize(jabatan, colWidths[4] - 4);
      
      // Ambil tinggi baris maksimal antara nama dan jabatan
      const totalLines = Math.max(namaLines.length, jabatanLines.length);
      const rowHeight = Math.max(12, totalLines * lineHeight + cellPad * 2);
      
      currentX = 14;
      
      // Cell 1: No
      doc.rect(currentX, currentY, colWidths[0], rowHeight);
      doc.text(`${index + 1}`, currentX + colWidths[0] / 2, currentY + rowHeight / 2 + 1.5, { align: 'center' });
      currentX += colWidths[0];
      
      // Cell 2: Nama (multi-line wrap)
      doc.rect(currentX, currentY, colWidths[1], rowHeight);
      doc.text(namaLines, currentX + 2, currentY + cellPad + lineHeight);
      currentX += colWidths[1];

      // Cell 3: Waktu Presensi
      doc.rect(currentX, currentY, colWidths[2], rowHeight);
      const waktuPresensi = item.waktu ? item.waktu.substring(0, 5) : '-';
      doc.text(waktuPresensi, currentX + colWidths[2] / 2, currentY + rowHeight / 2 + 1.5, { align: 'center' });
      currentX += colWidths[2];

      // Cell 4: Tim/Bagian
      doc.rect(currentX, currentY, colWidths[3], rowHeight);
      const tim = item.isGuest ? '-' : (user?.tim || '-');
      const timLines = doc.splitTextToSize(tim, colWidths[3] - 4);
      doc.text(timLines, currentX + colWidths[3] / 2, currentY + cellPad + lineHeight, { align: 'center' });
      currentX += colWidths[3];
      
      // Cell 5: Jabatan
      doc.rect(currentX, currentY, colWidths[4], rowHeight);
      doc.text(jabatanLines, currentX + colWidths[4] / 2, currentY + cellPad + lineHeight, { align: 'center' });
      currentX += colWidths[4];
      
      // Cell 6: Tanda Tangan
      doc.rect(currentX, currentY, colWidths[5], rowHeight);
      if (item.signature) {
        try {
          const sigY = currentY + (rowHeight - 10) / 2;
          doc.addImage(item.signature, 'PNG', currentX + (colWidths[5] - 20) / 2, sigY, 20, 10);
        } catch (e) {
          doc.text('-', currentX + colWidths[5] / 2, currentY + rowHeight / 2 + 1.5, { align: 'center' });
        }
      } else {
        doc.text('-', currentX + colWidths[5] / 2, currentY + rowHeight / 2 + 1.5, { align: 'center' });
      }
      
      currentY += rowHeight;
    });
    
    // Footer: rata kiri-tengah (indented), posisi bawah halaman
    currentY = pageHeight - 52;
    const footerX = 150; // indent ≈ 60% dari lebar halaman
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Surabaya, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, footerX, currentY);
    doc.text('Mengetahui,', footerX, currentY + 7);
    
    if (signature) {
      try {
        doc.addImage(signature, 'PNG', footerX, currentY + 11, 30, 15);
      } catch (e) {
        console.error('Error adding signature:', e);
      }
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('Kepala BPS Kota Surabaya', footerX, currentY + 32);
    
    doc.save(`Absensi_${exportForm.judulKegiatan.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportAbsensiToExcel = (data: AbsensiRecord[]) => {
    const header = [
    'No', 
    'Nama', 
    'Tim/Bagian',
    'Kategori', 
    'Jenis Kegiatan', 
    'Nama Kegiatan',
    'Waktu Absen', 
    'Status', 
    'Instansi (Tamu)'
  ];

    const rows = data.map((item, index) => {
      const user = users.find(u => u.id === item.userId);
      const kategori = item.isGuest ? 'Tamu' : (user?.kategori || 'N/A');
      
      return [
        index + 1,
        item.namaUser,
        item.isGuest ? '-' : (user?.tim || '-'),
        kategori,
        item.jenisKegiatan.replace('-', ' ').toUpperCase(),
        item.namaKegiatan || '-',
        `${item.tanggal} ${item.waktu}`,
        item.status,
        item.isGuest && item.instansi ? item.instansi : '-'
      ].join(',');
    });

    const csvContent = [
      `DAFTAR HADIR (PRESENSI) - BPS KOTA SURABAYA`,
      `Judul Kegiatan: ${exportForm.judulKegiatan}`,
      `Hari/Tanggal: ${exportForm.hari}, ${exportForm.tanggal}`,
      `Tempat: ${exportForm.tempat}`,
      '',
      header.join(','),
      ...rows
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Absensi_${exportForm.judulKegiatan.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };  

  const exportNotulensiData = () => {
    const csvContent = [
      ['Tanggal', 'Waktu', 'Judul', 'Jenis', 'Penulis'].join(','),
      ...notulensiData.map(item => [
        item.tanggal,
        item.waktu,
        `"${item.judul}"`,
        item.jenisKegiatan,
        item.namaUser
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notulensi-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDateDisplay = (dateString: string) => {
    try {
      if (!dateString) return '';
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  const compareDates = (itemDate: string, filterDate: string): boolean => {
    if (!filterDate) return true;
    return itemDate === filterDate;
  };

  const getFilteredAbsensi = () => {
    return absensiData.filter(item => {
      const dateMatch = compareDates(item.tanggal, filterDate);
      const userMatch = !filterUser || filterUser === 'all' || item.userId === filterUser;
      const kegiatanMatch = filterKegiatan === 'all' || item.jenisKegiatan === filterKegiatan;
      const namaKegiatanMatch = !filterNamaKegiatan || item.namaKegiatan.toLowerCase().includes(filterNamaKegiatan.toLowerCase());
      
      let kategoriMatch = true;
      if (filterKategori !== 'all') {
        if (item.isGuest) {
          kategoriMatch = false;
        } else {
          const user = users.find(u => u.id === item.userId);
          kategoriMatch = user?.kategori === filterKategori;
        }
      }

      let timMatch = true;
      if (filterTim !== 'all') {
        if (item.isGuest) {
          timMatch = false;
        } else {
          const user = users.find(u => u.id === item.userId);
          timMatch = user?.tim === filterTim;
        }
      }
      
      return dateMatch && userMatch && kegiatanMatch && kategoriMatch && namaKegiatanMatch && timMatch;
    });
  };

  // Unique nama kegiatan for auto-suggest
  const uniqueNamaKegiatan = [...new Set(absensiData.map(a => a.namaKegiatan).filter(Boolean))];

  const filteredAbsensi = getFilteredAbsensi();

  const filteredActivities = activities.filter(item => {
    const dateMatch = compareDates(item.tanggal, filterDate);
    const userMatch = !filterUser || filterUser === 'all' || item.userId === filterUser;
    return dateMatch && userMatch;
  });

  const jenisKegiatanOptions = [
    { value: 'all', label: 'Semua Kegiatan' },
    { value: 'senam', label: '🏃‍♂️ Senam Pagi' },
    { value: 'apel', label: '🎖️ Apel Pagi' },
    { value: 'sharing-knowledge', label: '🧠 Sharing Knowledge' },
    { value: 'rapelan', label: '📋 Rapelan' },
    { value: 'doa-bersama', label: '🤲 Doa Bersama' },
    { value: 'rapat', label: '📋 Rapat' }
  ];

  const blockReasonOptions = [
    { value: 'izin', label: '✅ Izin' },
    { value: 'sakit', label: '🏥 Sakit' },
    { value: 'alpa', label: '❌ Alpa' },
    { value: 'izin-telat', label: '⏰ Izin Telat' }
  ];

  const getBlockReasonLabel = (reason: string) => {
    const option = blockReasonOptions.find(opt => opt.value === reason);
    return option ? option.label : reason;
  };

  const formatBlockedUntil = (blockedUntil?: string) => {
    if (!blockedUntil) return '';
    const date = new Date(blockedUntil);
    return date.toLocaleString('id-ID', { 
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const stats = {
    totalUsers: users.length,
    totalPresensi: absensiData.length,
    totalNotula: notulensiData.length,
    totalActivities: activities.length,
    filteredPresensi: filteredAbsensi.length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header dengan Gradient */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
                <Settings className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-500 text-white border-0">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Administrator
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold">Panel Admin</h1>
                <p className="text-blue-100 mt-1">
                  Kelola sistem absensi dan monitoring BPS Kota Surabaya
                </p>
              </div>
            </div>
            <Button 
              onClick={loadAdminData} 
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-0 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Message Alert */}
        {message.text && (
          <Alert className={`${message.type === 'error' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'} shadow-md`}>
            <AlertDescription className={message.type === 'error' ? 'text-red-700' : 'text-green-700'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-900">Total Users</CardTitle>
              <div className="bg-blue-500 p-2 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">{stats.totalUsers}</div>
              <p className="text-xs text-blue-700 mt-1">Pengguna terdaftar</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-900">Total Absensi</CardTitle>
              <div className="bg-green-500 p-2 rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">{stats.totalPresensi}</div>
              <p className="text-xs text-green-700 mt-1">Record absensi</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-900">Total Notulensi</CardTitle>
              <div className="bg-purple-500 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900">{stats.totalNotula}</div>
              <p className="text-xs text-purple-700 mt-1">Notulensi dibuat</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-br from-orange-50 to-orange-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-orange-900">System Health</CardTitle>
              <div className="bg-orange-500 p-2 rounded-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-orange-900">
                    {users.filter(u => !u.isBlocked).length}/{users.length}
                  </div>
                  <p className="text-xs text-orange-700 mt-1">User aktif / total</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-green-700">Online</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white shadow-md rounded-xl p-1">
            <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-2" />
              Kelola User
            </TabsTrigger>
            <TabsTrigger value="absensi" className="rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-2" />
              Monitor Presensi
            </TabsTrigger>
            <TabsTrigger value="notulensi" className="rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <FileText className="w-4 h-4 mr-2" />
              Monitor Notula
            </TabsTrigger>
            <TabsTrigger value="jadwal" className="rounded-lg data-[state=active]:bg-teal-600 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-2" />
              Jadwal Rapat
            </TabsTrigger>
            <TabsTrigger value="statistics" className="rounded-lg data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              Statistik
            </TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-4 mt-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl text-blue-900">Pengelolaan User</CardTitle>
                    <CardDescription className="text-blue-700">Kelola data pengguna sistem</CardDescription>
                  </div>
                  <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={resetUserForm} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Tambah User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-xl text-blue-900">
                          {editingUser ? 'Edit User' : 'Tambah User Baru'}
                        </DialogTitle>
                        <DialogDescription>
                          Isi form di bawah untuk {editingUser ? 'memperbarui' : 'menambahkan'} user
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleUserSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="nama">Nama Lengkap</Label>
                          <Input
                            id="nama"
                            value={userForm.nama}
                            onChange={(e) => setUserForm({ ...userForm, nama: e.target.value })}
                            required
                            className="border-gray-300"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            required
                            className="border-gray-300"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">
                            Password {editingUser && '(kosongkan jika tidak ingin mengubah)'}
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            value={userForm.password}
                            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                            required={!editingUser}
                            className="border-gray-300"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="kategori">Kategori</Label>
                          <Select 
                            onValueChange={(value) => setUserForm({ ...userForm, kategori: value as UserKategori })}
                            value={userForm.kategori}
                          >
                            <SelectTrigger className="border-gray-300">
                              <SelectValue placeholder="Pilih kategori" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pegawai">Pegawai</SelectItem>
                              <SelectItem value="Magang">Magang</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tim">Tim / Bagian</Label>
                          <Select 
                            onValueChange={(value) => setUserForm({ ...userForm, tim: value })}
                            value={userForm.tim}
                          >
                            <SelectTrigger className="border-gray-300">
                              <SelectValue placeholder="Pilih Tim / Bagian" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Distribusi">Distribusi</SelectItem>
                              <SelectItem value="ZI">ZI</SelectItem>
                              <SelectItem value="PSS">PSS</SelectItem>
                              <SelectItem value="Humas">Humas</SelectItem>
                              <SelectItem value="IPDS">IPDS</SelectItem>
                              <SelectItem value="Sosial">Sosial</SelectItem>
                              <SelectItem value="Produksi">Produksi</SelectItem>
                              <SelectItem value="Neraca">Neraca</SelectItem>
                              <SelectItem value="POTIK">POTIK</SelectItem>
                              <SelectItem value="Umum">Umum</SelectItem>
                              <SelectItem value="UKK">UKK</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select 
                            onValueChange={(value) => setUserForm({ ...userForm, role: value as UserRole })}
                            value={userForm.role}
                          >
                            <SelectTrigger className="border-gray-300">
                              <SelectValue placeholder="Pilih role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsUserDialogOpen(false)}
                          >
                            Batal
                          </Button>
                          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                            {editingUser ? 'Perbarui' : 'Tambah'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Nama</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Tim/Bagian</TableHead>
                        <TableHead className="font-semibold">Kategori</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Tanggal Daftar</TableHead>
                        <TableHead className="font-semibold text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{user.nama}</TableCell>
                          <TableCell className="text-gray-600">{user.email}</TableCell>
                          <TableCell className="text-gray-600 font-medium">{user.tim || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {user.kategori}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} 
                              className={user.role === 'admin' ? 'bg-indigo-600' : 'bg-gray-500'}>
                              {user.role === 'admin' ? (
                                <><Shield className="w-3 h-3 mr-1" />Admin</>
                              ) : (
                                'User'
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.isBlocked ? (
                              <div className="space-y-1">
                                <Badge className="bg-red-600 text-white">
                                  <Ban className="w-3 h-3 mr-1" />
                                  Diblokir
                                </Badge>
                                <div className="text-xs text-gray-600">
                                  <div>{getBlockReasonLabel(user.blockReason || '')}</div>
                                  {user.blockNote && (
                                    <div className="text-gray-500 italic">"{user.blockNote}"</div>
                                  )}
                                  {user.blockedUntil && (
                                    <div className="text-orange-600 font-medium">
                                      Sampai: {formatBlockedUntil(user.blockedUntil)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <Badge className="bg-green-500 text-white">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Aktif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {new Date(user.tanggalDaftar).toLocaleDateString('id-ID')}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-center flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditUser(user)}
                                className="hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              {user.isBlocked ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnblockUser(user.id)}
                                  className="hover:bg-green-50 hover:text-green-700"
                                  title="Buka Blokir"
                                >
                                  <Unlock className="w-3 h-3" />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenBlockDialog(user)}
                                  className="hover:bg-red-50 hover:text-red-700"
                                  title="Blokir User"
                                >
                                  <Ban className="w-3 h-3" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResetPassword(user.id)}
                                className="hover:bg-orange-50 hover:text-orange-700"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id)}
                                className="hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Block User Dialog */}
          <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl text-red-900 flex items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  Blokir Pengguna
                </DialogTitle>
                <DialogDescription>
                  Blokir {blockingUser?.nama} dari melakukan absensi
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-2">Informasi Pemblokiran:</p>
                      <ul className="space-y-1 text-xs">
                        <li>• <strong>Izin/Sakit/Alpa:</strong> Blokir sampai besok pagi jam 00:00</li>
                        <li>• <strong>Izin Telat:</strong> Blokir sampai hari ini jam 15:00</li>
                        <li>• Admin dapat membuka blokir secara manual kapan saja</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="blockReason">Alasan Pemblokiran <span className="text-red-500">*</span></Label>
                  <Select 
                    onValueChange={(value) => setBlockForm({ ...blockForm, reason: value as BlockReason })}
                    value={blockForm.reason}
                  >
                    <SelectTrigger className="border-gray-300">
                      <SelectValue placeholder="Pilih alasan" />
                    </SelectTrigger>
                    <SelectContent>
                      {blockReasonOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="blockNote">Catatan Tambahan (Opsional)</Label>
                  <Textarea
                    id="blockNote"
                    placeholder="Contoh: Izin keperluan keluarga, Sakit demam, dll..."
                    value={blockForm.note}
                    onChange={(e) => setBlockForm({ ...blockForm, note: e.target.value })}
                    className="border-gray-300"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsBlockDialogOpen(false);
                      setBlockingUser(null);
                      setBlockForm({ reason: '', note: '' });
                    }}
                  >
                    Batal
                  </Button>
                  <Button 
                    onClick={handleBlockUser}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={!blockForm.reason}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Blokir User
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Absensi Monitoring Tab */}
          <TabsContent value="absensi" className="space-y-4 mt-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-xl text-green-900">Monitoring Absensi</CardTitle>
                    <CardDescription className="text-green-700">Kelola dan export data absensi</CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      onClick={handleDeleteAllAbsensi} 
                      variant="destructive"
                      size="sm"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash className="w-4 h-4 mr-2" />
                      Hapus Semua
                    </Button>
                    <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={resetExportForm} className="bg-green-600 hover:bg-green-700">
                          <Download className="w-4 h-4 mr-2" />
                          Export dengan Kop
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-xl text-green-900">Export Absensi dengan Kop Resmi</DialogTitle>
                          <DialogDescription>
                            Isi informasi berikut untuk membuat dokumen absensi resmi BPS
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleExportSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Pilih Jadwal Kegiatan <span className="text-red-500">*</span></Label>
                            <Select 
                              onValueChange={(jadwalId) => {
                                const jadwal = jadwalRapatData.find(j => j.id === jadwalId);
                                if (jadwal) {
                                  // Determine day of the week from the date
                                  const dateObj = new Date(jadwal.tanggal);
                                  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()];
                                  
                                  setExportForm({
                                    ...exportForm,
                                    judulKegiatan: jadwal.judul,
                                    tanggal: jadwal.tanggal,
                                    hari: hari,
                                    // Use 'BPS Kota Surabaya' as default tempat if none is specified
                                    tempat: 'BPS Kota Surabaya',
                                    waktu: `${jadwal.jamMulai?.replace(':', '.') || '00.00'} - Selesai`
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="border-gray-300">
                                <SelectValue placeholder="-- Pilih dari Jadwal --" />
                              </SelectTrigger>
                              <SelectContent>
                                {jadwalRapatData.sort((a,b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()).map(jadwal => (
                                  <SelectItem key={jadwal.id} value={jadwal.id}>
                                    {jadwal.tanggal} - {jadwal.judul}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500 mt-1">Pilih jadwal untuk mengisi form otomatis di bawah ini.</p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="judulKegiatan">Judul Kegiatan <span className="text-red-500">*</span></Label>
                            <Input
                              id="judulKegiatan"
                              placeholder="Pilih dari dropdown di atas"
                              value={exportForm.judulKegiatan}
                              readOnly
                              className="bg-slate-100 border-gray-300 text-slate-600 cursor-not-allowed"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="hari">Hari <span className="text-red-500">*</span></Label>
                              <Input
                                id="hari"
                                placeholder="Otomatis"
                                value={exportForm.hari}
                                readOnly
                                className="bg-slate-100 border-gray-300 text-slate-600 cursor-not-allowed"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="tanggal">Tanggal <span className="text-red-500">*</span></Label>
                              <Input
                                id="tanggal"
                                type="date"
                                value={exportForm.tanggal}
                                readOnly
                                className="bg-slate-100 border-gray-300 text-slate-600 cursor-not-allowed"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tempat">Tempat <span className="text-red-500">*</span></Label>
                            <Input
                              id="tempat"
                              placeholder="Contoh: Aula BPS Kota Surabaya"
                              value={exportForm.tempat}
                              readOnly
                              className="bg-slate-100 border-gray-300 text-slate-600 cursor-not-allowed"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="waktu">Waktu <span className="text-red-500">*</span></Label>
                            <Input
                              id="waktu"
                              placeholder="Otomatis"
                              value={exportForm.waktu}
                              readOnly
                              className="bg-slate-100 border-gray-300 text-slate-600 cursor-not-allowed"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Format Export <span className="text-red-500">*</span></Label>
                            <Select 
                              onValueChange={(value) => setExportForm({ ...exportForm, exportType: value as 'pdf' | 'excel' })}
                              value={exportForm.exportType}
                            >
                              <SelectTrigger className="border-gray-300">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pdf">PDF (dengan Tanda Tangan)</SelectItem>
                                <SelectItem value="excel">Excel/CSV</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-900 font-medium mb-2">
                              Data yang akan di-export:
                            </p>
                            <ul className="text-sm text-blue-800 space-y-1">
                              <li>• Total: <strong>{filteredAbsensi.length} orang</strong></li>
                              <li>• Filter Kegiatan: <strong>{jenisKegiatanOptions.find(k => k.value === filterKegiatan)?.label || 'Semua'}</strong></li>
                              <li>• Filter Kategori: <strong>{filterKategori === 'all' ? 'Semua' : filterKategori}</strong></li>
                              {filterDate && <li>• Tanggal: <strong>{filterDate}</strong></li>}
                              {filterNamaKegiatan && <li>• Nama Kegiatan: <strong>{filterNamaKegiatan}</strong></li>}
                            </ul>
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setIsExportDialogOpen(false)}
                            >
                              Batal
                            </Button>
                            <Button type="submit" className="bg-green-600 hover:bg-green-700">
                              <Download className="w-4 h-4 mr-2" />
                              Export Sekarang
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Signature Dialog */}
            <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle className="text-xl text-blue-900">Tanda Tangan Admin</DialogTitle>
                  <DialogDescription>
                    Mohon tanda tangan untuk mengesahkan dokumen absensi
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="border-2 border-gray-300 rounded-lg bg-white">
                    <SignatureCanvas
                      ref={signaturePadRef}
                      canvasProps={{
                        className: 'w-full h-48',
                      }}
                    />
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={clearSignature}
                    >
                      Hapus Tanda Tangan
                    </Button>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsSignatureDialogOpen(false)}
                      >
                        Batal
                      </Button>
                      <Button onClick={handleSignatureSubmit} className="bg-blue-600 hover:bg-blue-700">
                        <Download className="w-4 h-4 mr-2" />
                        Export PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Filter Section */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gray-50 border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Filter className="w-5 h-5 text-gray-700" />
                  Filter Data Absensi
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700">Tanggal</Label>
                    <Input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="border-gray-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Jenis Kegiatan</Label>
                    <Select 
                      onValueChange={(value) => setFilterKegiatan(value as JenisKegiatan)}
                      value={filterKegiatan}
                    >
                      <SelectTrigger className="border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {jenisKegiatanOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Kategori</Label>
                    <Select 
                      onValueChange={(value) => setFilterKategori(value as 'all' | 'Pegawai' | 'Magang')}
                      value={filterKategori}
                    >
                      <SelectTrigger className="border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        <SelectItem value="Pegawai">Pegawai</SelectItem>
                        <SelectItem value="Magang">Magang</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">User</Label>
                    <Select onValueChange={setFilterUser} value={filterUser || 'all'}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Pilih user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua User</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Tim</Label>
                    <Select onValueChange={setFilterTim} value={filterTim}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Tim</SelectItem>
                        {timOptions.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700">Nama Kegiatan</Label>
                    <Select onValueChange={(v) => setFilterNamaKegiatan(v === 'all' ? '' : v)} value={filterNamaKegiatan || 'all'}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Pilih kegiatan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kegiatan</SelectItem>
                        {uniqueNamaKegiatan.map(nama => (
                          <SelectItem key={nama} value={nama}>{nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Menampilkan <strong className="text-green-600">{filteredAbsensi.length}</strong> dari {absensiData.length} data absensi
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFilterDate('');
                      setFilterKegiatan('all');
                      setFilterKategori('all');
                      setFilterUser('');
                      setFilterNamaKegiatan('');
                      setFilterTim('all');
                    }}
                    className="hover:bg-gray-100"
                  >
                    Reset Filter
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Absensi Data Table */}
            <Card className="border-0 shadow-lg">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">No</TableHead>
                        <TableHead className="font-semibold">Tanggal</TableHead>
                        <TableHead className="font-semibold">Waktu</TableHead>
                        <TableHead className="font-semibold">Nama</TableHead>
                        <TableHead className="font-semibold">Kategori</TableHead>
                        <TableHead className="font-semibold">Jenis Kegiatan</TableHead>
                        <TableHead className="font-semibold">Nama Kegiatan</TableHead> {/* ← KOLOM BARU */}
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">TTD</TableHead>
                        <TableHead className="font-semibold text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAbsensi.length > 0 ? (
                        filteredAbsensi.map((item, index) => {
                          const user = users.find(u => u.id === item.userId);
                          const kategori = item.isGuest ? 'Tamu' : (user?.kategori || 'N/A');
                          
                          return (
                            <TableRow key={item.id} className="hover:bg-gray-50">
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell className="text-gray-600">{formatDateDisplay(item.tanggal)}</TableCell>
                              <TableCell className="text-gray-600">{item.waktu}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{item.namaUser}</p>
                                  {item.isGuest && item.instansi && (
                                    <p className="text-xs text-blue-600">🏢 {item.instansi}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={item.isGuest ? 'default' : 'outline'}
                                  className={item.isGuest ? 'bg-purple-500 text-white' : 'bg-blue-50 text-blue-700 border-blue-200'}
                                >
                                  {kategori}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-gray-50 text-gray-700">
                                  {item.jenisKegiatan.replace('-', ' ').toUpperCase()}
                                </Badge>
                              </TableCell>
                              {/* ← CELL BARU: Nama Kegiatan */}
                              <TableCell className="max-w-xs">
                                <p className="text-sm text-gray-900 truncate" title={item.namaKegiatan}>
                                  {item.namaKegiatan || '-'}
                                </p>
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-green-500 text-white border-0">
                                  {item.status.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {item.signature ? (
                                  <img 
                                    src={item.signature} 
                                    alt="TTD" 
                                    className="h-8 w-16 object-contain border rounded"
                                  />
                                ) : (
                                  <span className="text-gray-400 text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteAbsensi(item.id)}
                                    className="hover:bg-red-50 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                            Tidak ada data absensi yang sesuai dengan filter
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jadwal Rapat Tab */}
          <TabsContent value="jadwal" className="space-y-4 mt-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl text-teal-900">Monitor Jadwal Kegiatan</CardTitle>
                    <CardDescription className="text-teal-700">Manajemen jadwal yang sedang aktif atau akan datang</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">No</TableHead>
                        <TableHead className="font-semibold">Judul</TableHead>
                        <TableHead className="font-semibold">Jenis</TableHead>
                        <TableHead className="font-semibold">Tanggal</TableHead>
                        <TableHead className="font-semibold">Jam</TableHead>
                        <TableHead className="font-semibold">Tim</TableHead>
                        <TableHead className="font-semibold">Peserta</TableHead>
                        <TableHead className="font-semibold">Repeat</TableHead>
                        <TableHead className="font-semibold">Tautan / QR</TableHead>
                        <TableHead className="font-semibold text-center">Aksi</TableHead>

                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jadwalRapatData.length > 0 ? (
                        jadwalRapatData.map((j, idx) => (
                          <TableRow key={j.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-semibold text-gray-900">{j.judul}</p>
                                {j.deskripsi && <p className="text-xs text-gray-500 truncate max-w-[200px]">{j.deskripsi}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 uppercase text-[10px]">
                                {j.jenisKegiatan?.replace('-', ' ') || 'Rapat'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-600">{formatDateDisplay(j.tanggal)}</TableCell>
                            <TableCell className="text-gray-600">{j.jamMulai} - {j.jamSelesai}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(Array.isArray(j.tim) ? j.tim : []).map(t => (
                                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(Array.isArray(j.peserta) ? j.peserta : []).map(p => (
                                  <Badge key={p} className="bg-blue-100 text-blue-700 border-0 text-[10px]">{p}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {j.repeatType === 'none' ? '1x' : j.repeatType === 'daily' ? 'Harian' : j.repeatType === 'weekly' ? 'Mingguan' : 'Custom'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {j.activeQRId ? (
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 w-8 p-0 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                    onClick={() => openQRDialog(j)}
                                    title="Lihat QR Code"
                                  >
                                    <QrCode className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 w-8 p-0 border-blue-200 text-blue-600 hover:bg-blue-50"
                                    onClick={() => handleCopyLink(j.activeQRId!)}
                                    title="Salin Tautan"
                                  >
                                    <Link className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (() => {
                                const now = new Date();
                                const jDate = new Date(j.tanggal);
                                const [endH, endM] = (j.jamSelesai || '00:00').split(':').map(Number);
                                jDate.setHours(endH, endM, 0, 0);
                                const isFinished = j.repeatType === 'none' && now > jDate;

                                return (
                                  <Button
                                    size="sm"
                                    className={`${isFinished ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} h-8 text-[10px] gap-1 px-2`}
                                    onClick={() => !isFinished && handleQuickGenerateQR(j)}
                                    disabled={isFinished}
                                    title={isFinished ? "Kegiatan sudah berakhir" : "Generate QR"}
                                  >
                                    {isFinished ? <Clock className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                    {isFinished ? 'Selesai' : 'Generate'}
                                  </Button>
                                );
                              })()}
                            </TableCell>


                            <TableCell>
                              <div className="flex justify-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteJadwal(j.id)}
                                  className="hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            Belum ada jadwal rapat. Klik "Buat Jadwal" untuk membuat.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notulensi jtoring Tab */}
          <TabsContent value="notulensi" className="space-y-4 mt-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl text-purple-900">Monitoring Notulensi</CardTitle>
                    <CardDescription className="text-purple-700">Kelola dan export data notulensi</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleDeleteAllNotulensi} 
                      variant="destructive"
                      size="sm"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash className="w-4 h-4 mr-2" />
                      Hapus Semua
                    </Button>
                    <Button onClick={exportNotulensiData} className="bg-purple-600 hover:bg-purple-700">
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Tanggal</TableHead>
                        <TableHead className="font-semibold">Waktu</TableHead>
                        <TableHead className="font-semibold">Judul</TableHead>
                        <TableHead className="font-semibold">Jenis</TableHead>
                        <TableHead className="font-semibold">Penulis</TableHead>
                        <TableHead className="font-semibold">Foto</TableHead>
                        <TableHead className="font-semibold text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notulensiData.length > 0 ? (
                        notulensiData.map((item) => (
                          <TableRow key={item.id} className="hover:bg-gray-50">
                            <TableCell className="text-gray-600">{formatDateDisplay(item.tanggal)}</TableCell>
                            <TableCell className="text-gray-600">{item.waktu}</TableCell>
                            <TableCell className="font-medium max-w-xs truncate">
                              {item.judul}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                {item.jenisKegiatan.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-600">{item.namaUser}</TableCell>
                            <TableCell>
                              {item.foto ? (
                                <Badge className="bg-blue-500 text-white border-0">Ada</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50 text-gray-600">Tidak ada</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteNotulensi(item.id)}
                                  className="hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            Tidak ada data notulensi
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activities Log Tab */}
          <TabsContent value="statistics" className="space-y-4 mt-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-orange-900">Statistik Sistem</CardTitle>
                    <CardDescription className="text-orange-700">
                      Ringkasan data dan performa sistem
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* User Statistics */}
                  <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-blue-900">Statistik User</CardTitle>
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">Total User</span>
                        <span className="text-xl font-bold text-blue-600">{stats.totalUsers}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">User Aktif</span>
                        <span className="text-xl font-bold text-green-600">
                          {users.filter(u => !u.isBlocked).length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">User Diblokir</span>
                        <span className="text-xl font-bold text-red-600">
                          {users.filter(u => u.isBlocked).length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">Admin</span>
                        <span className="text-xl font-bold text-purple-600">
                          {users.filter(u => u.role === 'admin').length}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Absensi Statistics */}
                  <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-green-900">Statistik Absensi</CardTitle>
                        <Calendar className="w-6 h-6 text-green-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">Total Record</span>
                        <span className="text-xl font-bold text-green-600">{stats.totalPresensi}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">Pegawai</span>
                        <span className="text-xl font-bold text-blue-600">
                          {absensiData.filter(a => {
                            const user = users.find(u => u.id === a.userId);
                            return user?.kategori === 'Pegawai';
                          }).length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">Magang</span>
                        <span className="text-xl font-bold text-purple-600">
                          {absensiData.filter(a => {
                            const user = users.find(u => u.id === a.userId);
                            return user?.kategori === 'Magang';
                          }).length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">Tamu</span>
                        <span className="text-xl font-bold text-orange-600">
                          {absensiData.filter(a => a.isGuest).length}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notulensi Statistics */}
                  <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-purple-900">Statistik Notulensi</CardTitle>
                        <FileText className="w-6 h-6 text-purple-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">Total Dokumen</span>
                        <span className="text-xl font-bold text-purple-600">{stats.totalNotula}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">Rapat</span>
                        <span className="text-xl font-bold text-blue-600">
                          {notulensiData.filter(n => n.jenisKegiatan === 'rapat').length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">Doa Bersama</span>
                        <span className="text-xl font-bold text-green-600">
                          {notulensiData.filter(n => n.jenisKegiatan === 'doa').length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <span className="text-sm text-gray-700">Rapelan</span>
                        <span className="text-xl font-bold text-orange-600">
                          {notulensiData.filter(n => n.jenisKegiatan === 'rapelan').length}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Activity Breakdown */}
                <Card className="mt-6 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-indigo-900">Breakdown Kegiatan Absensi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {['senam', 'apel', 'rapat', 'doa-bersama', 'rapelan'].map(activity => {
                        const count = absensiData.filter(a => a.jenisKegiatan === activity).length;
                        const colors = {
                          'senam': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
                          'apel': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
                          'rapat': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
                          'doa-bersama': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
                          'rapelan': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' }
                        };
                        const color = colors[activity as keyof typeof colors];
                        
                        return (
                          <div key={activity} className={`p-4 ${color.bg} border-2 ${color.border} rounded-lg text-center`}>
                            <div className={`text-2xl font-bold ${color.text}`}>{count}</div>
                            <div className="text-xs text-gray-700 mt-1 capitalize">
                              {activity.replace('-', ' ')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* System Info */}
                <Card className="mt-6 border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-gray-900">Informasi Sistem</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Waktu Server</div>
                          <div className="font-semibold text-gray-900">
                            {new Date().toLocaleTimeString('id-ID')}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Status Database</div>
                          <div className="font-semibold text-green-600 flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            Connected
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Activity className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Versi Sistem</div>
                          <div className="font-semibold text-gray-900">v1.0.0</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* QR Code Dialog for Admin Monitoring */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-indigo-900 flex items-center gap-2">
              <QrCode className="w-6 h-6 text-indigo-600" />
              Tautan Presensi Kegiatan
            </DialogTitle>
            <DialogDescription>
              Scan QR ini atau bagikan link untuk melakukan presensi.
            </DialogDescription>
          </DialogHeader>
          
          {selectedQR && (
            <div className="flex flex-col items-center justify-center p-6 space-y-6">
              <div className="text-center">
                <Badge className="mb-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
                  {selectedQR.jenis.toUpperCase()}
                </Badge>
                <h3 className="text-lg font-bold text-gray-900">{selectedQR.judul}</h3>
              </div>

              <div className="p-4 bg-white border-4 border-indigo-100 rounded-2xl shadow-inner">
                <QRCode 
                  value={`${window.location.origin}/#/absensi-qr/${selectedQR.id}`}
                  size={200}
                  level="H"
                />
              </div>

              <div className="w-full space-y-2">
                <Label className="text-xs text-gray-500">Tautan Langsung</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${window.location.origin}/#/absensi-qr/${selectedQR.id}`} 
                    className="bg-gray-50 text-xs"
                  />
                  <Button 
                    variant="outline"
                    onClick={() => handleCopyLink(selectedQR.id)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={() => {
                  window.open(`/#/absensi-qr/${selectedQR.id}`, '_blank');
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Buka Halaman Presensi
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
