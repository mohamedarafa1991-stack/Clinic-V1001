
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { dbService } from '../services/db';
import { 
  User, Plus, Search, FileText, ChevronDown, ChevronUp, 
  Pill, Printer, Save, X, Edit3, Trash2, Activity, 
  Calendar, FilePlus, AlertCircle, Phone, Mail, MapPin, Heart, AlertOctagon,
  Scale, Thermometer, HeartPulse, Shield, CheckCircle2, Calculator
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Medicine, PrescriptionItem, VisitRecord, Patient } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { differenceInYears, parseISO, subYears, format } from 'date-fns';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const GENDERS = ['Male', 'Female', 'Other'];

const COMMON_ALLERGIES = [
  'Penicillin', 'Peanuts', 'Latex', 'Shellfish', 'Dairy', 'Pollen', 'Dust Mites', 'Sulfa Drugs', 'Other'
];

const COMMON_CONDITIONS = [
  'Hypertension', 'Type 2 Diabetes', 'Asthma', 'Arthritis', 'Heart Disease', 'Migraine', 'Thyroid Disorder', 'Other'
];

// --- Internal Component: Tag Input ---
const TagInput = ({ 
  label, 
  options, 
  value, 
  onChange, 
  colorClass = "bg-gray-100 text-gray-700"
}: {
  label: string, 
  options: string[], 
  value: string, 
  onChange: (val: string) => void,
  colorClass?: string
}) => {
  const [input, setInput] = useState('');
  // Parse comma-separated string into array, filter empty/None
  const tags = value.split(',').map(s => s.trim()).filter(s => s && s !== 'None');

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
        const newTags = [...tags, tag];
        onChange(newTags.join(', '));
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    const newTags = tags.filter(t => t !== tag);
    onChange(newTags.length > 0 ? newTags.join(', ') : 'None');
  };

  return (
    <div>
        <label className={`block text-xs font-bold mb-1.5 uppercase ${colorClass.includes('rose') ? 'text-rose-600 dark:text-rose-400' : (colorClass.includes('amber') ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400')}`}>{label}</label>
        <div className="border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-2 focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20 transition-all">
            <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, i) => (
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
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag(input);
                        }
                    }}
                />
                {input && (
                     <button type="button" onMouseDown={() => addTag(input)} className="absolute right-0 top-0 text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 font-bold text-gray-600 dark:text-gray-300">Add</button>
                )}
            </div>
             {/* Suggestions */}
            <div className="flex flex-wrap gap-1 mt-2 border-t border-gray-100 dark:border-slate-700 pt-2">
                {options.filter(o => !tags.includes(o) && o.toLowerCase().includes(input.toLowerCase())).map(opt => (
                    <button 
                        key={opt} 
                        type="button" 
                        onClick={() => addTag(opt)}
                        className="text-[10px] bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 px-2 py-1 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 hover:text-gray-800 dark:hover:text-white transition-colors"
                    >
                        + {opt}
                    </button>
                ))}
            </div>
        </div>
    </div>
  );
};

