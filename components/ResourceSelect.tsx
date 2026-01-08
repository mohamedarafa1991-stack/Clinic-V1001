import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search, Plus, X, Tag, Stethoscope, Hash, Award } from 'lucide-react';
import { dbService } from '../services/db';

interface ResourceItem {
  id: number;
  name: string;
  category?: string;
}

interface ResourceSelectProps {
  resource: 'specialties' | 'doctor_titles';
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  placeholder?: string;
  multi?: boolean;
  allowAdd?: boolean;
}

const ResourceSelect: React.FC<ResourceSelectProps> = ({ 
  resource, value, onChange, error, placeholder, multi = false, allowAdd = true 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('General');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadItems = () => {
    try {
      if (resource === 'specialties') {
        setItems(dbService.query("SELECT * FROM specialties ORDER BY category, name"));
      } else {
        setItems(dbService.query("SELECT * FROM doctor_titles ORDER BY name"));
      }
    } catch(e) { console.error(e); }
  };

  useEffect(() => { loadItems(); }, [resource]);

  const selectedValues = useMemo(() => {
      if (!value) return [];
      return value.split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  const groupedItems = useMemo(() => {
      if (resource !== 'specialties') return { 'All': items };
      const groups: Record<string, ResourceItem[]> = {};
      items.forEach(i => {
          const cat = i.category || 'Other';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(i);
      });
      return groups;
  }, [items, resource]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowAddForm(false);
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
        // Don't close for multi
    } else {
        onChange(itemName);
        setIsOpen(false);
        setSearch('');
    }
  };

  const handleAdd = () => {
      if (!newItemName) return;
      try {
          if (resource === 'specialties') {
              dbService.exec("INSERT INTO specialties (name, category) VALUES (?, ?)", [newItemName, newItemCategory]);
          } else {
              dbService.exec("INSERT INTO doctor_titles (name) VALUES (?)", [newItemName]);
          }
          loadItems();
          handleSelect(newItemName);
          setNewItemName('');
          setShowAddForm(false);
      } catch (e) {
          console.error("Failed to add item", e);
      }
  };

  const removeValue = (e: React.MouseEvent, itemToRemove: string) => {
      e.stopPropagation();
      const newValues = selectedValues.filter(v => v !== itemToRemove);
      onChange(newValues.join(', '));
  };

  // Filter items based on search
  const filteredGroups = useMemo(() => {
      const result: Record<string, ResourceItem[]> = {};
      Object.keys(groupedItems).forEach(cat => {
          const filtered = groupedItems[cat].filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
          if (filtered.length > 0) result[cat] = filtered;
      });
      return result;
  }, [groupedItems, search]);

  const hasMatches = Object.keys(filteredGroups).length > 0;

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className={`
          min-h-[46px] flex items-center justify-between w-full p-2.5 rounded-xl border cursor-pointer bg-white dark:bg-slate-800 transition-all
          ${error ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200 dark:border-slate-700 hover:border-[var(--color-primary)] dark:hover:border-[var(--color-primary)]'}
          ${isOpen ? 'ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]' : ''}
        `}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1">
          {multi && selectedValues.length > 0 ? (
              selectedValues.map(val => (
                  <span key={val} className="flex items-center gap-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2 py-1 rounded-lg text-xs font-bold animate-fade-in-up border border-[var(--color-primary)]/20">
                      {val}
                      <span role="button" onClick={(e) => removeValue(e, val)} className="hover:text-red-500"><X size={12}/></span>
                  </span>
              ))
          ) : (
              <div className="flex items-center gap-2 px-1">
                {resource === 'doctor_titles' ? <Award size={16} className="text-gray-400" /> : <Stethoscope size={16} className="text-gray-400" />}
                <span className={`text-sm font-medium ${value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                    {(!multi && value) || placeholder || "Select..."}
                </span>
              </div>
          )}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform mx-2 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-96 flex flex-col animate-fade-in-up overflow-hidden">
          {/* Search Header */}
          {!showAddForm && (
            <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                    ref={inputRef}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white placeholder-gray-400"
                    placeholder={`Filter ${resource === 'specialties' ? 'Specialties' : 'Titles'}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                />
                </div>
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
            {showAddForm ? (
                <div className="p-4 space-y-4">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Plus size={16} className="text-[var(--color-primary)]" /> Add New {resource === 'specialties' ? 'Specialty' : 'Title'}
                    </h4>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Name</label>
                        <input 
                            autoFocus
                            className="w-full border p-2 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            placeholder={resource === 'specialties' ? 'e.g. Neurology' : 'e.g. Consultant'}
                        />
                    </div>
                    {resource === 'specialties' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Category</label>
                            <select 
                                className="w-full border p-2 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                value={newItemCategory}
                                onChange={e => setNewItemCategory(e.target.value)}
                            >
                                <option>Primary Care</option>
                                <option>Internal Specialists</option>
                                <option>Surgical</option>
                                <option>Women's Health</option>
                                <option>Head & Neck</option>
                                <option>Diagnostic</option>
                                <option>General</option>
                                <option>Other</option>
                            </select>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button onClick={handleAdd} className="px-3 py-1.5 text-xs font-bold bg-[var(--color-primary)] text-white rounded-lg">Save & Select</button>
                    </div>
                </div>
            ) : (
                <>
                    {!hasMatches && search && (
                        <div className="p-4 text-center text-sm text-gray-400 italic">No matches found</div>
                    )}

                    {Object.entries(filteredGroups).map(([cat, grpItems]) => (
                        <div key={cat} className="mb-2">
                        {resource === 'specialties' && (
                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-slate-800/50 rounded-md mb-1 mx-1 flex items-center gap-1">
                                <Hash size={10} /> {cat}
                            </div>
                        )}
                        {(grpItems as ResourceItem[]).map((item) => {
                            const isSelected = selectedValues.includes(item.name);
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
                                `}
                            >
                                {item.name}
                                {isSelected && <Check size={16} />}
                            </button>
                            );
                        })}
                        </div>
                    ))}
                </>
            )}
          </div>

          {/* Footer Action */}
          {allowAdd && !showAddForm && (
              <div className="p-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowAddForm(true); setNewItemName(search); }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
                  >
                      <Plus size={14} /> Add New {resource === 'specialties' ? 'Specialty' : 'Title'}
                  </button>
              </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResourceSelect;