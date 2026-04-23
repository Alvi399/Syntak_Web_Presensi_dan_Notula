import React, { useState, useEffect } from 'react';
import { useDataSync } from '@/hooks/useDataSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie } from 'recharts';;
import { Users, Calendar, FileText, Activity, TrendingUp, Clock, BarChart3, RefreshCw, CheckCircle2, Edit3 } from 'lucide-react';;
import { authService, type ActivityLog } from '@/lib/authService';
import { dataService } from '@/lib/dataService';
import EditProfileDialog from '@/components/EditProfileDialog';
import { User as UserType } from '@/lib/authService';

interface PresensiStats {
  totalToday: number;
  totalThisMonth: number;
  todayByActivity: Record<string, number>;
  dailyByCategory: Array<{ date: string; Pegawai: number; Magang: number }>;
  monthlyByActivity: Array<{ activity: string; count: number }>;
}

interface NotulaStats {
  totalAll: number;
  totalToday: number;
  totalThisMonth: number;
  contributors: number;
}

// Helper function untuk mendapatkan data 5 bulan terakhir
const getLast5MonthsData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const currentDate = new Date();
  const result = [];
  
  for (let i = 4; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    result.push({
      month: months[date.getMonth()],
      year: date.getFullYear(),
      monthIndex: date.getMonth(),
      yearMonth: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    });
  }
  
  return result;
};

