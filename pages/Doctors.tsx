
import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { UserRole, Doctor, WorkSchedule, DoctorNote, DoctorTitle } from '../types';
import { 
  User, Plus, Save, X, Edit3, Trash2, Calendar, Clock, 
  FileText, Upload, BarChart2, StickyNote, CheckCircle2,
  Mail, Phone, Shield, AlertTriangle, Eye, EyeOff, DollarSign
} from 'lucide-react';
import ResourceSelect from '../components/ResourceSelect';
import FileDropzone from '../components/FileDropzone';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO, isAfter } from 'date-fns';

// Constants
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_SCHEDULE: WorkSchedule = DAYS.reduce((acc, day) => {
  acc[day] = { isWorking: day !== 'Sun', start: '09:00', end: '17:00' };
  return acc;
}, {} as WorkSchedule);

// Schedule Editor Component
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
        <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-400 uppercase px-2">
                <div className="col-span-2">{t('day')}</div>
                <div className="col-span-2 text-center">{t('status')}</div>
                <div className="col-span-8 text-center">{t('working_hours')}</div>
            </div>
            {DAYS.map(day => (
                <div key={day} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-xl border transition-colors ${schedule[day].isWorking ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm' : 'bg-gray-50 dark:bg-slate-900 border-transparent opacity-60'}`}>
                    <div className="col-span-2 font-bold text-gray-700 dark:text-gray-300">{t(day as any)}</div>
                    <div className="col-span-2 flex justify-center">
                        <button 
                            onClick={() => toggleDay(day)}
                            className={`w-10 h-6 rounded-full transition-colors relative ${schedule[day].isWorking ? 'bg-[var(--color-primary)]' : 'bg-gray-300 dark:bg-slate-600'}`}
                        >
                            <div className={`absolute top-1 left-1 rtl:right-1 rtl:left-auto w-4 h-4 bg-white rounded-full transition-transform ${schedule[day].isWorking ? 'translate-x-4 rtl:-translate-x-4' : ''}`}></div>
                        </button>
                    </div>
                    <div className="col-span-8 flex gap-2 items-center justify-center">
                        <input 
                            type="time" 
                            disabled={!schedule[day].isWorking}
                            value={schedule[day].start}
                            onChange={(e) => updateTime(day, 'start', e.target.value)}
                            className="bg-gray-100 dark:bg-slate-700 border-none rounded-lg px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white"
                        />
                        <span className="text-gray-400">-</span>
                        <input 
                            type="time" 
                            disabled={!schedule[day].isWorking}
                            value={schedule[day].end}
                            onChange={(e) => updateTime(day, 'end', e.target.value)}
                            className="bg-gray-100 dark:bg-slate-700 border-none rounded-lg px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

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
  
  // Note Form State
  const [noteForm, setNoteForm] = useState<Partial<DoctorNote>>({ type: 'Instruction', priority: 'Normal', visibility: 'All' });
  const [showNoteForm, setShowNoteForm] = useState(false);

  useEffect(() => { refreshDoctors(); }, []);
  const refreshDoctors = () => { 
      setDoctors(dbService.query("SELECT * FROM doctors")); 
  };

  const loadSubData = (docId: number) => {
      setDoctorNotes(dbService.query(`SELECT * FROM doctor_notes WHERE doctorId = ${docId} ORDER BY createdAt DESC`));
      setDoctorDocs(dbService.query(`SELECT * FROM doctor_documents WHERE doctorId = ${docId} ORDER BY id DESC`));
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
      dbService.exec("DELETE FROM doctor_notes WHERE id = ?", [id]);
      if(selectedDoctor) loadSubData(selectedDoctor.id);
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
    setFormData({ title: 'Dr.' }); // Default title if list empty
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

  const getActiveNotes = () => {
      const now = new Date();
      return doctorNotes.filter(n => {
          if (n.visibility === 'Admin' && user?.role !== UserRole.ADMIN) return false;
          if (n.visibility === 'Medical' && ![UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE].includes(user?.role as UserRole)) return false;
          if (n.type === 'Temporary' && n.expiryDate && isAfter(now, parseISO(n.expiryDate))) return false;
          return true;
      });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <div className="flex justify-between items-end mb-8">
        <div><h2 className="text-3xl font-bold text-gray-900 dark:text-white">{t('staff_directory')}</h2></div>
        {isAdmin && <button onClick={startNewDoctor} className="bg-gray-900 dark:bg-slate-700 text-white px-5 py-2.5 rounded-xl flex gap-2 shadow-lg hover:opacity-90"><Plus size={18} /> {t('add_specialist')}</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-20 p-1">
        {doctors.map(doc => (
            <div key={doc.id} onClick={() => handleSelectDoctor(doc)} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 hover:border-[var(--color-primary)] cursor-pointer p-6 shadow-sm transition-all group hover:-translate-y-1">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold text-xl shadow-inner">
                        {doc.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{doc.name}</h3>
                        <p className="text-xs text-[var(--color-primary)] font-bold uppercase tracking-wide mt-1">{doc.specialty}</p>
                    </div>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-slate-800 pt-3">
                    <span className="flex items-center gap-1"><Calendar size={12}/> {JSON.parse(doc.schedule).Mon?.isWorking ? 'Mon-Fri' : 'Flexible'}</span>
                    <span className="font-bold bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">{doc.fee} EGP</span>
                </div>
                {doc.status === 'On Leave' && <div className="mt-2 text-center text-[10px] font-bold bg-orange-100 text-orange-700 rounded py-1">ON LEAVE</div>}
            </div>
        ))}
      </div>

      {(selectedDoctor || showAddModal) && (
        <div className="fixed inset-0 z-50 flex justify-end" dir={dir}>
           <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => { setSelectedDoctor(null); setShowAddModal(false); }}></div>
           <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-up border-l rtl:border-l-0 rtl:border-r border-gray-200 dark:border-slate-800">
              {/* Header */}
              <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900 z-10 sticky top-0">
                  <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{isEditing ? (selectedDoctor ? t('edit_profile') : t('add_specialist')) : t('doctor_profile')}</h2>
                      <p className="text-sm text-gray-500">{isEditing ? t('availability_config') : t('professional_details')}</p>
                  </div>
                  <div className="flex gap-2">
                       {isEditing ? (
                          <button onClick={handleSave} className="px-4 py-2 bg-gray-900 dark:bg-slate-700 text-white rounded-lg font-bold flex items-center gap-2 hover:opacity-90"><Save size={16} /> {t('save')}</button>
                      ) : (isAdmin && (
                          <>
                            <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg font-bold flex gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-white"><Edit3 size={16} /> {t('edit')}</button>
                            <button onClick={handleDelete} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg"><Trash2 size={18}/></button>
                          </>
                      ))}
                      <button onClick={() => {setSelectedDoctor(null); setShowAddModal(false);}} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"><X size={24}/></button>
                  </div>
              </div>

              {/* Tabs */}
              <div className="flex px-8 border-b border-gray-100 dark:border-slate-800 overflow-x-auto gap-6 bg-white dark:bg-slate-900">
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
                        className={`pb-4 pt-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                      >
                          <tab.icon size={16}/> {t(tab.label as any)}
                      </button>
                  ))}
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50 dark:bg-slate-800/50">
                  
                  {/* TAB: PROFILE */}
                  {activeTab === 'profile' && (
                      <div className="space-y-6 animate-fade-in-up">
                          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                              <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><User size={14}/> {t('professional_details')}</h4>
                              <div className="grid grid-cols-2 gap-6">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{t('title')}</label>
                                      {isEditing ? (
                                          <ResourceSelect 
                                            resource="doctor_titles"
                                            value={formData.title || ''}
                                            onChange={(v) => setFormData({...formData, title: v})}
                                            placeholder="Select Title"
                                          />
                                      ) : <p className="font-medium dark:text-white">{formData.title}</p>}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{t('full_name')}</label>
                                      {isEditing ? <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)] outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Dr. Name" /> : <p className="text-lg font-bold dark:text-white">{formData.name}</p>}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{t('specialty')}</label>
                                      {isEditing ? (
                                          <ResourceSelect 
                                            resource="specialties"
                                            value={formData.specialty || ''}
                                            onChange={(val) => setFormData({...formData, specialty: val})}
                                            placeholder="Choose Specialty"
                                            multi={true}
                                          />
                                      ) : <p className="font-medium text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg inline-block">{formData.specialty}</p>}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{t('license_id')}</label>
                                      {isEditing ? <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={formData.licenseId || ''} onChange={e => setFormData({...formData, licenseId: e.target.value})} /> : <p className="font-mono text-sm dark:text-white">{formData.licenseId || 'N/A'}</p>}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{t('consultation_fee')}</label>
                                      {isEditing ? <input type="number" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)] outline-none" value={formData.fee} onChange={e => setFormData({...formData, fee: Number(e.target.value)})} /> : <p className="font-bold text-[var(--color-primary)] text-lg">{formData.fee} EGP</p>}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">Commission % <DollarSign size={12}/></label>
                                      {isEditing ? <input type="number" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={formData.commissionRate || 0} onChange={e => setFormData({...formData, commissionRate: Number(e.target.value)})} /> : <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-bold">{formData.commissionRate || 0}%</span>}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{t('status')}</label>
                                      {isEditing ? (
                                          <select className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                              <option>Active</option><option>On Leave</option><option>Inactive</option>
                                          </select>
                                      ) : <span className={`px-2 py-1 rounded text-xs font-bold ${formData.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{formData.status || 'Active'}</span>}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{t('email')}</label>
                                      {isEditing ? <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} /> : <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Mail size={14}/> {formData.email || '--'}</div>}
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{t('phone')}</label>
                                      {isEditing ? <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} /> : <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><Phone size={14}/> {formData.phone || '--'}</div>}
                                  </div>
                                  <div className="col-span-2">
                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">{t('bio_notes')}</label>
                                      {isEditing ? <textarea className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white h-24 resize-none focus:ring-2 focus:ring-[var(--color-primary)] outline-none" value={formData.bio || ''} onChange={e => setFormData({...formData, bio: e.target.value})} /> : <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-slate-800 p-3 rounded-xl">{formData.bio || 'No details provided.'}</p>}
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* TAB: SCHEDULE */}
                  {activeTab === 'schedule' && (
                      <div className="animate-fade-in-up bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                          <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2"><Clock size={14}/> {t('availability_config')}</h4>
                          {isEditing ? (
                              <ScheduleEditor schedule={scheduleData} onChange={setScheduleData} />
                          ) : (
                              <div className="space-y-3">
                                  {DAYS.map(day => (
                                      <div key={day} className="flex justify-between items-center py-3 border-b border-gray-50 dark:border-slate-800 last:border-0">
                                          <div className="flex items-center gap-3">
                                              <div className={`w-2 h-2 rounded-full ${scheduleData[day].isWorking ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                                              <span className="font-bold text-sm text-gray-700 dark:text-gray-300 w-16">{t(day as any)}</span>
                                          </div>
                                          {scheduleData[day].isWorking ? (
                                              <span className="text-sm font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700">
                                                  {scheduleData[day].start} - {scheduleData[day].end}
                                              </span>
                                          ) : (
                                              <span className="text-xs text-gray-400 italic bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded">{t('off_duty')}</span>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}

                  {/* TAB: NOTES (New Advanced System) */}
                  {activeTab === 'notes' && (
                      <div className="animate-fade-in-up space-y-4">
                          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                              {!showNoteForm ? (
                                  <button onClick={() => setShowNoteForm(true)} className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-slate-700 text-gray-400 font-bold rounded-xl hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2">
                                      <Plus size={18}/> {t('add_note_placeholder')}
                                  </button>
                              ) : (
                                  <div className="space-y-4">
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                          <select className="border p-2 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white" value={noteForm.type} onChange={e => setNoteForm({...noteForm, type: e.target.value as any})}>
                                              <option value="Permanent">{t('note_permanent')}</option>
                                              <option value="Temporary">{t('note_temp')}</option>
                                              <option value="Instruction">{t('note_instruction')}</option>
                                          </select>
                                          <select className="border p-2 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white" value={noteForm.priority} onChange={e => setNoteForm({...noteForm, priority: e.target.value as any})}>
                                              <option value="Normal">Normal Priority</option>
                                              <option value="Important">Important</option>
                                              <option value="Critical">Critical</option>
                                          </select>
                                          <select className="border p-2 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white" value={noteForm.visibility} onChange={e => setNoteForm({...noteForm, visibility: e.target.value as any})}>
                                              <option value="All">Visible to All</option>
                                              <option value="Medical">Medical Staff Only</option>
                                              <option value="Admin">Admin Only</option>
                                          </select>
                                          {noteForm.type === 'Temporary' && (
                                              <input type="date" className="border p-2 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white" onChange={e => setNoteForm({...noteForm, expiryDate: e.target.value})} />
                                          )}
                                      </div>
                                      <textarea 
                                          className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:text-white h-24"
                                          placeholder={t('add_note_placeholder')}
                                          value={noteForm.text}
                                          onChange={(e) => setNoteForm({...noteForm, text: e.target.value})}
                                      />
                                      <div className="flex justify-end gap-2">
                                          <button onClick={() => setShowNoteForm(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">{t('cancel')}</button>
                                          <button onClick={handleAddNote} className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold">{t('add')}</button>
                                      </div>
                                  </div>
                              )}
                          </div>
                          
                          <div className="space-y-3">
                              {getActiveNotes().map(note => (
                                  <div key={note.id} className={`p-4 rounded-xl border relative group ${
                                      note.priority === 'Critical' ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900' :
                                      note.priority === 'Important' ? 'bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-900' :
                                      'bg-gray-50 border-gray-100 dark:bg-slate-800/50 dark:border-slate-700'
                                  }`}>
                                      <div className="flex justify-between items-start mb-2">
                                          <div className="flex items-center gap-2">
                                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                  note.type === 'Instruction' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                                              }`}>{note.type}</span>
                                              {note.visibility !== 'All' && <span className="flex items-center gap-1 text-[10px] text-gray-500"><EyeOff size={10}/> {note.visibility}</span>}
                                          </div>
                                          <button onClick={() => handleDeleteNote(note.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                                      </div>
                                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{note.text}</p>
                                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                                          <span className="text-[10px] text-gray-400 font-medium">By {note.authorName} ({note.authorRole})</span>
                                          <span className="text-[10px] text-gray-400">{new Date(note.createdAt).toLocaleDateString()} {note.expiryDate ? `• Expires: ${note.expiryDate}` : ''}</span>
                                      </div>
                                  </div>
                              ))}
                              {doctorNotes.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No notes yet.</p>}
                          </div>
                      </div>
                  )}

                  {/* TAB: DOCUMENTS */}
                  {activeTab === 'documents' && (
                      <div className="animate-fade-in-up space-y-6">
                          <FileDropzone onFilesAdded={handleFilesAdded} />
                          <div className="grid grid-cols-1 gap-3">
                              {doctorDocs.map(doc => (
                                  <div key={doc.id} className="flex justify-between p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl items-center">
                                      <div className="flex gap-3 items-center">
                                          <div className={`p-2 rounded-lg ${doc.type.includes('pdf') ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                              <FileText size={20}/>
                                          </div>
                                          <div>
                                              <span className="font-bold text-sm text-gray-800 dark:text-white block">{doc.name}</span>
                                              <span className="text-[10px] text-gray-400">{doc.size} • {doc.uploadDate}</span>
                                          </div>
                                      </div>
                                      <button onClick={() => handleDeleteDoc(doc.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* TAB: METRICS */}
                  {activeTab === 'metrics' && (
                      <div className="animate-fade-in-up space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800">
                                  <h5 className="text-xs text-gray-500 uppercase font-bold">{t('total_patients')}</h5>
                                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">1,240</p>
                              </div>
                              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800">
                                  <h5 className="text-xs text-gray-500 uppercase font-bold">{t('revenue_ytd')}</h5>
                                  <p className="text-2xl font-bold text-[var(--color-primary)] mt-1">EGP 850k</p>
                              </div>
                          </div>
                          
                          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 h-64">
                              <h5 className="text-xs text-gray-500 uppercase font-bold mb-4">{t('patient_volume')}</h5>
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={metricsData}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#9ca3af'}} />
                                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', backgroundColor: '#1e293b', color: '#fff'}} />
                                      <Bar dataKey="patients" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={30} />
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
