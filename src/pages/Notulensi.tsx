import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Plus, Edit, Trash2, Download, Camera, Users, Calendar, TrendingUp, Eye, PenTool, BookOpen } from 'lucide-react';
import { authService, type User } from '@/lib/authService';
import { dataService, type NotulensiRecord } from '@/lib/dataService';
type JenisNotulensi = 'rapat' | 'doa' | 'rapelan' | 'lainnya';

export default function Notulensi() {
  const [notulensiList, setNotulensiList] = useState<NotulensiRecord[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewNotulensi, setPreviewNotulensi] = useState<NotulensiRecord | null>(null);
  const [editingNotulensi, setEditingNotulensi] = useState<NotulensiRecord | null>(null);
  const [formData, setFormData] = useState({
    judul: '',
    jenisKegiatan: '' as JenisNotulensi | '',
    hari: '',
    jam: '',
    tempat: '',
    agenda: '',
    isi: '',
    foto: '',
    signature: '',
    pemandu: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentUser = authService.getCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [stats, setStats] = useState({ totalAll: 0, totalToday: 0, totalThisMonth: 0, contributors: 0 });
  
  const jenisKegiatan = [
    { value: 'rapat' as JenisNotulensi, label: 'Rapat', icon: '👥' },
    { value: 'doa' as JenisNotulensi, label: 'Doa/Laporan', icon: '🤲' },
    { value: 'rapelan' as JenisNotulensi, label: 'Rapelan', icon: '📋' },
    { value: 'lainnya' as JenisNotulensi, label: 'Lainnya', icon: '📝' }
  ];

  useEffect(() => {
    loadNotulensi();
    loadStats();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && formData.jenisKegiatan === 'doa') {
      // Set ukuran canvas sesuai dengan display size
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Setup drawing style
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Load existing signature if any
        if (formData.signature) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = formData.signature;
        }
      }
    }
  }, [formData.jenisKegiatan, isDialogOpen]);
  
  const loadNotulensi = async () => {
    const data = await dataService.getNotulensiList();
    setNotulensiList(data);
  };

  const loadStats = async () => {
    const statsData = await dataService.getNotulensiStats();
    setStats(statsData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    if (formData.jenisKegiatan === 'doa' && !formData.signature) {
      setMessage({ type: 'error', text: 'Tanda tangan wajib diisi untuk Doa/Laporan!' });
      setIsSubmitting(false);
      return;
    }

    try {
      let success = false;
      
      if (editingNotulensi) {
        success = await dataService.updateNotulensi(editingNotulensi.id, {
          judul: formData.judul,
          jenisKegiatan: formData.jenisKegiatan as JenisNotulensi,
          hari: formData.hari,
          jam: formData.jam,
          tempat: formData.tempat,
          agenda: formData.agenda,
          isi: formData.isi,
          foto: formData.foto,
          signature: formData.signature,
          pemandu: formData.pemandu
        });
      } else {
        success = await dataService.saveNotulensi(
          formData.judul,
          formData.jenisKegiatan as string,
          formData.isi,
          formData.foto,
          formData.hari,
          formData.jam,
          formData.tempat,
          formData.agenda,
          formData.signature,
          formData.pemandu
        );
      }

      if (success) {
        setMessage({ 
          type: 'success', 
          text: editingNotulensi ? 'Notulensi berhasil diperbarui!' : 'Notulensi berhasil disimpan!' 
        });
        resetForm();
        await loadNotulensi();
        await loadStats();
        setIsDialogOpen(false);
      } else {
        setMessage({ type: 'error', text: 'Gagal menyimpan notulensi' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (notulensi: NotulensiRecord) => {
    setEditingNotulensi(notulensi);
    setFormData({
      judul: notulensi.judul,
      jenisKegiatan: notulensi.jenisKegiatan,
      hari: notulensi.hari || '',
      jam: notulensi.jam || '',
      tempat: notulensi.tempat || '',
      agenda: notulensi.agenda || '',
      isi: notulensi.isi,
      foto: notulensi.foto || '',
      signature: notulensi.signature || '',
      pemandu: notulensi.pemandu || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus notulensi ini?')) {
      const success = await dataService.deleteNotulensi(id);
      if (success) {
        setMessage({ type: 'success', text: 'Notulensi berhasil dihapus!' });
        await loadNotulensi();
        await loadStats();
      } else {
        setMessage({ type: 'error', text: 'Gagal menghapus notulensi' });
      }
    }
  };

  const handlePreview = (notulensi: NotulensiRecord) => {
    setPreviewNotulensi(notulensi);
    setIsPreviewOpen(true);
  };

  const handleDownloadPDF = async (notulensi: NotulensiRecord) => {
    const htmlContent = generatePDFContent(notulensi);
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();
      
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  const generatePDFContent = (notulensi: NotulensiRecord) => {
    const isRapat = notulensi.jenisKegiatan === 'rapat';
    const isDoa = notulensi.jenisKegiatan === 'doa';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Notulensi - ${notulensi.judul}</title>
  <style>
    @page { size: A4; margin: 2cm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', serif;
      line-height: 1.6;
      color: #000;
      max-width: 21cm;
      margin: 0 auto;
      padding: 20px;
      font-size: 12pt;
    }
    .header-with-image {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 15px;
      margin-bottom: 30px;
    }
    .header-with-image img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 15px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 18pt;
      margin: 5px 0;
      font-weight: bold;
    }
    .header h2 {
      font-size: 16pt;
      margin: 5px 0;
      font-weight: bold;
    }
    .header-title {
      font-size: 18pt;
      font-weight: bold;
      margin: 30px 0;
      text-align: center;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .info-table tr { vertical-align: top; }
    .info-table td {
      padding: 8px 5px;
      font-size: 12pt;
    }
    .info-table td:first-child {
      width: 180px;
      font-weight: normal;
    }
    .info-table td:nth-child(2) {
      width: 20px;
      text-align: center;
    }
    .content {
      margin: 30px 0;
      text-align: justify;
    }
    .content h3 {
      text-align: left;
      font-size: 14pt;
      margin: 20px 0 15px 0;
      font-weight: bold;
    }
    .content-text {
      white-space: pre-line;
      font-size: 12pt;
      text-align: justify;
      line-height: 1.8;
    }
    .documentation {
      margin: 40px 0;
      page-break-inside: avoid;
    }
    .documentation h3 {
      font-size: 14pt;
      margin-bottom: 20px;
      font-weight: bold;
      text-align: center;
    }
    .documentation img {
      max-width: 100%;
      max-height: 400px;
      height: auto;
      border: 1px solid #000;
      margin: 20px auto;
      display: block;
    }
    .signature-section {
      margin-top: 80px;
      page-break-inside: avoid;
    }
    .signature-right {
      float: right;
      text-align: center;
      margin-right: 80px;
      min-width: 250px;
    }
    .signature-label {
      margin-bottom: 80px;
      font-weight: normal;
    }
    .signature-image {
      margin: 0 auto 15px auto;
      display: block;
      max-width: 200px;
      height: auto;
    }
    .signature-name {
      border-bottom: 2px solid #000;
      padding: 5px 20px;
      display: inline-block;
      min-width: 200px;
      text-align: center;
      font-weight: normal;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      font-size: 10pt;
      color: #333;
    }
    @media print {
      body { margin: 0; padding: 15px; }
      .signature-section { page-break-inside: avoid; }
      .documentation { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${isRapat ? `
  <div class="header">
    <h1>NOTULENSI RAPAT</h1>
    <h2>BADAN PUSAT STATISTIK KOTA SURABAYA</h2>
  </div>
  <table class="info-table">
    <tr><td>HARI/TANGGAL</td><td>:</td><td>${notulensi.hari || notulensi.tanggal}</td></tr>
    <tr><td>JAM</td><td>:</td><td>${notulensi.jam || notulensi.waktu}</td></tr>
    <tr><td>TEMPAT</td><td>:</td><td>${notulensi.tempat || 'Kantor BPS Kota Surabaya'}</td></tr>
    <tr><td>AGENDA</td><td>:</td><td>${notulensi.agenda || notulensi.judul}</td></tr>
  </table>
  <div class="content">
    <h3>KESIMPULAN:</h3>
    <div class="content-text">${notulensi.isi}</div>
  </div>
  ` : isDoa ? `
  <div class="header-with-image">
    <img src="/Header.png" alt="Header BPS Kota Surabaya" />
  </div>
  <div class="header-title">LAPORAN KEGIATAN</div>
  <table class="info-table">
    <tr><td>Nama Kegiatan</td><td>:</td><td>${notulensi.judul}</td></tr>
    <tr><td>Tanggal Pelaksanaan</td><td>:</td><td>${notulensi.tanggal}</td></tr>
    <tr><td>Waktu</td><td>:</td><td>${notulensi.waktu}</td></tr>
    <tr><td>Pemandu Doa</td><td>:</td><td>${notulensi.pemandu || '-'}</td></tr>
  </table>
  <div class="content">
    <h3>Informasi yang dibagikan:</h3>
    <div class="content-text">${notulensi.isi}</div>
  </div>
  ` : `
  <div class="header-title">${notulensi.judul}</div>
  <table class="info-table">
    <tr><td>Jenis Kegiatan</td><td>:</td><td>${notulensi.jenisKegiatan.toUpperCase()}</td></tr>
    <tr><td>Tanggal</td><td>:</td><td>${notulensi.tanggal}</td></tr>
    <tr><td>Waktu</td><td>:</td><td>${notulensi.waktu}</td></tr>
  </table>
  <div class="content">
    <h3>ISI:</h3>
    <div class="content-text">${notulensi.isi}</div>
  </div>
  `}
  ${notulensi.foto ? `
  <div class="documentation">
    <h3>${isDoa ? 'Bukti Dukung (Dokumentasi)' : 'DOKUMENTASI'}</h3>
    <img src="${notulensi.foto}" alt="Dokumentasi Kegiatan" />
  </div>
  ` : ''}
  ${isDoa ? `
  <div class="signature-section">
    <div class="signature-right">
      <p class="signature-label">Pembuat Laporan</p>
      ${notulensi.signature ? '<img src="' + notulensi.signature + '" alt="Signature" class="signature-image" />' : '<div style="height: 80px;"></div>'}
      <p class="signature-name">${notulensi.namaUser}</p>
    </div>
  </div>
  ` : `
  <div class="footer">
    <p>Notulensi dibuat oleh: ${notulensi.namaUser}</p>
    <p>Tanggal pembuatan: ${notulensi.tanggal}</p>
  </div>
  `}
</body>
</html>
    `;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData({ ...formData, foto: e.target?.result as string });
      };
      reader.readAsDataURL(file);
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
      
      // Save signature
      const signature = canvas.toDataURL('image/png');
      setFormData({ ...formData, signature });
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setFormData({ ...formData, signature: '' });
      }
    }
  };

  const resetForm = () => {
    setFormData({ 
      judul: '', 
      jenisKegiatan: '', 
      hari: '', 
      jam: '', 
      tempat: '', 
      agenda: '', 
      isi: '', 
      foto: '',
      signature: '',
      pemandu: ''
    });
    setEditingNotulensi(null);
    setMessage({ type: '', text: '' });
    clearSignature();
  };

  const rapatNotulensi = notulensiList.filter(n => n.jenisKegiatan === 'rapat');
  const doaNotulensi = notulensiList.filter(n => n.jenisKegiatan === 'doa');
  const rapelanNotulensi = notulensiList.filter(n => n.jenisKegiatan === 'rapelan');
  const lainnyaNotulensi = notulensiList.filter(n => n.jenisKegiatan === 'lainnya');
  
  // Filter function
  const filterNotulensi = (list: NotulensiRecord[]) => {
    return list.filter(notulensi => {
      const matchesSearch = notulensi.judul.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Perbaikan filter tanggal
      let matchesDate = true;
      if (dateFilter) {
        // Konversi format tanggal input (yyyy-mm-dd) ke format yang sesuai
        const inputDate = new Date(dateFilter);
        const day = inputDate.getDate();
        const month = inputDate.getMonth() + 1; // Bulan dimulai dari 0
        const year = inputDate.getFullYear();
        
        // Cek berbagai format tanggal yang mungkin ada
        // Format: "18/10/2025" atau "5/10/2025"
        const datePattern1 = `${day}/${month}/${year}`;
        const datePattern2 = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        
        matchesDate = notulensi.tanggal.includes(datePattern1) || 
                      notulensi.tanggal.includes(datePattern2) ||
                      notulensi.tanggal.includes(dateFilter);
      }
      
      return matchesSearch && matchesDate;
    });
  };
  
  // Apply filters
  const filteredNotulensiList = filterNotulensi(notulensiList);
  const filteredRapatNotulensi = filterNotulensi(rapatNotulensi);
  const filteredDoaNotulensi = filterNotulensi(doaNotulensi);
  const filteredRapelanNotulensi = filterNotulensi(rapelanNotulensi);
  const filteredLainnyaNotulensi = filterNotulensi(lainnyaNotulensi);

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />
        
        <div className="relative flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Badge className="bg-green-500/90 text-white border-0 hover:bg-green-500">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                  Sistem Dokumentasi
                </Badge>
              </div>
              <h1 className="text-4xl font-bold mb-2">Notulensi Digital</h1>
              <p className="text-emerald-100 text-lg">
                Kelola notulensi rapat dan kegiatan BPS Surabaya dengan mudah
              </p>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={resetForm}
                className="bg-white text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Notulensi
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {editingNotulensi ? 'Edit Notulensi' : 'Tambah Notulensi Baru'}
                </DialogTitle>
                <DialogDescription>
                  Isi form di bawah untuk {editingNotulensi ? 'memperbarui' : 'membuat'} notulensi
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="judul">Judul Notulensi</Label>
                    <Input
                      id="judul"
                      value={formData.judul}
                      onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                      placeholder="Rapat Koordinasi Persiapan Pelaksanaan..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jenisKegiatan">Jenis Kegiatan</Label>
                    <Select 
                      onValueChange={(value) => setFormData({ ...formData, jenisKegiatan: value as JenisNotulensi })}
                      value={formData.jenisKegiatan || undefined}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis kegiatan" />
                      </SelectTrigger>
                      <SelectContent>
                        {jenisKegiatan.map((kegiatan) => (
                          <SelectItem key={kegiatan.value} value={kegiatan.value}>
                            <span className="flex items-center gap-2">
                              <span>{kegiatan.icon}</span>
                              {kegiatan.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.jenisKegiatan === 'rapat' && (
                  <div className="bg-yellow-50 p-5 rounded-xl border-2 border-yellow-200">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <span>📋</span>
                      Informasi Header (Khusus Rapat - Format BPS)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="hari">Hari/Tanggal *</Label>
                        <Input
                          id="hari"
                          value={formData.hari}
                          onChange={(e) => setFormData({ ...formData, hari: e.target.value })}
                          placeholder="Kamis, 15 Mei 2025"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="jam">Jam *</Label>
                        <Input
                          id="jam"
                          value={formData.jam}
                          onChange={(e) => setFormData({ ...formData, jam: e.target.value })}
                          placeholder="08:30 - selesai"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tempat">Tempat *</Label>
                        <Input
                          id="tempat"
                          value={formData.tempat}
                          onChange={(e) => setFormData({ ...formData, tempat: e.target.value })}
                          placeholder="Pendopo Kelurahan Jemur Wonosari"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="agenda">Agenda *</Label>
                        <Input
                          id="agenda"
                          value={formData.agenda}
                          onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                          placeholder="Rapat Koordinasi Persiapan Pelaksanaan..."
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.jenisKegiatan === 'doa' && (
                  <div className="space-y-2 bg-green-50 p-5 rounded-xl border-2 border-green-200">
                    <Label htmlFor="pemandu" className="text-base font-semibold">
                      Nama Pemandu Doa *
                    </Label>
                    <p className="text-sm text-gray-600">
                      Masukkan nama pemandu doa pada kegiatan ini
                    </p>
                    <Input
                      id="pemandu"
                      value={formData.pemandu}
                      onChange={(e) => setFormData({ ...formData, pemandu: e.target.value })}
                      placeholder="Nama pemandu doa..."
                      required
                      className="bg-white"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="isi">
                    {formData.jenisKegiatan === 'rapat' ? 'Isi Notulensi (Kesimpulan)' : 
                     formData.jenisKegiatan === 'doa' ? 'Informasi yang dibagikan' : 
                     'Isi Notulensi'}
                  </Label>
                  <Textarea
                    id="isi"
                    value={formData.isi}
                    onChange={(e) => setFormData({ ...formData, isi: e.target.value })}
                    placeholder={
                      formData.jenisKegiatan === 'doa' 
                        ? 'Bu Tanti: pagi ini ada undangan dari pusat terkait briefing PHTS dengan total sampel 129...'
                        : '1. Disampaikan kepada Kelurahan Jemurwonosari bahwa Kelurahan Jemurwonosari terpilih sebagai kelurahan...'
                    }
                    rows={8}
                    className="resize-none"
                    required
                  />
                </div>

                {formData.jenisKegiatan === 'doa' && (
                  <div className="space-y-2 bg-blue-50 p-5 rounded-xl border-2 border-blue-200">
                    <Label className="text-base font-semibold">Tanda Tangan Pembuat Laporan *</Label>
                    <p className="text-sm text-gray-600">Gambar tanda tangan Anda di area di bawah ini</p>
                    
                    <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl overflow-hidden hover:border-blue-400 transition-colors">
                      <canvas
                        ref={canvasRef}
                        width={600}
                        height={200}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          const touch = e.touches[0];
                          const canvas = canvasRef.current;
                          if (canvas) {
                            const rect = canvas.getBoundingClientRect();
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                              setIsDrawing(true);
                              ctx.beginPath();
                              ctx.moveTo(
                                touch.clientX - rect.left,
                                touch.clientY - rect.top
                              );
                            }
                          }
                        }}
                        onTouchMove={(e) => {
                          e.preventDefault();
                          if (!isDrawing) return;
                          const touch = e.touches[0];
                          const canvas = canvasRef.current;
                          if (canvas) {
                            const rect = canvas.getBoundingClientRect();
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                              ctx.lineTo(
                                touch.clientX - rect.left,
                                touch.clientY - rect.top
                              );
                              ctx.stroke();
                            }
                          }
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          stopDrawing();
                        }}
                        className="w-full cursor-crosshair touch-none"
                        style={{ touchAction: 'none' }}
                      />
                    </div>
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearSignature}
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Hapus Tanda Tangan
                    </Button>
                    
                    {formData.signature && (
                      <div className="mt-2 bg-green-50 p-3 rounded-lg border border-green-200">
                        <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                          <span className="text-green-600">✓</span>
                          Tanda tangan sudah dibuat
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="foto">Upload Dokumentasi (Opsional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="foto"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="flex-1"
                    />
                    <Camera className="w-5 h-5 text-gray-400" />
                  </div>
                  {formData.foto && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600 mb-2 font-medium">Preview Dokumentasi:</p>
                      <img 
                        src={formData.foto} 
                        alt="Preview" 
                        className="max-w-full h-48 object-cover rounded-xl border-2 shadow-md"
                      />
                    </div>
                  )}
                </div>

                {message.text && (
                  <Alert className={`${message.type === 'error' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'} border-2`}>
                    <AlertDescription className={`${message.type === 'error' ? 'text-red-700' : 'text-green-700'} font-medium`}>
                      {message.type === 'success' ? '✅ ' : '❌ '}
                      {message.text}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Menyimpan...
                      </>
                    ) : (
                      editingNotulensi ? 'Perbarui' : 'Simpan'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Notulensi */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                Total
              </Badge>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Notulensi</h3>
            <p className="text-4xl font-bold text-gray-900 mb-2">{stats.totalAll}</p>
            <p className="text-xs text-gray-500">
              Semua notulensi yang dibuat
            </p>
            <div className="mt-4 flex items-center gap-2 text-emerald-600">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium">Dokumen lengkap</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Bulan Ini */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                Bulan Ini
              </Badge>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Bulan Ini</h3>
            <p className="text-4xl font-bold text-gray-900 mb-2">{stats.totalThisMonth}</p>
            <p className="text-xs text-gray-500">
              Notulensi bulan ini
            </p>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500" 
                style={{width: `${Math.min((stats.totalThisMonth / 20) * 100, 100)}%`}}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Hari Ini */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <Badge variant="outline" className="text-purple-600 border-purple-200">
                Hari Ini
              </Badge>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Hari Ini</h3>
            <p className="text-4xl font-bold text-gray-900 mb-2">{stats.totalToday}</p>
            <p className="text-xs text-gray-500">
              Notulensi dibuat hari ini
            </p>
            <div className="mt-4 flex items-center gap-2 text-purple-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Produktivitas harian</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Kontributor */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-500 to-pink-600 text-white hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <Badge className="bg-white/20 text-white border-0">
                Aktif
              </Badge>
            </div>
            <h3 className="text-sm font-medium text-white/80 mb-1">Kontributor</h3>
            <p className="text-4xl font-bold mb-2">{stats.contributors}</p>
            <p className="text-xs text-white/70">
              Pengguna aktif
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-xs font-medium text-white/90">User berkontribusi</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message Alert */}
      {message.text && (
        <Alert className={`${message.type === 'error' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'} border-2`}>
          <AlertDescription className={`${message.type === 'error' ? 'text-red-700' : 'text-green-700'} font-medium`}>
            {message.type === 'success' ? '✅ ' : '❌ '}
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Preview Notulensi</DialogTitle>
            <DialogDescription>
              Preview format notulensi {previewNotulensi?.jenisKegiatan}
            </DialogDescription>
          </DialogHeader>
          {previewNotulensi && (
            <div className="bg-white p-6 border-2 border-gray-300 rounded-xl shadow-inner">
              {previewNotulensi.jenisKegiatan === 'rapat' ? (
                <>
                  <div className="text-center border-b-4 border-black pb-4 mb-6">
                    <h1 className="text-xl font-bold text-gray-900">NOTULENSI RAPAT</h1>
                    <h2 className="text-lg font-semibold text-gray-700">BADAN PUSAT STATISTIK KOTA SURABAYA</h2>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex"><span className="font-semibold w-32">HARI/TGL</span><span className="mr-2">:</span><span>{previewNotulensi.hari || previewNotulensi.tanggal}</span></div>
                      <div className="flex"><span className="font-semibold w-32">JAM</span><span className="mr-2">:</span><span>{previewNotulensi.jam || previewNotulensi.waktu}</span></div>
                      <div className="flex"><span className="font-semibold w-32">TEMPAT</span><span className="mr-2">:</span><span>{previewNotulensi.tempat || 'Kantor BPS Kota Surabaya'}</span></div>
                      <div className="flex"><span className="font-semibold w-32">AGENDA</span><span className="mr-2">:</span><span>{previewNotulensi.agenda || previewNotulensi.judul}</span></div>
                    </div>
                  </div>
                  <div className="mb-6">
                    <h3 className="font-bold text-lg mb-3">KESIMPULAN:</h3>
                    <div className="text-sm leading-relaxed whitespace-pre-line text-justify">{previewNotulensi.isi}</div>
                  </div>
                </>
              ) : previewNotulensi.jenisKegiatan === 'doa' ? (
                <>
                  <div className="border-b-4 border-black pb-4 mb-6">
                    <img src="/Header.png" alt="Header BPS Kota Surabaya" className="w-full max-w-full" />
                  </div>
                  <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">LAPORAN KEGIATAN</h1>
                  </div>
                  <div className="bg-gray-100 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex"><span className="w-48">Nama Kegiatan</span><span className="mr-2">:</span><span>{previewNotulensi.judul}</span></div>
                      <div className="flex"><span className="w-48">Tanggal Pelaksanaan</span><span className="mr-2">:</span><span>{previewNotulensi.tanggal}</span></div>
                      <div className="flex"><span className="w-48">Waktu</span><span className="mr-2">:</span><span>{previewNotulensi.waktu}</span></div>
                      <div className="flex"><span className="w-48">Pemandu Doa</span><span className="mr-2">:</span><span>{previewNotulensi.pemandu || '-'}</span></div>
                    </div>
                  </div>
                  <div className="mb-6">
                    <h3 className="font-bold text-base mb-3">Informasi yang dibagikan:</h3>
                    <div className="text-sm leading-relaxed whitespace-pre-line text-justify">{previewNotulensi.isi}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">{previewNotulensi.judul}</h1>
                    <div className="bg-gray-100 p-3 rounded-lg text-sm">
                      <div className="flex justify-center gap-4">
                        <span><strong>Jenis:</strong> {previewNotulensi.jenisKegiatan.toUpperCase()}</span>
                        <span><strong>Tanggal:</strong> {previewNotulensi.tanggal}</span>
                        <span><strong>Waktu:</strong> {previewNotulensi.waktu}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mb-6">
                    <h3 className="font-bold text-lg mb-3">ISI:</h3>
                    <div className="text-sm leading-relaxed whitespace-pre-line text-justify">{previewNotulensi.isi}</div>
                  </div>
                </>
              )}
              {previewNotulensi.foto && (
                <div className="border-t-2 border-gray-300 pt-6 mt-6">
                  <h3 className="font-bold text-lg mb-4 text-center">
                    {previewNotulensi.jenisKegiatan === 'doa' ? 'Bukti Dukung (Dokumentasi)' : 'DOKUMENTASI:'}
                  </h3>
                  <img src={previewNotulensi.foto} alt="Dokumentasi" className="max-w-full mx-auto rounded-lg border-2 border-gray-300" />
                </div>
              )}
              <div className="border-t-2 border-gray-300 pt-4 mt-6 text-xs text-gray-600">
                {previewNotulensi.jenisKegiatan === 'doa' ? (
                  <div className="text-right pr-12 mt-8">
                    <p className="mb-2">Pembuat Laporan</p>
                    {previewNotulensi.signature && <img src={previewNotulensi.signature} alt="Signature" className="max-w-[200px] h-auto ml-auto my-2" />}
                    <p className="border-b border-gray-900 inline-block pb-1 min-w-[200px] text-center">{previewNotulensi.namaUser}</p>
                  </div>
                ) : (
                  <>
                    <p>Notulensi dibuat oleh: {previewNotulensi.namaUser}</p>
                    <p>Tanggal pembuatan: {previewNotulensi.tanggal}</p>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Tutup</Button>
            {previewNotulensi && (
              <Button onClick={() => handleDownloadPDF(previewNotulensi)}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Search and Filter Section */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="text-sm font-medium mb-2 block">
                🔍 Cari Notulensi
              </Label>
              <Input
                id="search"
                type="text"
                placeholder="Cari berdasarkan judul..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="w-full md:w-64">
              <Label htmlFor="dateFilter" className="text-sm font-medium mb-2 block">
                📅 Filter Tanggal
              </Label>
              <Input
                id="dateFilter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full"
              />
            </div>
            {(searchQuery || dateFilter) && (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setDateFilter('');
                  }}
                  className="w-full md:w-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="semua" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-gray-100 p-1 rounded-xl">
          <TabsTrigger value="semua" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            Semua ({filteredNotulensiList.length})
          </TabsTrigger>
          <TabsTrigger value="rapat" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            Rapat ({filteredRapatNotulensi.length})
          </TabsTrigger>
          <TabsTrigger value="doa" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            Doa/Laporan ({filteredDoaNotulensi.length})
          </TabsTrigger>
          <TabsTrigger value="rapelan" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            Rapelan ({filteredRapelanNotulensi.length})
          </TabsTrigger>
          <TabsTrigger value="lainnya" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
            Lainnya ({filteredLainnyaNotulensi.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="semua" className="space-y-4 mt-6">
          {filteredNotulensiList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredNotulensiList.map((notulensi) => (
                <NotulensiCard 
                  key={notulensi.id} 
                  notulensi={notulensi} 
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPreview={handlePreview}
                  onDownload={handleDownloadPDF}
                  jenisKegiatan={jenisKegiatan}
                  currentUser={currentUser}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-12 h-12 text-gray-300" />
              </div>
              <p className="text-lg font-medium text-gray-600">Belum ada notulensi</p>
              <p className="text-sm text-gray-400 mt-1">Klik tombol "Tambah Notulensi" untuk memulai</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rapat" className="space-y-4 mt-6">
          {filteredRapatNotulensi.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRapatNotulensi.map((notulensi) => (
                <NotulensiCard key={notulensi.id} notulensi={notulensi} onEdit={handleEdit} onDelete={handleDelete} onPreview={handlePreview} onDownload={handleDownloadPDF} jenisKegiatan={jenisKegiatan} currentUser={currentUser} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500"><p>Belum ada notulensi rapat</p></div>
          )}
        </TabsContent>

        <TabsContent value="doa" className="space-y-4 mt-6">
          {filteredDoaNotulensi.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDoaNotulensi.map((notulensi) => (
                <NotulensiCard key={notulensi.id} notulensi={notulensi} onEdit={handleEdit} onDelete={handleDelete} onPreview={handlePreview} onDownload={handleDownloadPDF} jenisKegiatan={jenisKegiatan} currentUser={currentUser} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500"><p>Belum ada notulensi doa/laporan</p></div>
          )}
        </TabsContent>

        <TabsContent value="rapelan" className="space-y-4 mt-6">
          {filteredRapelanNotulensi.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRapelanNotulensi.map((notulensi) => (
                <NotulensiCard key={notulensi.id} notulensi={notulensi} onEdit={handleEdit} onDelete={handleDelete} onPreview={handlePreview} onDownload={handleDownloadPDF} jenisKegiatan={jenisKegiatan} currentUser={currentUser} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500"><p>Belum ada notulensi rapelan</p></div>
          )}
        </TabsContent>

        <TabsContent value="lainnya" className="space-y-4 mt-6">
          {filteredLainnyaNotulensi.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLainnyaNotulensi.map((notulensi) => (
                <NotulensiCard key={notulensi.id} notulensi={notulensi} onEdit={handleEdit} onDelete={handleDelete} onPreview={handlePreview} onDownload={handleDownloadPDF} jenisKegiatan={jenisKegiatan} currentUser={currentUser} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500"><p>Belum ada notulensi lainnya</p></div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface NotulensiCardProps {
  notulensi: NotulensiRecord;
  onEdit: (notulensi: NotulensiRecord) => void;
  onDelete: (id: string) => void;
  onPreview: (notulensi: NotulensiRecord) => void;
  onDownload: (notulensi: NotulensiRecord) => void;
  jenisKegiatan: Array<{ value: JenisNotulensi; label: string; icon: string }>;
  currentUser: User | null;
}

function NotulensiCard({ notulensi, onEdit, onDelete, onPreview, onDownload, jenisKegiatan, currentUser }: NotulensiCardProps) {
  const kegiatan = jenisKegiatan.find(k => k.value === notulensi.jenisKegiatan);
  const canEdit = currentUser?.id === notulensi.userId || currentUser?.role === 'admin';
  const isRapat = notulensi.jenisKegiatan === 'rapat';

  const getBorderColor = () => {
    switch (notulensi.jenisKegiatan) {
      case 'rapat': return 'border-l-yellow-500';
      case 'doa': return 'border-l-blue-500';
      case 'rapelan': return 'border-l-green-500';
      case 'lainnya': return 'border-l-purple-500';
      default: return 'border-l-gray-400';
    }
  };

  const getBadgeColor = () => {
    switch (notulensi.jenisKegiatan) {
      case 'rapat': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'doa': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'rapelan': return 'bg-green-100 text-green-800 border-green-300';
      case 'lainnya': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <Card className={`h-full border-l-4 ${getBorderColor()} border-0 shadow-lg hover:shadow-xl transition-all duration-300 group`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg line-clamp-2 mb-2 group-hover:text-emerald-600 transition-colors">
              {notulensi.judul}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-xl">{kegiatan?.icon}</span>
              <span>{kegiatan?.label}</span>
            </div>
          </div>
          <Badge variant="outline" className={`${getBadgeColor()} border-2 font-semibold shrink-0`}>
            {kegiatan?.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRapat && (notulensi.hari || notulensi.tempat) && (
          <div className="bg-yellow-50 p-3 rounded-lg text-xs space-y-1 border-2 border-yellow-200">
            {notulensi.hari && <div><span className="font-semibold">Hari:</span> {notulensi.hari}</div>}
            {notulensi.jam && <div><span className="font-semibold">Jam:</span> {notulensi.jam}</div>}
            {notulensi.tempat && <div><span className="font-semibold">Tempat:</span> {notulensi.tempat}</div>}
          </div>
        )}
        
        <div className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
          {notulensi.isi}
        </div>
        
        {notulensi.foto && (
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium flex items-center gap-1">
              <Camera className="w-3 h-3" />
              Dokumentasi tersedia
            </p>
            <img 
              src={notulensi.foto} 
              alt="Bukti foto" 
              className="w-full h-32 object-cover rounded-lg border-2 shadow-sm"
            />
          </div>
        )}

        <div className="flex items-center justify-between text-sm pt-2 border-t">
          <span className="text-gray-600 font-medium">📝 {notulensi.namaUser}</span>
          <span className="text-gray-500">{notulensi.tanggal}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPreview(notulensi)}
            className="flex-1 hover:bg-blue-50 hover:border-blue-400 transition-colors"
          >
            <Eye className="w-4 h-4 mr-1" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload(notulensi)}
            className="hover:bg-green-50 hover:border-green-400 transition-colors"
          >
            <Download className="w-4 h-4" />
          </Button>
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(notulensi)}
                className="hover:bg-yellow-50 hover:border-yellow-400 transition-colors"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(notulensi.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}