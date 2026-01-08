
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  group?: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string | number | (string | number)[];
  onChange: (val: any) => void;
  placeholder?: string;
  label?: string;
  multi?: boolean;
  searchable?: boolean;
  error?: boolean;
  className?: string;
}

const Select: React.FC<SelectProps> = ({ 
  options, value, onChange, placeholder = "Select...", 
  label, multi = false, searchable = true, error, className 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Grouping Logic
  const groupedOptions = useMemo<Record<string, SelectOption[]>>(() => {
    const groups: Record<string, SelectOption[]> = {};
    const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
    
    filtered.forEach(opt => {
      const g = opt.group || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(opt);
    });
    
    return groups;
  }, [options, search]);

  const flatFilteredOptions = useMemo(() => {
    return options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  // Click Outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (optionValue: string | number) => {
    if (multi) {
      const current = Array.isArray(value) ? value : [];
      if (current.includes(optionValue)) {
        onChange(current.filter(v => v !== optionValue));
      } else {
        onChange([...current, optionValue]);
      }
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  const isSelected = (val: string | number) => {
    if (multi) return Array.isArray(value) && value.includes(val);
    return value === val;
  };

  const getDisplayLabel = () => {
    if (multi) {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length === 0) return placeholder;
      if (arr.length === 1) return options.find(o => o.value === arr[0])?.label;
      return `${arr.length} selected`;
    }
    const found = options.find(o => o.value === value);
    return found ? found.label : placeholder;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase">{label}</label>}
      
      <div 
        onClick={() => { setIsOpen(!isOpen); if(!isOpen && searchable) setTimeout(() => searchRef.current?.focus(), 100); }}
        className={`w-full border rounded-xl p-3 bg-white dark:bg-slate-800 flex justify-between items-center cursor-pointer transition-all
          ${error ? 'border-red-500' : isOpen ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20' : 'border-gray-200 dark:border-slate-700 hover:border-[var(--color-primary)]'}
        `}
      >
        <div className="flex flex-wrap gap-1 overflow-hidden">
          {multi && Array.isArray(value) && value.length > 0 ? (
             value.map(v => {
               const opt = options.find(o => o.value === v);
               return (
                 <span key={v} className="text-[10px] bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1 dark:text-white">
                   {opt?.label}
                   <span onClick={(e) => { e.stopPropagation(); handleSelect(v); }} className="hover:text-red-500"><X size={10}/></span>
                 </span>
               )
             })
          ) : (
            <span className={`text-sm ${value ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400'}`}>
              {(!multi && options.find(o => o.value === value)?.label) || placeholder}
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in-up">
          {searchable && (
            <div className="p-2 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                  ref={searchRef}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </div>
          )}
          
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {flatFilteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">No options found.</div>
            ) : (
              (Object.entries(groupedOptions) as [string, SelectOption[]][]).map(([group, groupOpts]) => (
                <div key={group}>
                  {Object.keys(groupedOptions).length > 1 && group !== 'Other' && (
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase bg-gray-50 dark:bg-slate-800/50 rounded mt-1">{group}</div>
                  )}
                  {groupOpts.map((opt, idx) => {
                    const active = isSelected(opt.value);
                    return (
                      <div 
                        key={opt.value}
                        onClick={() => handleSelect(opt.value)}
                        className={`px-3 py-2.5 rounded-lg text-sm flex justify-between items-center cursor-pointer transition-colors
                          ${active ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800'}
                        `}
                      >
                        <span>{opt.label}</span>
                        {active && <Check size={14} />}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Select;
