
import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { dbService } from './services/db';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ShortcutProvider } from './contexts/ShortcutContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Nurses from './pages/Nurses';
import Services from './pages/Services';
import Prescriptions from './pages/Prescriptions';
import Finances from './pages/Finances';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Notifications from './pages/Notifications';
import QueueDisplay from './pages/QueueDisplay';
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
              </ShortcutProvider>
            </HashRouter>
          </ThemeProvider>
        </AuthProvider>
      </LanguageProvider>
    </Initializer>
  );
}

export default App;
