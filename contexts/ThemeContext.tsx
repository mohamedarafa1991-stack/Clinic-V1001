
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/db';
import { OCCASION_THEMES } from '../services/themeConfig';

interface ThemeSettings {
  mode: 'light' | 'dark';
  decoration: string;
  primaryColor: string;
  secondaryColor: string;
  inputBg: string;
}

interface ThemeContextType {
  settings: ThemeSettings; // Current effective settings (Preview)
  savedSettings: ThemeSettings; // Committed settings
  updatePreview: (updates: Partial<ThemeSettings>) => void;
  saveChanges: () => void;
  revertChanges: () => void;
  isDirty: boolean;
  resolvedColors: { primary: string; secondary: string };
}

const defaultSettings: ThemeSettings = {
  mode: 'light',
  decoration: 'none',
  primaryColor: '#0d9488',
  secondaryColor: '#0f766e',
  inputBg: '#ffffff'
};

const ThemeContext = createContext<ThemeContextType>(null!);

export const ThemeProvider = ({ children }: { children?: React.ReactNode }) => {
  const [savedSettings, setSavedSettings] = useState<ThemeSettings>(defaultSettings);
  const [previewSettings, setPreviewSettings] = useState<ThemeSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Load from DB on mount
  useEffect(() => {
    const load = () => {
      try {
        const rows = dbService.query("SELECT * FROM settings");
        const getVal = (k: string) => rows.find((r: any) => r.key === k)?.value;

        const loaded: ThemeSettings = {
          mode: (getVal('theme_mode') as 'light' | 'dark') || 'light',
          decoration: getVal('active_decoration') || 'none',
          primaryColor: getVal('primary_color') || '#0d9488',
          secondaryColor: getVal('secondary_color') || '#0f766e',
          inputBg: getVal('input_bg_color') || '#ffffff'
        };
        
        setSavedSettings(loaded);
        setPreviewSettings(loaded);
        setIsLoaded(true);
      } catch (e) {
        console.warn("Theme DB load failed (likely not ready), using defaults", e);
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  // 2. Compute Resolved Colors (Handling Presets vs Custom)
  const resolvedColors = useMemo(() => {
    const { mode, decoration, primaryColor, secondaryColor } = previewSettings;
    if (decoration !== 'none' && OCCASION_THEMES[decoration]) {
      const themePalette = OCCASION_THEMES[decoration].colors[mode];
      return { primary: themePalette.primary, secondary: themePalette.secondary };
    }
    return { primary: primaryColor, secondary: secondaryColor };
  }, [previewSettings]);

  // 3. Apply to DOM (Live Preview Engine)
  useEffect(() => {
    if (!isLoaded) return;
    
    const root = document.documentElement;
    const { mode, decoration, inputBg } = previewSettings;
    const { primary, secondary } = resolvedColors;

    // A. Mode
    if (mode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    // B. Decoration Class
    root.classList.remove('theme-spring', 'theme-ramadan', 'theme-christmas', 'theme-halloween', 'theme-none');
    if (decoration !== 'none') {
      root.classList.add(`theme-${decoration}`);
      // Remove inline overrides to let CSS class variables take precedence if needed, 
      // BUT we want to ensure resolvedColors are consistent, so we force them below.
    } else {
      root.classList.add('theme-none');
    }

    // C. CSS Variables (Force apply resolved colors to ensure consistency across components)
    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-secondary', secondary);
    
    if (decoration === 'none') {
       root.style.setProperty('--color-input-bg', inputBg);
    } else {
       root.style.removeProperty('--color-input-bg');
    }

    // Dispatch legacy event for non-context consumers (if any remain)
    window.dispatchEvent(new Event('medicore-theme-change'));

  }, [previewSettings, resolvedColors, isLoaded]);

  // 4. Actions
  const updatePreview = (updates: Partial<ThemeSettings>) => {
    setPreviewSettings(prev => ({ ...prev, ...updates }));
  };

  const saveChanges = () => {
    setSavedSettings(previewSettings);
    // Persist
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme_mode', ?)", [previewSettings.mode]);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('active_decoration', ?)", [previewSettings.decoration]);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('primary_color', ?)", [previewSettings.primaryColor]);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('secondary_color', ?)", [previewSettings.secondaryColor]);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('input_bg_color', ?)", [previewSettings.inputBg]);
  };

  const revertChanges = () => {
    setPreviewSettings(savedSettings);
  };

  const isDirty = JSON.stringify(savedSettings) !== JSON.stringify(previewSettings);

  return (
    <ThemeContext.Provider value={{ 
      settings: previewSettings, 
      savedSettings, 
      updatePreview, 
      saveChanges, 
      revertChanges, 
      isDirty,
      resolvedColors 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
