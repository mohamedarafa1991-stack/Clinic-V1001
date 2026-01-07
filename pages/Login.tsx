import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { dbService } from '../services/db';

const Login = () => {
  const [email, setEmail] = useState('admin@medicore.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [logo, setLogo] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
      // Try to load logo if DB is initialized, or initialize then load
      const loadLogo = async () => {
          try {
              await dbService.init();
              const settings = dbService.query("SELECT * FROM settings WHERE key = 'clinic_logo'");
              if (settings.length > 0) {
                  setLogo(settings[0].value);
              }
          } catch(e) {
              console.warn("Could not load logo", e);
          }
      };
      loadLogo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/dashboard');
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="flex flex-col items-center mb-8">
            {logo ? (
                <img src={logo} alt="Clinic Logo" className="w-20 h-20 object-contain mb-4" />
            ) : (
                <div className="bg-[var(--color-primary)] text-white p-3 rounded-xl mb-4 shadow-lg shadow-teal-500/30">
                    <Activity size={32} />
                </div>
            )}
            <h1 className="text-2xl font-bold text-gray-800">MediCore Login</h1>
            <p className="text-gray-500">Secure Clinic Management System</p>
        </div>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-center text-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input 
                    type="email" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                    type="password" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            <button type="submit" className="w-full bg-[var(--color-primary)] text-white py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg shadow-teal-500/30">
                Sign In
            </button>
        </form>
        
        <div className="mt-6 text-center text-xs text-gray-400">
            <p>Demo Admin: admin@medicore.com / password</p>
            <p>Demo Doctor: sarah@medicore.com / password</p>
        </div>
      </div>
    </div>
  );
};

export default Login;