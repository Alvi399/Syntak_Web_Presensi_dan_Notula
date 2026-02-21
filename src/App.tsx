import React, { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Calendar, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Shield,
  Mail
} from 'lucide-react';
import { authService, type User} from '@/lib/authService';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Absensi from '@/pages/Absensi';
import Notulensi from '@/pages/Notulensi';
import AdminPanel from '@/pages/AdminPanel';
import Undangan from '@/pages/Undangan';
import AbsensiQR from '@/pages/AbsensiTamu';

type PageType = 'dashboard' | 'absensi' | 'notulensi' | 'admin' | 'undangan';

const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [qrMode, setQrMode] = useState<{ active: boolean; qrId: string }>({ active: false, qrId: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      const user = authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }

      // Check for QR code in URL hash
      const checkQRHash = () => {
        const hash = window.location.hash;
        const qrMatch = hash.match(/#\/absensi-qr\/(.+)/);
        
        if (qrMatch && qrMatch[1]) {
          setQrMode({ active: true, qrId: qrMatch[1] });
        } else {
          setQrMode({ active: false, qrId: '' });
        }
      };

      checkQRHash();
      window.addEventListener('hashchange', checkQRHash);
      
      setIsLoading(false);
      
      return () => window.removeEventListener('hashchange', checkQRHash);
    };

    initializeApp();
  }, []);

  const handleLoginSuccess = () => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setCurrentUser(null);
      setCurrentPage('dashboard');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const menuItems = [
    { id: 'dashboard' as PageType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'absensi' as PageType, label: 'Absensi', icon: Calendar },
    { id: 'notulensi' as PageType, label: 'Notulensi', icon: FileText },
    { id: 'undangan' as PageType, label: 'Undangan', icon: Mail },
  ];

  const adminMenuItems = [
    ...menuItems,
    { id: 'admin' as PageType, label: 'Panel Admin', icon: Shield },
  ];

  const currentMenuItems = currentUser?.role === 'admin' ? adminMenuItems : menuItems;

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'absensi':
        return <Absensi />;
      case 'notulensi':
        return <Notulensi />;
      case 'undangan':
        return <Undangan />;
      case 'admin':
        return currentUser?.role === 'admin' ? <AdminPanel /> : <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <TooltipProvider>
        <Toaster />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Memuat aplikasi...</p>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // QR Mode - No login required
  if (qrMode.active) {
    return (
      <TooltipProvider>
        <Toaster />
        <AbsensiQR qrId={qrMode.qrId} />
      </TooltipProvider>
    );
  }

  if (!currentUser) {
    return (
      <TooltipProvider>
        <Toaster />
        <Login onLoginSuccess={handleLoginSuccess} />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Toaster />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex">
        {/* Sidebar - FIXED, tidak scroll */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header Sidebar with Logo */}
            <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 px-6 py-6 flex-shrink-0">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Logo */}
                  <div className="bg-white p-2 rounded-xl shadow-lg">
                    <img 
                      src="/logo_web.jpg" 
                      alt="Syntak Logo" 
                      className="w-10 h-10 object-contain"
                      onError={(e) => {
                        // Fallback jika logo tidak ditemukan
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <Calendar className="w-10 h-10 text-blue-600 hidden" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-wide">Syntak</h1>
                    <p className="text-xs text-blue-100 font-medium">BPS Kota Surabaya</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Scrollable content dalam sidebar */}
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* User Info */}
              <div className="p-6 border-b bg-gradient-to-br from-blue-50 to-indigo-50 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {currentUser.nama}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs font-medium bg-blue-100 text-blue-700">
                        {currentUser.kategori}
                      </Badge>
                      {currentUser.role === 'admin' && (
                        <Badge className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shadow-md">
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-1">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Menu Utama
                </p>
                {currentMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentPage(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200
                        ${isActive 
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 font-semibold scale-[1.02]' 
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:scale-[1.01]'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-sm' : ''}`} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Logout Button */}
              <div className="p-4 border-t bg-gray-50 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 font-medium transition-all duration-200 hover:shadow-md"
                  size="default"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Keluar 
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - dengan margin left untuk sidebar */}
        <div className="flex-1 flex flex-col lg:ml-72">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b sticky top-0 z-40 shadow-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="hover:bg-blue-50"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img 
                src="/logo_web.jpg" 
                alt="Logo" 
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <h1 className="text-lg font-bold text-gray-900">
                {currentMenuItems.find(item => item.id === currentPage)?.label}
              </h1>
            </div>
            <div className="w-10" />
          </div>

          {/* Page Content - SCROLLABLE */}
          <main className="flex-1 p-6 overflow-y-auto">
            {renderCurrentPage()}
          </main>
        </div>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default App;