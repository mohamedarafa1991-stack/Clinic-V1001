
import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/db';
import { 
  Search, Pill, Building2, FlaskConical, Stethoscope, 
  Tag, AlertTriangle, Info, ArrowRight, DollarSign, Plus
} from 'lucide-react';
import { Medicine } from '../types';

const DrugIndex = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDrug, setSelectedDrug] = useState<Medicine | null>(null);
  
  // Alternatives
  const [alternatives, setAlternatives] = useState<Medicine[]>([]);

  // Infinite Scroll Limit
  const DISPLAY_LIMIT = 50;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
      if (selectedDrug) {
          // Find alternatives (Same generic, different ID)
          const alts = medicines.filter(m => 
              m.generic === selectedDrug.generic && m.id !== selectedDrug.id
          );
          setAlternatives(alts);
      }
  }, [selectedDrug, medicines]);

  const loadData = () => {
    const data = dbService.query("SELECT * FROM medicines ORDER BY name ASC");
    setMedicines(data);
  };

  const categories = useMemo(() => {
      const cats = new Set(medicines.map(m => m.category).filter(Boolean));
      return ['All', ...Array.from(cats).sort()];
  }, [medicines]);

  const filteredMedicines = useMemo(() => {
      let result = medicines;
      if (selectedCategory !== 'All') {
          result = result.filter(m => m.category === selectedCategory);
      }
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          result = result.filter(m => 
              m.name.toLowerCase().includes(lower) || 
              m.generic.toLowerCase().includes(lower) || 
              m.manufacturer.toLowerCase().includes(lower)
          );
      }
      return result;
  }, [medicines, searchTerm, selectedCategory]);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 pb-6">
      
      {/* LEFT COLUMN: Search & List (Reference App Style) */}
      <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
          {/* Header & Search */}
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-3">
                  <Pill className="text-[var(--color-primary)]" /> Drug Reference
              </h2>
              <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input 
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none dark:text-white transition-all"
                      placeholder="Search trade or generic name..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>

          {/* Categories Sidebar (Horizontal Scroll on Mobile) */}
          <div className="p-2 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 overflow-x-auto whitespace-nowrap custom-scrollbar flex gap-2">
              {categories.map(cat => (
                  <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedCategory === cat ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                  >
                      {cat}
                  </button>
              ))}
          </div>

          {/* List Results */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-gray-50 dark:bg-slate-900/50">
              {filteredMedicines.length === 0 ? (
                  <div className="text-center py-10 px-4">
                      <p className="text-gray-400 text-sm">No drugs found.</p>
                  </div>
              ) : (
                  filteredMedicines.slice(0, DISPLAY_LIMIT).map(m => (
                      <div 
                          key={m.id}
                          onClick={() => setSelectedDrug(m)}
                          className={`p-3 rounded-xl cursor-pointer border transition-all ${selectedDrug?.id === m.id ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-[var(--color-primary)] dark:hover:border-[var(--color-primary)]'}`}
                      >
                          <div className="flex justify-between items-start">
                              <h4 className={`font-bold text-sm ${selectedDrug?.id === m.id ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>{m.name}</h4>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedDrug?.id === m.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                                  {m.category || 'Drug'}
                              </span>
                          </div>
                          <p className={`text-xs mt-1 truncate ${selectedDrug?.id === m.id ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                              {m.generic}
                          </p>
                          <div className={`mt-2 flex justify-between items-center text-[10px] font-medium ${selectedDrug?.id === m.id ? 'text-white/90' : 'text-gray-400'}`}>
                              <span>{m.form} {m.concentration}</span>
                              {/* Price Display */}
                              {/* @ts-ignore */}
                              {m.price ? <span>{m.price} EGP</span> : <span>-</span>}
                          </div>
                      </div>
                  ))
              )}
              {filteredMedicines.length > DISPLAY_LIMIT && (
                  <div className="text-center py-4">
                      <p className="text-xs text-gray-400 font-medium">Showing top {DISPLAY_LIMIT} results</p>
                  </div>
              )}
          </div>
      </div>

      {/* RIGHT COLUMN: Professional Detail View */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden">
          {selectedDrug ? (
              <div className="flex flex-col h-full animate-fade-in-up">
                  {/* Hero Header */}
                  <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b border-gray-200 dark:border-slate-700 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5">
                          <FlaskConical size={120} className="text-[var(--color-primary)]" />
                      </div>
                      <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-2">
                              <span className="bg-[var(--color-primary)] text-white px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                                  {selectedDrug.category || 'Pharmaceutical'}
                              </span>
                              {/* @ts-ignore */}
                              {selectedDrug.price && (
                                  <span className="bg-emerald-500 text-white px-2 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                      <DollarSign size={10} /> {selectedDrug.price} EGP
                                  </span>
                              )}
                          </div>
                          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">{selectedDrug.name}</h1>
                          <p className="text-xl text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
                              {selectedDrug.generic}
                          </p>
                      </div>
                  </div>

                  {/* Details Grid */}
                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          
                          {/* Basic Info */}
                          <div className="space-y-6">
                              <div className="bg-gray-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                      <Info size={16}/> Product Specifications
                                  </h3>
                                  <ul className="space-y-4">
                                      <li className="flex justify-between border-b border-gray-200 dark:border-slate-700 pb-2">
                                          <span className="text-sm text-gray-500 dark:text-gray-400">Dosage Form</span>
                                          <span className="text-sm font-bold text-gray-800 dark:text-white">{selectedDrug.form}</span>
                                      </li>
                                      <li className="flex justify-between border-b border-gray-200 dark:border-slate-700 pb-2">
                                          <span className="text-sm text-gray-500 dark:text-gray-400">Concentration</span>
                                          <span className="text-sm font-bold text-gray-800 dark:text-white">{selectedDrug.concentration}</span>
                                      </li>
                                      <li className="flex justify-between border-b border-gray-200 dark:border-slate-700 pb-2">
                                          <span className="text-sm text-gray-500 dark:text-gray-400">Manufacturer</span>
                                          <span className="text-sm font-bold text-[var(--color-primary)] flex items-center gap-1">
                                              <Building2 size={14}/> {selectedDrug.manufacturer}
                                          </span>
                                      </li>
                                  </ul>
                              </div>

                              {/* Clinical Note (Mocked for professional feel) */}
                              <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
                                  <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <Stethoscope size={16}/> Clinical Indication
                                  </h3>
                                  <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                                      Indicated for treatment related to {selectedDrug.category?.toLowerCase() || 'general'} conditions. 
                                      Always verify dosage and contraindications before prescribing.
                                  </p>
                              </div>
                          </div>

                          {/* Market Alternatives */}
                          <div>
                              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <Tag size={16}/> Market Alternatives ({alternatives.length})
                              </h3>
                              <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                                  {alternatives.length === 0 ? (
                                      <p className="p-6 text-center text-sm text-gray-400">No direct alternatives found in index.</p>
                                  ) : (
                                      <div className="divide-y divide-gray-100 dark:divide-slate-800">
                                          {alternatives.map(alt => (
                                              <div 
                                                  key={alt.id} 
                                                  onClick={() => setSelectedDrug(alt)}
                                                  className="p-4 hover:bg-white dark:hover:bg-slate-700 cursor-pointer transition-colors group"
                                              >
                                                  <div className="flex justify-between items-center mb-1">
                                                      <span className="font-bold text-sm text-gray-800 dark:text-white group-hover:text-[var(--color-primary)] transition-colors">{alt.name}</span>
                                                      {/* @ts-ignore */}
                                                      {alt.price && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{alt.price} EGP</span>}
                                                  </div>
                                                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                                                      <span>{alt.manufacturer}</span>
                                                      <span className="bg-gray-200 dark:bg-slate-600 px-1.5 rounded text-[10px]">{alt.form}</span>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-50/30 dark:bg-slate-800/30">
                  <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg mb-6">
                      <Pill size={48} className="text-[var(--color-primary)] opacity-50" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Select a Drug</h2>
                  <p className="text-gray-500 dark:text-gray-400 max-w-md">
                      Search and select a medication from the list to view full professional details, price, and market alternatives.
                  </p>
                  <div className="mt-8 flex gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1"><Tag size={12}/> Trade Names</span>
                      <span className="flex items-center gap-1"><FlaskConical size={12}/> Generics</span>
                      <span className="flex items-center gap-1"><Building2 size={12}/> Manufacturers</span>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default DrugIndex;
