export interface ThemePalette {
  primary: string;
  secondary: string;
  appBg: string;
  surface: string;
  border: string;
  inputBg: string;
}

export interface ThemeDef {
  name: string;
  colors: {
    light: ThemePalette;
    dark: ThemePalette;
  }
}

// Centralized Theme Definitions
export const OCCASION_THEMES: Record<string, ThemeDef> = {
  spring: { 
    name: 'Spring Season', 
    colors: {
      light: {
        primary: '#10b981', // Emerald 500
        secondary: '#38bdf8', // Sky 400
        appBg: '#f0fdf4', // Emerald 50
        surface: '#ffffff',
        border: '#d1fae5', // Emerald 100
        inputBg: '#ffffff'
      },
      dark: {
        primary: '#34d399', // Emerald 400
        secondary: '#38bdf8',
        appBg: '#022c22', // Emerald 950
        surface: '#064e3b', // Emerald 900
        border: '#065f46', // Emerald 800
        inputBg: '#065f46'
      }
    }
  },
  ramadan: { 
    name: 'Ramadan / Eid', 
    colors: {
      light: {
        primary: '#4f46e5', // Indigo 600
        secondary: '#fbbf24', // Amber 400
        appBg: '#f5f3ff', // Violet 50
        surface: '#ffffff',
        border: '#e0e7ff', // Indigo 100
        inputBg: '#ffffff'
      },
      dark: {
        primary: '#818cf8', // Indigo 400
        secondary: '#fbbf24',
        appBg: '#1e1b4b', // Indigo 950
        surface: '#312e81', // Indigo 900
        border: '#3730a3', // Indigo 800
        inputBg: '#312e81'
      }
    }
  },
  christmas: { 
    name: 'Christmas', 
    colors: {
      light: {
        primary: '#e11d48', // Rose 600
        secondary: '#15803d', // Green 700
        appBg: '#fff1f2', // Rose 50
        surface: '#ffffff',
        border: '#ffe4e6', // Rose 100
        inputBg: '#ffffff'
      },
      dark: {
        primary: '#fb7185', // Rose 400
        secondary: '#4ade80', // Green 400
        appBg: '#4c0519', // Rose 950
        surface: '#881337', // Rose 900
        border: '#9f1239', // Rose 800
        inputBg: '#881337'
      }
    }
  },
  halloween: { 
    name: 'Halloween', 
    colors: {
      light: {
        primary: '#f97316', // Orange 500
        secondary: '#9333ea', // Purple 600
        appBg: '#fff7ed', // Orange 50
        surface: '#ffffff',
        border: '#ffedd5', // Orange 100
        inputBg: '#ffffff'
      },
      dark: {
        primary: '#fb923c', // Orange 400
        secondary: '#a855f7', // Purple 500
        appBg: '#292524', // Stone 800 (Darker/Spooky)
        surface: '#1c1917', // Stone 900
        border: '#44403c', // Stone 700
        inputBg: '#1c1917'
      }
    }
  },
  none: {
    name: 'Default',
    colors: {
      light: {
        primary: '#0d9488', // Teal 600
        secondary: '#0f766e', // Teal 700
        appBg: '#f8fafc', // Slate 50
        surface: '#ffffff',
        border: '#e2e8f0', // Slate 200
        inputBg: '#ffffff'
      },
      dark: {
        primary: '#0d9488', 
        secondary: '#0f766e',
        appBg: '#0f172a', // Slate 900
        surface: '#1e293b', // Slate 800
        border: '#334155', // Slate 700
        inputBg: '#1e293b'
      }
    }
  }
};