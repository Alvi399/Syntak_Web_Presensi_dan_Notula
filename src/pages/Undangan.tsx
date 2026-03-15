import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Mail, Trash2, Download, Eye, Users, Calendar, FileText, Upload, File, FileImage, FileType, Radio } from 'lucide-react';
import { authService } from '@/lib/authService';
import { dataService, type UndanganRecord, type JadwalRapat } from '@/lib/dataService';

export default function Undangan() {
  const [undanganList, setUndanganList] = useState<UndanganRecord[]>([]);
  const [activeJadwals, setActiveJadwals] = useState<JadwalRapat[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUndangan, setPreviewUndangan] = useState<UndanganRecord | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State untuk upload file
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>('');
  const [selectedJadwalId, setSelectedJadwalId] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState<string | null>(null); // id of undangan being broadcast
  
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    loadUndangan();
    loadActiveJadwal();
  }, []);

  const loadActiveJadwal = async () => {
    try {
       const jadwals = await dataService.getActiveJadwal(currentUser?.tim, currentUser?.kategori);
       setActiveJadwals(jadwals || []);
    
    // Auto-select first schedule if available
    if (jadwals && jadwals.length > 0) {
      setSelectedJadwalId(jadwals[0].id);
    }
    } catch (error) {
       console.error("Gagal memuat jadwal aktif", error);
    }
  };

  const loadUndangan = async () => {
    const data = await dataService.getUndanganList();
    setUndanganList(data);
  };

  // Handler untuk file upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi tipe file
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Format file tidak didukung. Gunakan PDF, DOCX, JPG, atau PNG.' });
      return;
    }

    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Ukuran file terlalu besar. Maksimal 5MB.' });
      return;
    }

    setUploadFile(file);
    setMessage({ type: '', text: '' });

    // Preview untuk gambar
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setUploadPreview('');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setMessage({ type: 'error', text: 'Silakan pilih file untuk diunggah.' });
      return;
    }

    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const selectedJadwal = activeJadwals.find(j => j.id === selectedJadwalId);
      const perihal = selectedJadwal ? `Undangan ${selectedJadwal.judul}` : uploadFile.name;

      // Wrap FileReader in a Promise so await works correctly
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(uploadFile);
      });

      const success = await dataService.saveUndangan({
        userId: currentUser?.id || '',
        namaUser: currentUser?.nama || '',
        tempat: 'Surabaya',
        tanggal: new Date().toISOString().split('T')[0],
        nomorSurat: '-',
        sifat: 'Biasa',
        lampiran: uploadFile.name,
        perihal: perihal,
        kepada: 'File undangan eksternal',
        isiSurat: `File undangan yang diunggah: ${uploadFile.name}`,
        hariTanggalWaktu: selectedJadwal ? `${selectedJadwal.tanggal}, ${selectedJadwal.jamMulai} - ${selectedJadwal.jamSelesai}` : '-',
        tempatKegiatan: '-',
        idKegiatan: selectedJadwalId || undefined,
        tandaTangan: '',
        jabatanPenandatangan: currentUser?.nama || '',
        nip: '',
        isUploadedFile: true,
        uploadedFileName: uploadFile.name,
        uploadedFileType: uploadFile.type,
        uploadedFileData: fileData,
        uploadedFileSize: uploadFile.size
      });

      if (success) {
        setMessage({ type: 'success', text: 'File undangan berhasil diunggah!' });
        resetUploadForm();
        await loadUndangan();
        setIsUploadDialogOpen(false);
      } else {
        setMessage({ type: 'error', text: 'Gagal mengunggah file. Silakan coba lagi.' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat mengunggah file.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadPreview('');
    setSelectedJadwalId('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadUploadedFile = (undangan: UndanganRecord) => {
    if (!undangan.isUploadedFile || !undangan.uploadedFileData) return;

    const link = document.createElement('a');
    link.href = undangan.uploadedFileData;
    link.download = undangan.uploadedFileName || 'undangan';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-600" />;
    if (fileType.includes('word') || fileType.includes('document')) return <FileType className="w-5 h-5 text-blue-600" />;
    if (fileType.includes('image')) return <FileImage className="w-5 h-5 text-green-600" />;
    return <File className="w-5 h-5 text-gray-600" />;
  };

  const handleDelete = async (id: string) => {
    try {
      if (window.confirm("Apakah Anda yakin ingin menghapus surat undangan ini?")) {
        const success = await dataService.deleteUndangan(id);
        if (success) {
          setMessage({ type: 'success', text: 'Undangan berhasil dihapus!' });
          await loadUndangan();
        } else {
          setMessage({ type: 'error', text: 'Gagal menghapus undangan' });
        }
      }
    } catch (error) {
      console.error("Error deleting undangan:", error);
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat menghapus undangan.' });
    }
  };

  const handleBroadcast = async (undangan: UndanganRecord) => {
    if (!undangan.idKegiatan) {
      setMessage({ type: 'error', text: 'Undangan ini tidak terhubung ke jadwal kegiatan.' });
      return;
    }
    if (!window.confirm(`Broadcast undangan "${undangan.perihal}" ke semua peserta jadwal ini?`)) return;

    setIsBroadcasting(undangan.id);
    setMessage({ type: '', text: '' });
    try {
      const backendBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
      const res = await fetch(`${backendBase}/api/undangan/${undangan.id}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcasterId: currentUser?.id }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `📢 Broadcast dimulai ke ${data.total} peserta. Lihat progress bar di bawah layar.` });
      } else {
        setMessage({ type: 'error', text: data.message || 'Gagal memulai broadcast.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat broadcast.' });
    } finally {
      setIsBroadcasting(null);
    }
  };

  const handlePreview = (undangan: UndanganRecord) => {
    setPreviewUndangan(undangan);
    setIsPreviewOpen(true);
  };

  const thisMonthCount = undanganList.filter(u => {
    const month = new Date(u.createdAt).getMonth();
    return month === new Date().getMonth();
  }).length;

  const myUndanganCount = undanganList.filter(u => u.userId === currentUser?.id).length;

  const thisWeekCount = undanganList.filter(u => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(u.createdAt) > weekAgo;
  }).length;

  const uploadedFilesCount = undanganList.filter(u => u.isUploadedFile).length;

  return (
    <div className="space-y-6">
      {/* Header with Orange Gradient */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />
        
        <div className="relative flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Badge className="bg-amber-500/90 text-white border-0 hover:bg-amber-500">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                  Sistem Undangan
                </Badge>
              </div>
              <h1 className="text-4xl font-bold mb-2">Undangan Resmi</h1>
              <p className="text-orange-100 text-lg">
                Kelola surat undangan resmi BPS Surabaya dengan format profesional
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {/* TOMBOL UPLOAD FILE BARU */}
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={resetUploadForm}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Undangan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl flex items-center gap-2">
                    <Upload className="w-6 h-6 text-green-600" />
                    Upload File Undangan
                  </DialogTitle>
                  <DialogDescription>
                    Unggah file undangan eksternal (PDF, DOCX, JPG, PNG). Maksimal 5MB.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUploadSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <Label htmlFor="fileUpload">Pilih File</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-green-400 transition-colors text-center">
                      <input
                        ref={fileInputRef}
                        id="fileUpload"
                        type="file"
                        accept=".pdf,.docx,.jpg,.jpeg,.png"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      {!uploadFile ? (
                        <div className="space-y-3">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <Upload className="w-8 h-8 text-green-600" />
                          </div>
                          <div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              className="hover:bg-green-50"
                            >
                              Pilih File
                            </Button>
                            <p className="text-sm text-gray-500 mt-2">
                              atau drag & drop file di sini
                            </p>
                          </div>
                          <p className="text-xs text-gray-400">
                            Format: PDF, DOCX, JPG, PNG (Max: 5MB)
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {uploadPreview && (
                            <div className="mb-4">
                              <img 
                                src={uploadPreview} 
                                alt="Preview" 
                                className="max-h-48 mx-auto rounded-lg shadow-md"
                              />
                            </div>
                          )}
                          
                          <div className="bg-green-50 p-4 rounded-lg">
                            <div className="flex items-center gap-3">
                              {getFileIcon(uploadFile.type)}
                              <div className="text-left flex-1">
                                <p className="font-medium text-gray-900">{uploadFile.name}</p>
                                <p className="text-sm text-gray-600">
                                  {formatFileSize(uploadFile.size)}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setUploadFile(null);
                                  setUploadPreview('');
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Ganti File
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="jadwal">Pilih Jadwal Kegiatan (Opsional)</Label>
                      <Select value={selectedJadwalId} onValueChange={setSelectedJadwalId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih jadwal kegiatan yang terhubung" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {activeJadwals.length === 0 ? (
                            <SelectItem value="none" disabled>Tidak ada jadwal aktif</SelectItem>
                          ) : (
                            activeJadwals.map(jadwal => (
                              <SelectItem key={jadwal.id} value={jadwal.id}>
                                {jadwal.judul} ({jadwal.tanggal})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Jika Anda memilih jadwal, informasi undangan akan disinkronisasi ke jadwal tersebut.
                      </p>
                    </div>
                  </div>

                  {message.text && (
                    <Alert className={`${message.type === 'error' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'} border-2`}>
                      <AlertDescription className={`${message.type === 'error' ? 'text-red-700' : 'text-green-700'} font-medium`}>
                        {message.type === 'success' ? '✅ ' : '❌ '}
                        {message.text}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsUploadDialogOpen(false)}
                    >
                      Batal
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting || !uploadFile}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Mengunggah...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload File
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-400/20 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Mail className="w-6 h-6 text-orange-600" />
              </div>
              <Badge variant="outline" className="text-orange-600 border-orange-200">Total</Badge>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total Undangan</h3>
            <p className="text-4xl font-bold text-gray-900 mb-2">{undanganList.length}</p>
            <p className="text-xs text-gray-500">Semua undangan yang dibuat</p>
            <div className="mt-4 flex items-center gap-2 text-orange-600">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium">Dokumen resmi</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
              <Badge variant="outline" className="text-amber-600 border-amber-200">Bulan Ini</Badge>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Bulan Ini</h3>
            <p className="text-4xl font-bold text-gray-900 mb-2">{thisMonthCount}</p>
            <p className="text-xs text-gray-500">Undangan bulan ini</p>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-amber-500 to-amber-600 h-2 rounded-full transition-all duration-500" 
                style={{width: `${Math.min((thisMonthCount / 10) * 100, 100)}%`}}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <Badge variant="outline" className="text-blue-600 border-blue-200">Saya</Badge>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Oleh Saya</h3>
            <p className="text-4xl font-bold text-gray-900 mb-2">{myUndanganCount}</p>
            <p className="text-xs text-gray-500">Undangan yang saya buat</p>
            <div className="mt-4 flex items-center gap-2 text-blue-600">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Kontribusi saya</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <Badge className="bg-white/20 text-white border-0">Upload</Badge>
            </div>
            <h3 className="text-sm font-medium text-white/80 mb-1">File Upload</h3>
            <p className="text-4xl font-bold mb-2">{uploadedFilesCount}</p>
            <p className="text-xs text-white/70">File undangan eksternal</p>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-xs font-medium text-white/90">File terunggah</span>
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
            <DialogTitle className="text-2xl">Preview {previewUndangan?.isUploadedFile ? 'File Upload' : 'Surat Undangan'}</DialogTitle>
            <DialogDescription>Preview dokumen sebelum diunduh</DialogDescription>
          </DialogHeader>
          {previewUndangan && (
            <>
              {previewUndangan.isUploadedFile ? (
                <div className="border-2 rounded-xl bg-white shadow-inner overflow-hidden">
                  {/* Header Info File */}
                  <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-b">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center">
                        {getFileIcon(previewUndangan.uploadedFileType || '')}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900">{previewUndangan.perihal}</h3>
                        <p className="text-sm text-gray-600 mt-1">{previewUndangan.uploadedFileName}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Ukuran: {formatFileSize(previewUndangan.uploadedFileSize || 0)}</span>
                          <span>•</span>
                          <span>Upload: {new Date(previewUndangan.createdAt).toLocaleDateString('id-ID')}</span>
                          <span>•</span>
                          <span>Oleh: {previewUndangan.namaUser}</span>
                        </div>
                      </div>
                    </div>
                    
                    {previewUndangan.kepada && previewUndangan.kepada !== 'File undangan eksternal' && (
                      <div className="mt-4 bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600 font-medium mb-1">Deskripsi:</p>
                        <p className="text-sm text-gray-900">{previewUndangan.kepada}</p>
                      </div>
                    )}
                  </div>

                  {/* Preview Area */}
                  <div className="p-6">
                    {previewUndangan.uploadedFileType === 'application/pdf' ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">Preview PDF</p>
                          <Badge className="bg-red-100 text-red-700 border-red-200">
                            <FileText className="w-3 h-3 mr-1" />
                            PDF Document
                          </Badge>
                        </div>
                        
                        {/* PDF Preview dengan iframe */}
                        <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                          <iframe
                            src={previewUndangan.uploadedFileData}
                            className="w-full h-[600px]"
                            title="PDF Preview"
                          />
                        </div>
                        
                        <p className="text-xs text-gray-500 text-center mt-2">
                          Jika preview tidak muncul, klik tombol Download untuk membuka file
                        </p>
                      </div>
                    ) : previewUndangan.uploadedFileType?.includes('word') || previewUndangan.uploadedFileType?.includes('document') ? (
                      <div className="text-center space-y-4 py-8">
                        <div className="w-24 h-24 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
                          <FileType className="w-12 h-12 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 mb-1">Dokumen Word</p>
                          <p className="text-sm text-gray-600">Preview dokumen Word tidak tersedia di browser</p>
                          <p className="text-xs text-gray-500 mt-2">Klik tombol Download untuk membuka file</p>
                        </div>
                      </div>
                    ) : previewUndangan.uploadedFileType?.startsWith('image/') ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">Preview Gambar</p>
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            <FileImage className="w-3 h-3 mr-1" />
                            Image File
                          </Badge>
                        </div>
                        
                        <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50 p-4">
                          <img 
                            src={previewUndangan.uploadedFileData} 
                            alt="Preview" 
                            className="max-w-full max-h-[600px] mx-auto rounded-lg shadow-lg"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-4 py-8">
                        <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                          <File className="w-12 h-12 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 mb-1">Preview Tidak Tersedia</p>
                          <p className="text-sm text-gray-600">Format file ini tidak dapat di-preview di browser</p>
                          <p className="text-xs text-gray-500 mt-2">Klik tombol Download untuk membuka file</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                
                <div className="border-2 rounded-xl p-8 bg-white shadow-inner" style={{ fontFamily: 'Times New Roman, serif', minHeight: '600px' }}>
                  <div className="text-left border-b-2 border-black pb-6 mb-8">
                    <img 
                      src="/Kop Undangan.png" 
                      alt="Kop Undangan" 
                      style={{ maxHeight: '80px', marginBottom: '10px' }}
                    />
                  </div>

                  <div className="text-sm mb-6">
                    <div className="text-right mb-4">
                      {previewUndangan.tempat}, {new Date(previewUndangan.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div className="space-y-1">
                      <div className="flex">
                        <span className="w-24">Nomor</span>
                        <span>: {previewUndangan.nomorSurat}</span>
                      </div>
                      <div className="flex">
                        <span className="w-24">Sifat</span>
                        <span>: {previewUndangan.sifat}</span>
                      </div>
                      <div className="flex">
                        <span className="w-24">Lampiran</span>
                        <span>: {previewUndangan.lampiran || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="w-24">Hal</span>
                        <span>: {previewUndangan.perihal}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm mb-6">
                    <p>Yth. {previewUndangan.kepada}</p>
                  </div>

                  <div className="text-sm text-justify mb-8 leading-relaxed">
                    <p className="mb-4">{previewUndangan.isiSurat}</p>
                    
                    <div className="ml-8 space-y-1 mb-4">
                      <div className="flex">
                        <span className="w-32">hari/tanggal</span>
                        <span>: {previewUndangan.hariTanggalWaktu.split(',')[0]}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32">waktu</span>
                        <span>: {previewUndangan.hariTanggalWaktu.split(',').slice(1).join(',')}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32">tempat</span>
                        <span>: {previewUndangan.tempatKegiatan.split('\n')[0]}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32">alamat</span>
                        <span>: {previewUndangan.tempatKegiatan.split('\n')[1]}</span>
                      </div>
                    </div>

                    <p>{previewUndangan.isiPenutup || 'Demikian atas perhatian dan kehadiran Saudara disampaikan terima kasih.'}</p>
                  </div>

                  <div className="flex justify-end mt-16">
                    <div className="text-center w-64 text-sm">
                      <p className="mb-2">{previewUndangan.jabatanPenandatangan}</p>
                      
                      <div className="mb-4 min-h-16 flex items-center justify-center">
                        {previewUndangan.tandaTangan && (
                          <img 
                            src={previewUndangan.tandaTangan} 
                            alt="TTD" 
                            style={{ maxHeight: '50px', maxWidth: '120px' }}
                          />
                        )}
                      </div>
                      
                      <div className="border-t border-black pt-2">
                        <p className="font-bold">{previewUndangan.namaUser}</p>
                        <p>{previewUndangan.nip || 'NIP. -'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Tutup
            </Button>
            {previewUndangan && (
              <Button onClick={() => handleDownloadUploadedFile(previewUndangan)}>
                <Download className="w-4 h-4 mr-2" />
                Download File
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Undangan List */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                Daftar Undangan
              </CardTitle>
              <CardDescription className="text-xs mt-2">
                Kelola semua surat undangan yang telah dibuat
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {undanganList.length} dokumen
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {undanganList.length > 0 ? (
            <div className="space-y-4">
              {undanganList.map((undangan) => (
                <div 
                  key={undangan.id} 
                  className={`group relative overflow-hidden p-5 border-2 rounded-xl hover:shadow-md transition-all duration-300 ${
                    undangan.isUploadedFile 
                      ? 'bg-gradient-to-r from-white to-green-50/30 hover:border-green-400' 
                      : 'bg-gradient-to-r from-white to-orange-50/30 hover:border-orange-400'
                  }`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500 ${
                    undangan.isUploadedFile ? 'bg-green-400/5' : 'bg-orange-400/5'
                  }`} />
                  
                  <div className="relative flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          undangan.isUploadedFile ? 'bg-green-100' : 'bg-orange-100'
                        }`}>
                          {undangan.isUploadedFile ? (
                            getFileIcon(undangan.uploadedFileType || '')
                          ) : (
                            <Mail className="w-5 h-5 text-orange-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-semibold text-gray-900 text-lg transition-colors ${
                              undangan.isUploadedFile ? 'group-hover:text-green-600' : 'group-hover:text-orange-600'
                            }`}>
                              {undangan.perihal}
                            </h3>
                            {undangan.isUploadedFile && (
                              <Badge className="bg-green-100 text-green-700 border-green-200">
                                <Upload className="w-3 h-3 mr-1" />
                                Upload
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${
                              undangan.sifat === 'Segera' ? 'border-red-300 text-red-700 bg-red-50' :
                              undangan.sifat === 'Penting' ? 'border-orange-300 text-orange-700 bg-orange-50' :
                              'border-gray-300 text-gray-700 bg-gray-50'
                            }`}>
                              {undangan.sifat}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`p-3 rounded-lg mb-3 border ${
                        undangan.isUploadedFile 
                          ? 'bg-green-50/50 border-green-100' 
                          : 'bg-orange-50/50 border-orange-100'
                      }`}>
                        <p className="text-sm text-gray-700 mb-1">
                          <strong className={undangan.isUploadedFile ? 'text-green-700' : 'text-orange-700'}>
                            {undangan.isUploadedFile ? 'File:' : 'Kepada:'}
                          </strong> {undangan.isUploadedFile ? undangan.uploadedFileName : undangan.kepada.split('\n')[0]}
                        </p>
                        {undangan.isUploadedFile && undangan.uploadedFileSize && (
                          <p className="text-xs text-gray-600">
                            Ukuran: {formatFileSize(undangan.uploadedFileSize)}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {undangan.nomorSurat}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(undangan.tanggal).toLocaleDateString('id-ID')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {undangan.namaUser}
                        </span>
                        {undangan.lampiran && !undangan.isUploadedFile && (
                          <span className="flex items-center gap-1">
                            📎 {undangan.lampiran}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4 shrink-0 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(undangan)}
                        className="hover:bg-blue-50 hover:border-blue-400 transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadUploadedFile(undangan)}
                        className="hover:bg-green-50 hover:border-green-400 transition-colors"
                        title="Download File"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      {/* Broadcast button — admin only or owner, only for linked undangan */}
                      {(currentUser?.role === 'admin' || currentUser?.id === undangan.userId) && undangan.idKegiatan && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleBroadcast(undangan)}
                          disabled={isBroadcasting === undangan.id}
                          className="hover:bg-purple-50 hover:border-purple-400 text-purple-600 hover:text-purple-700 transition-colors"
                          title="Broadcast ke Peserta"
                        >
                          {isBroadcasting === undangan.id ? (
                            <Radio className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Radio className="w-4 h-4" />
                          )}
                          <span className="ml-1 text-xs hidden sm:inline">Broadcast</span>
                        </Button>
                      )}
                      {(currentUser?.id === undangan.userId || currentUser?.role === 'admin') && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(undangan.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-400 transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-12 h-12 text-orange-300" />
              </div>
              <p className="text-sm text-gray-400">Klik tombol "Upload Undangan" untuk memulai</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}