
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

export interface Shortcut {
  id: string;
  label: string;
  keys: string[]; // e.g., ['Control', 'k']
  action: () => void;
  role?: string[]; // Allowed roles
  description?: string;
}

interface ShortcutContextType {
  shortcuts: Shortcut[];
  registerShortcut: (shortcut: Shortcut) => void;
  updateShortcutKeys: (id: string, newKeys: string[]) => void;
  activeKeys: string[];
}

const ShortcutContext = createContext<ShortcutContextType>(null!);

export const ShortcutProvider = ({ children }: { children?: React.ReactNode }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setLanguage, language } = useLanguage();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  // Default Shortcuts Registration
  useEffect(() => {
    const defaults: Shortcut[] = [
      { id: 'nav_dashboard', label: 'Go to Dashboard', keys: ['Alt', 'd'], action: () => navigate('/dashboard'), description: 'Navigate to main dashboard' },
      { id: 'nav_patients', label: 'Go to Patients', keys: ['Alt', 'p'], action: () => navigate('/patients'), description: 'Open patient registry' },
      { id: 'nav_appointments', label: 'Go to Appointments', keys: ['Alt', 'a'], action: () => navigate('/appointments'), description: 'Open scheduler' },
      { id: 'toggle_theme', label: 'Toggle Theme', keys: ['Alt', 't'], action: () => {
         const isDark = document.documentElement.classList.contains('dark');
         if(isDark) document.documentElement.classList.remove('dark');
         else document.documentElement.classList.add('dark');
         // Dispatch event for components listening to theme changes
         window.dispatchEvent(new Event('medicore-theme-change'));
      }, description: 'Switch light/dark mode' },
      { id: 'toggle_lang', label: 'Switch Language', keys: ['Alt', 'l'], action: () => setLanguage(language === 'en' ? 'ar' : 'en'), description: 'Toggle English/Arabic' },
    ];
    setShortcuts(defaults);
  }, [navigate, language]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore inputs
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

    const currentKey = e.key;
    // Build active key set for complex combos if needed, simplified here to check modifiers + key
    
    shortcuts.forEach(s => {
      // Check user role permission
      if (s.role && user && !s.role.includes(user.role)) return;

      const modifiersMatch = 
        (s.keys.includes('Control') === e.ctrlKey) &&
        (s.keys.includes('Alt') === e.altKey) &&
        (s.keys.includes('Shift') === e.shiftKey) &&
        (s.keys.includes('Meta') === e.metaKey);

      const mainKey = s.keys.find(k => !['Control', 'Alt', 'Shift', 'Meta'].includes(k));
      
      if (modifiersMatch && mainKey?.toLowerCase() === currentKey.toLowerCase()) {
        e.preventDefault();
        s.action();
        // Visual Feedback
        showShortcutToast(s.label);
      }
    });
  }, [shortcuts, user]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const registerShortcut = (s: Shortcut) => {
    setShortcuts(prev => {
      if (prev.find(p => p.id === s.id)) return prev;
      return [...prev, s];
    });
  };

  const updateShortcutKeys = (id: string, newKeys: string[]) => {
    setShortcuts(prev => prev.map(s => s.id === id ? { ...s, keys: newKeys } : s));
  };

  // Simple visual feedback toast
  const showShortcutToast = (label: string) => {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-10 right-10 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in-up font-bold text-sm flex items-center gap-2';
    toast.innerHTML = `<span class="bg-white/20 p-1 rounded text-xs">⌨</span> ${label}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  return (
    <ShortcutContext.Provider value={{ shortcuts, registerShortcut, updateShortcutKeys, activeKeys }}>
      {children}
    </ShortcutContext.Provider>
  );
};

export const useShortcuts = () => useContext(ShortcutContext);
