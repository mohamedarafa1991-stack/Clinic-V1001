
import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Calendar, Users, Stethoscope, 
  DollarSign, Settings, LogOut, Activity, MessageSquare, BookOpen
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { dbService } from '../services/db';
import ThemeDecorator from './ThemeDecorator';

const LayoutComponent = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTheme, setActiveTheme] = useState('none');
  const [clinicLogo, setClinicLogo] = useState('');

  useEffect(() => {
    // Initial Load
    loadTheme();
    loadLogo();

    // Listen for changes from Settings page
    const handleThemeChange = () => loadTheme();
    const handleLogoChange = () => loadLogo();
    window.addEventListener('medicore-theme-change', handleThemeChange);
    window.addEventListener('medicore-logo-change', handleLogoChange);

    return () => {
      window.removeEventListener('medicore-theme-change', handleThemeChange);
      window.removeEventListener('medicore-logo-change', handleLogoChange);
    };
  }, []);

  const loadTheme = () => {
    const settings = dbService.query("SELECT * FROM settings WHERE key = 'active_decoration'");
    if (settings.length > 0) {
      setActiveTheme(settings[0].value);
    }
  };

  const loadLogo = () => {
    const settings = dbService.query("SELECT * FROM settings WHERE key = 'clinic_logo'");
    if (settings.length > 0) {
      setClinicLogo(settings[0].value);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: [] },
    { to: '/appointments', icon: Calendar, label: 'Appointments', roles: [] },
    { to: '/patients', icon: Users, label: 'Patients', roles: [UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.NURSE] },
    { to: '/doctors', icon: Stethoscope, label: 'Doctors', roles: [UserRole.ADMIN, UserRole.RECEPTIONIST] },
    { to: '/pharmacy', icon: BookOpen, label: 'Drug Index', roles: [UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE] },
    { to: '/messages', icon: MessageSquare, label: 'Messages', roles: [] },
    { to: '/finances', icon: DollarSign, label: 'Finances', roles: [UserRole.ADMIN, UserRole.BILLING] },
    { to: '/settings', icon: Settings, label: 'Settings', roles: [UserRole.ADMIN] },
  ];

  return (
    <div className="flex h-screen bg-appBg overflow-hidden transition-colors duration-500 relative selection:bg-[var(--color-primary)] selection:text-white">
      
      {/* --- Global Decoration Overlay (Z-0) --- */}
      <ThemeDecorator theme={activeTheme} />

      {/* Sidebar */}
      <aside className="w-64 bg-surface border-r border-borderSubtle hidden md:flex flex-col z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-colors duration-500">
        <div className="p-6 flex items-center gap-3 mb-2">
          {clinicLogo ? (
             <img src={clinicLogo} alt="Clinic Logo" className="w-10 h-10 object-contain" />
          ) : (
             <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-white p-2.5 rounded-xl shadow-lg shadow-[var(--color-primary)]/20">
               <Activity size={24} />
             </div>
          )}
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">MediCore</h1>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            if (item.roles.length > 0 && user && !item.roles.includes(user.role)) return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3.5 mx-1 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                    isActive 
                      ? 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-md shadow-[var(--color-primary)]/25 translate-x-1' 
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-[var(--color-primary)] dark:hover:text-[var(--color-primary)] font-medium'
                  }`
                }
              >
                <item.icon size={20} className="relative z-10" />
                <span className="font-medium relative z-10">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 mx-3 mb-4 mt-2">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-borderSubtle transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-[var(--color-primary)] font-bold shadow-sm">
                {user?.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">{user?.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 px-3 py-2 text-rose-500 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-slate-600 rounded-xl w-full transition-all text-xs font-bold uppercase tracking-wide"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative bg-appBg z-10 transition-colors duration-500">
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto animate-fade-in-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default LayoutComponent;
