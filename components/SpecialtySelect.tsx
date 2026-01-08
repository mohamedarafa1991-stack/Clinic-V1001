
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search, Plus, Stethoscope, X } from 'lucide-react';
import { dbService } from '../services/db';
import { Specialty } from '../types';

interface SpecialtySelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  placeholder?: string;
  multi?: boolean;
}

const SpecialtySelect: React.FC<SpecialtySelectProps> = ({ value, onChange, error, placeholder, multi = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [items, setItems] = useState<Specialty[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load from DB
  useEffect(() => {
      const load = () => {
          try {
              const data = dbService.query("SELECT * FROM specialties ORDER BY category, name");
              setItems(data);
          } catch(e) { console.error(e); }
      };
      load();
  }, []);

  const selectedValues = useMemo(() => {
      if (!value) return [];
      return value.split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  // Group items
  const groupedItems = useMemo(() => {
      const groups: Record<string, Specialty[]> = {};
      items.forEach(i => {
          if (!groups[i.category]) groups[i.category] = [];
          groups[i.category].push(i);
      });
      return groups;
  }, [items]);

  // Flatten for navigation
  const flatItems = useMemo(() => {
    // Filter based on search
    if (!search) return items;
    return items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  }, [search, items]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (itemName: string) => {
    if (multi) {
        let newValues: string[];
        if (selectedValues.includes(itemName)) {
            newValues = selectedValues.filter(v => v !== itemName);
        } else {
            newValues = [...selectedValues, itemName];
        }
        onChange(newValues.join(', '));
        // Keep focus for rapid selection
        inputRef.current?.focus();
    } else {
        onChange(itemName);
        setIsOpen(false);
        setSearch('');
    }
  };

  const removeValue = (e: React.MouseEvent, itemToRemove: string) => {
      e.stopPropagation();
      const newValues = selectedValues.filter(v => v !== itemToRemove);
      onChange(newValues.join(', '));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % flatItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + flatItems.length) % flatItems.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (flatItems[highlightedIndex]) {
          handleSelect(flatItems[highlightedIndex].name);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className={`
          min-h-[46px] flex items-center justify-between w-full p-2 rounded-xl border cursor-pointer bg-white dark:bg-slate-800 transition-all
          ${error ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200 dark:border-slate-700 hover:border-[var(--color-primary)] dark:hover:border-[var(--color-primary)]'}
          ${isOpen ? 'ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]' : ''}
        `}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <div className="flex flex-wrap gap-1 items-center flex-1">
          {multi && selectedValues.length > 0 ? (
              selectedValues.map(val => (
                  <span key={val} className="flex items-center gap-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2 py-1 rounded-lg text-xs font-bold animate-fade-in-up">
                      {val}
                      <span role="button" onClick={(e) => removeValue(e, val)} className="hover:text-red-500"><X size={12}/></span>
                  </span>
              ))
          ) : (
              <div className="flex items-center gap-2 px-1">
                <div className={`p-1 rounded-md ${value ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-400'}`}>
                    <Stethoscope size={14} />
                </div>
                <span className={`text-sm font-medium ${value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                    {(!multi && value) || placeholder || "Select..."}
                </span>
              </div>
          )}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform mx-2 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-80 overflow-hidden flex flex-col animate-fade-in-up">
          {/* Search Header */}
          <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                ref={inputRef}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white placeholder-gray-400"
                placeholder="Filter specialties..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
            {flatItems.length === 0 && search && (
              <div className="p-4 text-center text-sm text-gray-400 italic">No matches found</div>
            )}

            {Object.entries(groupedItems).map(([cat, grpItems]) => {
              const filteredGroup = (grpItems as Specialty[]).filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
              if(filteredGroup.length === 0) return null;

              return (
                <div key={cat} className="mb-2">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-slate-800/50 rounded-md mb-1 mx-1">
                    {cat}
                  </div>
                  {filteredGroup.map((item) => {
                    const isSelected = selectedValues.includes(item.name);
                    const isHighlighted = flatItems[highlightedIndex]?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(item.name);
                        }}
                        className={`
                          w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between group
                          ${isSelected ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800'}
                          ${isHighlighted && !isSelected ? 'bg-gray-50 dark:bg-slate-800' : ''}
                        `}
                      >
                        {item.name}
                        {isSelected && <Check size={16} />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecialtySelect;
