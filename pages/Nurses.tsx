
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { UserRole, Nurse, NurseNote } from '../types';
import { 
  Plus, Edit3, Trash2, Syringe, Mail, Phone, X, Save, 
  DollarSign, Activity, User, StickyNote, BarChart2, EyeOff,
  History, Clock, AlertTriangle, CheckCircle2, Lock, AlertCircle, Info
} from 'lucide-react';
import { format, parseISO, isAfter, formatDistanceToNow } from 'date-fns';
import FileDropzone from '../components/FileDropzone';

const StatusBadge = ({ status }: { status?: string }) => {
    const styles = status === 'Active' 
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
        : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-400 border-gray-200 dark:border-slate-700';
    
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${styles}`}>
            {status || 'Active'}
        </span>
    );
};

const Nurses = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notes' | 'metrics'>('profile');

  // Data States
  const [formData, setFormData] = useState<Partial<Nurse>>({});
  const [nurseNotes, setNurseNotes] = useState<NurseNote[]>([]);
  const [allNotes, setAllNotes] = useState<NurseNote[]>([]); // Cache for grid view

  // Note Form State
  const [noteForm, setNoteForm] = useState<Partial<NurseNote>>({ type: 'Instruction', priority: 'Normal', visibility: 'All' });
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showNoteHistory, setShowNoteHistory] = useState(false);

  useEffect(() => { loadNurses(); refreshAllNotes(); }, []);

  const loadNurses = () => {
    setNurses(dbService.query("SELECT * FROM nurses ORDER BY name"));
  };

  const refreshAllNotes = () => {
      setAllNotes(dbService.query("SELECT * FROM nurse_notes"));
  }

  const loadSubData = (nurseId: number) => {
      const notes = dbService.query(`SELECT * FROM nurse_notes WHERE nurseId = ${nurseId} ORDER BY createdAt DESC`);
      setNurseNotes(notes);
      refreshAllNotes(); // Keep global cache sync
  };

  const handleSelectNurse = (nurse: Nurse) => {
      setSelectedNurse(nurse);
      setFormData(nurse);
      loadSubData(nurse.id);
      setActiveTab('profile');
      setIsEditing(false);
  };

  const handleSave = () => {
      if(!formData.name) return alert("Name is required");
      const query = selectedNurse 
          ? `UPDATE nurses SET name=?, phone=?, email=?, status=?, commissionRate=? WHERE id=?`
          : `INSERT INTO nurses (name, phone, email, status, commissionRate) VALUES (?, ?, ?, ?, ?)`;
      
      const params = [formData.name, formData.phone, formData.email, formData.status || 'Active', formData.commissionRate || 0];
      if (selectedNurse) params.push(selectedNurse.id);

      dbService.exec(query, params);
      loadNurses();
      
      if (!selectedNurse) {
          setShowAddModal(false);
          setIsEditing(false);
      } else {
          setIsEditing(false);
          setSelectedNurse({...selectedNurse, ...formData} as Nurse);
      }
  };

  const startNewNurse = () => {
      setFormData({ status: 'Active', commissionRate: 0 });
      setSelectedNurse(null);
      setNurseNotes([]);
      setShowAddModal(true);
      setIsEditing(true);
      setActiveTab('profile');
  };

  const handleDelete = () => {
      if(selectedNurse && confirm(`Delete ${selectedNurse.name}?`)) {
          dbService.exec("DELETE FROM nurses WHERE id=?", [selectedNurse.id]);
          loadNurses();
          setSelectedNurse(null);
      }
  };

  // --- Notes Logic ---
  const handleAddNote = () => {
      if(!noteForm.text || !selectedNurse) return;
      
      if (noteForm.type === 'Temporary' && !noteForm.expiryDate) {
          alert('Please select an expiry date for temporary notes.');
          return;
      }

      dbService.exec(
          "INSERT INTO nurse_notes (nurseId, text, type, priority, expiryDate, visibility, createdAt, authorName, authorRole) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
              selectedNurse.id, noteForm.text, noteForm.type, noteForm.priority, 
              noteForm.expiryDate || null, noteForm.visibility, new Date().toISOString(), 
              user?.name || 'Admin', user?.role
          ]
      );
      setNoteForm({ type: 'Instruction', priority: 'Normal', visibility: 'All', text: '' });
      setShowNoteForm(false);
      loadSubData(selectedNurse.id);
  };

  const handleDeleteNote = (id: number) => {
      if(confirm('Delete note?')) {
        dbService.exec("DELETE FROM nurse_notes WHERE id = ?", [id]);
        if(selectedNurse) loadSubData(selectedNurse.id);
      }
  };

  const getDisplayNotes = () => {
      const now = new Date();
      return nurseNotes.filter(n => {
          // Visibility
          if (n.visibility === 'Admin' && user?.role !== UserRole.ADMIN) return false;
          if (n.visibility === 'Medical' && ![UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE].includes(user?.role as UserRole)) return false;
          
          // Expiry
          if (n.type === 'Temporary' && n.expiryDate) {
              const isExpired = isAfter(now, parseISO(n.expiryDate));
              if (isExpired && !showNoteHistory) return false;
          }
          return true;
      });
  };

  // Helper to get active note count for grid card
  const getNurseActiveNotes = (nurseId: number) => {
      const now = new Date();
      return allNotes.filter(n => 
          n.nurseId === nurseId && 
          (!n.expiryDate || !isAfter(now, parseISO(n.expiryDate)))
      );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
        <div className="flex justify-between items-end mb-8 px-1">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <Activity className="text-[var(--color-primary)]" size={32} /> {t('nurses')}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Clinical support staff management.</p>
            </div>
            {isAdmin && (
                <button 
                    onClick={startNewNurse} 
                    className="bg-[var(--color-primary)] text-white px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 hover:opacity-90 transition-all active:scale-95 font-bold text-sm"
                >
                    <Plus size={18} /> {t('add_nurse')}
                </button>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-20 p-1 custom-scrollbar">
            {nurses.map(nurse => {
                const activeNotes = getNurseActiveNotes(nurse.id);
                const criticalCount = activeNotes.filter(n => n.priority === 'Critical').length;
                const latestNote = activeNotes.sort((a,b) => b.id - a.id)[0];

                return (
                <div 
                    key={nurse.id} 
                    onClick={() => handleSelectNurse(nurse)}
                    className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 hover:border-[var(--color-primary)] cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
                >
                    <div className="p-6 flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/20 dark:to-rose-800/20 flex items-center justify-center text-rose-500 dark:text-rose-400 font-bold text-2xl shadow-inner border border-white/10">
                                <Syringe size={24} />
                            </div>
                            <StatusBadge status={nurse.status} />
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Registered Nurse</p>
                            <h3 className="font-bold text-xl text-gray-900 dark:text-white leading-tight group-hover:text-[var(--color-primary)] transition-colors">
                                {nurse.name}
                            </h3>
                        </div>

                        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-gray-300" /> 
                                <span className="truncate">{nurse.phone || 'No phone'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail size={14} className="text-gray-300" /> 
                                <span className="truncate">{nurse.email || 'No email'}</span>
                            </div>
                        </div>

                        {/* Card Note Indicator */}
                        {activeNotes.length > 0 && latestNote && (
                            <div className={`mt-4 p-3 rounded-xl border flex items-start gap-2 ${criticalCount > 0 ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/50' : 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/50'}`}>
                                {criticalCount > 0 ? <AlertTriangle size={14} className="text-red-500 mt-0.5" /> : <StickyNote size={14} className="text-blue-500 mt-0.5" />}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-bold uppercase mb-0.5 ${criticalCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                        {criticalCount > 0 ? 'Critical Attention' : 'Active Instruction'}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate font-medium">
                                        {latestNote.text}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-medium">
                            {activeNotes.length} Note{activeNotes.length !== 1 ? 's' : ''}
                        </span>
                        {nurse.commissionRate ? (
                            <div className="flex flex-col text-right">
                                <span className="text-gray-400 uppercase font-bold text-[10px]">Comm.</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{nurse.commissionRate}%</span>
                            </div>
                        ) : <span></span>}
                    </div>
                </div>
            )})}
        </div>

        {/* Slide-over Modal */}
        {(selectedNurse || showAddModal) && (
            <div className="fixed inset-0 z-50 flex justify-end" dir={dir}>
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => { setSelectedNurse(null); setShowAddModal(false); }}></div>
                
                <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-slide-in-right border-l rtl:border-l-0 rtl:border-r border-gray-200 dark:border-slate-800">
                    
                    {/* Header */}
                    <div className="px-8 py-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10 sticky top-0">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {isEditing || showAddModal ? <Edit3 size={24} className="text-[var(--color-primary)]"/> : <User size={24} className="text-[var(--color-primary)]"/>}
                                {isEditing ? (selectedNurse ? t('edit_profile') : t('add_nurse')) : selectedNurse?.name}
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Nurse Profile & Administration</p>
                        </div>
                        <div className="flex gap-3">
                            {isEditing ? (
                                <button onClick={handleSave} className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl font-bold flex items-center gap-2 hover:opacity-90 shadow-lg shadow-[var(--color-primary)]/20 transition-all">
                                    <Save size={18} /> {t('save')}
                                </button>
                            ) : (isAdmin && (
                                <>
                                    <button onClick={() => setIsEditing(true)} className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold flex gap-2 transition-colors">
                                        <Edit3 size={18} /> {t('edit')}
                                    </button>
                                    <button onClick={handleDelete} className="p-2.5 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors">
                                        <Trash2 size={20}/>
                                    </button>
                                </>
                            ))}
                            <button onClick={() => {setSelectedNurse(null); setShowAddModal(false);}} className="p-2.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <X size={24}/>
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="px-8 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 flex gap-6 overflow-x-auto">
                        {[
                            { id: 'profile', icon: User, label: 'tab_profile' },
                            { id: 'notes', icon: StickyNote, label: 'tab_notes' },
                            { id: 'metrics', icon: BarChart2, label: 'tab_metrics' },
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <tab.icon size={16}/> {t(tab.label as any)}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30 dark:bg-black/20 custom-scrollbar">
                        
                        {/* TAB: PROFILE */}
                        {activeTab === 'profile' && (
                            <div className="space-y-8 animate-fade-in-up">
                                 {/* Alerts Section in Profile */}
                                 {getDisplayNotes().filter(n => n.priority !== 'Normal').length > 0 && (
                                      <div className="mb-2 space-y-3">
                                          {getDisplayNotes().filter(n => n.priority !== 'Normal').map(note => (
                                              <div key={note.id} className={`p-4 rounded-xl border flex items-start gap-3 ${
                                                  note.priority === 'Critical' 
                                                    ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-900 dark:text-red-300' 
                                                    : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-900 dark:text-amber-300'
                                              }`}>
                                                  <AlertCircle size={20} className="mt-0.5 shrink-0" />
                                                  <div>
                                                      <h5 className="font-bold text-sm uppercase mb-1">{note.priority} Alert</h5>
                                                      <p className="text-sm leading-relaxed">{note.text}</p>
                                                      <p className="text-xs mt-2 opacity-70 flex items-center gap-2"><Clock size={10}/> Expires: {note.expiryDate || 'Never'}</p>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                        <User size={14}/> Personal Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('full_name')}</label>
                                            {isEditing ? (
                                                <input className="w-full border p-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)] outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nurse Name" />
                                            ) : <p className="font-bold text-lg dark:text-white p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">{formData.name}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('status')}</label>
                                            {isEditing ? (
                                                <select className="w-full border p-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white" value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                                    <option>Active</option><option>Inactive</option>
                                                </select>
                                            ) : <StatusBadge status={formData.status} />}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">Commission <DollarSign size={10}/></label>
                                            {isEditing ? (
                                                <input 
                                                    type="number" min="0" max="100" 
                                                    className="w-full border p-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white font-mono font-bold"
                                                    value={formData.commissionRate || 0} 
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val) && val >= 0 && val <= 100) setFormData({...formData, commissionRate: val});
                                                    }} 
                                                />
                                            ) : <span className="p-3 block bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold">{formData.commissionRate || 0}%</span>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('email')}</label>
                                            {isEditing ? (
                                                <input className="w-full border p-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                                            ) : <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-sm text-gray-600 dark:text-gray-300"><Mail size={16}/> {formData.email || '--'}</div>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('phone')}</label>
                                            {isEditing ? (
                                                <input className="w-full border p-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                            ) : <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-sm text-gray-600 dark:text-gray-300"><Phone size={16}/> {formData.phone || '--'}</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: NOTES */}
                        {activeTab === 'notes' && (
                            <div className="animate-fade-in-up space-y-6">
                                {/* Note Header & Actions */}
                                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm sticky top-0 z-10">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><StickyNote size={14}/> {t('internal_notes')}</h4>
                                        <p className="text-[10px] text-gray-400 mt-1">Instructions, temporary memos, and admin logs.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowNoteHistory(!showNoteHistory)} className={`p-2 rounded-lg border transition-colors ${showNoteHistory ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`} title="Toggle History/Expired">
                                            <History size={16}/>
                                        </button>
                                        <button onClick={() => setShowNoteForm(!showNoteForm)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${showNoteForm ? 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700' : 'bg-[var(--color-primary)] text-white border-transparent shadow-lg shadow-[var(--color-primary)]/20'}`}>
                                            {showNoteForm ? t('cancel') : t('add')}
                                        </button>
                                    </div>
                                </div>

                                {/* Add Note Form */}
                                {showNoteForm && (
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-lg animate-fade-in-up relative z-10">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('note_type')}</label>
                                                <select className="w-full border p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]" value={noteForm.type} onChange={e => setNoteForm({...noteForm, type: e.target.value as any})}>
                                                    <option value="Instruction">{t('note_instruction')}</option>
                                                    <option value="Temporary">{t('note_temp')}</option>
                                                    <option value="Permanent">{t('note_permanent')}</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('priority')}</label>
                                                <select className="w-full border p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]" value={noteForm.priority} onChange={e => setNoteForm({...noteForm, priority: e.target.value as any})}>
                                                    <option value="Normal">Normal</option>
                                                    <option value="Important">Important</option>
                                                    <option value="Critical">Critical</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Visibility</label>
                                                <select className="w-full border p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]" value={noteForm.visibility} onChange={e => setNoteForm({...noteForm, visibility: e.target.value as any})}>
                                                    <option value="All">All Staff</option>
                                                    <option value="Medical">Medical Only</option>
                                                    <option value="Admin">Admin Only</option>
                                                </select>
                                            </div>
                                        </div>
                                        
                                        {noteForm.type === 'Temporary' && (
                                            <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800 flex items-center gap-3">
                                                <Clock size={18} className="text-amber-600 dark:text-amber-400"/>
                                                <div className="flex-1">
                                                    <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">{t('expiry_date')}</label>
                                                    <input type="date" className="w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700 p-2 rounded-lg text-sm" onChange={e => setNoteForm({...noteForm, expiryDate: e.target.value})} />
                                                </div>
                                            </div>
                                        )}

                                        <textarea 
                                            className="w-full border p-4 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white dark:border-slate-700 h-32 focus:ring-2 focus:ring-[var(--color-primary)] outline-none resize-none text-sm"
                                            placeholder={t('add_note_placeholder')}
                                            value={noteForm.text}
                                            onChange={(e) => setNoteForm({...noteForm, text: e.target.value})}
                                        />
                                        
                                        <div className="flex justify-end gap-3 mt-4">
                                            <button onClick={() => setShowNoteForm(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-bold text-sm">{t('cancel')}</button>
                                            <button onClick={handleAddNote} className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all">{t('save')}</button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Note Stream */}
                                <div className="space-y-4">
                                    {getDisplayNotes().map(note => {
                                        const isExpired = note.type === 'Temporary' && note.expiryDate && isAfter(new Date(), parseISO(note.expiryDate));
                                        return (
                                            <div key={note.id} className={`p-5 rounded-2xl border relative group transition-all hover:shadow-md ${
                                                isExpired ? 'opacity-60 border-dashed bg-gray-50 dark:bg-slate-800/50' : 
                                                'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800'
                                            }`}>
                                                <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-md ${
                                                    note.priority === 'Critical' ? 'bg-red-500' : 
                                                    note.priority === 'Important' ? 'bg-orange-500' :
                                                    note.type === 'Instruction' ? 'bg-blue-500' : 'bg-gray-300'
                                                }`}></div>

                                                <div className="pl-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2">
                                                            {/* Author Badge */}
                                                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-full pl-1 pr-3 py-1 border border-gray-200 dark:border-slate-700">
                                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                                                    note.authorRole === UserRole.ADMIN ? 'bg-purple-500' : 
                                                                    note.authorRole === UserRole.DOCTOR ? 'bg-blue-500' : 'bg-slate-500'
                                                                }`}>
                                                                    {note.authorName?.charAt(0) || '?'}
                                                                </div>
                                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{note.authorName}</span>
                                                            </div>
                                                            <span className="text-[10px] text-gray-400">{formatDistanceToNow(parseISO(note.createdAt), { addSuffix: true })}</span>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-2">
                                                            {isExpired && <span className="bg-gray-200 dark:bg-slate-700 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Expired</span>}
                                                            
                                                            {note.priority !== 'Normal' && (
                                                                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                                                    note.priority === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                                                                }`}>
                                                                    <AlertCircle size={10}/> {note.priority}
                                                                </span>
                                                            )}
                                                            
                                                            {note.visibility !== 'All' && (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
                                                                    {note.visibility === 'Admin' ? <Lock size={10}/> : <EyeOff size={10}/>} {note.visibility}
                                                                </span>
                                                            )}
                                                            
                                                            {isAdmin && <button onClick={() => handleDeleteNote(note.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>}
                                                        </div>
                                                    </div>
                                                    
                                                    <p className={`text-sm leading-relaxed whitespace-pre-wrap mt-2 ${isExpired ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>{note.text}</p>
                                                    
                                                    {note.type === 'Temporary' && note.expiryDate && (
                                                        <div className="mt-3 flex items-center gap-2 text-[10px] text-amber-600 dark:text-amber-500 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded w-fit">
                                                            <Clock size={12}/> 
                                                            Expires: {note.expiryDate}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {getDisplayNotes().length === 0 && (
                                        <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-2xl">
                                            <div className="bg-gray-50 dark:bg-slate-800/50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300 dark:text-slate-600">
                                                <Info size={20}/>
                                            </div>
                                            <p className="text-gray-400 text-sm font-medium">No active notes.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB: METRICS */}
                        {activeTab === 'metrics' && (
                            <div className="animate-fade-in-up">
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm text-center py-12">
                                    <BarChart2 size={48} className="mx-auto text-gray-300 mb-4"/>
                                    <p className="text-gray-500">Performance metrics coming soon.</p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Nurses;
