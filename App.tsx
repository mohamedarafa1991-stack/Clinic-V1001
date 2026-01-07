import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { dbService } from './services/db';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Finances from './pages/Finances';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Pharmacy from './pages/Pharmacy';
import Notifications from './pages/Notifications';
import { Loader2 } from 'lucide-react';
import { UserRole } from './types';

const ProtectedRoute = ({ children, allowedRoles = [] }: { children?: React.ReactNode, allowedRoles?: UserRole[] }) => {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" />;

  // Role check
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const Initializer = ({ children }: { children?: React.ReactNode }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await dbService.init();
        
        // Load settings safely
        let settings: any[] = [];
        try {
            settings = dbService.query("SELECT * FROM settings");
        } catch (e) {
            console.warn("Could not load settings, using defaults", e);
        }

        const themeMode = settings.find((s: any) => s.key === 'theme_mode')?.value || 'light';
        const activeDecoration = settings.find((s: any) => s.key === 'active_decoration')?.value || 'none';
        
        const root = document.documentElement;

        // 1. Clean up old classes
        root.classList.remove('theme-spring', 'theme-ramadan', 'theme-christmas', 'theme-halloween', 'theme-none');
        root.classList.remove('dark');

        // 2. Apply Dark Mode Class
        if (themeMode === 'dark') {
            root.classList.add('dark');
        }

        // 3. Apply Theme Class
        if (activeDecoration !== 'none') {
            // Named theme: Class handles all variables
            root.classList.add(`theme-${activeDecoration}`);
            
            // Remove inline overrides to let CSS class variables take precedence
            root.style.removeProperty('--color-primary');
            root.style.removeProperty('--color-secondary');
            root.style.removeProperty('--color-app-bg');
            root.style.removeProperty('--color-surface');
            root.style.removeProperty('--color-border');
            root.style.removeProperty('--color-input-bg');
        } else {
            // Default theme: Use fallback class + allow manual overrides from DB
            root.classList.add('theme-none');
            
            const primary = settings.find((s: any) => s.key === 'primary_color')?.value;
            const secondary = settings.find((s: any) => s.key === 'secondary_color')?.value;
            const inputBg = settings.find((s: any) => s.key === 'input_bg_color')?.value;

            if (primary) root.style.setProperty('--color-primary', primary);
            if (secondary) root.style.setProperty('--color-secondary', secondary);
            if (inputBg) root.style.setProperty('--color-input-bg', inputBg);
        }

        setReady(true);
      } catch (err) {
        console.error("Initialization Failed:", err);
        setReady(true); 
      }
    };
    init();
  }, []);

  if (!ready) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-slate-900 flex-col gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Loading MediCore...</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Initializing Secure Database</p>
      </div>
    );
  }

  return <>{children}</>;
};

function App() {
  return (
    <Initializer>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="appointments" element={<Appointments />} />
              
              <Route path="patients" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.NURSE]}>
                  <Patients />
                </ProtectedRoute>
              } />
              
              <Route path="doctors" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.RECEPTIONIST]}>
                  <Doctors />
                </ProtectedRoute>
              } />
              
              <Route path="pharmacy" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE]}>
                  <Pharmacy />
                </ProtectedRoute>
              } />
              
              <Route path="messages" element={<Notifications />} />
              
              <Route path="finances" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.BILLING]}>
                  <Finances />
                </ProtectedRoute>
              } />
              
              <Route path="settings" element={
                <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                  <Settings />
                </ProtectedRoute>
              } />
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </Initializer>
  );
}

export default App;