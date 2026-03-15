import { useState, useEffect } from 'react';
import { User, Edit3, Save, X, Briefcase, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User as UserType } from '@/lib/authService';
import { dataService } from '@/lib/dataService';
import { authService } from '@/lib/authService';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserType;
  onProfileUpdated: (updatedUser: UserType) => void;
}

export default function EditProfileDialog({
  open,
  onOpenChange,
  currentUser,
  onProfileUpdated,
}: EditProfileDialogProps) {
  const [nama, setNama] = useState('');
  const [tim, setTim] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });

  // Populate form when dialog opens
  useEffect(() => {
    if (open) {
      setNama(currentUser.nama || '');
      setTim((currentUser as any).tim || '');
      setJabatan((currentUser as any).jabatan || '');
      setMessage({ type: '', text: '' });
    }
  }, [open, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      setMessage({ type: 'error', text: 'Nama tidak boleh kosong.' });
      return;
    }

    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await dataService.updateProfile(currentUser.id, {
        nama: nama.trim(),
        tim: tim.trim() || undefined,
        jabatan: jabatan.trim() || undefined,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Profil berhasil diperbarui!' });
        // Refresh current user from storage
        const freshUser = authService.getCurrentUser();
        if (freshUser) {
          onProfileUpdated(freshUser);
        }
        setTimeout(() => onOpenChange(false), 1000);
      } else {
        setMessage({ type: 'error', text: result.message || 'Gagal memperbarui profil.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan. Silakan coba lagi.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Edit3 className="w-4 h-4 text-blue-600" />
            </div>
            Edit Profil
          </DialogTitle>
          <DialogDescription>
            Perbarui nama, tim, dan jabatan Anda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Nama */}
          <div className="space-y-2">
            <Label htmlFor="edit-nama" className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              Nama Lengkap
            </Label>
            <Input
              id="edit-nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Masukkan nama lengkap"
              required
            />
          </div>

          {/* Tim */}
          <div className="space-y-2">
            <Label htmlFor="edit-tim" className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              Tim / Bagian
            </Label>
            <Select value={tim} onValueChange={setTim}>
              <SelectTrigger id="edit-tim" className="w-full">
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
              </SelectContent>
            </Select>
          </div>

          {/* Jabatan */}
          <div className="space-y-2">
            <Label htmlFor="edit-jabatan" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-gray-500" />
              Jabatan
              {currentUser.kategori === 'Magang' && (
                <span className="text-xs text-gray-400">(default: Mahasiswa)</span>
              )}
            </Label>
            <Input
              id="edit-jabatan"
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              placeholder={currentUser.kategori === 'Magang' ? 'Mahasiswa' : 'Contoh: Analis Data, Staf IT, ...'}
            />
          </div>

          {/* Message */}
          {message.text && (
            <Alert className={`${message.type === 'error' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'} border-2`}>
              <AlertDescription className={`${message.type === 'error' ? 'text-red-700' : 'text-green-700'} font-medium text-sm`}>
                {message.type === 'success' ? '✅ ' : '❌ '}
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-1" />
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  Simpan
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
