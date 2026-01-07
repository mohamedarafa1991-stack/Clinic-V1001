import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, Doctor, WorkSchedule, DoctorNote } from '../types';
import { 
  User, Clock, Calendar, Phone, Mail, 
  Edit3, Save, X, Stethoscope, 
  ChevronRight, Plus, Trash2, 
  Briefcase, TrendingUp, Upload, Settings, ListPlus, PenLine, Check, Award,
  FileText, Image as ImageIcon, Eye, Copy, Download, StickyNote, Pin, Shield, Timer
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Pie, PieChart as RePieChart, Legend } from 'recharts';
import { format, parseISO, isPast, isFuture } from 'date-fns';

// --- Types & Helpers ---
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_SCHEDULE: WorkSchedule = DAYS.reduce((acc, day) => {
  acc[day] = { isWorking: day !== 'Sun', start: '09:00', end: '17:00' };
  return acc;
}, {} as WorkSchedule);

// --- Sub-Components ---

const ScheduleEditor = ({ 
  schedule, 
  onChange, 
  readOnly 
}: { 
  schedule: WorkSchedule, 
  onChange: (s: WorkSchedule) => void,
  readOnly: boolean 
}) => {
  const handleDayChange = (day: string, field: string, value: any) => {
    const newSchedule = { ...schedule, [day]: { ...schedule[day], [field]: value } };
    onChange(newSchedule);
  };

  const copyToWeekdays = () => {
    if (readOnly) return;
    const base = schedule['Mon'];
    const newSchedule = { ...schedule };
    ['Tue', 'Wed', 'Thu', 'Fri'].forEach(d => {
        newSchedule[d] = { ...base };
    });
    onChange(newSchedule);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {!readOnly && (
         <div className="bg-gray-50 dark:bg-slate-800 px-4 py-2 border-b border-gray-200 dark:border-slate-700 flex justify-end">
            <button 
                onClick={copyToWeekdays}
                title="Copy Monday's schedule to Tuesday through Friday"
                className="text-xs bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 font-bold flex items-center gap-2 transition-all shadow-sm"
            >
                <Copy size={14} /> Copy Mon to Weekdays
            </button>
         </div>
      )}
      <div className="divide-y divide-gray-100 dark:divide-slate-800">
        {DAYS.map(day => {
          const s = schedule[day] || { isWorking: false, start: '09:00', end: '17:00' };
          return (
            <div key={day} className={`grid grid-cols-12 items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${!s.isWorking ? 'opacity-60 bg-gray-50/50 dark:bg-slate-800/30' : ''}`}>
              <div className="col-span-2 font-bold text-gray-700 dark:text-gray-300 text-sm flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${s.isWorking ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`}></div>
                 {day}
              </div>
              
              <div className="col-span-2 flex items-center">
                 <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={s.isWorking}
                      disabled={readOnly}
                      onChange={(e) => handleDayChange(day, 'isWorking', e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                 </label>
              </div>

              <div className="col-span-8 flex items-center gap-2">
                  {s.isWorking ? (
                    <>
                      <div className="relative flex-1">
                        <input 
                            type="time" 
                            value={s.start} 
                            disabled={readOnly}
                            onChange={(e) => handleDayChange(day, 'start', e.target.value)}
                            className="w-full border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium text-center"
                        />
                      </div>
                      <span className="text-gray-400 text-xs font-medium">TO</span>
                      <div className="relative flex-1">
                        <input 
                            type="time" 
                            value={s.end} 
                            disabled={readOnly}
                            onChange={(e) => handleDayChange(day, 'end', e.target.value)}
                            className="w-full border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium text-center"
                        />
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 font-medium italic w-full text-center bg-gray-100 dark:bg-slate-800 py-1.5 rounded-lg border border-transparent">
                        Clinic Closed
                    </span>
                  )}
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
  const isAdmin = user?.role === UserRole.ADMIN;
  
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule' | 'metrics' | 'documents' | 'notes'>('profile');
  
  // Specialties Management
  const [specialties, setSpecialties] = useState<{id: number, name: string}[]>([]);
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [newSpec, setNewSpec] = useState('');
  const [editingSpec, setEditingSpec] = useState<{id: number, name: string} | null>(null);

  // Edit Form State
  const [formData, setFormData] = useState<Partial<Doctor>>({});
  const [scheduleData, setScheduleData] = useState<WorkSchedule>(DEFAULT_SCHEDULE);
  
  // Advanced Analytics Data
  const [analyticsData, setAnalyticsData] = useState<{
    timeline: any[];
    statusDist: any[];
    totalPatients: number;
    completionRate: number;
  }>({ timeline: [], statusDist: [], totalPatients: 0, completionRate: 0 });

  // Documents
  const [documents, setDocuments] = useState<any[]>([]);

  // Notes
  const [notes, setNotes] = useState<DoctorNote[]>([]);
  const [showExpiredNotes, setShowExpiredNotes] = useState(false);
  const [newNote, setNewNote] = useState<{
      text: string;
      type: 'Permanent' | 'Temporary';
      priority: 'Normal' | 'Important';
      expiryDate: string;
      visibility: 'All' | 'Admin' | 'Medical';
  }>({ text: '', type: 'Permanent', priority: 'Normal', expiryDate: '', visibility: 'All' });

  const refreshDoctors = () => {
    setDoctors(dbService.query("SELECT * FROM doctors"));
  };

  const refreshSpecialties = () => {
    setSpecialties(dbService.query("SELECT * FROM specialties ORDER BY name ASC"));
  };

  const refreshDocuments = () => {
      if(!selectedDoctor) return;
      const docs = dbService.query(`SELECT * FROM doctor_documents WHERE doctorId = ${selectedDoctor.id} ORDER BY id DESC`);
      setDocuments(docs);
  };

  const refreshNotes = () => {
      if (!selectedDoctor) return;
      // Get all notes for doctor
      let allNotes: DoctorNote[] = dbService.query(`SELECT * FROM doctor_notes WHERE doctorId = ${selectedDoctor.id} ORDER BY createdAt DESC`);
      
      // Filter by role visibility
      if (!isAdmin) {
          allNotes = allNotes.filter(n => {
              if (n.visibility === 'All') return true;
              if (n.visibility === 'Medical' && (user?.role === UserRole.DOCTOR || user?.role === UserRole.NURSE)) return true;
              // AdminOnly is filtered out
              return false;
          });
      }

      setNotes(allNotes);
  };

  useEffect(() => {
    refreshDoctors();
    refreshSpecialties();
  }, []);

  useEffect(() => {
    if (selectedDoctor) {
        // Fetch Documents
        refreshDocuments();
        
        // Fetch Notes
        refreshNotes();

        // Calculate Analytics
        const apps = dbService.query(`SELECT * FROM appointments WHERE doctorId = ${selectedDoctor.id}`);
        
        // 1. Timeline (Appointments by Date)
        const dateMap: Record<string, number> = {};
        apps.forEach((a: any) => {
            const date = a.date.substring(5); // MM-DD
            dateMap[date] = (dateMap[date] || 0) + 1;
        });
        const timeline = Object.keys(dateMap).sort().map(d => ({ date: d, count: dateMap[d] }));

        // 2. Status Distribution
        const statusMap: Record<string, number> = {};
        apps.forEach((a: any) => {
            statusMap[a.status] = (statusMap[a.status] || 0) + 1;
        });
        const statusDist = Object.keys(statusMap).map(s => ({ name: s, value: statusMap[s] }));

        // 3. KPI
        const totalPatients = new Set(apps.map((a:any) => a.patientId)).size;
        const completed = apps.filter((a:any) => a.status === 'Completed').length;
        const rate = apps.length > 0 ? Math.round((completed / apps.length) * 100) : 0;

        setAnalyticsData({ timeline, statusDist, totalPatients, completionRate: rate });
    }
  }, [selectedDoctor]);

  // Grouping Logic
  const groupedDoctors = useMemo(() => {
      const groups: Record<string, Doctor[]> = {};
      doctors.forEach(doc => {
          const spec = doc.specialty || 'General';
          if (!groups[spec]) groups[spec] = [];
          groups[spec].push(doc);
      });
      return groups;
  }, [doctors]);

  const sortedSpecialties = Object.keys(groupedDoctors).sort();

  // Handlers
  const handleSelectDoctor = (doc: Doctor) => {
    setSelectedDoctor(doc);
    setFormData(doc);
    try {
      setScheduleData(JSON.parse(doc.schedule));
    } catch {
      setScheduleData(DEFAULT_SCHEDULE);
    }
    setIsEditing(false);
    setActiveTab('profile');
  };

  const handleSave = () => {
    if (!formData.name) return;

    if (selectedDoctor) {
      // Update
      dbService.exec(
        `UPDATE doctors SET name=?, specialty=?, fee=?, bio=?, schedule=?, photo=?, phone=?, email=? WHERE id=?`,
        [
          formData.name, 
          formData.specialty, 
          formData.fee, 
          formData.bio, 
          JSON.stringify(scheduleData), 
          formData.photo || '',
          formData.phone || '',
          formData.email || '',
          selectedDoctor.id
        ]
      );
    } else {
      // Create
      dbService.exec(
        `INSERT INTO doctors (name, specialty, fee, bio, schedule, photo, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          formData.name, 
          formData.specialty || (specialties[0]?.name || 'General'), 
          formData.fee || 0, 
          formData.bio || '', 
          JSON.stringify(scheduleData), 
          formData.photo || '',
          formData.phone || '',
          formData.email || ''
        ]
      );

      // Save Pending Documents
      const idRes = dbService.query("SELECT last_insert_rowid() as id");
      const newDoctorId = idRes[0]?.id;
      
      if (newDoctorId && documents.length > 0) {
          documents.forEach(doc => {
              if (doc.isPending) {
                  dbService.exec(
                      `INSERT INTO doctor_documents (doctorId, name, type, size, content, uploadDate) VALUES (?, ?, ?, ?, ?, ?)`,
                      [
                          newDoctorId, 
                          doc.name, 
                          doc.type, 
                          doc.size, 
                          doc.content, 
                          doc.uploadDate
                      ]
                  );
              }
          });
      }
    }
    
    refreshDoctors();
    setSelectedDoctor(null);
    setShowAddModal(false);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!selectedDoctor || !confirm("Delete this doctor profile? This cannot be undone.")) return;
    dbService.exec("DELETE FROM doctors WHERE id = ?", [selectedDoctor.id]);
    setSelectedDoctor(null);
    refreshDoctors();
  };

  const startNewDoctor = () => {
    setFormData({});
    setScheduleData(DEFAULT_SCHEDULE);
    setDocuments([]); // Clear documents state
    setSelectedDoctor(null);
    setShowAddModal(true);
    setIsEditing(true);
    setActiveTab('profile');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Document Management
  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      
      if (file.size > 5 * 1024 * 1024) {
          alert("File size must be less than 5MB");
          return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
          const content = reader.result as string;
          
          if (selectedDoctor) {
            // Direct DB Insert for existing doctors
            dbService.exec(
                `INSERT INTO doctor_documents (doctorId, name, type, size, content, uploadDate) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    selectedDoctor.id, 
                    file.name, 
                    file.type, 
                    (file.size / 1024).toFixed(0) + 'KB', 
                    content, 
                    new Date().toISOString().split('T')[0]
                ]
            );
            refreshDocuments();
          } else {
             // Add to temporary state for new doctors
             const newDoc = {
                 id: Date.now(), // Temporary ID
                 name: file.name,
                 type: file.type,
                 size: (file.size / 1024).toFixed(0) + 'KB',
                 content: content,
                 uploadDate: new Date().toISOString().split('T')[0],
                 isPending: true
             };
             setDocuments(prev => [newDoc, ...prev]);
          }
      };
      reader.readAsDataURL(file);
  };

  const deleteDocument = (id: number) => {
      if(confirm('Delete this document permanently?')) {
          if (selectedDoctor) {
              dbService.exec("DELETE FROM doctor_documents WHERE id = ?", [id]);
              refreshDocuments();
          } else {
              setDocuments(prev => prev.filter(d => d.id !== id));
          }
      }
  };

  const viewDocument = (doc: any) => {
      const win = window.open();
      if(win) {
          win.document.write(`<iframe src="${doc.content}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      }
  };

  const downloadDocument = (doc: any) => {
      const link = document.createElement('a');
      link.href = doc.content;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Notes Management
  const handleSaveNote = () => {
      if (!selectedDoctor || !newNote.text) return;
      if (newNote.type === 'Temporary' && (!newNote.expiryDate || isPast(parseISO(newNote.expiryDate)))) {
          alert("Please select a valid future expiry date for temporary notes.");
          return;
      }

      dbService.exec(
          `INSERT INTO doctor_notes (doctorId, text, type, priority, expiryDate, visibility, authorName, authorRole, createdAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
              selectedDoctor.id,
              newNote.text,
              newNote.type,
              newNote.priority,
              newNote.type === 'Temporary' ? newNote.expiryDate : null,
              newNote.visibility,
              user?.name || 'Unknown',
              user?.role || 'Unknown',
              new Date().toISOString()
          ]
      );

      // Reset
      setNewNote({ text: '', type: 'Permanent', priority: 'Normal', expiryDate: '', visibility: 'All' });
      refreshNotes();
  };

  const handleDeleteNote = (noteId: number, authorName: string) => {
      // Permission check: Admin or the Author can delete
      if (user?.role !== UserRole.ADMIN && user?.name !== authorName) {
          alert("You can only delete notes you created.");
          return;
      }

      if (confirm("Delete this note permanently?")) {
          dbService.exec("DELETE FROM doctor_notes WHERE id = ?", [noteId]);
          refreshNotes();
      }
  };

  // Specialty CRUD
  const addSpecialty = () => {
      if(!newSpec.trim()) return;
      dbService.exec("INSERT INTO specialties (name) VALUES (?)", [newSpec.trim()]);
      setNewSpec('');
      refreshSpecialties();
  };

  const updateSpecialty = () => {
      if(!editingSpec || !editingSpec.name.trim()) return;
      // Also update doctors who had this specialty
      const oldSpec = specialties.find(s => s.id === editingSpec.id);
      if(oldSpec) {
          dbService.exec("UPDATE doctors SET specialty = ? WHERE specialty = ?", [editingSpec.name.trim(), oldSpec.name]);
      }
      dbService.exec("UPDATE specialties SET name = ? WHERE id = ?", [editingSpec.name.trim(), editingSpec.id]);
      setEditingSpec(null);
      refreshSpecialties();
      refreshDoctors(); // To reflect changes in doctor cards
  };

  const deleteSpecialty = (id: number) => {
      if(confirm("Delete this specialty?")) {
          dbService.exec("DELETE FROM specialties WHERE id = ?", [id]);
          refreshSpecialties();
      }
  };

  const getAvailabilityStatus = (scheduleStr: string) => {
    try {
      const schedule = JSON.parse(scheduleStr);
      const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      const dayConfig = schedule[today];
      
      if (!dayConfig?.isWorking) return { label: 'Off Today', color: 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400', dot: 'bg-gray-400' };
      
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      if (currentTime >= dayConfig.start && currentTime <= dayConfig.end) {
        return { label: 'Available Now', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30', dot: 'bg-emerald-500' };
      }
      return { label: `Opens ${dayConfig.start}`, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30', dot: 'bg-amber-500' };
    } catch {
      return { label: 'Unknown', color: 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400', dot: 'bg-gray-400' };
    }
  };

  // Colors for charts
  const CHART_COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

  // Sorting notes for display
  const sortedNotes = notes.sort((a, b) => {
      // 1. Priority (Important first)
      if (a.priority === 'Important' && b.priority !== 'Important') return -1;
      if (a.priority !== 'Important' && b.priority === 'Important') return 1;
      // 2. Date (Newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const activeNotes = sortedNotes.filter(n => n.type === 'Permanent' || (n.type === 'Temporary' && n.expiryDate && isFuture(parseISO(n.expiryDate))));
  const expiredNotes = sortedNotes.filter(n => n.type === 'Temporary' && n.expiryDate && !isFuture(parseISO(n.expiryDate)));

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
           <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Staff Directory</h2>
           <p className="text-gray-500 dark:text-gray-400 mt-1">Manage specialist profiles, schedules, and clinic allocation.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={startNewDoctor}
            className="bg-gray-900 dark:bg-slate-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-black dark:hover:bg-slate-600 transition shadow-lg shadow-gray-200 dark:shadow-none"
          >
            <Plus size={18} /> Add Specialist
          </button>
        )}
      </div>

      {/* Grid by Specialty */}
      <div className="overflow-y-auto pb-20 p-1 space-y-10 custom-scrollbar">
        {doctors.length === 0 && (
            <div className="text-center py-20 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                <Stethoscope size={48} className="mx-auto text-gray-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-bold text-gray-600 dark:text-gray-300">No doctors found</h3>
                <p className="text-gray-400 dark:text-gray-500 text-sm">Add a new specialist to get started.</p>
            </div>
        )}

        {sortedSpecialties.map(specialty => (
            <div key={specialty} className="animate-fade-in-up">
                <div className="flex items-center gap-3 mb-5 pl-2">
                    <div className="h-8 w-1.5 bg-[var(--color-primary)] rounded-full"></div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        {specialty}
                        <span className="text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full border border-gray-200 dark:border-slate-700">
                            {groupedDoctors[specialty].length}
                        </span>
                    </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {groupedDoctors[specialty].map((doc) => {
                    const status = getAvailabilityStatus(doc.schedule);
                    return (
                        <div 
                        key={doc.id} 
                        onClick={() => handleSelectDoctor(doc)}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 hover:border-[var(--color-primary)] hover:shadow-xl hover:shadow-[var(--color-primary)]/5 transition-all duration-300 cursor-pointer group flex flex-col overflow-hidden"
                        >
                        {/* Card Header with Avatar */}
                        <div className="p-6 pb-0 flex items-start justify-between">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-slate-800 overflow-hidden shadow-inner border border-gray-100 dark:border-slate-700">
                                    {doc.photo ? (
                                        <img src={doc.photo} alt={doc.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-600">
                                            <User size={32} />
                                        </div>
                                    )}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-white dark:border-slate-900 ${status.dot}`}></div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-gray-100 dark:border-slate-700">ID #{doc.id}</span>
                            </div>
                        </div>

                        {/* Card Content */}
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-[var(--color-primary)] transition-colors">{doc.name}</h3>
                            <p className="text-sm font-medium text-[var(--color-primary)] mb-4 flex items-center gap-1.5">
                                <Stethoscope size={14} /> {doc.specialty}
                            </p>

                            <div className="space-y-2 mb-5">
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <Phone size={14} className="text-gray-400 dark:text-slate-500" /> 
                                    <span className="truncate">{doc.phone || 'No phone'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <Mail size={14} className="text-gray-400 dark:text-slate-500" /> 
                                    <span className="truncate">{doc.email || 'No email'}</span>
                                </div>
                            </div>

                            {/* Footer Status */}
                            <div className={`flex items-center justify-between p-3 rounded-xl border ${status.color || 'bg-gray-50 border-gray-100'}`}>
                                <span className="text-xs font-bold">{status.label}</span>
                                <span className="text-xs font-bold opacity-75">{doc.fee} EGP</span>
                            </div>
                        </div>
                        </div>
                    );
                    })}
                </div>
            </div>
        ))}
      </div>

      {/* Modern Slide-over Drawer / Modal */}
      {(selectedDoctor || showAddModal) && (
        <div className="fixed inset-0 z-50 flex justify-end">
           {/* Backdrop */}
           <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => { setSelectedDoctor(null); setShowAddModal(false); }}></div>
           
           {/* Drawer */}
           <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-up border-l border-gray-200 dark:border-slate-800">
              
              {/* Drawer Header */}
              <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-start bg-white dark:bg-slate-900 z-10 sticky top-0">
                  <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        {isEditing ? (formData.id ? 'Edit Profile' : 'New Specialist') : 'Doctor Profile'}
                        {!isEditing && <span className="text-xs font-normal text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-slate-700">Read Only</span>}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage personal details, clinic hours, and performance.</p>
                  </div>
                  <div className="flex gap-2">
                       {isEditing ? (
                          <>
                             <button onClick={() => { setIsEditing(false); if(showAddModal) setShowAddModal(false); }} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={20} /></button>
                             <button onClick={handleSave} className="px-4 py-2 bg-gray-900 dark:bg-slate-700 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-black dark:hover:bg-slate-600 shadow-md transition-all text-sm">
                                <Save size={16} /> Save Changes
                             </button>
                          </>
                      ) : (
                          <>
                             {isAdmin && (
                               <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg font-bold transition-all shadow-sm text-sm">
                                  <Edit3 size={16} /> Edit Profile
                               </button>
                             )}
                             <button onClick={() => setSelectedDoctor(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><X size={24} /></button>
                          </>
                      )}
                  </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-slate-800/50">
                  <div className="px-8 py-6">
                      
                      {/* Tabs */}
                      <div className="flex gap-6 border-b border-gray-200 dark:border-slate-800 mb-8 overflow-x-auto">
                        {['profile', 'schedule', 'documents', 'notes', 'metrics'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`pb-3 text-sm font-bold capitalize tracking-wide transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === tab ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                {tab === 'profile' && <User size={16} />}
                                {tab === 'schedule' && <Calendar size={16} />}
                                {tab === 'metrics' && <TrendingUp size={16} />}
                                {tab === 'documents' && <FileText size={16} />}
                                {tab === 'notes' && <StickyNote size={16} />}
                                {tab}
                            </button>
                        ))}
                      </div>

                      {activeTab === 'profile' && (
                          <div className="space-y-6 animate-fade-in-up">
                              {/* 1. Basic Info Section */}
                              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                    <Award size={14} className="text-[var(--color-primary)]"/> Professional Details
                                  </h4>
                                  
                                  <div className="flex gap-6 items-start">
                                      {/* Photo Upload */}
                                      <div className="shrink-0 text-center">
                                          <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-lg overflow-hidden mb-3 relative group mx-auto">
                                              {formData.photo ? (
                                                  <img src={formData.photo} className="w-full h-full object-cover" />
                                              ) : (
                                                  <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-600 bg-gray-50 dark:bg-slate-800">
                                                      <User size={48} className="opacity-50"/>
                                                  </div>
                                              )}
                                              
                                              {/* Overlay for Edit Mode */}
                                              {isEditing && (
                                                  <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-white backdrop-blur-sm">
                                                      <Upload size={24} className="mb-1" />
                                                      <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                                                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                                  </label>
                                              )}
                                          </div>
                                          
                                          {isEditing && (
                                              <div className="flex flex-col gap-2 items-center">
                                                 <label className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors flex items-center gap-2">
                                                    <Upload size={12} /> Upload Photo
                                                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                                 </label>
                                                 {formData.photo && (
                                                    <button onClick={() => setFormData({...formData, photo: ''})} className="text-[10px] text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                                                        <X size={10} /> Remove Photo
                                                    </button>
                                                 )}
                                              </div>
                                          )}
                                      </div>

                                      {/* Fields */}
                                      <div className="flex-1 space-y-4">
                                          <div>
                                              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">Full Name</label>
                                              {isEditing ? (
                                                  <input 
                                                    className="w-full border border-gray-200 dark:border-slate-700 p-2.5 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-bold text-gray-800 dark:text-white bg-white dark:bg-slate-800"
                                                    value={formData.name || ''}
                                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                                    placeholder="Dr. Name"
                                                  />
                                              ) : (
                                                  <p className="text-lg font-bold text-gray-900 dark:text-white">{formData.name}</p>
                                              )}
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">Specialty</label>
                                                  {isEditing ? (
                                                      <div className="flex gap-2">
                                                        <select 
                                                            className="w-full border border-gray-200 dark:border-slate-700 p-2.5 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-800 text-sm dark:text-white"
                                                            value={formData.specialty || ''}
                                                            onChange={e => setFormData({...formData, specialty: e.target.value})}
                                                        >
                                                            <option value="">Select...</option>
                                                            {specialties.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                                        </select>
                                                        <button onClick={() => setShowSpecModal(true)} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"><Settings size={16}/></button>
                                                      </div>
                                                  ) : (
                                                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded w-fit border border-gray-200 dark:border-slate-700">{formData.specialty}</p>
                                                  )}
                                              </div>
                                              <div>
                                                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">Consultation Fee</label>
                                                  {isEditing ? (
                                                      <div className="relative">
                                                          <input type="number" className="w-full border border-gray-200 dark:border-slate-700 p-2.5 pl-8 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-medium bg-white dark:bg-slate-800 dark:text-white" value={formData.fee} onChange={e => setFormData({...formData, fee: Number(e.target.value)})} />
                                                          <span className="absolute left-3 top-2.5 text-gray-400 font-serif text-sm">£</span>
                                                      </div>
                                                  ) : (
                                                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{formData.fee} EGP</p>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>

                              {/* 2. Contact Section */}
                              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                    <Phone size={14} className="text-[var(--color-primary)]"/> Contact Information
                                  </h4>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">Phone Number</label>
                                          {isEditing ? (
                                              <input className="w-full border border-gray-200 dark:border-slate-700 p-2.5 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none text-sm bg-white dark:bg-slate-800 dark:text-white" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+20..." />
                                          ) : (
                                              <p className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"><Phone size={14} className="text-gray-400"/> {formData.phone || 'N/A'}</p>
                                          )}
                                      </div>
                                      <div>
                                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">Email Address</label>
                                          {isEditing ? (
                                              <input className="w-full border border-gray-200 dark:border-slate-700 p-2.5 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] outline-none text-sm bg-white dark:bg-slate-800 dark:text-white" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="doctor@clinic.com" />
                                          ) : (
                                              <p className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"><Mail size={14} className="text-gray-400"/> {formData.email || 'N/A'}</p>
                                          )}
                                      </div>
                                  </div>
                              </div>

                              {/* 3. Bio Section */}
                              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                    <ListPlus size={14} className="text-[var(--color-primary)]"/> Biography
                                  </h4>
                                  {isEditing ? (
                                      <textarea 
                                          className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-4 h-32 focus:ring-2 focus:ring-[var(--color-primary)] outline-none resize-none leading-relaxed text-sm bg-white dark:bg-slate-800 dark:text-white"
                                          value={formData.bio || ''}
                                          onChange={e => setFormData({...formData, bio: e.target.value})}
                                          placeholder="Enter doctor's biography..."
                                      />
                                  ) : (
                                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                                          {formData.bio || "No biography added."}
                                      </p>
                                  )}
                              </div>
                          </div>
                      )}

                      {activeTab === 'schedule' && (
                          <div className="space-y-6 animate-fade-in-up">
                              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-xl flex items-start gap-3">
                                  <Clock className="text-blue-600 dark:text-blue-400 mt-1 shrink-0" size={20} />
                                  <div>
                                      <h4 className="font-bold text-blue-900 dark:text-blue-200 text-sm">Weekly Availability</h4>
                                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                                          Configure the start and end times for each day. Days marked inactive will not show up for appointment booking.
                                      </p>
                                  </div>
                              </div>
                              <ScheduleEditor 
                                  schedule={scheduleData} 
                                  readOnly={!isEditing} 
                                  onChange={setScheduleData}
                              />
                          </div>
                      )}

                      {activeTab === 'documents' && (
                          <div className="space-y-6 animate-fade-in-up">
                              <div className="flex justify-between items-center">
                                  <h4 className="font-bold text-gray-800 dark:text-white">Documents & Certificates</h4>
                                  <label className="bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:opacity-90 cursor-pointer shadow-sm">
                                      <Upload size={14} /> Upload File
                                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleDocUpload} />
                                  </label>
                              </div>

                              <div className="grid grid-cols-1 gap-3">
                                  {documents.length === 0 ? (
                                      <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                                          <FileText className="mx-auto text-gray-300 dark:text-slate-600 mb-2" size={32} />
                                          <p className="text-gray-500 dark:text-gray-400 text-sm">No documents uploaded.</p>
                                      </div>
                                  ) : (
                                      documents.map(doc => (
                                          <div key={doc.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-gray-300 dark:hover:border-slate-600 transition-colors shadow-sm">
                                              <div className="flex items-center gap-3 overflow-hidden">
                                                  <div className={`p-2 rounded-lg ${doc.type.includes('pdf') ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400'}`}>
                                                      {doc.type.includes('pdf') ? <FileText size={20} /> : <ImageIcon size={20} />}
                                                  </div>
                                                  <div className="min-w-0">
                                                      <p className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">{doc.name}</p>
                                                      <p className="text-[10px] text-gray-400 uppercase">{doc.size} • {doc.uploadDate}</p>
                                                  </div>
                                              </div>
                                              <div className="flex gap-2">
                                                  <button onClick={() => viewDocument(doc)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500 dark:text-gray-400 hover:text-[var(--color-primary)] transition-colors"><Eye size={16}/></button>
                                                  <button onClick={() => downloadDocument(doc)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors"><Download size={16}/></button>
                                                  <button onClick={() => deleteDocument(doc.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                              <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                                  <Award size={12} /> Stored securely in local database
                              </p>
                          </div>
                      )}

                      {activeTab === 'notes' && (
                          <div className="space-y-6 animate-fade-in-up">
                              {/* Create Note Section */}
                              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-4 rounded-xl shadow-sm">
                                  <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                      <StickyNote size={16} /> Add Note
                                  </h4>
                                  <div className="space-y-3">
                                      <textarea 
                                          className="w-full border border-gray-200 dark:border-slate-700 rounded-lg p-3 text-sm bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white"
                                          placeholder="Type internal note here..."
                                          rows={2}
                                          value={newNote.text}
                                          onChange={e => setNewNote({...newNote, text: e.target.value})}
                                      />
                                      <div className="flex flex-wrap gap-3 items-center justify-between">
                                          <div className="flex flex-wrap gap-2">
                                              <select 
                                                  className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-white outline-none"
                                                  value={newNote.type}
                                                  onChange={e => setNewNote({...newNote, type: e.target.value as any})}
                                              >
                                                  <option value="Permanent">Permanent</option>
                                                  <option value="Temporary">Temporary</option>
                                              </select>
                                              <select 
                                                  className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-white outline-none"
                                                  value={newNote.priority}
                                                  onChange={e => setNewNote({...newNote, priority: e.target.value as any})}
                                              >
                                                  <option value="Normal">Normal</option>
                                                  <option value="Important">Important</option>
                                              </select>
                                              <select 
                                                  className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-white outline-none"
                                                  value={newNote.visibility}
                                                  onChange={e => setNewNote({...newNote, visibility: e.target.value as any})}
                                              >
                                                  <option value="All">Visible to All</option>
                                                  <option value="Medical">Medical Only</option>
                                                  <option value="Admin">Admin Only</option>
                                              </select>
                                              {newNote.type === 'Temporary' && (
                                                  <input 
                                                      type="date" 
                                                      className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 dark:text-white outline-none"
                                                      value={newNote.expiryDate}
                                                      onChange={e => setNewNote({...newNote, expiryDate: e.target.value})}
                                                  />
                                              )}
                                          </div>
                                          <button 
                                              onClick={handleSaveNote}
                                              className="bg-[var(--color-primary)] text-white text-xs px-4 py-2 rounded-lg font-bold hover:opacity-90 flex items-center gap-2"
                                          >
                                              <Plus size={14} /> Save Note
                                          </button>
                                      </div>
                                  </div>
                              </div>

                              {/* Active Notes List */}
                              <div className="space-y-3">
                                  {activeNotes.length === 0 ? (
                                      <p className="text-center text-gray-400 text-sm py-8 italic">No active notes.</p>
                                  ) : (
                                      activeNotes.map(note => (
                                          <div 
                                              key={note.id} 
                                              className={`relative p-4 rounded-xl border transition-all hover:shadow-md ${
                                                  note.priority === 'Important' 
                                                      ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' 
                                                      : note.type === 'Temporary'
                                                          ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
                                                          : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700'
                                              }`}
                                          >
                                              {note.priority === 'Important' && (
                                                  <div className="absolute top-0 right-0 p-2 text-red-500">
                                                      <Pin size={14} fill="currentColor" />
                                                  </div>
                                              )}
                                              <div className="flex justify-between items-start mb-2">
                                                  <div className="flex items-center gap-2">
                                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${note.authorRole === UserRole.ADMIN ? 'bg-slate-700' : 'bg-blue-500'}`}>
                                                          {note.authorName.charAt(0)}
                                                      </div>
                                                      <div>
                                                          <span className="text-xs font-bold text-gray-700 dark:text-gray-200 block">{note.authorName}</span>
                                                          <span className="text-[10px] text-gray-400 uppercase">{note.authorRole} • {format(parseISO(note.createdAt), 'MMM d')}</span>
                                                      </div>
                                                  </div>
                                                  <div className="flex items-center gap-2 pr-6">
                                                      {note.visibility !== 'All' && (
                                                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500">
                                                              <Shield size={10} /> {note.visibility}
                                                          </span>
                                                      )}
                                                      {note.type === 'Temporary' && (
                                                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                                              <Timer size={10} /> Expires {format(parseISO(note.expiryDate!), 'MMM d')}
                                                          </span>
                                                      )}
                                                  </div>
                                              </div>
                                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                                              
                                              {(user?.role === UserRole.ADMIN || user?.name === note.authorName) && (
                                                  <button 
                                                      onClick={() => handleDeleteNote(note.id, note.authorName)}
                                                      className="absolute bottom-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                  >
                                                      <Trash2 size={14} />
                                                  </button>
                                              )}
                                          </div>
                                      ))
                                  )}
                              </div>

                              {/* Expired Notes Toggle */}
                              {expiredNotes.length > 0 && (
                                  <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                                      <button 
                                          onClick={() => setShowExpiredNotes(!showExpiredNotes)}
                                          className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-2 mb-3"
                                      >
                                          {showExpiredNotes ? <ChevronRight className="rotate-90 transition-transform" size={14} /> : <ChevronRight size={14} />}
                                          Archived / Expired Notes ({expiredNotes.length})
                                      </button>
                                      
                                      {showExpiredNotes && (
                                          <div className="space-y-2 pl-4 border-l-2 border-gray-100 dark:border-slate-800">
                                              {expiredNotes.map(note => (
                                                  <div key={note.id} className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-800 opacity-75">
                                                      <div className="flex justify-between items-center mb-1">
                                                          <span className="text-xs font-bold text-gray-500">{note.authorName}</span>
                                                          <span className="text-[10px] text-gray-400">Expired: {note.expiryDate}</span>
                                                      </div>
                                                      <p className="text-xs text-gray-600 dark:text-gray-400">{note.text}</p>
                                                  </div>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              )}
                          </div>
                      )}

                      {activeTab === 'metrics' && (
                          <div className="space-y-6 animate-fade-in-up">
                               {/* KPI Cards */}
                               <div className="grid grid-cols-2 gap-4">
                                   <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center transition-colors">
                                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-2">
                                            <Briefcase size={18} />
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{analyticsData.totalPatients}</h3>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Unique Patients</p>
                                   </div>
                                   <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center transition-colors">
                                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-2">
                                            <Check size={18} />
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{analyticsData.completionRate}%</h3>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Completion Rate</p>
                                   </div>
                               </div>
                               
                               {/* Charts */}
                               <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                                   <h4 className="font-bold text-sm text-gray-800 dark:text-white mb-4 flex items-center gap-2"><TrendingUp size={16}/> Appointment Trend</h4>
                                   <div className="h-40 w-full">
                                       <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={analyticsData.timeline}>
                                                <defs>
                                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8}/>
                                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                                                <XAxis dataKey="date" fontSize={10} tick={{fill: '#94a3b8'}} />
                                                <YAxis fontSize={10} tick={{fill: '#94a3b8'}} />
                                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: '8px' }} />
                                                <Area type="monotone" dataKey="count" stroke="var(--color-primary)" fillOpacity={1} fill="url(#colorCount)" />
                                            </AreaChart>
                                       </ResponsiveContainer>
                                   </div>
                               </div>

                               <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                                   <h4 className="font-bold text-sm text-gray-800 dark:text-white mb-4 flex items-center gap-2"><RePieChart size={16}/> Status Distribution</h4>
                                   <div className="h-40 w-full">
                                       <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie
                                                    data={analyticsData.statusDist}
                                                    innerRadius={40}
                                                    outerRadius={60}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    {analyticsData.statusDist.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: '8px' }} />
                                                <Legend wrapperStyle={{fontSize: '10px'}} iconSize={8} />
                                            </RePieChart>
                                       </ResponsiveContainer>
                                   </div>
                               </div>
                          </div>
                      )}

                      {isEditing && !showAddModal && (
                          <div className="mt-12 pt-6 border-t border-gray-200 dark:border-slate-800">
                              <button 
                                onClick={handleDelete}
                                className="w-full py-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/30 text-sm"
                              >
                                 <Trash2 size={16} /> Delete Staff Profile
                              </button>
                          </div>
                      )}
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* Specialty Management Modal */}
      {showSpecModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in-up border border-gray-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-slate-800 pb-2">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2"><ListPlus size={20} /> Manage Specialties</h3>
                    <button onClick={() => { setShowSpecModal(false); setEditingSpec(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500"><X size={20}/></button>
                </div>
                
                <div className="flex gap-2 mb-4">
                    <input 
                        className="flex-1 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-800 dark:text-white"
                        placeholder="New Specialty Name"
                        value={newSpec}
                        onChange={e => setNewSpec(e.target.value)}
                    />
                    <button onClick={addSpecialty} className="bg-[var(--color-primary)] text-white px-3 py-2 rounded-lg hover:opacity-90">
                        <Plus size={18} />
                    </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {specialties.map(spec => (
                        <div key={spec.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 group">
                            {editingSpec?.id === spec.id ? (
                                <div className="flex gap-2 flex-1 mr-2">
                                    <input 
                                        autoFocus
                                        className="flex-1 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 dark:text-white"
                                        value={editingSpec.name}
                                        onChange={e => setEditingSpec({...editingSpec, name: e.target.value})}
                                    />
                                    <button onClick={updateSpecialty} className="text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 p-1 rounded"><Check size={14}/></button>
                                    <button onClick={() => setEditingSpec(null)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 p-1 rounded"><X size={14}/></button>
                                </div>
                            ) : (
                                <>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{spec.name}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingSpec(spec)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1.5 rounded"><PenLine size={14}/></button>
                                        <button onClick={() => deleteSpecialty(spec.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded"><Trash2 size={14}/></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Doctors;