const Patients = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'rx'>('info');

  // Modals
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showRxModal, setShowRxModal] = useState(false);

  // Forms Data
  const initialPatientState: Partial<Patient> = { 
      id: 0, name: '', phone: '', email: '', address: '', 
      emergency_contact: '', blood_group: 'Unknown', allergies: 'None', chronic_conditions: 'None',
      dob: '', gender: 'Male', history: '[]',
      height: 0, weight: 0
  };
  
  const [patientForm, setPatientForm] = useState<any>(initialPatientState);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // UI Specific State for Split Fields
  const [splitName, setSplitName] = useState({ first: '', last: '' });
  const [splitEC, setSplitEC] = useState({ name: '', relation: '', phone: '' });
  const [ageInput, setAgeInput] = useState('');

  // Visit Form with Vitals
  const [visitForm, setVisitForm] = useState({ 
      diagnosis: '', treatment: '', medications: '', notes: '',
      bpSystolic: '', bpDiastolic: '', heartRate: '', temperature: '', weight: ''
  });
  
  // Rx Data
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [pharmacyDrugs, setPharmacyDrugs] = useState<Medicine[]>([]);
  const [currentRxItems, setCurrentRxItems] = useState<PrescriptionItem[]>([]);
  const [rxNotes, setRxNotes] = useState('');
  const [patientPrescriptions, setPatientPrescriptions] = useState<any[]>([]);
  const [tempRxItem, setTempRxItem] = useState({ medicineId: '', dosage: '', frequency: '', duration: '' });

  useEffect(() => {
    loadPatients();
    setPharmacyDrugs(dbService.query("SELECT * FROM medicines ORDER BY name ASC"));
  }, [searchTerm]);

  const loadPatients = () => {
    const q = searchTerm 
        ? `SELECT * FROM patients WHERE name LIKE '%${searchTerm}%' OR phone LIKE '%${searchTerm}%' OR email LIKE '%${searchTerm}%'`
        : "SELECT * FROM patients ORDER BY name ASC";
    setPatients(dbService.query(q));
  };

  const loadPrescriptions = (pid: number) => {
    const rx = dbService.query(`
        SELECT p.*, d.name as doctorName 
        FROM prescriptions p 
        LEFT JOIN doctors d ON p.doctorId = d.id 
        WHERE p.patientId = ${pid} 
        ORDER BY p.id DESC
    `);
    setPatientPrescriptions(rx);
  };

  const toggleExpand = (pid: number) => {
    if (expandedRow === pid) {
        setExpandedRow(null);
    } else {
        setExpandedRow(pid);
        setSelectedPatientId(pid);
        loadPrescriptions(pid);
        setActiveTab('info');
    }
  };

  // --- Calculations & Helpers ---
  
  const calculateBMI = (weight?: number, height?: number) => {
      if (!weight || !height) return { value: 0, label: 'N/A', color: 'text-gray-400' };
      const heightM = height / 100;
      const bmi = weight / (heightM * heightM);
      let label = 'Normal';
      let color = 'text-emerald-500';
      
      if (bmi < 18.5) { label = 'Underweight'; color = 'text-blue-500'; }
      else if (bmi >= 25 && bmi < 29.9) { label = 'Overweight'; color = 'text-orange-500'; }
      else if (bmi >= 30) { label = 'Obese'; color = 'text-red-500'; }
      
      return { value: bmi.toFixed(1), label, color };
  };

  const getAge = (dob: string) => {
    if (!dob) return '--';
    try {
        return differenceInYears(new Date(), parseISO(dob));
    } catch { return '--'; }
  };

  const getLatestVitals = (historyStr: string) => {
      try {
          const history = JSON.parse(historyStr || '[]');
          const vitalRecord = history.find((h: VisitRecord) => h.bp || h.heartRate);
          if (vitalRecord) return vitalRecord;
          return null;
      } catch { return null; }
  };

  // --- State Synchronization ---

  const prepareFormForEdit = (p: Patient) => {
    setPatientForm(p);
    // Split Name
    const nameParts = p.name.split(' ');
    setSplitName({
        first: nameParts[0] || '',
        last: nameParts.slice(1).join(' ') || ''
    });
    // Split EC
    const ecParts = (p.emergency_contact || '').split(' - ');
    setSplitEC({
        name: ecParts[0] || '',
        relation: ecParts[1] || '',
        phone: ecParts[2] || ''
    });
    // Age
    setAgeInput(getAge(p.dob).toString());
  };

  const resetForm = () => {
      setPatientForm(initialPatientState);
      setSplitName({ first: '', last: '' });
      setSplitEC({ name: '', relation: '', phone: '' });
      setAgeInput('');
      setFormErrors({});
  };
  
  // Logic to update combined Name
  const handleNameChange = (part: 'first' | 'last', val: string) => {
      const updated = { ...splitName, [part]: val };
      setSplitName(updated);
      setPatientForm((prev: any) => ({ ...prev, name: `${updated.first} ${updated.last}`.trim() }));
  };

  // Logic to update combined EC
  const handleECChange = (part: 'name' | 'relation' | 'phone', val: string) => {
      const updated = { ...splitEC, [part]: val };
      setSplitEC(updated);
      setPatientForm((prev: any) => ({ ...prev, emergency_contact: `${updated.name} - ${updated.relation} - ${updated.phone}` }));
  };

  // Logic for DOB / Age
  const handleAgeChange = (age: string) => {
      setAgeInput(age);
      if (age && !isNaN(Number(age))) {
          // Approximate DOB based on Age
          const date = subYears(new Date(), Number(age));
          const dobStr = format(date, 'yyyy-MM-dd');
          setPatientForm((prev: any) => ({ ...prev, dob: dobStr }));
      }
  };

  const handleDobChange = (dob: string) => {
      setPatientForm((prev: any) => ({ ...prev, dob }));
      if (dob) {
          const age = differenceInYears(new Date(), parseISO(dob));
          setAgeInput(age.toString());
      }
  };
  
  const validateForm = () => {
      const errors: any = {};
      if (!splitName.first || splitName.first.length < 2) errors.name = "First Name is required";
      if (!splitName.last || splitName.last.length < 2) errors.name = "Last Name is required";
      if (!patientForm.phone) errors.phone = "Phone number is required";
      if (!patientForm.dob) errors.dob = "Date of Birth or Age is required";
      
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
  };

  // --- CRUD ---

  const handleEditPatient = (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    prepareFormForEdit(p);
    setFormErrors({});
    setShowPatientModal(true);
  };

  const savePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Ensure combined strings are set correctly before save (redundancy check)
    const fullName = `${splitName.first} ${splitName.last}`.trim();
    const fullEC = `${splitEC.name} - ${splitEC.relation} - ${splitEC.phone}`;

    if (patientForm.id) {
        dbService.exec(
            `UPDATE patients SET 
             name=?, phone=?, email=?, address=?, emergency_contact=?, blood_group=?, allergies=?, chronic_conditions=?,
             dob=?, gender=?, height=?, weight=?
             WHERE id=?`,
            [
                fullName, patientForm.phone, patientForm.email, patientForm.address, 
                fullEC, patientForm.blood_group, patientForm.allergies || 'None', patientForm.chronic_conditions || 'None',
                patientForm.dob, patientForm.gender, patientForm.height || 0, patientForm.weight || 0,
                patientForm.id
            ]
        );
    } else {
        dbService.exec(
            `INSERT INTO patients 
             (name, phone, email, address, emergency_contact, blood_group, allergies, chronic_conditions, dob, gender, history, height, weight) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                fullName, patientForm.phone, patientForm.email, patientForm.address,
                fullEC, patientForm.blood_group, patientForm.allergies || 'None', patientForm.chronic_conditions || 'None',
                patientForm.dob, patientForm.gender, '[]',
                patientForm.height || 0, patientForm.weight || 0
            ]
        );
    }
    setShowPatientModal(false);
    resetForm();
    loadPatients();
  };

  const handleDeletePatient = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this patient record? This cannot be undone.')) {
        dbService.exec("DELETE FROM patients WHERE id = ?", [id]);
        loadPatients();
        setExpandedRow(null);
    }
  };

  // --- Visit Recording ---

  const openVisitModal = () => {
    setVisitForm({ 
        diagnosis: '', treatment: '', medications: '', notes: '',
        bpSystolic: '', bpDiastolic: '', heartRate: '', temperature: '', weight: ''
    });
    setShowVisitModal(true);
  };

  const saveVisit = () => {
    if (!selectedPatientId) return;
    const patient = patients.find(p => p.id === selectedPatientId);
    if (!patient) return;

    const bp = (visitForm.bpSystolic && visitForm.bpDiastolic) ? `${visitForm.bpSystolic}/${visitForm.bpDiastolic}` : undefined;

    const newRecord: VisitRecord = {
        date: new Date().toISOString().split('T')[0],
        diagnosis: visitForm.diagnosis,
        treatment: visitForm.treatment,
        medications: visitForm.notes,
        bp: bp,
        heartRate: visitForm.heartRate,
        temperature: visitForm.temperature
    };

    const currentHistory = JSON.parse(patient.history || '[]');
    const updatedHistory = [newRecord, ...currentHistory];

    if (visitForm.weight) {
        dbService.exec("UPDATE patients SET history = ?, weight = ? WHERE id = ?", [JSON.stringify(updatedHistory), Number(visitForm.weight), selectedPatientId]);
    } else {
        dbService.exec("UPDATE patients SET history = ? WHERE id = ?", [JSON.stringify(updatedHistory), selectedPatientId]);
    }
    
    setShowVisitModal(false);
    loadPatients();
  };

  // --- Prescription Logic ---

  const openRxModal = () => {
    setCurrentRxItems([]);
    setRxNotes('');
    setTempRxItem({ medicineId: '', dosage: '', frequency: '', duration: '' });
    setShowRxModal(true);
  };

  const addRxItem = () => {
      if (!tempRxItem.medicineId || !tempRxItem.dosage || !tempRxItem.frequency) {
          alert("Please fill in Medicine, Dosage, and Frequency.");
          return;
      }
      
      const medicine = pharmacyDrugs.find(d => d.id === Number(tempRxItem.medicineId));
      if (!medicine) return;

      const newItem: PrescriptionItem = {
          medicineId: medicine.id,
          name: medicine.name,
          dosage: tempRxItem.dosage,
          frequency: tempRxItem.frequency,
          duration: tempRxItem.duration || '5 days'
      };

      setCurrentRxItems([...currentRxItems, newItem]);
      setTempRxItem({ medicineId: '', dosage: '', frequency: '', duration: '' });
  };

  const removeRxItem = (index: number) => {
      const newList = [...currentRxItems];
      newList.splice(index, 1);
      setCurrentRxItems(newList);
  };

  const savePrescription = () => {
    if (!selectedPatientId) return;
    if (currentRxItems.length === 0) {
        alert("Please add at least one medication.");
        return;
    }

    const docId = user?.relatedId || 0;
    dbService.exec(
        `INSERT INTO prescriptions (patientId, doctorId, date, items, notes) VALUES (?, ?, ?, ?, ?)`,
        [selectedPatientId, docId, new Date().toISOString().split('T')[0], JSON.stringify(currentRxItems), rxNotes]
    );
    setShowRxModal(false);
    loadPrescriptions(selectedPatientId);
  };

  const printRx = (rx: any, patientName: string) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(13, 148, 136);
    doc.text("MediCore Clinic", 105, 20, { align: "center" });
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("MEDICAL PRESCRIPTION", 105, 45, { align: "center" });
    
    doc.setFontSize(11);
    doc.text(`Patient Name: ${patientName}`, 20, 60);
    doc.text(`Date: ${rx.date}`, 140, 60);
    
    const items = JSON.parse(rx.items);
    const body = items.map((i: any) => [i.name, i.dosage, i.frequency, i.duration]);
    
    autoTable(doc, {
        startY: 80,
        head: [['Medication', 'Dosage', 'Frequency', 'Duration']],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [13, 148, 136] }
    });
    
    if (rx.notes) {
        doc.text("Notes:", 20, (doc as any).lastAutoTable.finalY + 10);
        doc.setFontSize(10);
        doc.text(rx.notes, 20, (doc as any).lastAutoTable.finalY + 16);
    }
    
    doc.save(`Rx_${patientName}_${rx.date}.pdf`);
  };

  const magicFill = () => {
    const names = ["Alice Wonderland", "Bob Builder", "Charlie Chaplin", "David Beckham", "Elon Tusk"];
    const rand = Math.floor(Math.random() * names.length);
    const split = names[rand].split(' ');
    
    setSplitName({ first: split[0], last: split[1] });
    setPatientForm((prev: any) => ({ ...prev, name: names[rand] }));
    
    setPatientForm((prev: any) => ({
        ...prev,
        phone: `555-${Math.floor(1000 + Math.random() * 9000)}`,
        email: `${split[0].toLowerCase()}@example.com`,
        address: '123 Medical Drive, Wellness City',
        emergency_contact: 'Jane Doe - Wife - 555-9999',
        blood_group: BLOOD_GROUPS[Math.floor(Math.random() * BLOOD_GROUPS.length)],
        allergies: 'None',
        chronic_conditions: 'None',
        dob: '1985-05-20',
        gender: Math.random() > 0.5 ? 'Male' : 'Female',
        height: 175,
        weight: 70
    }));
    
    setSplitEC({ name: 'Jane Doe', relation: 'Wife', phone: '555-9999' });
    setAgeInput('39');
    setFormErrors({});
  };

  // Form Live BMI Calc
  const liveBMI = calculateBMI(patientForm.weight, patientForm.height);

  return (
    <div className="pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Patient Registry</h2>
                <p className="text-gray-500 dark:text-gray-400">Manage records, medical history, and detailed profiles</p>
            </div>
            <button 
                onClick={() => { resetForm(); setShowPatientModal(true); }}
                className="bg-[var(--color-primary)] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 transition shadow-lg shadow-[var(--color-primary)]/20"
            >
                <Plus size={18} /> Add Patient
            </button>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 mb-6 flex items-center gap-3 focus-within:ring-2 ring-[var(--color-primary)]/20 transition-all">
            <Search className="text-gray-400" size={20} />
            <input 
                type="text"
                placeholder="Search by name, phone or email..."
                className="flex-1 outline-none text-gray-700 dark:text-white bg-transparent placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* List */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors">
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                    <tr>
                        <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Patient</th>
                        <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Contact</th>
                        <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Biometrics</th>
                        <th className="p-4 text-right font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {patients.map(p => {
                        const isExpanded = expandedRow === p.id;
                        const bmi = calculateBMI(p.weight, p.height);
                        const latestVitals = getLatestVitals(p.history);
                        const allergyList = (p.allergies && p.allergies !== 'None') ? p.allergies.split(',') : [];

                        return (
                        <React.Fragment key={p.id}>
                            <tr 
                                className={`transition-colors cursor-pointer ${isExpanded ? 'bg-teal-50/50 dark:bg-teal-900/10 border-l-4 border-l-[var(--color-primary)]' : 'hover:bg-gray-50 dark:hover:bg-slate-800/30 border-l-4 border-l-transparent'}`} 
                                onClick={() => toggleExpand(p.id)}
                            >
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${p.gender === 'Male' ? 'bg-indigo-500' : p.gender === 'Female' ? 'bg-rose-500' : 'bg-gray-500'}`}>
                                            {p.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 dark:text-white">{p.name}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-gray-400">ID: #{p.id.toString().padStart(4, '0')}</p>
                                                {allergyList.length > 0 && (
                                                    <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 rounded-full font-bold border border-red-200 dark:border-red-900/40 flex items-center gap-0.5" title={p.allergies}>
                                                        <AlertCircle size={10} /> {allergyList.length > 1 ? `${allergyList.length} Allergies` : 'Allergy'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col text-sm">
                                        <span className="text-gray-800 dark:text-gray-300 font-medium flex items-center gap-1"><Phone size={12} className="text-gray-400"/> {p.phone}</span>
                                        {p.email && <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1"><Mail size={12} className="text-gray-400"/> {p.email}</span>}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col text-sm">
                                        <span className="text-gray-800 dark:text-gray-300 font-medium">{getAge(p.dob)} yrs, {p.gender}</span>
                                        <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {p.blood_group && <span className="bg-gray-100 dark:bg-slate-700 px-1.5 rounded text-gray-700 dark:text-gray-300 font-medium">{p.blood_group}</span>}
                                            {p.weight && <span>{p.weight}kg</span>}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                        <button onClick={(e) => handleEditPatient(p, e)} className="p-2 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-lg text-gray-500 dark:text-gray-400 border border-transparent hover:border-gray-200 dark:hover:border-slate-600 transition-all"><Edit3 size={16} /></button>
                                        <button onClick={(e) => handleDeletePatient(p.id, e)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-gray-400 transition-all"><Trash2 size={16} /></button>
                                        <button onClick={() => toggleExpand(p.id)} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-gray-400">
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            
                            {/* Expanded View */}
                            {isExpanded && (
                                <tr className="bg-gray-50 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800">
                                    <td colSpan={4} className="p-0">
                                        <div className="p-6">
                                            {/* Tab Navigation */}
                                            <div className="flex gap-6 border-b border-gray-200 dark:border-slate-700 mb-6">
                                                <button 
                                                    onClick={() => setActiveTab('info')}
                                                    className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'info' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                                >
                                                    <User size={16} /> Patient Dashboard
                                                </button>
                                                <button 
                                                    onClick={() => setActiveTab('timeline')}
                                                    className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'timeline' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                                >
                                                    <Activity size={16} /> Clinical History
                                                </button>
                                                <button 
                                                    onClick={() => setActiveTab('rx')}
                                                    className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'rx' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                                >
                                                    <Pill size={16} /> Prescriptions
                                                </button>
                                            </div>

                                            {/* Tab Content: Dashboard Info */}
                                            {activeTab === 'info' && (
                                                <div className="animate-fade-in-up grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                    {/* Column 1: Medical Monitor */}
                                                    <div className="lg:col-span-1 space-y-4">
                                                        <div className="bg-slate-800 dark:bg-slate-900 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden ring-1 ring-slate-900/5 dark:ring-slate-800">
                                                            <div className="flex justify-between items-start mb-6 border-b border-slate-700 pb-3">
                                                                <h4 className="font-bold flex items-center gap-2 text-emerald-400"><Activity size={18} /> Live Vitals</h4>
                                                                {latestVitals && <span className="text-[10px] text-slate-400">{latestVitals.date}</span>}
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                                <div className="text-center p-2 rounded-lg bg-slate-700/50 border border-slate-600">
                                                                    <div className="flex items-center justify-center gap-1 mb-1 text-rose-400">
                                                                        <HeartPulse size={14} /> <span className="text-[10px] font-bold uppercase tracking-wider">HR</span>
                                                                    </div>
                                                                    <p className="text-2xl font-mono font-bold tracking-tight">{latestVitals?.heartRate || '--'} <span className="text-xs font-sans text-slate-400 font-normal">bpm</span></p>
                                                                </div>
                                                                <div className="text-center p-2 rounded-lg bg-slate-700/50 border border-slate-600">
                                                                    <div className="flex items-center justify-center gap-1 mb-1 text-sky-400">
                                                                        <Activity size={14} /> <span className="text-[10px] font-bold uppercase tracking-wider">BP</span>
                                                                    </div>
                                                                    <p className="text-2xl font-mono font-bold tracking-tight">{latestVitals?.bp || '--'}</p>
                                                                </div>
                                                                <div className="text-center p-2 rounded-lg bg-slate-700/50 border border-slate-600">
                                                                    <div className="flex items-center justify-center gap-1 mb-1 text-purple-400">
                                                                        <Thermometer size={14} /> <span className="text-[10px] font-bold uppercase tracking-wider">Temp</span>
                                                                    </div>
                                                                    <p className="text-2xl font-mono font-bold tracking-tight">{latestVitals?.temperature || '--'} <span className="text-xs font-sans text-slate-400 font-normal">°C</span></p>
                                                                </div>
                                                                <div className="text-center p-2 rounded-lg bg-slate-700/50 border border-slate-600">
                                                                    <div className="flex items-center justify-center gap-1 mb-1 text-emerald-400">
                                                                        <Scale size={14} /> <span className="text-[10px] font-bold uppercase tracking-wider">Wt</span>
                                                                    </div>
                                                                    <p className="text-2xl font-mono font-bold tracking-tight">{p.weight || '--'} <span className="text-xs font-sans text-slate-400 font-normal">kg</span></p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Alerts Card */}
                                                        {p.allergies && p.allergies !== 'None' && (
                                                            <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/30 p-4 rounded-xl shadow-sm ring-1 ring-rose-50 dark:ring-0">
                                                                <h4 className="font-bold text-rose-700 dark:text-rose-400 mb-2 flex items-center gap-2 text-sm"><AlertOctagon size={16} /> Allergies</h4>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {p.allergies.split(',').map((alg, i) => (
                                                                        <span key={i} className="text-rose-800 dark:text-rose-200 text-xs font-bold bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded-md border border-rose-100 dark:border-rose-800">{alg.trim()}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {p.chronic_conditions && p.chronic_conditions !== 'None' && (
                                                            <div className="bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl shadow-sm ring-1 ring-amber-50 dark:ring-0">
                                                                <h4 className="font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2 text-sm"><Activity size={16} /> Chronic Conditions</h4>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {p.chronic_conditions.split(',').map((cond, i) => (
                                                                        <span key={i} className="text-amber-800 dark:text-amber-200 text-xs font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md border border-amber-100 dark:border-amber-800">{cond.trim()}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Column 2 & 3: Detailed Profile */}
                                                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                                                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                                                            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                                                                <Shield size={20} className="text-[var(--color-primary)]" /> Medical Profile
                                                            </h4>
                                                            <button onClick={(e) => handleEditPatient(p, e)} className="text-sm bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-600">
                                                                Edit Details
                                                            </button>
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                                            <div>
                                                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><User size={14}/> Demographics</h5>
                                                                <ul className="space-y-3 text-sm">
                                                                    <li className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                                                                        <span className="text-slate-500 dark:text-slate-400">Full Name</span>
                                                                        <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
                                                                    </li>
                                                                    <li className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                                                                        <span className="text-slate-500 dark:text-slate-400">Gender / Age</span>
                                                                        <span className="font-medium text-slate-900 dark:text-white">{p.gender}, {getAge(p.dob)} yrs</span>
                                                                    </li>
                                                                    <li className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                                                                        <span className="text-slate-500 dark:text-slate-400">Date of Birth</span>
                                                                        <span className="font-medium text-slate-900 dark:text-white">{p.dob}</span>
                                                                    </li>
                                                                </ul>

                                                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 mt-6 flex items-center gap-2"><Phone size={14}/> Contact</h5>
                                                                <ul className="space-y-3 text-sm">
                                                                    <li className="flex gap-3">
                                                                        <Phone size={16} className="text-slate-400 shrink-0" />
                                                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{p.phone}</span>
                                                                    </li>
                                                                    <li className="flex gap-3">
                                                                        <Mail size={16} className="text-slate-400 shrink-0" />
                                                                        <span className="text-slate-700 dark:text-slate-300 break-all">{p.email || 'N/A'}</span>
                                                                    </li>
                                                                    <li className="flex gap-3">
                                                                        <MapPin size={16} className="text-slate-400 shrink-0" />
                                                                        <span className="text-slate-700 dark:text-slate-300">{p.address || 'N/A'}</span>
                                                                    </li>
                                                                </ul>
                                                            </div>

                                                            <div>
                                                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Activity size={14}/> Biometrics</h5>
                                                                <ul className="space-y-3 text-sm">
                                                                    <li className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                                                                        <span className="text-slate-500 dark:text-slate-400">Blood Group</span>
                                                                        <span className="font-bold text-white bg-rose-500 px-2 rounded-md shadow-sm shadow-rose-200 dark:shadow-none">{p.blood_group || '--'}</span>
                                                                    </li>
                                                                    <li className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                                                                        <span className="text-slate-500 dark:text-slate-400">Height</span>
                                                                        <span className="font-medium text-slate-900 dark:text-white">{p.height ? `${p.height} cm` : '--'}</span>
                                                                    </li>
                                                                    <li className="flex justify-between border-b border-slate-50 dark:border-slate-800 pb-2">
                                                                        <span className="text-slate-500 dark:text-slate-400">Weight</span>
                                                                        <span className="font-medium text-slate-900 dark:text-white">{p.weight ? `${p.weight} kg` : '--'}</span>
                                                                    </li>
                                                                    <li className="flex justify-between items-center pt-2">
                                                                        <span className="text-slate-500 dark:text-slate-400">BMI</span>
                                                                        <span className={`font-bold ${bmi.color}`}>{bmi.value} ({bmi.label})</span>
                                                                    </li>
                                                                </ul>
                                                                
                                                                <div className="mt-6 bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
                                                                    <div className="flex gap-3 items-center">
                                                                        <div className="bg-white dark:bg-slate-800 p-2 rounded-full text-rose-500 shadow-sm"><Heart size={16} /></div>
                                                                        <div>
                                                                            <span className="block text-slate-900 dark:text-white font-bold">{p.emergency_contact || 'None'}</span>
                                                                            <span className="text-xs text-rose-400">Emergency Contact</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tab Content: Timeline */}
                                            {activeTab === 'timeline' && (
                                                <div className="animate-fade-in-up">
                                                    {/* ... same timeline content ... */}
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h4 className="font-bold text-slate-700 dark:text-white">Medical History Log</h4>
                                                        <button onClick={openVisitModal} className="text-sm bg-slate-900 dark:bg-slate-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-600 shadow-md">
                                                            <FilePlus size={14} /> Add Clinical Note
                                                        </button>
                                                    </div>
                                                    {JSON.parse(p.history).length === 0 ? (
                                                        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                                            <div className="bg-white dark:bg-slate-700 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-slate-400">
                                                                <FileText size={24} />
                                                            </div>
                                                            <p className="text-slate-500 dark:text-slate-400 font-medium">No medical records found.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-8 py-2">
                                                            {JSON.parse(p.history).map((h: any, i: number) => (
                                                                <div key={i} className="pl-6 relative">
                                                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[var(--color-primary)] border-4 border-white dark:border-slate-800 shadow-sm"></div>
                                                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                                                                        <div className="flex justify-between items-start mb-3 border-b border-slate-50 dark:border-slate-800 pb-2">
                                                                            <h5 className="font-bold text-slate-800 dark:text-white text-lg">{h.diagnosis}</h5>
                                                                            <div className="text-right">
                                                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded mb-1">
                                                                                    <Calendar size={12} /> {h.date}
                                                                                </span>
                                                                                {(h.bp || h.heartRate) && (
                                                                                    <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                                                        {h.bp && <span className="flex items-center gap-1"><Activity size={10} className="text-sky-500"/> {h.bp}</span>}
                                                                                        {h.heartRate && <span className="flex items-center gap-1"><HeartPulse size={10} className="text-rose-500"/> {h.heartRate}</span>}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <div>
                                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Treatment Plan</span>
                                                                                <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">{h.treatment}</p>
                                                                            </div>
                                                                            {h.medications && (
                                                                                <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/20 mt-2 text-amber-900 dark:text-amber-200">
                                                                                    <span className="text-xs font-bold uppercase flex items-center gap-1">
                                                                                        <FileText size={12} /> Clinical Notes
                                                                                    </span>
                                                                                    <p className="text-sm mt-1 italic">{h.medications}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Tab Content: Prescriptions */}
                                            {activeTab === 'rx' && (
                                                <div className="animate-fade-in-up">
                                                    {/* ... same rx content ... */}
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h4 className="font-bold text-slate-700 dark:text-white">Prescription History</h4>
                                                        <button onClick={openRxModal} className="text-sm bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-lg flex items-center gap-2 hover:opacity-90 shadow-md">
                                                            <Pill size={14} /> Write Prescription
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {patientPrescriptions.length === 0 ? (
                                                            <p className="text-slate-400 col-span-2 text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">No prescriptions found.</p>
                                                        ) : (
                                                            patientPrescriptions.map(rx => (
                                                                <div key={rx.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm flex flex-col justify-between hover:border-[var(--color-primary)] transition-colors">
                                                                    {/* ... Rx Card Content ... */}
                                                                    <div>
                                                                        <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-50 dark:border-slate-800">
                                                                            <span className="text-xs font-bold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2 py-1 rounded">Rx #{rx.id}</span>
                                                                            <span className="text-xs text-slate-400 font-medium">{rx.date}</span>
                                                                        </div>
                                                                        <div className="space-y-2 mb-3">
                                                                            {JSON.parse(rx.items).map((item: any, idx: number) => (
                                                                                <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-2 rounded flex justify-between items-center">
                                                                                    <div>
                                                                                        <p className="text-sm font-bold text-slate-800 dark:text-white">{item.name}</p>
                                                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.dosage} • {item.frequency}</p>
                                                                                    </div>
                                                                                    <span className="text-xs font-bold text-slate-400">{item.duration}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div className="pt-3 flex justify-between items-center">
                                                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                            <User size={12} /> Dr. {rx.doctorName || 'Unknown'}
                                                                        </span>
                                                                        <button onClick={() => printRx(rx, p.name)} className="text-[var(--color-primary)] hover:underline text-xs font-bold flex items-center gap-1">
                                                                            <Printer size={12} /> Print PDF
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    )})}
                </tbody>
            </table>
        </div>

        {/* Patient Drawer (Fixed Right Side) */}
        {showPatientModal && createPortal(
            <div className="fixed inset-0 z-50 flex justify-end">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => setShowPatientModal(false)}></div>
                
                {/* Drawer */}
                <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-up border-l border-gray-200 dark:border-slate-800">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10 sticky top-0">
                        <div className="flex items-center gap-3">
                             <div className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] p-2 rounded-lg">
                                <User size={24} />
                             </div>
                             <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">{patientForm.id ? 'Edit Patient Record' : 'New Patient Registration'}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Complete the form below. Fields marked * are mandatory.</p>
                             </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {!patientForm.id && (
                                <button onClick={magicFill} className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-full font-bold hover:bg-purple-100 dark:hover:bg-purple-900/50 transition border border-purple-100 dark:border-purple-800">
                                    ✨ Auto-Fill
                                </button>
                            )}
                            <button onClick={() => setShowPatientModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400"><X size={24}/></button>
                        </div>
                    </div>
                    
                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-800/50 p-8">
                        <form onSubmit={savePatient} className="max-w-4xl mx-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                
                                {/* Left Column: Identity & Contact (Cols 1-7) */}
                                <div className="lg:col-span-7 space-y-6">
                                    {/* Identity Card */}
                                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                            <User size={14} className="text-[var(--color-primary)]" /> Identity Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">First Name *</label>
                                                <input 
                                                    className={`w-full border p-3 rounded-xl focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 transition-all dark:text-white ${formErrors.name ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                                                    value={splitName.first} 
                                                    onChange={e => handleNameChange('first', e.target.value)} 
                                                    placeholder="First Name"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Last Name *</label>
                                                <input 
                                                    className={`w-full border p-3 rounded-xl focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 transition-all dark:text-white ${formErrors.name ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                                                    value={splitName.last} 
                                                    onChange={e => handleNameChange('last', e.target.value)} 
                                                    placeholder="Last Name"
                                                />
                                            </div>
                                            
                                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Date of Birth *</label>
                                                    <input type="date" className={`w-full border p-3 rounded-xl focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 transition-all dark:text-white ${formErrors.dob ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`} value={patientForm.dob} onChange={e => handleDobChange(e.target.value)} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Age (Approx) *</label>
                                                    <input 
                                                        type="number" 
                                                        placeholder="Or enter age"
                                                        className={`w-full border p-3 rounded-xl focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 transition-all dark:text-white ${formErrors.dob ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`} 
                                                        value={ageInput} 
                                                        onChange={e => handleAgeChange(e.target.value)} 
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Gender</label>
                                                <div className="relative">
                                                    <select className="w-full border p-3 rounded-xl bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 appearance-none border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none transition-all dark:text-white" value={patientForm.gender} onChange={e => setPatientForm({...patientForm, gender: e.target.value})}>
                                                        {GENDERS.map(g => <option key={g}>{g}</option>)}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contact Card */}
                                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                            <Phone size={14} className="text-[var(--color-primary)]" /> Contact Details
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Phone Number *</label>
                                                <input className={`w-full border p-3 rounded-xl bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none transition-all dark:text-white ${formErrors.phone ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`} value={patientForm.phone} onChange={e => setPatientForm({...patientForm, phone: e.target.value})} placeholder="(555) 000-0000" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Email Address</label>
                                                <input type="email" className={`w-full border p-3 rounded-xl bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none transition-all dark:text-white ${formErrors.email ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`} value={patientForm.email || ''} onChange={e => setPatientForm({...patientForm, email: e.target.value})} placeholder="email@domain.com" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Residential Address</label>
                                                <input className="w-full border p-3 rounded-xl bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none transition-all dark:text-white" value={patientForm.address || ''} onChange={e => setPatientForm({...patientForm, address: e.target.value})} placeholder="Street Address, City, State" />
                                            </div>
                                            
                                            <div className="md:col-span-2 pt-2 border-t border-slate-50 dark:border-slate-800 mt-2">
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase flex items-center gap-2">
                                                    <Heart size={14} className="text-rose-500"/> Emergency Contact
                                                </label>
                                                <div className="grid grid-cols-12 gap-3">
                                                    <div className="col-span-5">
                                                        <input className="w-full border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white" placeholder="Contact Name" value={splitEC.name} onChange={e => handleECChange('name', e.target.value)} />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <input className="w-full border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white" placeholder="Relation" value={splitEC.relation} onChange={e => handleECChange('relation', e.target.value)} />
                                                    </div>
                                                    <div className="col-span-4">
                                                        <input className="w-full border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white" placeholder="Phone" value={splitEC.phone} onChange={e => handleECChange('phone', e.target.value)} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Clinical (Cols 8-12) */}
                                <div className="lg:col-span-5 space-y-6">
                                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm h-full transition-colors">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                                            <Activity size={14} className="text-[var(--color-primary)]" /> Clinical Profile
                                        </h4>
                                        
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Height (cm)</label>
                                                    <input type="number" className="w-full border border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-center font-bold text-lg focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none transition-all dark:text-white" value={patientForm.height || ''} onChange={e => setPatientForm({...patientForm, height: Number(e.target.value)})} placeholder="0" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Weight (kg)</label>
                                                    <input type="number" className="w-full border border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 text-center font-bold text-lg focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none transition-all dark:text-white" value={patientForm.weight || ''} onChange={e => setPatientForm({...patientForm, weight: Number(e.target.value)})} placeholder="0" />
                                                </div>
                                            </div>

                                            {/* Live BMI Indicator */}
                                            {patientForm.height > 0 && patientForm.weight > 0 && (
                                                <div className={`p-4 rounded-xl border flex items-center justify-between ${liveBMI.label === 'Normal' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30'}`}>
                                                    <div className="flex items-center gap-2">
                                                        <Calculator size={18} className={liveBMI.color.replace('text-', 'text-opacity-70 text-')} />
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">BMI Score</p>
                                                            <p className={`font-bold ${liveBMI.color}`}>{liveBMI.value} kg/m²</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${liveBMI.label === 'Normal' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'}`}>
                                                        {liveBMI.label}
                                                    </span>
                                                </div>
                                            )}

                                            <hr className="border-slate-100 dark:border-slate-800" />

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Blood Group</label>
                                                <div className="relative">
                                                    <select className="w-full border border-slate-200 dark:border-slate-700 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 appearance-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none transition-all dark:text-white" value={patientForm.blood_group || ''} onChange={e => setPatientForm({...patientForm, blood_group: e.target.value})}>
                                                        {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                                                </div>
                                            </div>

                                            {/* Tag Inputs for Allergies and Conditions */}
                                            <TagInput 
                                                label="Allergies" 
                                                options={COMMON_ALLERGIES} 
                                                value={patientForm.allergies || 'None'} 
                                                onChange={(val) => setPatientForm({...patientForm, allergies: val})}
                                                colorClass="bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-900/30"
                                            />

                                            <TagInput 
                                                label="Chronic Conditions" 
                                                options={COMMON_CONDITIONS} 
                                                value={patientForm.chronic_conditions || 'None'} 
                                                onChange={(val) => setPatientForm({...patientForm, chronic_conditions: val})}
                                                colorClass="bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30"
                                            />

                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowPatientModal(false)} className="px-6 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors">Cancel</button>
                                <button type="submit" className="px-8 py-3 bg-[var(--color-primary)] text-white rounded-xl shadow-lg shadow-[var(--color-primary)]/30 font-bold hover:opacity-90 transition-opacity flex items-center gap-2">
                                    <CheckCircle2 size={18} /> {patientForm.id ? 'Update Record' : 'Register Patient'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>,
            document.body
        )}

        {/* Visit Modal with Vitals */}
        {showVisitModal && createPortal(
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto shadow-2xl ring-1 ring-slate-900/5 dark:ring-slate-800 border border-gray-200 dark:border-slate-800">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 text-slate-800 dark:text-white">
                        <FilePlus className="text-slate-600 dark:text-slate-400" /> New Clinical Entry
                    </h3>
                    
                    <div className="space-y-6">
                        {/* Vitals Section */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                             <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Activity size={14}/> Vitals Check</h4>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">BP (Sys/Dia)</label>
                                    <div className="flex items-center gap-1">
                                        <input className="w-full border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg text-center font-mono font-bold focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-700 dark:text-white" placeholder="120" value={visitForm.bpSystolic} onChange={e => setVisitForm({...visitForm, bpSystolic: e.target.value})} />
                                        <span className="text-slate-400">/</span>
                                        <input className="w-full border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg text-center font-mono font-bold focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-700 dark:text-white" placeholder="80" value={visitForm.bpDiastolic} onChange={e => setVisitForm({...visitForm, bpDiastolic: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Heart Rate</label>
                                    <div className="relative">
                                        <input className="w-full border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg pr-8 font-mono font-bold focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-700 dark:text-white" placeholder="72" value={visitForm.heartRate} onChange={e => setVisitForm({...visitForm, heartRate: e.target.value})} />
                                        <span className="absolute right-2 top-3 text-[10px] text-slate-400 font-bold">BPM</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Temp</label>
                                    <div className="relative">
                                        <input className="w-full border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg pr-6 font-mono font-bold focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-700 dark:text-white" placeholder="36.6" value={visitForm.temperature} onChange={e => setVisitForm({...visitForm, temperature: e.target.value})} />
                                        <span className="absolute right-2 top-3 text-[10px] text-slate-400 font-bold">°C</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Weight</label>
                                    <div className="relative">
                                        <input className="w-full border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg pr-6 font-mono font-bold focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-700 dark:text-white" placeholder="kg" value={visitForm.weight} onChange={e => setVisitForm({...visitForm, weight: e.target.value})} />
                                        <span className="absolute right-2 top-3 text-[10px] text-slate-400 font-bold">KG</span>
                                    </div>
                                </div>
                             </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Primary Diagnosis</label>
                                <input 
                                    className="w-full border border-slate-300 dark:border-slate-600 p-3 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-800 dark:text-white" 
                                    placeholder="e.g. Acute Bronchitis"
                                    value={visitForm.diagnosis}
                                    onChange={e => setVisitForm({...visitForm, diagnosis: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Treatment Plan</label>
                                <textarea 
                                    className="w-full border border-slate-300 dark:border-slate-600 p-3 rounded-xl h-24 focus:ring-2 focus:ring-[var(--color-primary)] outline-none resize-none bg-white dark:bg-slate-800 dark:text-white" 
                                    placeholder="e.g. Prescribed antibiotics, rest for 3 days."
                                    value={visitForm.treatment}
                                    onChange={e => setVisitForm({...visitForm, treatment: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Clinical Notes (Internal)</label>
                                <input 
                                    className="w-full border border-slate-300 dark:border-slate-600 p-3 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-800 dark:text-white" 
                                    placeholder="Observations, patient complaints..."
                                    value={visitForm.notes}
                                    onChange={e => setVisitForm({...visitForm, notes: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button onClick={() => setShowVisitModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-bold">Cancel</button>
                        <button onClick={saveVisit} className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg shadow-lg font-bold hover:bg-black dark:hover:bg-slate-600 transition-colors flex items-center gap-2">
                            <Save size={18} /> Save Record
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        {/* Prescription Modal */}
        {showRxModal && createPortal(
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl animate-fade-in-up h-[90vh] flex flex-col shadow-2xl ring-1 ring-slate-900/5 dark:ring-slate-800 border border-gray-200 dark:border-slate-800">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Pill className="text-[var(--color-primary)]" /> Write Prescription
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Patient: <span className="font-bold text-slate-800 dark:text-slate-200">{patients.find(p => p.id === selectedPatientId)?.name}</span>
                            </p>
                        </div>
                        <button onClick={() => setShowRxModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"><X size={24}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-800/50">
                        {/* Add Drug Form */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Plus size={14}/> Add Medication</h4>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="md:col-span-4">
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Drug Name</label>
                                    <select 
                                        className="w-full border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white"
                                        value={tempRxItem.medicineId}
                                        onChange={e => setTempRxItem({...tempRxItem, medicineId: e.target.value})}
                                    >
                                        <option value="">Select Medicine...</option>
                                        {pharmacyDrugs.map(drug => (
                                            <option key={drug.id} value={drug.id}>
                                                {drug.name} {drug.form ? `(${drug.form} ${drug.concentration || ''})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Dosage</label>
                                    <input 
                                        className="w-full border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white" 
                                        placeholder="e.g. 500mg"
                                        value={tempRxItem.dosage}
                                        onChange={e => setTempRxItem({...tempRxItem, dosage: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Frequency</label>
                                    <input 
                                        className="w-full border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white" 
                                        placeholder="e.g. 1-0-1 or Twice daily"
                                        value={tempRxItem.frequency}
                                        onChange={e => setTempRxItem({...tempRxItem, frequency: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase">Duration</label>
                                    <input 
                                        className="w-full border border-slate-300 dark:border-slate-600 p-2.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white" 
                                        placeholder="e.g. 5 days"
                                        value={tempRxItem.duration}
                                        onChange={e => setTempRxItem({...tempRxItem, duration: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <button 
                                        onClick={addRxItem}
                                        className="w-full p-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-black dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                                        title="Add to List"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* List */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="p-4">Medication</th>
                                        <th className="p-4">Dosage</th>
                                        <th className="p-4">Frequency</th>
                                        <th className="p-4">Duration</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {currentRxItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-slate-400 italic">No medications added yet.</td>
                                        </tr>
                                    ) : (
                                        currentRxItems.map((item, idx) => (
                                            <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-4 font-bold text-slate-800 dark:text-white">{item.name}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-300">{item.dosage}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-300">{item.frequency}</td>
                                                <td className="p-4 text-slate-600 dark:text-slate-300">{item.duration}</td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => removeRxItem(idx)} className="text-red-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Instructions / Notes</label>
                            <textarea 
                                className="w-full border border-slate-300 dark:border-slate-600 p-3 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none bg-white dark:bg-slate-900 dark:text-white h-24 resize-none"
                                placeholder="e.g. Take after food. Drink plenty of water."
                                value={rxNotes}
                                onChange={e => setRxNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 rounded-b-2xl">
                        <button onClick={() => setShowRxModal(false)} className="px-6 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors">Cancel</button>
                        <button onClick={savePrescription} className="px-8 py-3 bg-[var(--color-primary)] text-white rounded-xl shadow-lg shadow-[var(--color-primary)]/30 font-bold hover:opacity-90 transition-opacity flex items-center gap-2">
                            <Save size={18} /> Save Prescription
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};

export default Patients;
