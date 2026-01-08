
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { 
  User, Plus, Search, FileText, ChevronDown, ChevronUp, 
  Pill, Printer, Save, X, Edit3, Trash2, Activity, 
  Calendar, FilePlus, AlertCircle, Phone, Mail, MapPin, Heart, AlertOctagon,
  Scale, Thermometer, HeartPulse, Shield, CheckCircle2, Calculator, Upload, Eye, Image as ImageIcon, BookTemplate, ZoomIn, ZoomOut, RotateCw, TrendingUp, Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { differenceInYears, parseISO, subYears, format } from 'date-fns';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar
} from 'recharts';
import FileDropzone from '../components/FileDropzone';
import { PrescriptionItem, Patient, AppointmentStatus } from '../types';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const COMMON_ALLERGIES = ['Penicillin', 'Peanuts', 'Latex', 'Shellfish', 'Dairy', 'Pollen', 'Dust Mites', 'Sulfa Drugs', 'Other'];
const COMMON_CONDITIONS = ['Hypertension', 'Type 2 Diabetes', 'Asthma', 'Arthritis', 'Heart Disease', 'Migraine', 'Thyroid Disorder', 'Other'];

const TagInput = ({ label, options, value, onChange, colorClass = "bg-gray-100 text-gray-700" }: any) => {
  const [input, setInput] = useState('');
  const tags = value ? value.split(',').map((s: string) => s.trim()).filter((s: string) => s && s !== 'None') : [];
  
  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) { onChange([...tags, tag].join(', ')); }
    setInput('');
  };
  
  const removeTag = (tag: string) => {
    const newTags = tags.filter((t: string) => t !== tag);
    onChange(newTags.length > 0 ? newTags.join(', ') : 'None');
  };

  return (
    <div>
        <label className={`block text-xs font-bold mb-1.5 uppercase ${colorClass.includes('rose') ? 'text-rose-600 dark:text-rose-400' : (colorClass.includes('amber') ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400')}`}>{label}</label>
        <div className="border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-2 focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20 transition-all">
            <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag: string, i: number) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1 ${colorClass} dark:bg-opacity-20`}>
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-black dark:hover:text-white opacity-60 hover:opacity-100"><X size={12}/></button>
                    </span>
                ))}
            </div>
            <div className="relative">
                <input 
                    className="w-full text-sm outline-none bg-transparent placeholder-gray-400 dark:text-white" 
                    placeholder="Type to add or select..." 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(input); } }}
                />
                {input && <button type="button" onMouseDown={() => addTag(input)} className="absolute right-0 top-0 text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 font-bold text-gray-600 dark:text-gray-300">Add</button>}
            </div>
            <div className="flex flex-wrap gap-1 mt-2 border-t border-gray-100 dark:border-slate-700 pt-2">
                {options.filter((o: string) => !tags.includes(o) && o.toLowerCase().includes(input.toLowerCase())).map((opt: string) => (
                    <button key={opt} type="button" onClick={() => addTag(opt)} className="text-[10px] bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 px-2 py-1 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 hover:text-gray-800 dark:hover:text-white transition-colors">+ {opt}</button>
                ))}
            </div>
        </div>
    </div>
  );
};

const Patients = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  // Data State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterBloodGroup, setFilterBloodGroup] = useState('');
  
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'appointments' | 'rx' | 'docs' | 'trends'>('info');
  const [patientPrescriptions, setPatientPrescriptions] = useState<any[]>([]);
  const [patientDocs, setPatientDocs] = useState<any[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  // Modals & Forms
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showDocViewer, setShowDocViewer] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [newBooking, setNewBooking] = useState({ doctorId: '', date: format(new Date(), 'yyyy-MM-dd') });
  
  const initialPatientState: Partial<Patient> = { 
    id: 0, name: '', phone: '', email: '', address: '', 
    emergency_contact: '', blood_group: 'Unknown', allergies: 'None', 
    chronic_conditions: 'None', dob: '', gender: 'Male', history: '[]', height: 0, weight: 0 
  };
  const [patientForm, setPatientForm] = useState<any>(initialPatientState);
  const [splitName, setSplitName] = useState({ first: '', last: '' });
  const [splitEC, setSplitEC] = useState({ name: '', relation: '', phone: '' });
  
  const [visitForm, setVisitForm] = useState({ 
    diagnosis: '', treatment: '', medications: '', notes: '', 
    bpSystolic: '', bpDiastolic: '', heartRate: '', temperature: '', weight: '' 
  });

  // --- Init & Loaders ---
  useEffect(() => { 
      loadPatients(); 
      setDoctors(dbService.query("SELECT * FROM doctors"));
  }, [searchTerm, filterGender, filterBloodGroup]);

  const loadPatients = () => {
    let q = "SELECT * FROM patients WHERE 1=1";
    
    if (searchTerm) {
        const term = searchTerm.trim();
        const isNum = /^\d+$/.test(term);
        if (isNum) {
            // Numeric: Search by ID (Exact) OR Phone (Partial)
            q += ` AND (id = ${term} OR phone LIKE '%${term}%')`;
        } else {
            // Text: Search Name, Email, Address
            q += ` AND (name LIKE '%${term}%' OR email LIKE '%${term}%' OR address LIKE '%${term}%')`;
        }
    }

    if (filterGender) {
        q += ` AND gender = '${filterGender}'`;
    }

    if (filterBloodGroup) {
        q += ` AND blood_group = '${filterBloodGroup}'`;
    }

    q += " ORDER BY name ASC";
    setPatients(dbService.query(q));
  };

  const clearFilters = () => {
      setSearchTerm('');
      setFilterGender('');
      setFilterBloodGroup('');
  };

  const loadSubData = (pid: number) => {
    setPatientPrescriptions(dbService.query(`SELECT p.*, d.name as doctorName FROM prescriptions p LEFT JOIN doctors d ON p.doctorId = d.id WHERE p.patientId = ${pid} ORDER BY p.id DESC`));
    setPatientDocs(dbService.query(`SELECT * FROM patient_documents WHERE patientId = ${pid} ORDER BY id DESC`));
    setPatientAppointments(dbService.query(`SELECT a.*, d.name as doctorName, d.specialty FROM appointments a LEFT JOIN doctors d ON a.doctorId = d.id WHERE a.patientId = ${pid} ORDER BY a.date DESC, a.time DESC`));
  };

  const toggleExpand = (pid: number) => {
    if (expandedRow === pid) { 
        setExpandedRow(null); 
    } else { 
        setExpandedRow(pid); 
        setSelectedPatientId(pid); 
        loadSubData(pid); 
        setActiveTab('info'); 
    }
  };

  // --- Vitals Analytics Data ---
  const vitalsData = useMemo(() => {
      if (!selectedPatientId) return [];
      const p = patients.find(pat => pat.id === selectedPatientId);
      if (!p || !p.history) return [];
      
      try {
          const hist = JSON.parse(p.history);
          const records = hist.filter((h: any) => h.bp || h.heartRate || h.temperature || h.weight || (p.weight && h.date === hist[0]?.date))
                             .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          return records.map((r: any) => {
              const bpParts = r.bp ? r.bp.split('/') : [null, null];
              return {
                  date: r.date,
                  systolic: bpParts[0] ? Number(bpParts[0]) : null,
                  diastolic: bpParts[1] ? Number(bpParts[1]) : null,
                  heartRate: r.heartRate ? Number(r.heartRate) : null,
                  temperature: r.temperature ? Number(r.temperature) : null,
                  weight: r.weight ? Number(r.weight) : null
              };
          });
      } catch (e) { return []; }
  }, [selectedPatientId, patients]);

  // --- Helpers ---
  const getAge = (dob: string) => { try { return differenceInYears(new Date(), parseISO(dob)); } catch { return '--'; } };
  
  const calculateBMI = (weight?: number, height?: number) => {
      if (!weight || !height) return { value: 0 };
      const h = height / 100;
      const bmi = weight / (h * h);
      return { value: bmi.toFixed(1) };
  };

  const getLatestVitals = (historyStr: string) => {
      try { return JSON.parse(historyStr || '[]').find((h: any) => h.bp || h.heartRate); } catch { return null; }
  };

  // --- Form Handlers ---
  const resetForm = () => { 
      setPatientForm(initialPatientState); 
      setSplitName({first:'', last:''}); 
      setSplitEC({name:'', relation:'', phone:''}); 
  };

  const handleEditPatient = (p: any, e: React.MouseEvent) => { 
      e.stopPropagation(); 
      setPatientForm(p); 
      const n = p.name.split(' '); 
      setSplitName({first: n[0], last: n.slice(1).join(' ')}); 
      const ec = (p.emergency_contact || '').split(' - '); 
      setSplitEC({name: ec[0] || '', relation: ec[1] || '', phone: ec[2] || ''}); 
      setShowPatientModal(true); 
  };

  const savePatient = (e: React.FormEvent) => { 
      e.preventDefault(); 
      const name = `${splitName.first} ${splitName.last}`; 
      const ec = `${splitEC.name} - ${splitEC.relation} - ${splitEC.phone}`; 
      const q = patientForm.id 
          ? "UPDATE patients SET name=?, phone=?, email=?, address=?, emergency_contact=?, blood_group=?, allergies=?, chronic_conditions=?, dob=?, gender=?, height=?, weight=? WHERE id=?" 
          : "INSERT INTO patients (name, phone, email, address, emergency_contact, blood_group, allergies, chronic_conditions, dob, gender, height, weight, history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')"; 
      
      const params = [name, patientForm.phone, patientForm.email, patientForm.address, ec, patientForm.blood_group, patientForm.allergies, patientForm.chronic_conditions, patientForm.dob, patientForm.gender, patientForm.height, patientForm.weight]; 
      if (patientForm.id) params.push(patientForm.id); 
      
      dbService.exec(q, params); 
      setShowPatientModal(false); 
      loadPatients(); 
  };

  // --- Visit Logic ---
  const openVisitModal = () => { 
      setVisitForm({diagnosis:'', treatment:'', medications:'', notes:'', bpSystolic:'', bpDiastolic:'', heartRate:'', temperature:'', weight:''}); 
      setShowVisitModal(true); 
  };

  const saveVisit = () => { 
      if (!selectedPatientId) return; 
      const p = patients.find(pt => pt.id === selectedPatientId); 
      if (!p) return; 
      
      const bp = (visitForm.bpSystolic && visitForm.bpDiastolic) ? `${visitForm.bpSystolic}/${visitForm.bpDiastolic}` : undefined; 
      const rec = {
          date: new Date().toISOString().split('T')[0], 
          diagnosis: visitForm.diagnosis, 
          treatment: visitForm.treatment, 
          medications: visitForm.notes, 
          bp, 
          heartRate: visitForm.heartRate, 
          temperature: visitForm.temperature,
          weight: visitForm.weight
      }; 
      
      const h = [rec, ...JSON.parse(p.history || '[]')]; 
      
      // Update history and potentially weight
      dbService.exec("UPDATE patients SET history=?, weight=? WHERE id=?", [JSON.stringify(h), visitForm.weight || p.weight, selectedPatientId]); 
      setShowVisitModal(false); 
      loadPatients(); 
      loadSubData(selectedPatientId);
  };

  // --- Booking Logic (Simplified) ---
  const handleBooking = () => {
      if(!newBooking.doctorId || !selectedPatientId) return;
      
      const doc = doctors.find(d => d.id === Number(newBooking.doctorId));
      const lastQ = dbService.query(`SELECT COUNT(*) as count FROM appointments WHERE doctorId = ${newBooking.doctorId} AND date = '${newBooking.date}'`);
      const qNum = (lastQ[0].count || 0) + 1;
      
      // Insert Appointment (Pending Payment, Default Fee)
      dbService.exec(
          `INSERT INTO appointments (doctorId, patientId, date, time, status, type, totalFee, discount, amountPaid, paymentStatus, queueNumber, paymentNotes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'Pending', ?, '')`,
          [newBooking.doctorId, selectedPatientId, newBooking.date, '09:00 - 17:00', AppointmentStatus.SCHEDULED, 'Consultation', doc?.fee || 150, qNum]
      );
      
      setShowBookingModal(false);
      loadSubData(selectedPatientId);
  };

  // --- Documents ---
  const handleFilesAdded = (files: any[]) => {
      if (!selectedPatientId) return;
      files.forEach(f => {
          dbService.exec(
              "INSERT INTO patient_documents (patientId,name,type,size,content,uploadDate) VALUES (?,?,?,?,?,?)", 
              [selectedPatientId, f.name, f.type, f.size, f.content, new Date().toISOString().split('T')[0]]
          );
      });
      loadSubData(selectedPatientId);
  };

  const deleteDoc = (id: number) => {
      if (confirm('Delete document?')) {
          dbService.exec("DELETE FROM patient_documents WHERE id = ?", [id]);
          if (selectedPatientId) loadSubData(selectedPatientId);
      }
  };

  return (
    <div className="pb-20">
        <div className="flex justify-between items-center mb-6">
            <div><h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('patients')}</h2><p className="text-gray-500 dark:text-gray-400">Registry & EMR</p></div>
            <button onClick={() => { resetForm(); setShowPatientModal(true); }} className="bg-[var(--color-primary)] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 shadow-lg"><Plus size={18} /> {t('new_patient')}</button>
        </div>

        {/* Enhanced Search Toolbar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search by name, phone, or ID..." 
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white transition-all" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                    <div className="relative min-w-[140px]">
                        <select 
                            className="w-full appearance-none px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
                            value={filterGender}
                            onChange={(e) => setFilterGender(e.target.value)}
                        >
                            <option value="">All Genders</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>

                    <div className="relative min-w-[160px]">
                        <select 
                            className="w-full appearance-none px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
                            value={filterBloodGroup}
                            onChange={(e) => setFilterBloodGroup(e.target.value)}
                        >
                            <option value="">All Blood Groups</option>
                            {BLOOD_GROUPS.filter(g => g !== 'Unknown').map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                    </div>
                    
                    {(searchTerm || filterGender || filterBloodGroup) && (
                        <button 
                            onClick={clearFilters}
                            className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold border border-red-100 dark:border-red-900 hover:bg-red-100 transition-colors flex items-center gap-2 whitespace-nowrap"
                        >
                            <X size={16}/> Clear
                        </button>
                    )}
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                    <tr><th className="p-4 text-gray-600 dark:text-gray-300">Name</th><th className="p-4 text-gray-600 dark:text-gray-300">Contact</th><th className="p-4 text-gray-600 dark:text-gray-300">Bio</th><th className="p-4 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {patients.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-400">No patients found matching your criteria.</td></tr>
                    ) : (
                        patients.map(p => {
                            const isExpanded = expandedRow === p.id;
                            return (
                            <React.Fragment key={p.id}>
                                <tr className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/30 border-l-4 ${isExpanded ? 'border-l-[var(--color-primary)] bg-teal-50/30' : 'border-l-transparent'}`} onClick={() => toggleExpand(p.id)}>
                                    <td className="p-4"><div className="flex gap-3 items-center"><div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">{p.name.charAt(0)}</div><div><p className="font-bold text-gray-800 dark:text-white">{p.name}</p><p className="text-xs text-gray-400">#{p.id}</p></div></div></td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300"><div>{p.phone}</div><div className="text-xs opacity-70">{p.address}</div></td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300">{getAge(p.dob)} yrs, {p.gender}</td>
                                    <td className="p-4 text-right"><button onClick={(e) => handleEditPatient(p, e)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><Edit3 size={16}/></button></td>
                                </tr>
                                {isExpanded && (
                                    <tr className="bg-gray-50 dark:bg-slate-800/30"><td colSpan={4} className="p-6">
                                        <div className="flex gap-4 border-b border-gray-200 dark:border-slate-700 mb-6 overflow-x-auto">
                                            {['info', 'timeline', 'appointments', 'trends', 'rx', 'docs'].map(tab => (
                                                <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-2 px-2 text-sm font-bold capitalize border-b-2 transition-all ${activeTab === tab ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500'}`}>
                                                    {tab === 'trends' ? 'Vitals Trends' : tab}
                                                </button>
                                            ))}
                                        </div>
                                        
                                        {/* VITALS TRENDS */}
                                        {activeTab === 'trends' && (
                                            <div className="space-y-6 animate-fade-in-up">
                                                {vitalsData.length < 2 ? (
                                                    <div className="text-center py-10 text-gray-400 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                                                        <Activity size={32} className="mx-auto mb-2 opacity-50"/>
                                                        <p>Not enough data points. Record more visits with vitals.</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                                                            <h4 className="font-bold text-gray-700 dark:text-white mb-4 flex items-center gap-2"><Activity size={16} className="text-rose-500"/> Blood Pressure</h4>
                                                            <div className="h-64">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <LineChart data={vitalsData}>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                                                        <XAxis dataKey="date" fontSize={10} tick={{fill: '#9ca3af'}} />
                                                                        <YAxis domain={[60, 200]} fontSize={10} tick={{fill: '#9ca3af'}} />
                                                                        <Tooltip contentStyle={{backgroundColor:'#1e293b', border:'none', borderRadius:'8px', color:'#fff'}} />
                                                                        <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={2} name="Systolic" />
                                                                        <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" strokeWidth={2} name="Diastolic" />
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                                                            <h4 className="font-bold text-gray-700 dark:text-white mb-4 flex items-center gap-2"><HeartPulse size={16} className="text-orange-500"/> Heart Rate</h4>
                                                            <div className="h-64">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <AreaChart data={vitalsData}>
                                                                        <defs>
                                                                            <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                                                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                                                            </linearGradient>
                                                                        </defs>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                                                        <XAxis dataKey="date" fontSize={10} tick={{fill: '#9ca3af'}} />
                                                                        <YAxis domain={[40, 120]} fontSize={10} tick={{fill: '#9ca3af'}} />
                                                                        <Tooltip contentStyle={{backgroundColor:'#1e293b', border:'none', borderRadius:'8px', color:'#fff'}} />
                                                                        <Area type="monotone" dataKey="heartRate" stroke="#f97316" fillOpacity={1} fill="url(#colorHr)" />
                                                                    </AreaChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* INFO TAB */}
                                        {activeTab === 'info' && <div className="animate-fade-in-up grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg ring-4 ring-slate-900/50">
                                                <div className="flex justify-between mb-6 border-b border-white/10 pb-3"><h4 className="font-bold flex items-center gap-2 text-emerald-400"><Activity size={18}/> VITALS</h4><span className="text-xs text-slate-400">{getLatestVitals(p.history)?.date}</span></div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="text-center p-3 rounded-lg bg-black/20 border border-white/5"><div className="text-rose-400 text-xs font-bold uppercase">HR</div><p className="text-3xl font-mono font-bold">{getLatestVitals(p.history)?.heartRate||'--'}</p></div>
                                                    <div className="text-center p-3 rounded-lg bg-black/20 border border-white/5"><div className="text-sky-400 text-xs font-bold uppercase">BP</div><p className="text-3xl font-mono font-bold">{getLatestVitals(p.history)?.bp||'--'}</p></div>
                                                    <div className="text-center p-3 rounded-lg bg-black/20 border border-white/5"><div className="text-purple-400 text-xs font-bold uppercase">Temp</div><p className="text-3xl font-mono font-bold">{getLatestVitals(p.history)?.temperature||'--'}</p></div>
                                                    <div className="text-center p-3 rounded-lg bg-black/20 border border-white/5"><div className="text-emerald-400 text-xs font-bold uppercase">Wt</div><p className="text-3xl font-mono font-bold">{p.weight||'--'}</p></div>
                                                </div>
                                            </div>
                                            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                                <div className="flex justify-between items-center mb-6"><h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Shield size={20} className="text-[var(--color-primary)]"/> Medical Profile</h4></div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div><h5 className="text-xs font-bold text-slate-400 uppercase mb-3">Demographics</h5><ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300"><li>Name: <b>{p.name}</b></li><li>Gender: {p.gender}</li><li>Age: {getAge(p.dob)}</li></ul></div>
                                                    <div><h5 className="text-xs font-bold text-slate-400 uppercase mb-3">Biometrics</h5><ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300"><li>Blood: <span className="bg-rose-500 text-white px-1.5 rounded">{p.blood_group}</span></li><li>Height: {p.height}cm</li><li>BMI: <b>{calculateBMI(p.weight, p.height).value}</b></li></ul></div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                                    <div className="flex gap-2 mb-2">
                                                        <span className="text-xs font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-1 rounded">Allergies: {p.allergies}</span>
                                                        <span className="text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-1 rounded">Conditions: {p.chronic_conditions}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>}

                                        {/* TIMELINE TAB */}
                                        {activeTab === 'timeline' && <div className="animate-fade-in-up">
                                            <div className="flex justify-between mb-4"><h4 className="font-bold text-slate-700 dark:text-white">History Log</h4><button onClick={openVisitModal} className="bg-slate-900 dark:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"><FilePlus size={14}/> Add Note</button></div>
                                            <div className="border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-6 py-2">
                                                {JSON.parse(p.history).map((h:any,i:number)=>(
                                                    <div key={i} className="pl-6 relative"><div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[var(--color-primary)] border-4 border-white dark:border-slate-800"></div><div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><div className="flex justify-between mb-2"><h5 className="font-bold text-slate-800 dark:text-white">{h.diagnosis||'Visit'}</h5><span className="text-xs text-slate-500 dark:text-slate-400">{h.date}</span></div><p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded">{h.treatment}</p></div></div>
                                                ))}
                                            </div>
                                        </div>}

                                        {/* APPOINTMENTS TAB */}
                                        {activeTab === 'appointments' && <div className="animate-fade-in-up">
                                            <div className="flex justify-between mb-4">
                                                <h4 className="font-bold text-slate-700 dark:text-white">Recent Appointments</h4>
                                                <button onClick={() => setShowBookingModal(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors">
                                                    <Calendar size={14}/> {t('create_appointment')}
                                                </button>
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-gray-50 dark:bg-slate-800">
                                                        <tr><th className="p-3">Date</th><th className="p-3">Doctor</th><th className="p-3">Status</th><th className="p-3 text-right">Payment</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {patientAppointments.map(app => (
                                                            <tr key={app.id} className="border-t border-slate-100 dark:border-slate-800">
                                                                <td className="p-3 font-medium">{app.date}</td>
                                                                <td className="p-3">{app.doctorName} <span className="text-xs text-gray-400 ml-1">{app.specialty}</span></td>
                                                                <td className="p-3"><span className="bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-xs">{app.status}</span></td>
                                                                <td className="p-3 text-right"><span className={`px-2 py-1 rounded text-xs font-bold ${app.paymentStatus === 'Paid' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'}`}>{app.paymentStatus}</span></td>
                                                            </tr>
                                                        ))}
                                                        {patientAppointments.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-400">No appointments found.</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>}

                                        {/* RX TAB */}
                                        {activeTab === 'rx' && <div className="animate-fade-in-up">
                                            <div className="flex justify-between mb-4">
                                                <h4 className="font-bold text-slate-700 dark:text-white">Prescriptions</h4>
                                                <button onClick={() => navigate('/prescriptions', { state: { patientId: p.id } })} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                                                    <FileText size={14}/> New Prescription
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{patientPrescriptions.map(rx=>(<div key={rx.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm"><div className="flex justify-between mb-2"><span className="text-xs font-bold bg-teal-50 text-teal-700 px-2 py-1 rounded">Rx #{rx.id}</span><span className="text-xs text-slate-400">{rx.date}</span></div><div className="space-y-1 mb-2">{JSON.parse(rx.items).map((it:any,ix:number)=>(<div key={ix} className="text-sm text-slate-700 dark:text-slate-300"><b>{it.name}</b> <span className="text-xs text-slate-500">{it.dosage}</span></div>))}</div></div>))}</div>
                                        </div>}

                                        {/* DOCS TAB */}
                                        {activeTab === 'docs' && <div className="animate-fade-in-up space-y-6">
                                            <div className="flex justify-between mb-2"><h4 className="font-bold text-slate-700 dark:text-white">Attachments & Labs</h4></div>
                                            
                                            <FileDropzone onFilesAdded={handleFilesAdded} />

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                                {patientDocs.map(doc=>(
                                                    <div key={doc.id} className="flex justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl items-center group hover:border-[var(--color-primary)] transition-colors">
                                                        <div className="flex gap-3 items-center">
                                                            <div className={`p-2 rounded-lg ${doc.type.includes('pdf') ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                                                {doc.type.includes('pdf') ? <FileText size={20}/> : <ImageIcon size={20}/>}
                                                            </div>
                                                            <div className="overflow-hidden">
                                                                <span className="font-bold text-sm text-slate-800 dark:text-white block truncate max-w-[150px]">{doc.name}</span>
                                                                <span className="text-[10px] text-gray-400">{doc.size} • {doc.uploadDate}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button onClick={()=>setShowDocViewer(doc)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"><Eye size={16}/></button>
                                                            <button onClick={()=>deleteDoc(doc.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>}
                                    </td></tr>
                                )}
                            </React.Fragment>
                        })
                    )}
                </tbody>
            </table>
        </div>
        
        {/* EDIT/ADD PATIENT MODAL */}
        {showPatientModal && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
                <div className="bg-white dark:bg-slate-900 w-full max-w-4xl p-8 overflow-y-auto animate-fade-in-up shadow-2xl border-l border-gray-200 dark:border-slate-800">
                    <div className="flex justify-between mb-6">
                        <h3 className="text-2xl font-bold dark:text-white">{patientForm.id ? 'Edit Patient' : 'Register Patient'}</h3>
                        <button onClick={()=>setShowPatientModal(false)} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full"><X size={20}/></button>
                    </div>
                    <form onSubmit={savePatient} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">First Name</label>
                                <input required className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={splitName.first} onChange={e=>setSplitName({...splitName,first:e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Last Name</label>
                                <input required className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={splitName.last} onChange={e=>setSplitName({...splitName,last:e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Date of Birth</label>
                                <input required type="date" className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={patientForm.dob} onChange={e=>setPatientForm({...patientForm,dob:e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Gender</label>
                                <select className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={patientForm.gender} onChange={e=>setPatientForm({...patientForm,gender:e.target.value})}>
                                    <option>Male</option><option>Female</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Phone</label>
                                <input required className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={patientForm.phone} onChange={e=>setPatientForm({...patientForm,phone:e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Blood Group</label>
                                <select className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={patientForm.blood_group} onChange={e=>setPatientForm({...patientForm,blood_group:e.target.value})}>
                                    {BLOOD_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 grid grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-800">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Height (cm)</label>
                                    <input type="number" className="w-full border p-2 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={patientForm.height} onChange={e=>setPatientForm({...patientForm,height:e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Weight (kg)</label>
                                    <input type="number" className="w-full border p-2 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={patientForm.weight} onChange={e=>setPatientForm({...patientForm,weight:e.target.value})} />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <TagInput label="Known Allergies" options={COMMON_ALLERGIES} value={patientForm.allergies || ''} onChange={(v:string) => setPatientForm({...patientForm, allergies: v})} colorClass="bg-rose-100 text-rose-700" />
                            </div>
                            <div className="col-span-2">
                                <TagInput label="Chronic Conditions" options={COMMON_CONDITIONS} value={patientForm.chronic_conditions || ''} onChange={(v:string) => setPatientForm({...patientForm, chronic_conditions: v})} colorClass="bg-amber-100 text-amber-700" />
                            </div>
                        </div>
                        <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3">
                            <button type="button" onClick={()=>setShowPatientModal(false)} className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-slate-800 font-bold text-gray-600 dark:text-gray-300">Cancel</button>
                            <button className="px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-bold shadow-lg">Save Record</button>
                        </div>
                    </form>
                </div>
            </div>, 
        document.body)}

        {/* ADD VISIT MODAL */}
        {showVisitModal && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-lg p-6 rounded-2xl shadow-2xl">
                    <h3 className="text-xl font-bold mb-4 dark:text-white">Record Clinical Visit</h3>
                    <div className="space-y-4">
                        <input className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="Diagnosis / Chief Complaint" value={visitForm.diagnosis} onChange={e=>setVisitForm({...visitForm,diagnosis:e.target.value})}/>
                        <textarea className="w-full border p-3 rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white h-24" placeholder="Treatment Plan & Notes" value={visitForm.treatment} onChange={e=>setVisitForm({...visitForm,treatment:e.target.value})}/>
                        
                        <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                            <input className="w-full border p-2 rounded dark:bg-slate-800 dark:text-white text-sm" placeholder="BP Systolic" value={visitForm.bpSystolic} onChange={e=>setVisitForm({...visitForm,bpSystolic:e.target.value})}/>
                            <input className="w-full border p-2 rounded dark:bg-slate-800 dark:text-white text-sm" placeholder="BP Diastolic" value={visitForm.bpDiastolic} onChange={e=>setVisitForm({...visitForm,bpDiastolic:e.target.value})}/>
                            <input className="w-full border p-2 rounded dark:bg-slate-800 dark:text-white text-sm" placeholder="Heart Rate (BPM)" value={visitForm.heartRate} onChange={e=>setVisitForm({...visitForm,heartRate:e.target.value})}/>
                            <input className="w-full border p-2 rounded dark:bg-slate-800 dark:text-white text-sm" placeholder="Temp (°C)" value={visitForm.temperature} onChange={e=>setVisitForm({...visitForm,temperature:e.target.value})}/>
                            <input className="w-full border p-2 rounded dark:bg-slate-800 dark:text-white text-sm" placeholder="Current Weight (kg)" value={visitForm.weight} onChange={e=>setVisitForm({...visitForm,weight:e.target.value})}/>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={()=>setShowVisitModal(false)} className="px-4 py-2 bg-gray-200 dark:bg-slate-800 rounded-lg text-gray-700 dark:text-gray-300 font-bold">Cancel</button>
                            <button onClick={saveVisit} className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold shadow-md">Save Visit</button>
                        </div>
                    </div>
                </div>
            </div>, 
        document.body)}
        
        {/* QUICK BOOKING MODAL */}
        {showBookingModal && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-sm p-6 rounded-2xl shadow-2xl">
                    <h3 className="text-xl font-bold mb-4 dark:text-white">{t('create_appointment')}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Doctor</label>
                            <select className="w-full border p-2 rounded-lg dark:bg-slate-800 dark:text-white" value={newBooking.doctorId} onChange={e => setNewBooking({...newBooking, doctorId: e.target.value})}>
                                <option value="">Select Doctor</option>
                                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                            <input type="date" className="w-full border p-2 rounded-lg dark:bg-slate-800 dark:text-white" value={newBooking.date} onChange={e => setNewBooking({...newBooking, date: e.target.value})}/>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={()=>setShowBookingModal(false)} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg font-bold">Cancel</button>
                            <button onClick={handleBooking} className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>,
        document.body)}

        {/* DOCUMENT PREVIEW MODAL */}
        {showDocViewer && createPortal(
            <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-4xl h-[80vh] bg-black flex items-center justify-center relative">
                    <button onClick={()=>setShowDocViewer(null)} className="absolute -top-12 right-0 text-white hover:text-red-500"><X size={32}/></button>
                    {showDocViewer.type.includes('image') ? (
                        <img src={showDocViewer.content} className="max-w-full max-h-full object-contain" />
                    ) : (
                        <iframe src={showDocViewer.content} className="w-full h-full bg-white" />
                    )}
                </div>
                <div className="text-white mt-4 font-bold">{showDocViewer.name}</div>
            </div>,
        document.body)}
    </div>
  );
};

export default Patients;
