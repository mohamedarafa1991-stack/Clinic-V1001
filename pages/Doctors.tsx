
import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { UserRole, Doctor, WorkSchedule, DoctorNote } from '../types';
import { 
  User, Plus, Save, X, Edit3, Trash2, Calendar, Clock, 
  FileText, BarChart2, StickyNote,
  Mail, Phone, Shield, AlertTriangle, Eye, EyeOff, DollarSign,
  MapPin, Briefcase, Award, Percent, History, Filter, AlertCircle, Info, Lock
} from 'lucide-react';
import ResourceSelect from '../components/ResourceSelect';
import FileDropzone from '../components/FileDropzone';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO, isAfter, formatDistanceToNow } from 'date-fns';

// Constants
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_SCHEDULE: WorkSchedule = DAYS.reduce((acc, day) => {
  acc[day] = { isWorking: day !== 'Sun', start: '09:00', end: '17:00' };
  return acc;
}, {} as WorkSchedule);

// --- Sub-Components ---

const StatusBadge = ({ status }: { status?: string }) => {
    const config = {
        'Active': { bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/20', dot: 'bg-emerald-500' },
        'On Leave': { bg: 'bg-amber-100 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/20', dot: 'bg-amber-500' },
        'Inactive': { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700', dot: 'bg-slate-500' }
    };
    const c = config[status as keyof typeof config] || config['Inactive'];
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            {status || 'Active'}
        </span>
    );
};

const ScheduleEditor = ({ schedule, onChange }: { schedule: WorkSchedule, onChange: (s: WorkSchedule) => void }) => {
    const { t } = useLanguage();
    
    const toggleDay = (day: string) => {
        onChange({
            ...schedule,
            [day]: { ...schedule[day], isWorking: !schedule[day].isWorking }
        });
    };

    const updateTime = (day: string, field: 'start' | 'end', value: string) => {
        onChange({
            ...schedule,
            [day]: { ...schedule[day], [field]: value }
        });
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <div className="col-span-3">{t('day')}</div>
                <div className="col-span-3 text-center">{t('status')}</div>
                <div className="col-span-6 text-center">{t('working_hours')}</div>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
            {DAYS.map(day => {
                const isWorking = schedule[day].isWorking;
                return (
                    <div key={day} className={`grid grid-cols-12 gap-4 items-center px-4 py-3 transition-colors ${isWorking ? 'bg-white dark:bg-slate-900' : 'bg-gray-50/30 dark:bg-slate-800/30'}`}>
                        <div className="col-span-3 font-bold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            {t(day as any)}
                        </div>
                        <div className="col-span-3 flex justify-center">
                            <button 
                                onClick={() => toggleDay(day)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isWorking ? 'bg-[var(--color-primary)]' : 'bg-gray-200 dark:bg-slate-700'}`}
                            >
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isWorking ? 'translate-x-5' : 'translate-x-1'}`}/>
                            </button>
                        </div>
                        <div className="col-span-6 flex gap-2 items-center justify-center">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white dark:bg-slate-800 transition-opacity ${isWorking ? 'border-gray-200 dark:border-slate-700 opacity-100' : 'border-transparent opacity-40 pointer-events-none'}`}>
                                <input 
                                    type="time" 
                                    value={schedule[day].start}
                                    onChange={(e) => updateTime(day, 'start', e.target.value)}
                                    className="bg-transparent border-none p-0 text-xs font-mono font-medium text-gray-800 dark:text-white focus:ring-0 w-16 text-center"
                                />
                                <span className="text-gray-300 text-[10px]">to</span>
                                <input 
                                    type="time" 
                                    value={schedule[day].end}
                                    onChange={(e) => updateTime(day, 'end', e.target.value)}
                                    className="bg-transparent border-none p-0 text-xs font-mono font-medium text-gray-800 dark:text-white focus:ring-0 w-16 text-center"
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
};

// --- Main Component ---

const Doctors = () => {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const isAdmin = user?.role === UserRole.ADMIN;
  
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule' | 'notes' | 'documents' | 'metrics'>('profile');
  
  // Data States
  const [formData, setFormData] = useState<Partial<Doctor>>({});
  const [scheduleData, setScheduleData] = useState<WorkSchedule>(DEFAULT_SCHEDULE);
  const [doctorNotes, setDoctorNotes] = useState<DoctorNote[]>([]);
  const [doctorDocs, setDoctorDocs] = useState<any[]>([]);
  const [allNotes, setAllNotes] = useState<DoctorNote[]>([]); // Cache for grid view
  
  // Note Form State
  const [noteForm, setNoteForm] = useState<Partial<DoctorNote>>({ type: 'Instruction', priority: 'Normal', visibility: 'All' });
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showNoteHistory, setShowNoteHistory] = useState(false);

  useEffect(() => { refreshDoctors(); }, []);
  
  const refreshDoctors = () => { 
      setDoctors(dbService.query("SELECT * FROM doctors")); 
      refreshAllNotes();
  };

  const refreshAllNotes = () => {
      setAllNotes(dbService.query("SELECT * FROM doctor_notes"));
  };

  const loadSubData = (docId: number) => {
      setDoctorNotes(dbService.query(`SELECT * FROM doctor_notes WHERE doctorId = ${docId} ORDER BY createdAt DESC`));
      setDoctorDocs(dbService.query(`SELECT * FROM doctor_documents WHERE doctorId = ${docId} ORDER BY id DESC`));
      refreshAllNotes(); 
  };

  const handleSelectDoctor = (doc: Doctor) => {
    setSelectedDoctor(doc);
    setFormData(doc);
    try { setScheduleData(JSON.parse(doc.schedule)); } catch { setScheduleData(DEFAULT_SCHEDULE); }
    loadSubData(doc.id);
    setActiveTab('profile');
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!formData.name) return alert("Name is required");
    const query = selectedDoctor 
        ? `UPDATE doctors SET name=?, title=?, licenseId=?, specialty=?, fee=?, commissionRate=?, bio=?, schedule=?, photo=?, phone=?, email=?, status=? WHERE id=?`
        : `INSERT INTO doctors (name, title, licenseId, specialty, fee, commissionRate, bio, schedule, photo, phone, email, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
        formData.name, formData.title || 'Dr.', formData.licenseId || '', formData.specialty || 'General Practice', 
        formData.fee || 0, formData.commissionRate || 0, formData.bio || '', JSON.stringify(scheduleData), formData.photo || '', 
        formData.phone || '', formData.email || '', formData.status || 'Active'
    ];
    if (selectedDoctor) params.push(selectedDoctor.id);

    dbService.exec(query, params);
    refreshDoctors();
    if(selectedDoctor) loadSubData(selectedDoctor.id);
    
    if (!selectedDoctor) {
        setShowAddModal(false);
        setIsEditing(false);
    } else {
        setIsEditing(false);
    }
  };

  const handleAddNote = () => {
      if(!noteForm.text || !selectedDoctor) return;
      
      if (noteForm.type === 'Temporary' && !noteForm.expiryDate) {
          alert('Please select an expiry date for temporary notes.');
          return;
      }

      dbService.exec(
          "INSERT INTO doctor_notes (doctorId, text, type, priority, expiryDate, visibility, createdAt, authorName, authorRole) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
              selectedDoctor.id, noteForm.text, noteForm.type, noteForm.priority, 
              noteForm.expiryDate || null, noteForm.visibility, new Date().toISOString(), 
              user?.name || 'Admin', user?.role
          ]
      );
      setNoteForm({ type: 'Instruction', priority: 'Normal', visibility: 'All', text: '' });
      setShowNoteForm(false);
      loadSubData(selectedDoctor.id);
  };

  const handleDeleteNote = (id: number) => {
      if(confirm('Are you sure you want to delete this note?')) {
          dbService.exec("DELETE FROM doctor_notes WHERE id = ?", [id]);
          if(selectedDoctor) loadSubData(selectedDoctor.id);
      }
  };

  const handleFilesAdded = (files: any[]) => {
      if (!selectedDoctor) return;
      files.forEach(f => {
          dbService.exec(
              "INSERT INTO doctor_documents (doctorId, name, type, size, content, uploadDate) VALUES (?,?,?,?,?,?)", 
              [selectedDoctor.id, f.name, f.type, f.size, f.content, new Date().toISOString().split('T')[0]]
          );
      });
      loadSubData(selectedDoctor.id);
  };

  const handleDeleteDoc = (id: number) => {
      if(confirm('Delete document?')) {
          dbService.exec("DELETE FROM doctor_documents WHERE id = ?", [id]);
          if(selectedDoctor) loadSubData(selectedDoctor.id);
      }
  };

  const startNewDoctor = () => {
    setFormData({ title: 'Dr.', commissionRate: 0 }); 
    setScheduleData(DEFAULT_SCHEDULE);
    setSelectedDoctor(null);
    setDoctorNotes([]);
    setDoctorDocs([]);
    setShowAddModal(true);
    setIsEditing(true);
    setActiveTab('profile');
  };

  const handleDelete = () => {
      if(selectedDoctor && confirm(`Delete Dr. ${selectedDoctor.name}?`)) {
          dbService.exec("DELETE FROM doctors WHERE id = ?", [selectedDoctor.id]);
          refreshDoctors();
          setSelectedDoctor(null);
      }
  };

  // Mock Metrics Data
  const metricsData = [
      { name: 'Jan', patients: 65, revenue: 4200 },
      { name: 'Feb', patients: 59, revenue: 3800 },
      { name: 'Mar', patients: 80, revenue: 5100 },
      { name: 'Apr', patients: 81, revenue: 5300 },
      { name: 'May', patients: 56, revenue: 3200 },
      { name: 'Jun', patients: 95, revenue: 6800 },
  ];

  const getDisplayNotes = () => {
      const now = new Date();
      return doctorNotes.filter(n => {
          // 1. Role-based Visibility Check
          if (n.visibility === 'Admin' && user?.role !== UserRole.ADMIN) return false;
          if (n.visibility === 'Medical' && ![UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE].includes(user?.role as UserRole)) return false;
          
          // 2. Expiry/History Check
          if (n.type === 'Temporary' && n.expiryDate) {
              const isExpired = isAfter(now, parseISO(n.expiryDate));
              if (isExpired && !showNoteHistory) return false;
          }
          
          return true;
      });
  };

  // Filter for critical alerts on Profile tab
  const getCriticalAlerts = () => {
      return getDisplayNotes().filter(n => n.priority === 'Critical' || n.priority === 'Important');
  };

  // Helper to get active note count for grid card
  const getDoctorActiveNotes = (doctorId: number) => {
      const now = new Date();
      return allNotes.filter(n => 
          n.doctorId === doctorId && 
          (!n.expiryDate || !isAfter(now, parseISO(n.expiryDate)))
      );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 px-1 gap-4">
        <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Shield className="text-[var(--color-primary)]" size={32} /> {t('staff_directory')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Manage doctor profiles, schedules, and performance.</p>
        </div>
        {isAdmin && (
            <button 
                onClick={startNewDoctor} 
                className="bg-[var(--color-primary)] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 hover:opacity-90 transition-all active:scale-95 font-bold text-sm"
            >
                <Plus size={18} /> {t('add_specialist')}
            </button>
        )}
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-20 p-1 custom-scrollbar">
        {doctors.map(doc => {
            const activeNotes = getDoctorActiveNotes(doc.id);
            const criticalCount = activeNotes.filter(n => n.priority === 'Critical').length;
            const latestNote = activeNotes.sort((a,b) => b.id - a.id)[0];

            return (
                <div 
                    key={doc.id} 
                    onClick={() => handleSelectDoctor(doc)} 
                    className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 hover:border-[var(--color-primary)] dark:hover:border-[var(--color-primary)] cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full"
                >
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="p-6 flex-1">
                        <div className="flex justify-between items-start mb-5">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-800 flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold text-xl shadow-inner border border-gray-100 dark:border-slate-700">
                                {doc.name.charAt(0)}
                            </div>
                            <StatusBadge status={doc.status} />
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">{doc.title}</p>
                            <h3 className="font-bold text-xl text-gray-900 dark:text-white leading-tight group-hover:text-[var(--color-primary)] transition-colors">
                                {doc.name}
                            </h3>
                            <p className="text-sm font-medium text-[var(--color-primary)] mt-1">{doc.specialty}</p>
                        </div>

                        <div className="space-y-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-gray-400" /> 
                                <span className="truncate">{doc.phone || 'No phone'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail size={14} className="text-gray-400" /> 
                                <span className="truncate">{doc.email || 'No email'}</span>
                            </div>
                        </div>

                        {/* Card Note Indicator */}
                        {activeNotes.length > 0 && latestNote && (
                            <div className={`mt-4 p-3 rounded-xl border flex items-start gap-2 ${criticalCount > 0 ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/50' : 'bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900/50'}`}>
                                {criticalCount > 0 ? <AlertTriangle size={14} className="text-red-500 mt-0.5" /> : <StickyNote size={14} className="text-blue-500 mt-0.5" />}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <p className={`text-[10px] font-bold uppercase ${criticalCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                            {criticalCount > 0 ? 'Critical Alert' : 'Active Note'}
                                        </p>
                                        {activeNotes.length > 1 && (
                                            <span className="text-[9px] px-1.5 rounded-full bg-white dark:bg-black/20 text-gray-500 border border-black/5">+{activeNotes.length - 1} more</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate font-medium">
                                        {latestNote.text}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center text-xs">
                        <div className="flex flex-col">
                            <span className="text-gray-400 uppercase font-bold text-[10px] tracking-wide">Consultation</span>
                            <span className="font-bold text-gray-800 dark:text-white text-sm">{doc.fee} EGP</span>
                        </div>
                        {doc.commissionRate ? (
                            <div className="flex flex-col text-right">
                                <span className="text-gray-400 uppercase font-bold text-[10px] tracking-wide">Comm.</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{doc.commissionRate}%</span>
                            </div>
                        ) : null}
                    </div>
                </div>
            );
        })}
      </div>

      {/* Side Panel Modal */}
      {(selectedDoctor || showAddModal) && (
        <div className="fixed inset-0 z-50 flex justify-end" dir={dir}>
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => { setSelectedDoctor(null); setShowAddModal(false); }}></div>
           
           <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-slide-in-right border-l rtl:border-l-0 rtl:border-r border-gray-200 dark:border-slate-800">
              
              {/* Modal Header */}
              <div className="px-8 py-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10 sticky top-0">
                  <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {isEditing || showAddModal ? <Edit3 size={24} className="text-[var(--color-primary)]"/> : <User size={24} className="text-[var(--color-primary)]"/>}
                          {isEditing ? (selectedDoctor ? t('edit_profile') : t('add_specialist')) : selectedDoctor?.name}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">{isEditing ? t('availability_config') : selectedDoctor?.specialty}</p>
                  </div>
                  <div className="flex gap-2">
                       {isEditing ? (
                          <button onClick={handleSave} className="px-5 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold flex items-center gap-2 hover:opacity-90 shadow-lg shadow-[var(--color-primary)]/20 transition-all text-sm">
                              <Save size={16} /> {t('save')}
                          </button>
                      ) : (isAdmin && (
                          <>
                            <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg font-bold flex gap-2 transition-colors text-sm">
                                <Edit3 size={16} /> {t('edit')}
                            </button>
                            <button onClick={handleDelete} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors">
                                <Trash2 size={20}/>
                            </button>
                          </>
                      ))}
                      <button onClick={() => {setSelectedDoctor(null); setShowAddModal(false);}} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                          <X size={24}/>
                      </button>
                  </div>
              </div>

              {/* Modal Tabs */}
              <div className="px-8 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 flex gap-6 overflow-x-auto">
                  {[
                      { id: 'profile', icon: User, label: 'tab_profile' },
                      { id: 'schedule', icon: Clock, label: 'tab_schedule' },
                      { id: 'notes', icon: StickyNote, label: 'tab_notes' },
                      { id: 'documents', icon: FileText, label: 'tab_documents' },
                      { id: 'metrics', icon: BarChart2, label: 'tab_metrics' },
                  ].map(tab => (
                      <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                          <tab.icon size={16}/> {t(tab.label as any)}
                      </button>
                  ))}
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30 dark:bg-black/20 custom-scrollbar">
                  
                  {/* TAB: PROFILE */}
                  {activeTab === 'profile' && (
                      <div className="space-y-8 animate-fade-in-up">
                          {/* Alerts Section in Profile */}
                          {getCriticalAlerts().length > 0 && (
                              <div className="mb-6 space-y-3">
                                  {getCriticalAlerts().map(note => (
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
                                  <User size={14}/> Identity & Professional
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="col-span-1 md:col-span-2 flex gap-4">
                                      <div className="flex-1">
                                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('title')}</label>
                                          {isEditing ? (
                                              <ResourceSelect 
                                                resource="doctor_titles"
                                                value={formData.title || ''}
                                                onChange={(v) => setFormData({...formData, title: v})}
                                                placeholder="Select"
                                              />
                                          ) : <p className="font-medium dark:text-white p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">{formData.title}</p>}
                                      </div>
                                      <div className="flex-[3]">
                                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('full_name')}</label>
                                          {isEditing ? (
                                              <input className="w-full border p-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)] outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Sarah House" />
                                          ) : <p className="font-bold text-lg dark:text-white p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">{formData.name}</p>}
                                      </div>
                                  </div>

                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('specialty')}</label>
                                      {isEditing ? (
                                          <ResourceSelect 
                                            resource="specialties"
                                            value={formData.specialty || ''}
                                            onChange={(val) => setFormData({...formData, specialty: val})}
                                            placeholder="Choose Specialty"
                                            multi={true}
                                          />
                                      ) : <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 font-medium text-[var(--color-primary)]">{formData.specialty}</div>}
                                  </div>

                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('license_id')}</label>
                                      {isEditing ? (
                                          <div className="relative">
                                              <Award className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                                              <input className="w-full border pl-10 pr-3 py-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white" value={formData.licenseId || ''} onChange={e => setFormData({...formData, licenseId: e.target.value})} />
                                          </div>
                                      ) : <p className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 font-mono text-sm dark:text-white">{formData.licenseId || 'N/A'}</p>}
                                  </div>
                              </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                  <Briefcase size={14}/> Status & Financials
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('status')}</label>
                                      {isEditing ? (
                                          <select className="w-full border p-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white" value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                              <option>Active</option><option>On Leave</option><option>Inactive</option>
                                          </select>
                                      ) : <StatusBadge status={formData.status} />}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('consultation_fee')}</label>
                                      {isEditing ? (
                                          <div className="relative">
                                              <span className="absolute left-3 top-3.5 text-gray-400 text-xs font-bold">EGP</span>
                                              <input type="number" className="w-full border pl-10 pr-3 py-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white font-mono font-bold" value={formData.fee} onChange={e => setFormData({...formData, fee: Number(e.target.value)})} />
                                          </div>
                                      ) : <p className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 font-bold text-gray-800 dark:text-white">{formData.fee} EGP</p>}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">Commission <Percent size={10}/></label>
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
                              </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                                  <MapPin size={14}/> Contact Details
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('email')}</label>
                                      {isEditing ? (
                                          <div className="relative">
                                              <Mail className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                                              <input className="w-full border pl-10 pr-3 py-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                                          </div>
                                      ) : <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-sm text-gray-600 dark:text-gray-300"><Mail size={16}/> {formData.email || '--'}</div>}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('phone')}</label>
                                      {isEditing ? (
                                          <div className="relative">
                                              <Phone className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                                              <input className="w-full border pl-10 pr-3 py-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                          </div>
                                      ) : <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 text-sm text-gray-600 dark:text-gray-300"><Phone size={16}/> {formData.phone || '--'}</div>}
                                  </div>
                                  <div className="col-span-1 md:col-span-2">
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('bio_notes')}</label>
                                      {isEditing ? (
                                          <textarea className="w-full border p-3 rounded-xl bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 dark:text-white h-24 resize-none focus:ring-2 focus:ring-[var(--color-primary)] outline-none" value={formData.bio || ''} onChange={e => setFormData({...formData, bio: e.target.value})} />
                                      ) : <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 italic">{formData.bio || 'No details provided.'}</p>}
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* TAB: SCHEDULE */}
                  {activeTab === 'schedule' && (
                      <div className="animate-fade-in-up">
                          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                              <div className="flex justify-between items-center mb-6">
                                <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2"><Clock size={14}/> Weekly Roster</h4>
                                <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">24-Hour Format</span>
                              </div>
                              {isEditing ? (
                                  <ScheduleEditor schedule={scheduleData} onChange={setScheduleData} />
                              ) : (
                                  <div className="space-y-2">
                                      {DAYS.map(day => (
                                          <div key={day} className="flex justify-between items-center p-3 border border-gray-100 dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-800/50">
                                              <div className="flex items-center gap-3">
                                                  <div className={`w-2 h-2 rounded-full ${scheduleData[day].isWorking ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-700'}`}></div>
                                                  <span className="font-bold text-sm text-gray-700 dark:text-gray-300 w-16">{t(day as any)}</span>
                                              </div>
                                              {scheduleData[day].isWorking ? (
                                                  <span className="text-sm font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
                                                      {scheduleData[day].start} - {scheduleData[day].end}
                                                  </span>
                                              ) : (
                                                  <span className="text-xs text-gray-400 italic bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">{t('off_duty')}</span>
                                              )}
                                          </div>
                                      ))}
                                  </div>
                              )}
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
                                  <p className="text-[10px] text-gray-400 mt-1">Directives, temporary memos, and admin logs.</p>
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
                              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xl animate-fade-in-up relative z-10">
                                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100 dark:border-slate-800">
                                      <h4 className="font-bold text-gray-800 dark:text-white">Compose New Note</h4>
                                      <X size={16} className="text-gray-400 cursor-pointer hover:text-red-500" onClick={() => setShowNoteForm(false)}/>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                      <div>
                                          <label className="block text-xs font-bold text-gray-500 mb-1.5">{t('note_type')}</label>
                                          <select className="w-full border p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]" value={noteForm.type} onChange={e => setNoteForm({...noteForm, type: e.target.value as any})}>
                                              <option value="Instruction">{t('note_instruction')}</option>
                                              <option value="Temporary">{t('note_temp')}</option>
                                              <option value="Permanent">{t('note_permanent')}</option>
                                          </select>
                                      </div>
                                      <div>
                                          <label className="block text-xs font-bold text-gray-500 mb-1.5">{t('priority')}</label>
                                          <select className="w-full border p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]" value={noteForm.priority} onChange={e => setNoteForm({...noteForm, priority: e.target.value as any})}>
                                              <option value="Normal">Normal</option>
                                              <option value="Important">Important</option>
                                              <option value="Critical">Critical</option>
                                          </select>
                                      </div>
                                      <div>
                                          <label className="block text-xs font-bold text-gray-500 mb-1.5">Visibility</label>
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
                                      <button onClick={handleAddNote} className="px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90 flex items-center gap-2">
                                          <Save size={16}/> {t('save')}
                                      </button>
                                  </div>
                              </div>
                          )}
                          
                          {/* Note Stream */}
                          <div className="space-y-4">
                              {getDisplayNotes().map(note => {
                                  const isExpired = note.type === 'Temporary' && note.expiryDate && isAfter(new Date(), parseISO(note.expiryDate));
                                  return (
                                      <div key={note.id} className={`p-5 rounded-2xl border bg-white dark:bg-slate-900 relative group transition-all hover:shadow-md ${
                                          isExpired ? 'opacity-60 border-dashed bg-gray-50 dark:bg-slate-800/50' : 
                                          'border-gray-200 dark:border-slate-800'
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
                                                              {note.authorName?.charAt(0)}
                                                          </div>
                                                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{note.authorName}</span>
                                                      </div>
                                                      <span className="text-[10px] text-gray-400">{formatDistanceToNow(parseISO(note.createdAt), { addSuffix: true })}</span>
                                                  </div>
                                                  
                                                  <div className="flex items-center gap-2">
                                                      {isExpired && <span className="bg-gray-200 dark:bg-slate-700 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Expired</span>}
                                                      {note.priority !== 'Normal' && (
                                                          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                                              note.priority === 'Critical' ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
                                                          }`}>
                                                              <AlertCircle size={10}/> {note.priority}
                                                          </span>
                                                      )}
                                                      {note.visibility !== 'All' && (
                                                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
                                                              {note.visibility === 'Admin' ? <Lock size={10}/> : <EyeOff size={10}/>} {note.visibility}
                                                          </span>
                                                      )}
                                                      {isAdmin && <button onClick={() => handleDeleteNote(note.id)} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ml-2"><Trash2 size={14}/></button>}
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

                  {/* TAB: DOCUMENTS */}
                  {activeTab === 'documents' && (
                      <div className="animate-fade-in-up space-y-6">
                          <FileDropzone onFilesAdded={handleFilesAdded} />
                          <div className="grid grid-cols-1 gap-3">
                              {doctorDocs.map(doc => (
                                  <div key={doc.id} className="flex justify-between p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl items-center group hover:border-[var(--color-primary)] transition-all">
                                      <div className="flex gap-4 items-center">
                                          <div className={`p-3 rounded-xl ${doc.type.includes('pdf') ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : 'bg-blue-50 text-blue-500 dark:bg-blue-900/20'}`}>
                                              <FileText size={24}/>
                                          </div>
                                          <div>
                                              <span className="font-bold text-sm text-gray-800 dark:text-white block">{doc.name}</span>
                                              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{doc.size} • {doc.uploadDate}</span>
                                          </div>
                                      </div>
                                      <button onClick={() => handleDeleteDoc(doc.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                                  </div>
                              ))}
                              {doctorDocs.length === 0 && <p className="text-center text-gray-400 text-sm py-8 italic">No documents attached.</p>}
                          </div>
                      </div>
                  )}

                  {/* TAB: METRICS */}
                  {activeTab === 'metrics' && (
                      <div className="animate-fade-in-up space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                  <div className="absolute top-0 right-0 p-4 opacity-5 text-[var(--color-primary)]"><User size={64}/></div>
                                  <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">{t('total_patients')}</h5>
                                  <p className="text-4xl font-bold text-gray-900 dark:text-white">1,240</p>
                                  <p className="text-[10px] text-emerald-500 font-bold mt-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> +12% from last month</p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                  <div className="absolute top-0 right-0 p-4 opacity-5 text-emerald-500"><DollarSign size={64}/></div>
                                  <h5 className="text-xs text-gray-500 uppercase font-bold mb-2">{t('revenue_ytd')}</h5>
                                  <p className="text-4xl font-bold text-[var(--color-primary)]">EGP 850k</p>
                                  <p className="text-[10px] text-emerald-500 font-bold mt-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> On Track</p>
                              </div>
                          </div>
                          
                          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 h-80 shadow-sm">
                              <h5 className="text-xs text-gray-500 uppercase font-bold mb-6 flex items-center gap-2"><BarChart2 size={14}/> {t('patient_volume')}</h5>
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={metricsData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#9ca3af'}} />
                                      <Tooltip 
                                        cursor={{fill: 'transparent'}} 
                                        contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} 
                                      />
                                      <Bar dataKey="patients" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={40} />
                                  </BarChart>
                              </ResponsiveContainer>
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

export default Doctors;
