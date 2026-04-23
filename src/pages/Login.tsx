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
    kategori: '' as 'Pegawai' | 'Magang' | '',
    tim: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);
  
  // OTP states
  const [otpStep, setOtpStep] = useState<'email' | 'otp' | 'complete'>('email');
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      console.log('Login attempt for:', loginData.email);
      const result = await authService.login(loginData.email, loginData.password);
      console.log('Login result:', result);

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

  const handleSendOtp = async () => {
    if (!registerData.email) {
      setMessage({ type: 'error', text: 'Silakan masukkan email terlebih dahulu' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await authService.sendOtp(registerData.email);
      
      if (result.success) {
        setMessage({ type: 'success', text: 'OTP telah dikirim ke email Anda' });
        setOtpStep('otp');
        setCountdown(300); // 5 minutes
        startCountdown();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat mengirim OTP' });
    } finally {
      setIsLoading(false);
    }
  };

  const startCountdown = () => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setMessage({ type: 'error', text: 'Silakan masukkan 6 digit OTP' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await authService.verifyOtp(registerData.email, otp);
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Email terverifikasi! Lanjutkan registrasi.' });
        setIsEmailVerified(true);
        setOtpStep('complete');
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan saat verifikasi OTP' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    
    setOtp('');
    await handleSendOtp();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    if (!isEmailVerified) {
      setMessage({ type: 'error', text: 'Silakan verifikasi email terlebih dahulu' });
      setIsLoading(false);
      return;
    }

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
      console.log('Register attempt for:', registerData.email);
      const result = await authService.register(
        registerData.nama,
        registerData.email,
        registerData.password,
        registerData.kategori as 'Pegawai' | 'Magang',
        registerData.tim,
        otp
      );
      console.log('Register result:', result);

      if (result.success) {
        setMessage({ type: 'success', text: 'Registrasi berhasil! Sedang masuk ke akun Anda...' });
        
        // Auto-login setelah register berhasil
        try {
          const loginResult = await authService.login(registerData.email, registerData.password);
          if (loginResult.success) {
            setTimeout(() => {
              onLoginSuccess();
            }, 1000);
          } else {
            // Jika auto-login gagal, redirect ke tab login dengan pesan
            setMessage({ type: 'success', text: 'Registrasi berhasil! Silakan login dengan akun Anda.' });
            resetForm();
          }
        } catch {
          setMessage({ type: 'success', text: 'Registrasi berhasil! Silakan login dengan akun Anda.' });
          resetForm();
        }
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem' });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setRegisterData({
      nama: '',
      email: '',
      password: '',
      confirmPassword: '',
      kategori: '',
      tim: ''
    });
    setOtp('');
    setOtpStep('email');
    setIsEmailVerified(false);
    setCountdown(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
            <TabsTrigger value="register" onClick={resetForm}>Daftar</TabsTrigger>
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
                  {otpStep === 'email' && 'Masukkan email untuk verifikasi'}
                  {otpStep === 'otp' && 'Masukkan kode OTP yang dikirim ke email'}
                  {otpStep === 'complete' && 'Isi data diri untuk menyelesaikan registrasi'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Step 1 - Email */}
                <div style={{ display: otpStep === 'email' ? undefined : 'none' }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="nama@email.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      autoComplete="off"
                      tabIndex={otpStep !== 'email' ? -1 : undefined}
                    />
                  </div>
                  <Button
                    onClick={handleSendOtp}
                    className="w-full"
                    disabled={isLoading || !registerData.email}
                    tabIndex={otpStep !== 'email' ? -1 : undefined}
                  >
                    {isLoading ? 'Mengirim...' : 'Kirim Kode OTP'}
                  </Button>
                </div>

                {/* Step 2 - OTP (selalu di DOM, hanya hidden) */}
                <div style={{ display: otpStep === 'otp' ? undefined : 'none' }} className="space-y-4">
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600">
                      Kode OTP telah dikirim ke <span className="font-semibold">{registerData.email}</span>
                    </p>
                    {countdown > 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        Kirim ulang dalam {formatTime(countdown)}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-center gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={otp[index] || ''}
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                        tabIndex={otpStep !== 'otp' ? -1 : undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!/^[0-9]?$/.test(val)) return;
                          const arr = otp.split('');
                          arr[index] = val;
                          setOtp(arr.join(''));
                          if (val && index < 5) {
                            const next = document.getElementById(`otp-input-${index + 1}`);
                            next?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !otp[index] && index > 0) {
                            const prev = document.getElementById(`otp-input-${index - 1}`);
                            prev?.focus();
                          }
                        }}
                        onPaste={index === 0 ? (e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData('text').slice(0, 6).replace(/[^0-9]/g, '');
                          if (pasted) {
                            setOtp(pasted);
                            const last = document.getElementById(`otp-input-${Math.min(pasted.length, 5)}`);
                            last?.focus();
                          }
                        } : undefined}
                        id={`otp-input-${index}`}
                        className="w-10 h-12 text-center text-lg font-bold border-2 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white"
                      />
                    ))}
                  </div>

                  <Button
                    onClick={handleVerifyOtp}
                    className="w-full"
                    disabled={isLoading || otp.length !== 6}
                    tabIndex={otpStep !== 'otp' ? -1 : undefined}
                  >
                    {isLoading ? 'Memverifikasi...' : 'Verifikasi OTP'}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={countdown > 0}
                      tabIndex={otpStep !== 'otp' ? -1 : undefined}
                      className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      Kirim ulang kode OTP
                    </button>
                  </div>
                </div>

                {/* Step 3 - Form Registrasi (selalu di DOM, hanya hidden) */}
                <div style={{ display: otpStep === 'complete' ? undefined : 'none' }}>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <Alert className="bg-green-50 border-green-500">
                      <AlertDescription className="text-green-700">
                        ✓ Email terverifikasi
                      </AlertDescription>
                    </Alert>

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
                      <Label htmlFor="reg-email-display">Email</Label>
                      <Input
                        id="reg-email-display"
                        type="email"
                        value={registerData.email}
                        disabled
                        className="bg-gray-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tim">Tim / Bagian</Label>
                      <Select 
                        onValueChange={(value) => setRegisterData({ ...registerData, tim: value })}
                        value={registerData.tim}
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
                </div>
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
