/**
 * Design System - Unified Theme Tokens & Component Styles
 * 
 * Centralizes all design decisions for consistent UI across the application.
 * Supports:
 * - Light/Dark modes
 * - Seasonal decorations (Spring, Ramadan, Christmas, Halloween)
 * - RTL/LTR layouts
 * - Responsive breakpoints
 * - Component variants
 */

export interface ThemeColors {
  // Primary palette
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryLight: string;
  primaryDark: string;
  
  // Secondary palette
  secondary: string;
  secondaryHover: string;
  secondaryLight: string;
  
  // Neutral colors
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  divider: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Input colors
  inputBg: string;
  inputBorder: string;
  inputFocus: string;
  inputDisabled: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSizeXs: string;
  fontSizeSm: string;
  fontSizeMd: string;
  fontSizeLg: string;
  fontSizeXl: string;
  fontSize2xl: string;
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightBold: number;
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ThemeRadius {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface ComponentVariants {
  button: {
    primary: string;
    secondary: string;
    outline: string;
    ghost: string;
    danger: string;
  };
  input: {
    default: string;
    error: string;
    success: string;
  };
  badge: {
    default: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}

// Light mode colors
export const lightColors: ThemeColors = {
  primary: '#0d9488',
  primaryHover: '#0f766e',
  primaryActive: '#115e59',
  primaryLight: '#5eead4',
  primaryDark: '#134e4a',
  
  secondary: '#0f766e',
  secondaryHover: '#115e59',
  secondaryLight: '#99f6e4',
  
  background: '#f9fafb',
  surface: '#ffffff',
  surfaceHover: '#f3f4f6',
  border: '#e5e7eb',
  divider: '#e5e7eb',
  
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  textInverse: '#ffffff',
  
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  inputBg: '#ffffff',
  inputBorder: '#d1d5db',
  inputFocus: '#0d9488',
  inputDisabled: '#f3f4f6'
};

// Dark mode colors
export const darkColors: ThemeColors = {
  primary: '#14b8a6',
  primaryHover: '#0d9488',
  primaryActive: '#0f766e',
  primaryLight: '#2dd4bf',
  primaryDark: '#134e4a',
  
  secondary: '#0f766e',
  secondaryHover: '#115e59',
  secondaryLight: '#5eead4',
  
  background: '#0f172a',
  surface: '#1e293b',
  surfaceHover: '#334155',
  border: '#334155',
  divider: '#334155',
  
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textTertiary: '#94a3b8',
  textInverse: '#0f172a',
  
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  inputBg: '#1e293b',
  inputBorder: '#475569',
  inputFocus: '#14b8a6',
  inputDisabled: '#334155'
};

// Spacing system (in pixels)
export const spacing: ThemeSpacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px'
};

// Typography
export const typography: ThemeTypography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSizeXs: '12px',
  fontSizeSm: '14px',
  fontSizeMd: '16px',
  fontSizeLg: '18px',
  fontSizeXl: '20px',
  fontSize2xl: '24px',
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700
};

// Shadows
export const shadows: ThemeShadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
};

// Border radius
export const radius: ThemeRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px'
};

// Component class builders
export const buildButtonClasses = (variant: keyof ComponentVariants['button'], disabled: boolean = false): string => {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  if (disabled) {
    return `${baseClasses} opacity-50 cursor-not-allowed bg-gray-300 text-gray-500`;
  }
  
  const variantClasses = {
    primary: 'bg-teal-600 hover:bg-teal-700 text-white focus:ring-teal-500 active:bg-teal-800',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
    outline: 'border-2 border-teal-600 text-teal-600 hover:bg-teal-50 focus:ring-teal-500 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-900/20',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-400 dark:text-gray-300 dark:hover:bg-gray-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 active:bg-red-800'
  };
  
  return `${baseClasses} ${variantClasses[variant]}`;
};

export const buildInputClasses = (state: 'default' | 'error' | 'success' = 'default', disabled: boolean = false): string => {
  const baseClasses = 'w-full px-4 py-2 rounded-lg border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1';
  
  if (disabled) {
    return `${baseClasses} bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:border-gray-600`;
  }
  
  const stateClasses = {
    default: 'border-gray-300 focus:border-teal-600 focus:ring-teal-500 dark:border-gray-600 dark:bg-slate-800 dark:text-gray-200',
    error: 'border-red-500 focus:border-red-600 focus:ring-red-500 dark:border-red-400',
    success: 'border-green-500 focus:border-green-600 focus:ring-green-500 dark:border-green-400'
  };
  
  return `${baseClasses} ${stateClasses[state]}`;
};

export const buildBadgeClasses = (variant: keyof ComponentVariants['badge']): string => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  };
  
  return `${baseClasses} ${variantClasses[variant]}`;
};

export const buildCardClasses = (interactive: boolean = false): string => {
  const baseClasses = 'bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm';
  
  if (interactive) {
    return `${baseClasses} transition-all duration-200 hover:shadow-md hover:border-teal-500 dark:hover:border-teal-600 cursor-pointer`;
  }
  
  return baseClasses;
};

export const buildModalClasses = (): string => {
  return 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm';
};

export const buildTableClasses = (): string => {
  return 'w-full border-collapse bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-sm';
};

export const buildTableHeaderClasses = (): string => {
  return 'bg-gray-50 dark:bg-slate-900 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';
};

export const buildTableRowClasses = (interactive: boolean = true): string => {
  const baseClasses = 'border-b border-gray-200 dark:border-slate-700';
  
  if (interactive) {
    return `${baseClasses} hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors duration-150`;
  }
  
  return baseClasses;
};

export const buildDropdownClasses = (): string => {
  return 'absolute z-50 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 min-w-[160px]';
};

export const buildTooltipClasses = (): string => {
  return 'absolute z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg';
};

/**
 * Seasonal decoration overrides
 */
export const seasonalThemes = {
  spring: {
    primary: '#ec4899',
    secondary: '#f472b6',
    accent: '#fbbf24'
  },
  ramadan: {
    primary: '#7c3aed',
    secondary: '#a78bfa',
    accent: '#fbbf24'
  },
  christmas: {
    primary: '#dc2626',
    secondary: '#16a34a',
    accent: '#fbbf24'
  },
  halloween: {
    primary: '#f97316',
    secondary: '#6b21a8',
    accent: '#fbbf24'
  }
};

/**
 * Animation utilities
 */
export const animations = {
  fadeIn: 'animate-fadeIn',
  slideUp: 'animate-slideUp',
  slideDown: 'animate-slideDown',
  spin: 'animate-spin',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce'
};

/**
 * Responsive breakpoints
 */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  xxl: '1536px'
};

/**
 * Z-index layers
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070
};

export const designSystem = {
  lightColors,
  darkColors,
  spacing,
  typography,
  shadows,
  radius,
  buildButtonClasses,
  buildInputClasses,
  buildBadgeClasses,
  buildCardClasses,
  buildModalClasses,
  buildTableClasses,
  buildTableHeaderClasses,
  buildTableRowClasses,
  buildDropdownClasses,
  buildTooltipClasses,
  seasonalThemes,
  animations,
  breakpoints,
  zIndex
};
