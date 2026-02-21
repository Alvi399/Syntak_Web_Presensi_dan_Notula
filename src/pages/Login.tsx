import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authService } from '@/lib/authService';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    nama: '',
    email: '',
    password: '',
    confirmPassword: '',
    kategori: '' as 'Pegawai' | 'Magang' | ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // TAMBAHKAN AWAIT karena login() sekarang async
      const result = await authService.login(loginData.email, loginData.password);

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setTimeout(() => {
          onLoginSuccess();
        }, 1000);
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    // Validation
    if (registerData.password !== registerData.confirmPassword) {
      setMessage({ type: 'error', text: 'Password dan konfirmasi password tidak cocok' });
      setIsLoading(false);
      return;
    }

    if (!registerData.kategori) {
      setMessage({ type: 'error', text: 'Silakan pilih kategori' });
      setIsLoading(false);
      return;
    }

    try {
      // TAMBAHKAN AWAIT karena register() sekarang async
      const result = await authService.register(
        registerData.nama,
        registerData.email,
        registerData.password,
        registerData.kategori
      );

      if (result.success) {
        setMessage({ type: 'success', text: result.message + '. Silakan login dengan akun Anda.' });
        setRegisterData({
          nama: '',
          email: '',
          password: '',
          confirmPassword: '',
          kategori: ''
        });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-end bg-cover bg-center relative p-4"
      style={{ backgroundImage: "url('/latar-belakang.jpg')" }}
    >
      <img
        src="/logo-BPS.png"
        alt="Logo BPS Surabaya"
        className="absolute top-10 left-10 w-60 h-auto"
      />

      <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-xl shadow-lg p-6 mr-8 md:mr-16">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 whitespace-nowrap">
            Absensi dan Notulensi Digital
          </h1>
          <p className="text-lg font-semibold text-gray-900">BPS Kota Surabaya</p>
          <p className="text-gray-600">Masuk atau daftar untuk melanjutkan</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Masuk</TabsTrigger>
            <TabsTrigger value="register">Daftar</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Masuk ke Akun</CardTitle>
                <CardDescription>
                  Masukkan email dan password Anda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="nama@email.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Masukkan password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Memproses...' : 'Masuk'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Daftar Akun Baru</CardTitle>
                <CardDescription>
                  Isi data diri untuk membuat akun
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nama">Nama Lengkap</Label>
                    <Input
                      id="nama"
                      type="text"
                      placeholder="Masukkan nama lengkap"
                      value={registerData.nama}
                      onChange={(e) => setRegisterData({ ...registerData, nama: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="nama@email.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kategori">Kategori</Label>
                    <Select onValueChange={(value) => setRegisterData({ ...registerData, kategori: value as 'Pegawai' | 'Magang' })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pegawai">Pegawai</SelectItem>
                        <SelectItem value="Magang">Magang</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="Masukkan password"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Konfirmasi Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Ulangi password"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Memproses...' : 'Daftar'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {message.text && (
          <Alert className={`mt-4 ${message.type === 'error' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
            <AlertDescription className={message.type === 'error' ? 'text-red-700' : 'text-green-700'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}