export default function Dashboard() {
  const [absensiStats, setAbsensiStats] = useState<PresensiStats>({
    totalToday: 0,
    totalThisMonth: 0,
    todayByActivity: {},
    dailyByCategory: [],
    monthlyByActivity: []
  });
  const [notulensiStats, setNotulensiStats] = useState<NotulaStats>({
    totalAll: 0,
    totalToday: 0,
    totalThisMonth: 0,
    contributors: 0
  });
  const [monthlyActivityData, setMonthlyActivityData] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [attendancePercentage, setAttendancePercentage] = useState(0);
  const [currentUser, setCurrentUser] = useState<UserType | null>(authService.getCurrentUser());
  const [totalNonAdminUsers, setTotalNonAdminUsers] = useState(0);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useDataSync(['all'], loadDashboardData);

  async function loadDashboardData() {
    try {
      // Load all data with async/await
      const [absensi, notulensi, activities, dailyByCategory, monthlyByActivity] = await Promise.all([
        dataService.getAbsensiStats(),
        dataService.getNotulensiStats(),
        authService.getActivities(),
        dataService.getDailyAbsensiByCategory(),
        dataService.getMonthlyAbsensiByActivity()
      ]);

      // Filter activities based on user role
      let filteredActivities = activities;
      if (currentUser?.role !== 'admin') {
        filteredActivities = activities.filter(a => a.userId === currentUser?.id);
      }
      filteredActivities = filteredActivities.slice(0, 5);

      setAbsensiStats({
        ...absensi,
        dailyByCategory,
        monthlyByActivity
      });
      setNotulensiStats(notulensi);
      
      // Generate charts data
      await generateTodayAttendanceData();
      await generateMonthlyActivityData();
      await calculateAttendancePercentage();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  async function generateTodayAttendanceData() {
    const todayAbsensi = await dataService.getAbsensiTodayNonGuest();
    const users = await authService.getAllUsersForAdmin();
    
    const pegawaiCount = todayAbsensi.filter(item => {
      const user = users.find(u => u.id === item.userId);
      return user?.kategori === 'Pegawai';
    }).length;
    
    const magangCount = todayAbsensi.filter(item => {
      const user = users.find(u => u.id === item.userId);
      return user?.kategori === 'Magang';
    }).length;
    
    setTodayAttendance([
      { kategori: 'Pegawai', jumlah: pegawaiCount },
      { kategori: 'Magang', jumlah: magangCount }
    ]);
  }

  async function calculateAttendancePercentage() {
    const todayAbsensi = await dataService.getAbsensiTodayNonGuest();
    const allUsers = await authService.getAllUsersForAdmin();
    const nonAdminUsers = allUsers.filter(u => u.role !== 'admin');
    const totalUsers = nonAdminUsers.length;
    
    // Update total non-admin users  
    setTotalNonAdminUsers(totalUsers);
    
    if (totalUsers === 0) {
      setAttendancePercentage(0);
      return;
    }
    
    // Count unique users who attended today
    const uniqueAttendees = new Set(todayAbsensi.map(a => a.userId));
    const percentage = (uniqueAttendees.size / totalUsers) * 100;
    
    setAttendancePercentage(Math.round(percentage));
  }

  async function generateMonthlyActivityData() {
    const last5Months = getLast5MonthsData();
    const allAbsensi = await dataService.getAbsensiList();
    
    const activityTypes = ['senam', 'apel', 'rapat', 'sharing-knowledge', 'doa-bersama', 'rapelan'];
    const activityLabels: Record<string, string> = {
      'senam': 'Senam',
      'apel': 'Apel',
      'rapat': 'Rapat',
      'sharing-knowledge': 'Sharing Knowledge',
      'doa-bersama': 'Doa Bersama',
      'rapelan': 'Rapelan'
    };
    
    const monthlyData = last5Months.map(monthInfo => {
      const dataPoint: any = { 
        month: monthInfo.month,
        fullDate: `${monthInfo.month} ${monthInfo.year}`
      };
      
      activityTypes.forEach(activity => {
        const count = allAbsensi.filter(item => {
          if (item.isGuest) return false; // Exclude guests
          
          // Parse item date (format: YYYY-MM-DD)
          const [year, month, day] = item.tanggal.split('-').map(Number);
          const itemDate = new Date(year, month - 1, day);
          
          return item.jenisKegiatan === activity &&
                 itemDate.getMonth() === monthInfo.monthIndex &&
                 itemDate.getFullYear() === monthInfo.year;
        }).length;
        
        dataPoint[activityLabels[activity]] = count;
      });
      
      return dataPoint;
    });
    
    setMonthlyActivityData(monthlyData);
  }

  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      return `${hours}:${minutes}`;
    } catch {
      return timeString;
    }
  };

  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return '👋 Selamat Pagi';
    if (hour < 15) return '☀️ Selamat Siang';
    if (hour < 18) return '🌤️ Selamat Sore';
    return '🌙 Selamat Malam';
  };

  const activityColors: Record<string, string> = {
    'Senam': '#2563eb',
    'Apel': '#10b981',
    'Rapat': '#f59e0b',
    'Sharing Knowledge': '#06b6d4',
    'Doa Bersama': '#8b5cf6',
    'Rapelan': '#ef4444'
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />
        
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                  <Activity className="w-3 h-3 mr-1" />
                  {currentUser?.role === 'admin' ? 'Administrator' : currentUser?.kategori}
                </Badge>
              </div>
              <h1 className="text-4xl font-bold mb-2">
                {getCurrentGreeting()}, {currentUser?.nama}!
              </h1>
              {(currentUser as any)?.tim && (
                <div className="flex items-center gap-2 mb-1 text-white/95 font-medium">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Tim: {(currentUser as any).tim}
                </div>
              )}
              {(currentUser as any)?.jabatan && (
                <div className="flex items-center gap-2 mb-3 text-white/80 text-sm">
                  <span>🏷️</span>
                  {(currentUser as any).jabatan}
                </div>
              )}
              <p className="text-white/90 text-lg">
                {new Date().toLocaleDateString('id-ID', { 
                  weekday: 'long', 
                  day: 'numeric',
                  month: 'long', 
                  year: 'numeric' 
                })}
              </p>
            </div>
            
            <div className="flex flex-col gap-2">
              <Button 
                onClick={loadDashboardData} 
                variant="secondary"
                className="bg-white/20 border-0 text-white hover:bg-white/30 backdrop-blur-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
              </Button>
              <Button
                onClick={() => setIsEditProfileOpen(true)}
                variant="secondary"
                className="bg-white/20 border-0 text-white hover:bg-white/30 backdrop-blur-sm"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Profil
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Absensi Hari Ini */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                Hari Ini
              </Badge>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Presensi Hari Ini</h3>
            <p className="text-4xl font-bold text-gray-900 mb-2">{absensiStats.totalToday || 0}</p>
            <p className="text-xs text-gray-500">
              Pegawai & magang (tidak termasuk tamu)
            </p>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500" 
                style={{width: `${Math.min((absensiStats.totalToday / 50) * 100, 100)}%`}}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Absensi Bulan Ini */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <Badge variant="outline" className="text-green-600 border-green-200">
                Bulan Ini
              </Badge>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Absensi Bulan Ini</h3>
            <p className="text-4xl font-bold text-gray-900 mb-2">{absensiStats.totalThisMonth || 0}</p>
            <p className="text-xs text-gray-500">
              Total absensi bulan ini
            </p>
            <div className="mt-4 flex items-center gap-2 text-green-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Data terupdate</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Notulensi Bulan Ini */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <Badge variant="outline" className="text-purple-600 border-purple-200">
                Notulensi
              </Badge>
            </div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">Notula Bulan Ini</h3>
            <p className="text-4xl font-bold text-gray-900 mb-2">{notulensiStats.totalThisMonth || 0}</p>
            <p className="text-xs text-gray-500">
              Notula bulan ini
            </p>
            <div className="mt-4 flex items-center gap-2 text-purple-600">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium">{notulensiStats.totalAll} total dokumen</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Total Kontributor */}
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-orange-500 to-red-600 text-white hover:shadow-xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <Badge className="bg-white/20 text-white border-0">
                Aktif
              </Badge>
            </div>
            <h3 className="text-sm font-medium text-white/80 mb-1">Total Kontributor</h3>
            <p className="text-4xl font-bold mb-2">{notulensiStats.contributors || 0}</p>
            <p className="text-xs text-white/70">
              Pengguna aktif notulensi
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-xs font-medium text-white/90">User aktif</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grafik Absensi Harian - BAR CHART */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Grafik Absensi Harian</CardTitle>
                <CardDescription className="text-xs">
                  Jumlah absensi Pegawai dan Magang hari ini
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {absensiStats.totalToday > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={todayAttendance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="kategori" 
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '14px', fontWeight: '500' }}
                    />
                    <Bar 
                      dataKey="jumlah" 
                      fill="#3b82f6" 
                      radius={[8, 8, 0, 0]}
                      name="Jumlah Orang"
                    />
                  </BarChart>
                </ResponsiveContainer>
                
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px]">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">Belum ada data absensi hari ini</p>
                <p className="text-sm text-gray-400 mt-1">Data akan muncul setelah ada absensi</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grafik Absensi Bulanan - LINE CHART */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Grafik Absensi Bulanan</CardTitle>
                <CardDescription className="text-xs">
                  Tren absensi per kegiatan (5 bulan terakhir)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {monthlyActivityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyActivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px', fontWeight: '500' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Senam" 
                    stroke={activityColors['Senam']}
                    strokeWidth={2}
                    dot={{ fill: activityColors['Senam'], r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Apel" 
                    stroke={activityColors['Apel']}
                    strokeWidth={2}
                    dot={{ fill: activityColors['Apel'], r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Rapat" 
                    stroke={activityColors['Rapat']}
                    strokeWidth={2}
                    dot={{ fill: activityColors['Rapat'], r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Doa Bersama" 
                    stroke={activityColors['Doa Bersama']}
                    strokeWidth={2}
                    dot={{ fill: activityColors['Doa Bersama'], r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Rapelan" 
                    stroke={activityColors['Rapelan']}
                    strokeWidth={2}
                    dot={{ fill: activityColors['Rapelan'], r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px]">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Activity className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">Belum ada data presensi bulanan</p>
                <p className="text-sm text-gray-400 mt-1">Data akan muncul setelah ada presensi</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance Visualization Today */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Visualisasi Kehadiran Hari Ini</CardTitle>
                <CardDescription className="text-xs">
                  Tingkat kehadiran dan breakdown per kegiatan tanggal {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              <Clock className="w-3 h-3 mr-1" />
              Real-time
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Pie Chart Tingkat Kehadiran */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-indigo-200">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-indigo-600" />
                <h4 className="font-semibold text-indigo-900">Tingkat Kehadiran Hari Ini</h4>
              </div>
              
              {absensiStats.totalToday > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Hadir', value: attendancePercentage, fill: '#10b981' },
                          { name: 'Tidak Hadir', value: 100 - attendancePercentage, fill: '#ef4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ value }) => `${value}%`}
                        labelLine={false}
                      >
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700">Hadir</span>
                      </div>
                      <span className="text-lg font-bold text-green-600">{attendancePercentage}%</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-red-200">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700">Tidak Hadir</span>
                      </div>
                      <span className="text-lg font-bold text-red-600">{100 - attendancePercentage}%</span>
                    </div>

                    <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <div className="text-xs text-gray-600 mb-1">Total Kehadiran Hari Ini</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {absensiStats.totalToday} orang
                      </div>
                      <div className="text-xs text-gray-500 mt-1">dari total {totalNonAdminUsers} user aktif</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[250px]">
                  <Users className="w-16 h-16 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-500">Belum ada yang absen hari ini</p>
                  <p className="text-xs text-gray-400 mt-1">Data akan muncul setelah ada absensi</p>
                </div>
              )}
            </div>

            {/* Right Column - Breakdown Absensi per Kegiatan Hari Ini */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900">Breakdown Absensi per Kegiatan</h4>
              </div>
              
              {absensiStats.todayByActivity && Object.keys(absensiStats.todayByActivity).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(absensiStats.todayByActivity).map(([activity, count]) => {
                    const activityConfig: Record<string, { label: string; color: string; icon: string; bgColor: string; borderColor: string }> = {
                      'senam': { 
                        label: 'Senam Pagi', 
                        color: 'text-blue-700', 
                        icon: '🏃‍♂️',
                        bgColor: 'bg-blue-50',
                        borderColor: 'border-blue-300'
                      },
                      'apel': { 
                        label: 'Apel Pagi', 
                        color: 'text-green-700', 
                        icon: '🎖️',
                        bgColor: 'bg-green-50',
                        borderColor: 'border-green-300'
                      },
                      'rapat': { 
                        label: 'Rapat', 
                        color: 'text-orange-700', 
                        icon: '💼',
                        bgColor: 'bg-orange-50',
                        borderColor: 'border-orange-300'
                      },
                      'sharing-knowledge': { 
                        label: 'Sharing Knowledge', 
                        color: 'text-cyan-700', 
                        icon: '🧠',
                        bgColor: 'bg-cyan-50',
                        borderColor: 'border-cyan-300'
                      },
                      'doa-bersama': { 
                        label: 'Doa Bersama', 
                        color: 'text-purple-700', 
                        icon: '🤲',
                        bgColor: 'bg-purple-50',
                        borderColor: 'border-purple-300'
                      },
                      'rapelan': { 
                        label: 'Rapelan', 
                        color: 'text-red-700', 
                        icon: '📋',
                        bgColor: 'bg-red-50',
                        borderColor: 'border-red-300'
                      }
                    };

                    const config = activityConfig[activity] || { 
                      label: activity, 
                      color: 'text-gray-700', 
                      icon: '📌',
                      bgColor: 'bg-gray-50',
                      borderColor: 'border-gray-300'
                    };

                    return (
                      <div 
                        key={activity} 
                        className={`flex items-center justify-between p-4 ${config.bgColor} border-2 ${config.borderColor} rounded-lg hover:shadow-md transition-shadow`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{config.icon}</div>
                          <div>
                            <div className={`font-semibold ${config.color}`}>
                              {config.label}
                            </div>
                            <div className="text-xs text-gray-500">
                              {count} orang hadir
                            </div>
                          </div>
                        </div>
                        <div className={`text-3xl font-bold ${config.color}`}>
                          {count}
                        </div>
                      </div>
                    );
                  })}

                  {/* Summary Card */}
                  <div className="mt-4 p-4 bg-gradient-to-r from-indigo-100 to-blue-100 border-2 border-indigo-300 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-indigo-700" />
                        <span className="font-semibold text-indigo-900">Total Absensi Hari Ini</span>
                      </div>
                      <span className="text-3xl font-bold text-indigo-700">
                        {Object.values(absensiStats.todayByActivity).reduce((sum, count) => sum + count, 0)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-indigo-600">
                      {Object.keys(absensiStats.todayByActivity).length} jenis kegiatan tercatat
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[250px]">
                  <Activity className="w-16 h-16 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-500">Belum ada absensi per kegiatan</p>
                  <p className="text-xs text-gray-400 mt-1">Data akan muncul setelah ada absensi</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      {currentUser && (
        <EditProfileDialog
          open={isEditProfileOpen}
          onOpenChange={setIsEditProfileOpen}
          currentUser={currentUser}
          onProfileUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        />
      )}
    </div>
  );
}