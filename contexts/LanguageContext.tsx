
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '../utils/translations';

interface LanguageContextType {
  language: Language; // Current effective language (Preview)
  savedLanguage: Language; // Persisted language
  setLanguage: (lang: Language) => void; // Updates preview
  saveLanguage: () => void; // Commits to storage
  revertLanguage: () => void; // Resets to saved
  t: (key: keyof typeof translations['en']) => string;
  dir: 'ltr' | 'rtl';
  isDirty: boolean;
}

const LanguageContext = createContext<LanguageContextType>(null!);

export const LanguageProvider = ({ children }: { children?: React.ReactNode }) => {
  const [savedLanguage, setSavedLanguage] = useState<Language>('en');
  const [previewLanguage, setPreviewLanguage] = useState<Language>('en');

  // Load initial
  useEffect(() => {
    const saved = localStorage.getItem('medicore_lang') as Language;
    if (saved) {
      setSavedLanguage(saved);
      setPreviewLanguage(saved);
    }
  }, []);

  // Apply Preview Side Effects (DOM updates)
  useEffect(() => {
    document.documentElement.dir = previewLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = previewLanguage;
  }, [previewLanguage]);

  const setLanguage = (lang: Language) => {
    setPreviewLanguage(lang);
  };

  const saveLanguage = () => {
    setSavedLanguage(previewLanguage);
    localStorage.setItem('medicore_lang', previewLanguage);
  };

  const revertLanguage = () => {
    setPreviewLanguage(savedLanguage);
  };

  const t = (key: keyof typeof translations['en']) => {
    return translations[previewLanguage][key] || key;
  };

  const isDirty = savedLanguage !== previewLanguage;

  return (
    <LanguageContext.Provider value={{ 
      language: previewLanguage, 
      savedLanguage,
      setLanguage, 
      saveLanguage, 
      revertLanguage,
      t, 
      dir: previewLanguage === 'ar' ? 'rtl' : 'ltr',
      isDirty
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
