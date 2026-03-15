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
import { FileText, Plus, Edit, Trash2, Download, Camera, Users, Calendar, TrendingUp, Eye, PenTool, BookOpen, Send, Check } from 'lucide-react';
import { authService, type User } from '@/lib/authService';
import { dataService, type NotulensiRecord } from '@/lib/dataService';
import { toast } from 'sonner';

type JenisNotula = 'rapat' | 'doa' | 'rapelan' | 'sharing-knowledge' | 'lainnya';

export default function Notula() {
  const [notulensiList, setNotulensiList] = useState<NotulensiRecord[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewNotulensi, setPreviewNotulensi] = useState<NotulensiRecord | null>(null);
  const [editingNotulensi, setEditingNotulensi] = useState<NotulensiRecord | null>(null);
  const [formData, setFormData] = useState({
    judul: '',
    jenisKegiatan: '' as JenisNotula | '',
    idKegiatan: '',
    hari: '',
    jam: '',
    tempat: '',
    agenda: '',
    ringkasan: '',
    diskusi: '',
    kesimpulan: '',
    tanya_jawab: '',
    isi: '',
    foto: '',
    signature: '',
    pemandu: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentUser = authService.getCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [activeJadwal, setActiveJadwal] = useState<any[]>([]);
  
  const jenisKegiatan = [
    { value: 'rapat' as JenisNotula, label: 'Rapat', icon: '💼' },
    { value: 'sharing-knowledge' as JenisNotula, label: 'Sharing Knowledge', icon: '🧠' },
    { value: 'rapelan' as JenisNotula, label: 'Rapelan', icon: '📋' },
    { value: 'doa' as JenisNotula, label: 'Doa Bersama', icon: '🤲' },
    { value: 'lainnya' as JenisNotula, label: 'Lainnya', icon: '📝' }
  ];

  useEffect(() => {
    loadNotulensi();
    loadActiveJadwal();
  }, []);

  useEffect(() => {
    if (isDialogOpen && canvasRef.current) {
        // Redraw signature if editing
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx && formData.signature) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = formData.signature;
        }
    }
  }, [isDialogOpen, formData.signature]);

  const loadNotulensi = async () => {
    const data = await dataService.getNotulensiList();
    setNotulensiList(data);
  };

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

  const handleOpenDialog = () => {
    // Determine default values based on active schedules
    let defaultJudul = '';
    let defaultJenis = '' as JenisNotula | '';
    let defaultIdKegiatan = '';

    if (activeJadwal && activeJadwal.length > 0) {
      // Pick the first active schedule that is currently 'open' or at least the first one
      const currentActive = activeJadwal.find(j => j.absen_state === 'open') || activeJadwal[0];
      if (currentActive) {
        defaultJudul = currentActive.judul;
        defaultIdKegiatan = currentActive.id;
        
        // Map jenis kegiatans
        if (currentActive.jenisKegiatan === 'doa-bersama') defaultJenis = 'doa' as JenisNotula;
        else if (currentActive.jenisKegiatan === 'rapat') defaultJenis = 'rapat' as JenisNotula;
        else if (currentActive.jenisKegiatan === 'sharing-knowledge') defaultJenis = 'sharing-knowledge' as JenisNotula;
        else defaultJenis = 'lainnya' as JenisNotula;
      }
    }

    setFormData({
      judul: defaultJudul, jenisKegiatan: defaultJenis, idKegiatan: defaultIdKegiatan, hari: '', jam: '',
      tempat: '', agenda: '', ringkasan: '', diskusi: '',
      kesimpulan: '', tanya_jawab: '', isi: '', foto: '',
      signature: '', pemandu: ''
    });
    setEditingNotulensi(null);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      judul: '', jenisKegiatan: '', idKegiatan: '', hari: '', jam: '',
      tempat: '', agenda: '', ringkasan: '', diskusi: '',
      kesimpulan: '', tanya_jawab: '', isi: '', foto: '',
      signature: '', pemandu: ''
    });
    setEditingNotulensi(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let success;
      if (editingNotulensi) {
        success = await dataService.updateNotulensi(editingNotulensi.id, formData);
      } else {
        success = await dataService.saveNotulensi(formData);
      }

      if (success) {
        toast.success(editingNotulensi ? 'Notula diperbarui' : 'Notula disimpan');
        setIsDialogOpen(false);
        resetForm();
        loadNotulensi();
      } else {
        toast.error('Gagal menyimpan notula');
      }
    } catch (error) {
      toast.error('Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBroadcast = async (id: string) => {
    if (!window.confirm('Kirim notula ini ke semua peserta yang hadir via email?')) return;
    setIsBroadcasting(true);
    try {
      const result = await dataService.broadcastNotulensi(id);
      if (result.success) {
        toast.success('Broadcast berhasil! Email telah dikirim.');
      } else {
        toast.error(result.message || 'Gagal broadcast');
      }
    } catch (error) {
      toast.error('Gagal broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus notula ini?')) return;
    const success = await dataService.deleteNotulensi(id);
    if (success) {
      toast.success('Notula dihapus');
      loadNotulensi();
    }
  };

  const handleDownloadPDF = (notula: NotulensiRecord) => {
    const html = generatePDF(notula);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  const generatePDF = (n: NotulensiRecord) => {
    return `
      <html>
        <head>
          <title>${n.judul}</title>
          <style>
            @page { size: A4; margin: 2cm; }
            body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .content { text-align: justify; }
            .section { margin-top: 15px; font-weight: bold; border-bottom: 1px solid #ccc; }
            .info-table { width: 100%; margin-bottom: 20px; }
            .info-table td { padding: 4px 0; }
            .info-table td:first-child { width: 150px; }
            .footer { margin-top: 50px; float: right; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>BADAN PUSAT STATISTIK KOTA SURABAYA</h3>
            <h2>NOTULA KEGIATAN</h2>
          </div>
          <table class="info-table">
            <tr><td>Judul</td><td>: ${n.judul}</td></tr>
            <tr><td>Kegiatan</td><td>: ${n.jenisKegiatan.toUpperCase()}</td></tr>
            <tr><td>Tanggal</td><td>: ${n.tanggal}</td></tr>
            <tr><td>Tempat</td><td>: ${n.tempat || '-'}</td></tr>
            <tr><td>Notulis</td><td>: ${n.namaUser}</td></tr>
          </table>
          
          <div class="content">
            <div class="section">RINGKASAN</div>
            <p>${n.ringkasan || n.isi || '-'}</p>
            
            <div class="section">DISKUSI</div>
            <p>${n.diskusi || '-'}</p>
            
            <div class="section">KESIMPULAN / TINDAK LANJUT</div>
            <p>${n.kesimpulan || '-'}</p>
            
            <div class="section">TANYA JAWAB</div>
            <p>${n.tanya_jawab || '-'}</p>
            ${n.foto ? `
            <div class="section">DOKUMENTASI</div>
            <div style="text-align: center; margin-top: 10px;">
              <img src="${n.foto}" style="max-width: 100%; max-height: 400px; object-fit: contain;" alt="Dokumentasi Kegiatan" />
            </div>` : ''}
          </div>
          
          <div class="footer">
            <p>Surabaya, ${n.tanggal}</p>
            <p>Notulis,</p>
            <br/><br/>
            <p><strong>${n.namaUser}</strong></p>
          </div>
        </body>
      </html>
    `;
  };

  const filteredList = notulensiList.filter(n => 
    n.judul.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (dateFilter === '' || n.tanggal === dateFilter)
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-8 text-white shadow-xl flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Notula Digital</h1>
          <p className="text-emerald-100">Dokumentasi hasil rapat dan kegiatan</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog} className="bg-white text-emerald-700 hover:bg-emerald-50 font-bold">
              <Plus className="w-4 h-4 mr-2" /> Buat Notula
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Form Notula</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Judul Notula</Label>
                  {activeJadwal && activeJadwal.length > 0 ? (
                    <div className="space-y-2">
                      <Select 
                        onValueChange={v => {
                          if (v === 'lainnya') {
                            setFormData({...formData, judul: '', idKegiatan: ''});
                          } else {
                            const selected = activeJadwal.find(j => j.id === v);
                            if (selected) {
                              let defaultJenis = '' as JenisNotula | '';
                              if (selected.jenisKegiatan === 'doa-bersama') defaultJenis = 'doa' as JenisNotula;
                              else if (selected.jenisKegiatan === 'rapat') defaultJenis = 'rapat' as JenisNotula;
                              else if (selected.jenisKegiatan === 'sharing-knowledge') defaultJenis = 'sharing-knowledge' as JenisNotula;
                              else defaultJenis = 'lainnya' as JenisNotula;

                              setFormData({
                                ...formData, 
                                judul: selected.judul, 
                                idKegiatan: selected.id,
                                jenisKegiatan: defaultJenis
                              });
                            }
                          }
                        }} 
                        value={formData.judul === '' ? '' : formData.idKegiatan || 'lainnya'}
                      >
                        <SelectTrigger><SelectValue placeholder="Pilih Kegiatan Aktif" /></SelectTrigger>
                        <SelectContent>
                          {activeJadwal.map(j => (
                            <SelectItem key={j.id} value={j.id}>{j.judul}</SelectItem>
                          ))}
                          <SelectItem value="lainnya">Lainnya (Tulis Manual)</SelectItem>
                        </SelectContent>
                      </Select>
                      {(!formData.idKegiatan || formData.idKegiatan === 'lainnya') && (
                        <Input 
                          placeholder="Tulis judul kegiatan..." 
                          value={formData.judul} 
                          onChange={e => setFormData({...formData, judul: e.target.value})} 
                          required 
                        />
                      )}
                    </div>
                  ) : (
                    <Input value={formData.judul} onChange={e => setFormData({...formData, judul: e.target.value})} required />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Jenis Kegiatan</Label>
                  <Select onValueChange={v => setFormData({...formData, jenisKegiatan: v as JenisNotula})} value={formData.jenisKegiatan}>
                    <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                    <SelectContent>
                      {jenisKegiatan.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Tempat</Label><Input value={formData.tempat} onChange={e => setFormData({...formData, tempat: e.target.value})} /></div>
                <div className="space-y-2"><Label>Pemandu/Moderator</Label><Input value={formData.pemandu} onChange={e => setFormData({...formData, pemandu: e.target.value})} /></div>
              </div>

              <div className="space-y-2"><Label>Ringkasan Pembahasan</Label><Textarea value={formData.ringkasan} onChange={e => setFormData({...formData, ringkasan: e.target.value})} rows={3} /></div>
              <div className="space-y-2"><Label>Diskusi / Masukan</Label><Textarea value={formData.diskusi} onChange={e => setFormData({...formData, diskusi: e.target.value})} rows={3} /></div>
              <div className="space-y-2"><Label>Tanya Jawab</Label><Textarea value={formData.tanya_jawab} onChange={e => setFormData({...formData, tanya_jawab: e.target.value})} rows={3} /></div>
              <div className="space-y-2"><Label>Kesimpulan & Tindak Lanjut</Label><Textarea value={formData.kesimpulan} onChange={e => setFormData({...formData, kesimpulan: e.target.value})} rows={3} required /></div>

              <div className="space-y-2">
                <Label>Dokumentasi (Foto)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                  {formData.foto ? (
                    <div className="relative inline-block">
                      <img src={formData.foto} alt="Preview Dokumentasi" className="max-h-48 rounded-md" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                        onClick={() => setFormData({ ...formData, foto: '' })}
                      >
                       <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <label className="cursor-pointer flex flex-col items-center justify-center gap-2">
                          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                            <Camera className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-emerald-600">Klik untuk unggah foto</span>
                          <span className="text-xs text-gray-500">Maks. ukuran 5MB</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 5 * 1024 * 1024) {
                                  toast.error('Ukuran foto maksimal 5MB');
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setFormData({ ...formData, foto: reader.result as string });
                                };
                                reader.readAsDataURL(file);
                              }
                            }} 
                          />
                       </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                <Button type="submit" className="bg-emerald-600" disabled={isSubmitting}>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Notula'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Input placeholder="Cari notula..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-48" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredList.map(n => (
          <Card key={n.id} className="hover:shadow-lg transition-shadow border-0 shadow-md">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <Badge variant="outline" className="mb-2 uppercase text-[10px]">{n.jenisKegiatan}</Badge>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => { setEditingNotulensi(n); setFormData({...n} as any); setIsDialogOpen(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => handleDelete(n.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardTitle className="text-lg line-clamp-1">{n.judul}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Calendar className="w-3 h-3"/> {n.tanggal}
                {n.foto && <span className="flex items-center gap-1 text-emerald-600 ml-2"><Camera className="w-3 h-3"/></span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 line-clamp-3 mb-4">{n.kesimpulan || n.isi}</p>
              <div className="flex gap-2">
                <Button className="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border-0" onClick={() => handleDownloadPDF(n)}>
                  <Download className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button className="flex-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-0" onClick={() => handleBroadcast(n.id)} disabled={isBroadcasting}>
                  <Send className="w-4 h-4 mr-2" /> Broadcast
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}