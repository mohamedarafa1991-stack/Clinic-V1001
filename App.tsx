
import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { dbService } from './services/db';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ShortcutProvider } from './contexts/ShortcutContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';
import { UserRole } from './types';
import { broadcastService } from './services/broadcast';

// Lazy Load Pages (Architectural enhancement for performance)
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Appointments = React.lazy(() => import('./pages/Appointments'));
const Patients = React.lazy(() => import('./pages/Patients'));
const Doctors = React.lazy(() => import('./pages/Doctors'));
const Nurses = React.lazy(() => import('./pages/Nurses'));
const Services = React.lazy(() => import('./pages/Services'));
const Prescriptions = React.lazy(() => import('./pages/Prescriptions'));
const Finances = React.lazy(() => import('./pages/Finances'));
const Settings = React.lazy(() => import('./pages/Settings'));
const NotificationsPage = React.lazy(() => import('./pages/Notifications'));
const Login = React.lazy(() => import('./pages/Login'));
const QueueDisplay = React.lazy(() => import('./pages/QueueDisplay'));

const LoadingFallback = () => (
  <div className="h-full w-full flex items-center justify-center min-h-[400px]">
    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
  </div>
);

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
        
        // Listen for cross-tab updates
        broadcastService.subscribe((msg) => {
            if (msg.type === 'db-update') {
                // In a real scenario, trigger specific re-fetches.
                // For Phase 1, we can trigger a soft reload or event
                window.dispatchEvent(new Event('external-db-change'));
            }
        });

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

        root.classList.remove('theme-spring', 'theme-ramadan', 'theme-christmas', 'theme-halloween', 'theme-none');
        root.classList.remove('dark');

        if (themeMode === 'dark') {
            root.classList.add('dark');
        }

        if (activeDecoration !== 'none') {
            root.classList.add(`theme-${activeDecoration}`);
            root.style.removeProperty('--color-primary');
            root.style.removeProperty('--color-secondary');
            root.style.removeProperty('--color-input-bg');
        } else {
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
      <LanguageProvider>
        <AuthProvider>
          <ThemeProvider>
            <HashRouter>
              <ShortcutProvider> 
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/queue-tv" element={<QueueDisplay />} />
                    
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

                      <Route path="nurses" element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.RECEPTIONIST]}>
                          <Nurses />
                        </ProtectedRoute>
                      } />

                      <Route path="services" element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.RECEPTIONIST]}>
                          <Services />
                        </ProtectedRoute>
                      } />

                      <Route path="prescriptions" element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE]}>
                          <Prescriptions />
                        </ProtectedRoute>
                      } />
                      
                      <Route path="messages" element={<NotificationsPage />} />
                      
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
                </Suspense>
              </ShortcutProvider>
            </HashRouter>
          </ThemeProvider>
        </AuthProvider>
      </LanguageProvider>
    </Initializer>
  );
}

export default App;
