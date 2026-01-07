import React from 'react';
import { 
  Snowflake, Moon, Star, Flower2, Leaf, 
  CloudFog, Wind, Sparkles, Ghost 
} from 'lucide-react';

interface ThemeDecoratorProps {
  theme: string;
}

const ThemeDecorator: React.FC<ThemeDecoratorProps> = ({ theme }) => {
  if (!theme || theme === 'none') return null;

  /**
   * THEME ARCHITECTURE:
   * 1. Atmosphere: A subtle gradient wash that defines the mood (z-0).
   * 2. Structure: Geometric or organic SVG lines that anchor the theme (z-10).
   * 3. Accents: Floating or swaying icons that provide life (z-20).
   * 
   * COLOR STRATEGY:
   * Uses CSS variables var(--color-primary) and var(--color-secondary) via Tailwind's
   * class mapping (text-primary, text-secondary) to ensure decorations match the active theme.
   */

  const renderTheme = () => {
    switch (theme) {
      // ----------------------------------------------------------------------
      // SPRING: Fresh, Organic, Optimistic (Growth & Breeze)
      // ----------------------------------------------------------------------
      case 'spring':
        return (
          <>
            {/* 1. Atmosphere: Sun Wash (Top Right) & Meadow Haze (Bottom Left) */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-[var(--color-primary)]/10 via-[var(--color-secondary)]/10 to-transparent dark:from-[var(--color-primary)]/20 dark:via-[var(--color-secondary)]/10 dark:to-transparent rounded-bl-[100%] blur-3xl pointer-events-none" />
            
            {/* 2. Structure: Organic Vine/Breeze Line */}
            <svg className="absolute top-0 right-0 w-96 h-96 opacity-30 dark:opacity-20 pointer-events-none" viewBox="0 0 100 100" fill="none">
              <path d="M100 0 C 80 40, 50 20, 0 50" stroke="var(--color-primary)" strokeWidth="0.5" />
              <path d="M100 10 C 90 50, 60 40, 20 80" stroke="var(--color-secondary)" strokeWidth="0.3" />
            </svg>

            {/* 3. Accents: Drifting Petals & Leaves */}
            {/* High Accents */}
            <div className="absolute top-12 right-12 animate-sway duration-[8000ms] pointer-events-none">
              <Flower2 size={24} className="text-secondary dark:text-secondary opacity-60" strokeWidth={1.5} />
            </div>
            <div className="absolute top-24 right-32 animate-float duration-[10000ms] delay-700 pointer-events-none">
              <Leaf size={16} className="text-primary dark:text-primary opacity-50 rotate-45" strokeWidth={1.5} />
            </div>
            
            {/* Low Accents (Growth) */}
            <div className="fixed bottom-0 left-0 p-8 pointer-events-none flex items-end gap-4 opacity-40 dark:opacity-20">
               <div className="animate-pulse-slow text-primary dark:text-primary">
                  <Leaf size={32} strokeWidth={1} className="-rotate-12" />
               </div>
               <div className="animate-float duration-[7000ms] mb-4 text-secondary dark:text-secondary">
                  <div className="w-2 h-2 rounded-full bg-current opacity-60"></div>
               </div>
               <div className="animate-float duration-[9000ms] mb-8 text-secondary dark:text-secondary">
                   <Wind size={24} strokeWidth={1} className="opacity-50" />
               </div>
            </div>
          </>
        );

      // ----------------------------------------------------------------------
      // RAMADAN: Geometric, Illuminated, Structured (Peace & Clarity)
      // ----------------------------------------------------------------------
      case 'ramadan':
        return (
          <>
            {/* 1. Atmosphere: Night Sky Gradient (Top) */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[var(--color-primary)]/10 to-transparent dark:from-[var(--color-primary)]/30 dark:to-transparent pointer-events-none" />

            {/* 2. Structure: Islamic Geometric Pattern Hint */}
            <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.05] dark:opacity-[0.1] pointer-events-none">
               <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" className="text-primary dark:text-secondary w-full h-full">
                  <path d="M50 0 L100 50 L50 100 L0 50 Z" strokeWidth="0.5" />
                  <path d="M50 10 L90 50 L50 90 L10 50 Z" strokeWidth="0.2" />
                  <circle cx="50" cy="50" r="20" strokeWidth="0.2" />
               </svg>
            </div>

            {/* 3. Accents: Hanging Lanterns (Verticality) */}
            <div className="absolute top-0 right-[15%] flex gap-12 z-50 pointer-events-none">
                 {/* Main Lantern */}
                 <div className="flex flex-col items-center animate-sway origin-top duration-[6000ms]">
                    <div className="h-32 w-[1px] bg-gradient-to-b from-primary/30 to-secondary/50 dark:from-primary/50 dark:to-secondary/80"></div>
                    <div className="relative group">
                        <div className="absolute inset-0 bg-secondary/20 blur-md rounded-full group-hover:bg-secondary/30 transition-colors"></div>
                        <Moon size={24} className="text-secondary relative z-10" strokeWidth={1.5} />
                    </div>
                 </div>
                 {/* Secondary Star */}
                 <div className="flex flex-col items-center animate-sway origin-top duration-[5000ms] delay-1000">
                    <div className="h-20 w-[1px] bg-primary/30 dark:bg-primary/50"></div>
                    <Star size={16} className="text-primary/60 dark:text-primary/80" fill="currentColor" strokeWidth={0} />
                 </div>
            </div>
          </>
        );

      // ----------------------------------------------------------------------
      // CHRISTMAS: Minimalist, Nordic, Crystalline (Cleanliness & Warmth)
      // ----------------------------------------------------------------------
      case 'christmas':
        return (
          <>
            {/* 1. Atmosphere: Frost Gradient corners */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-secondary/50 to-primary/50 opacity-60" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 to-transparent dark:from-primary/20 rounded-bl-full pointer-events-none" />

            {/* 2. Structure: Vertical Hanging Lines (Precision) */}
            <div className="absolute top-0 right-8 flex gap-4 pointer-events-none">
                <div className="h-40 w-[1px] bg-slate-200 dark:bg-slate-700/50"></div>
                <div className="h-24 w-[1px] bg-slate-200 dark:bg-slate-700/50"></div>
            </div>

            {/* 3. Accents: Minimalist Baubles & Snow */}
            <div className="absolute top-40 right-[35px] animate-spin-slow pointer-events-none opacity-80">
                <Snowflake size={20} className="text-secondary dark:text-secondary/60" />
            </div>
            <div className="absolute top-24 right-[19px] animate-sway origin-top duration-[4000ms] pointer-events-none">
                <div className="w-3 h-3 rounded-full bg-primary/80 dark:bg-primary/60 shadow-sm"></div>
            </div>

            {/* Ambient Snowfall (Bottom) */}
            <div className="fixed bottom-8 left-8 flex gap-8 pointer-events-none opacity-30 dark:opacity-20">
                <Snowflake size={16} className="text-slate-400 animate-float delay-100" />
                <Snowflake size={12} className="text-slate-400 animate-float delay-700 mt-4" />
            </div>
          </>
        );

      // ----------------------------------------------------------------------
      // HALLOWEEN: Atmospheric, Ethereal, Soft (Mystery & Playfulness)
      // ----------------------------------------------------------------------
      case 'halloween':
        return (
          <>
            {/* 1. Atmosphere: Low Fog (Bottom) */}
            <div className="fixed bottom-0 left-0 w-full h-48 bg-gradient-to-t from-secondary/10 to-transparent dark:from-secondary/20 pointer-events-none" />
            
            {/* 2. Structure: Corner Web (SVG) */}
            <svg className="absolute top-0 right-0 w-64 h-64 opacity-10 dark:opacity-20 pointer-events-none text-slate-500" viewBox="0 0 100 100" fill="none" stroke="currentColor">
               <path d="M100 0 L0 100 M100 25 L25 100 M100 50 L50 100" strokeWidth="0.2" />
               <path d="M50 50 Q 75 75 100 50" strokeWidth="0.2" fill="none" />
               <path d="M25 25 Q 50 50 75 25" strokeWidth="0.2" fill="none" />
            </svg>

            {/* 3. Accents: Floating Spirits & Sparkles */}
            <div className="absolute top-10 right-10 animate-float duration-[6000ms] pointer-events-none opacity-40 dark:opacity-30">
                <Sparkles size={20} className="text-primary dark:text-primary" />
            </div>
            
            <div className="fixed bottom-4 left-4 flex items-end gap-2 pointer-events-none opacity-30 dark:opacity-20">
                <CloudFog size={48} className="text-slate-400 animate-float duration-[8000ms]" />
                <Ghost size={24} className="text-secondary dark:text-secondary mb-2 animate-float duration-[9000ms] delay-500" />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {renderTheme()}
    </div>
  );
};

export default ThemeDecorator;