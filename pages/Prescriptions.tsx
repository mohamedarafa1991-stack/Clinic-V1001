
import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { PrescriptionItem, Patient, Doctor } from '../types';
import { 
  Pill, Printer, Save, X, Plus, Search, 
  Trash2, User, ChevronDown, FileText, 
  AlertTriangle, Copy, RotateCcw, Clock, Stethoscope,
  ArrowUp, ArrowDown, Activity, CheckCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { useLocation } from 'react-router-dom';

const Prescriptions = () => {
  const { user } = useAuth();
  const { t, dir, language } = useLanguage();
  const { resolvedColors } = useTheme();
  const location = useLocation();
  
  // Data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [recentRx, setRecentRx] = useState<any[]>([]);
  const [medSuggestions, setMedSuggestions] = useState<string[]>([]);
  
  // Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(0);
  const [rxItems, setRxItems] = useState<PrescriptionItem[]>([]);
  const [rxNotes, setRxNotes] = useState('');
  const [rxDiagnosis, setRxDiagnosis] = useState('');
  
  // Temp Item State
  const [tempItem, setTempItem] = useState<PrescriptionItem>({ medicineId: 0, name: '', dosage: '', frequency: '', duration: '' });
  
  // Template Saving
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    const allPatients = dbService.query("SELECT * FROM patients");
    setPatients(allPatients);
    setDoctors(dbService.query("SELECT * FROM doctors"));
    setTemplates(dbService.query("SELECT * FROM prescription_templates"));
    if (user?.relatedId) setSelectedDoctorId(user.relatedId);
    
    // Auto-select patient from navigation state
    if (location.state?.patientId) {
        const p = allPatients.find((pt: any) => pt.id === location.state.patientId);
        if (p) setSelectedPatient(p);
    }

    refreshRecentRx();
    loadMedSuggestions();
  }, [user, location.state]);

  const refreshRecentRx = () => {
    setRecentRx(dbService.query(`SELECT p.*, pt.name as patientName, d.name as doctorName FROM prescriptions p LEFT JOIN patients pt ON p.patientId = pt.id LEFT JOIN doctors d ON p.doctorId = d.id ORDER BY p.id DESC LIMIT 10`));
  };

  const loadMedSuggestions = () => {
      const rawRx = dbService.query("SELECT items FROM prescriptions ORDER BY id DESC LIMIT 100");
      const names = new Set<string>();
      rawRx.forEach((r: any) => { try { JSON.parse(r.items).forEach((i: any) => { if(i.name) names.add(i.name); }); } catch(e){} });
      setMedSuggestions(Array.from(names).sort());
  };

  const filteredPatients = useMemo(() => {
    if (!searchQuery) return [];
    return patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery));
  }, [patients, searchQuery]);

  const selectedDoctor = useMemo(() => doctors.find(d => d.id === Number(selectedDoctorId)), [doctors, selectedDoctorId]);

  const addItem = () => {
      if(!tempItem.name) return;
      setRxItems([...rxItems, tempItem]);
      setTempItem({ medicineId: 0, name: '', dosage: '', frequency: '', duration: '' });
  };

  const removeItem = (idx: number) => {
      const n = [...rxItems];
      n.splice(idx, 1);
      setRxItems(n);
  };

  const savePrescription = () => {
    if (!selectedPatient) return alert(t('search') + " Patient");
    dbService.exec(
        `INSERT INTO prescriptions (patientId, doctorId, date, items, notes, diagnosis) VALUES (?, ?, ?, ?, ?, ?)`, 
        [selectedPatient.id, selectedDoctorId, new Date().toISOString().split('T')[0], JSON.stringify(rxItems), rxNotes, rxDiagnosis]
    );
    refreshRecentRx(); 
    alert(t('save') + " - Prescription Saved"); 
    setRxItems([]); setRxNotes(''); setRxDiagnosis(''); setSelectedPatient(null);
  };

  const saveTemplate = () => {
      if(!newTemplateName || rxItems.length === 0) return;
      dbService.exec("INSERT INTO prescription_templates (name, items) VALUES (?, ?)", [newTemplateName, JSON.stringify(rxItems)]);
      setTemplates(dbService.query("SELECT * FROM prescription_templates"));
      setShowSaveTemplate(false);
      setNewTemplateName('');
  };

  const loadTemplate = (itemsStr: string) => {
      try {
          setRxItems(JSON.parse(itemsStr));
      } catch(e) {}
  };

  const printPrescription = () => {
      // 1. Fetch Clinic Metadata
      const settingsRows = dbService.query("SELECT * FROM settings");
      const getSetting = (k: string) => settingsRows.find((r: any) => r.key === k)?.value || '';
      
      const clinicLogo = getSetting('clinic_logo');
      const clinicName = getSetting('clinic_name') || "MediCore Clinic";
      const clinicAddress = getSetting('clinic_address');
      const clinicPhone = getSetting('clinic_phone');

      const isRtl = language === 'ar';
      
      // 2. Initialize PDF
      const doc = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.width;
      const margin = 15;
      const primaryColor = resolvedColors.primary; // e.g. #0d9488

      // Helper for RTL X-coordinates
      const alignLeft = isRtl ? 'right' : 'left';
      const alignRight = isRtl ? 'left' : 'right';
      
      // Get X position for a column (allows swapping columns based on direction)
      const getColX = (isLeftCol: boolean) => {
          if (isRtl) return isLeftCol ? pageWidth - margin : margin; // Swap visual sides
          return isLeftCol ? margin : pageWidth - margin;
      };

      // --- HEADER ---
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, pageWidth, 40, 'F');

      // Logo
      if (clinicLogo) {
          try {
              // Assuming clinicLogo is Base64 string "data:image/png;base64,..."
              const ext = clinicLogo.split(';')[0].match(/jpeg|png/)[0];
              doc.addImage(clinicLogo, ext.toUpperCase(), margin, 5, 30, 30);
          } catch (e) {
              console.warn("Logo add failed", e);
          }
      }

      // Clinic Info (White Text on Header)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      const titleX = clinicLogo ? margin + 35 : margin;
      
      doc.text(clinicName, pageWidth / 2, 18, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(clinicAddress || '', pageWidth / 2, 25, { align: 'center' });
      doc.text(clinicPhone || '', pageWidth / 2, 30, { align: 'center' });

      // --- INFO SECTION ---
      doc.setTextColor(0, 0, 0);
      let yPos = 55;

      // Doctor Details (Left in LTR, Right in RTL)
      const docLabel = selectedDoctor?.title ? `${selectedDoctor.title} ` : 'Dr. ';
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(docLabel + (selectedDoctor?.name || 'Unknown'), getColX(true), yPos, { align: alignLeft });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(selectedDoctor?.specialty || '', getColX(true), yPos + 5, { align: alignLeft });
      if (selectedDoctor?.licenseId) {
          doc.text(`Lic: ${selectedDoctor.licenseId}`, getColX(true), yPos + 10, { align: alignLeft });
      }

      // Patient Details (Right in LTR, Left in RTL)
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${t('patient')}: ${selectedPatient?.name}`, getColX(false), yPos, { align: alignRight });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`${t('date')}: ${format(new Date(), 'yyyy-MM-dd')}`, getColX(false), yPos + 5, { align: alignRight });
      if (selectedPatient?.dob) {
          const age = new Date().getFullYear() - new Date(selectedPatient.dob).getFullYear();
          doc.text(`${t('demographics')}: ${age}Y / ${selectedPatient.gender.charAt(0)}`, getColX(false), yPos + 10, { align: alignRight });
      }

      // --- DIAGNOSIS ---
      if (rxDiagnosis) {
          yPos += 20;
          doc.setTextColor(0);
          doc.setFont("helvetica", "bold");
          doc.text("Diagnosis:", isRtl ? pageWidth - margin : margin, yPos, { align: alignLeft });
          doc.setFont("helvetica", "normal");
          doc.text(rxDiagnosis, isRtl ? pageWidth - margin - 25 : margin + 25, yPos, { align: alignLeft });
      }

      // --- RX BODY ---
      yPos += rxDiagnosis ? 15 : 20;
      doc.setDrawColor(primaryColor);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);

      doc.setFontSize(24);
      doc.setTextColor(primaryColor);
      doc.setFont("times", "italic");
      doc.text("Rx", margin, yPos + 5); 

      // Table
      const tableHeaders = isRtl 
        ? [[t('duration'), t('frequency'), t('dosage'), t('medication')]]
        : [[t('medication'), t('dosage'), t('frequency'), t('duration')]];

      const tableBody = rxItems.map(item => {
          if (isRtl) return [item.duration, item.frequency, item.dosage, item.name];
          return [item.name, item.dosage, item.frequency, item.duration];
      });

      autoTable(doc, {
          startY: yPos + 10,
          head: tableHeaders,
          body: tableBody,
          theme: 'striped',
          headStyles: { 
              fillColor: primaryColor, 
              halign: isRtl ? 'right' : 'left' 
          },
          bodyStyles: { 
              halign: isRtl ? 'right' : 'left',
              fontSize: 11
          },
          styles: { font: "helvetica" },
          margin: { left: margin, right: margin }
      });

      // --- FOOTER / NOTES ---
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      if (rxNotes) {
          doc.setFontSize(10);
          doc.setTextColor(0);
          doc.setFont("helvetica", "bold");
          doc.text(t('instructions') + ":", isRtl ? pageWidth - margin : margin, finalY, { align: alignLeft });
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          const splitNotes = doc.splitTextToSize(rxNotes, pageWidth - (margin * 2));
          doc.text(splitNotes, isRtl ? pageWidth - margin : margin, finalY + 5, { align: alignLeft });
      }

      // Signature
      const sigY = 250;
      doc.setLineWidth(0.2);
      doc.setDrawColor(0);
      doc.line(pageWidth - margin - 50, sigY, pageWidth - margin, sigY);
      doc.setFontSize(10);
      doc.text(t('prescribing_doctor'), pageWidth - margin - 25, sigY + 5, { align: 'center' });

      // Save
      const safeName = selectedPatient?.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'patient';
      const fileName = `Rx_${safeName}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-6" dir={dir}>
      {/* Top Bar */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="bg-[var(--color-primary)]/10 p-3 rounded-xl text-[var(--color-primary)]"><FileText size={24} /></div>
          <div><h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('new_prescription')}</h1><p className="text-sm text-gray-500 dark:text-gray-400">Clinical Rx Writer</p></div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setRxItems([]); setSelectedPatient(null); setRxDiagnosis(''); setRxNotes(''); }} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"><RotateCcw size={16} /> {t('reset')}</button>
          <button onClick={savePrescription} disabled={!selectedPatient} className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-primary)] text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50"><Save size={18} /> {t('save')}</button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        {/* LEFT: FORM */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-y-auto pr-1 custom-scrollbar">
          
          {/* Patient & Doctor Selection */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative z-20">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">{t('select_patient')}</label>
                {!selectedPatient ? (
                  <div className="relative">
                    <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-3 text-gray-400" size={18} />
                    <input className="w-full pl-10 rtl:pr-10 rtl:pl-4 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white" placeholder={t('search')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    {searchQuery && filteredPatients.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fade-in-up z-50">
                        {filteredPatients.map(p => (
                          <button key={p.id} onClick={() => { setSelectedPatient(p); setSearchQuery(''); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center group">
                            <div><span className="block font-bold text-gray-800 dark:text-white">{p.name}</span><span className="text-xs text-gray-500">{p.phone}</span></div>
                            <User size={16} className="text-gray-300 group-hover:text-[var(--color-primary)]"/>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-xl">
                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold">{selectedPatient.name.charAt(0)}</div><div><p className="font-bold text-gray-800 dark:text-white text-sm">{selectedPatient.name}</p><p className="text-xs opacity-60">{selectedPatient.gender}, Age {new Date().getFullYear() - new Date(selectedPatient.dob).getFullYear()}</p></div></div>
                    <button onClick={() => setSelectedPatient(null)} className="p-1 hover:bg-white/50 rounded-full text-gray-500"><X size={16}/></button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">{t('prescribing_doctor')}</label>
                <div className="relative">
                  <select className="w-full pl-4 rtl:pr-4 rtl:pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none dark:text-white" value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(Number(e.target.value))}>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Rx Builder */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-slate-800 flex-1 flex flex-col">
            
            {/* Diagnosis Field */}
            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 flex items-center gap-2"><Activity size={14}/> Diagnosis</label>
                <input 
                    className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-3 bg-gray-50 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all"
                    placeholder="e.g. Acute Bronchitis"
                    value={rxDiagnosis}
                    onChange={e => setRxDiagnosis(e.target.value)}
                />
            </div>

            <div className="flex justify-between items-center mb-4 border-t border-gray-100 dark:border-slate-800 pt-6">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Stethoscope size={18} className="text-[var(--color-primary)]" /> {t('medication')}</h3>
                <div className="flex gap-2">
                    <button onClick={() => setShowSaveTemplate(!showSaveTemplate)} className="text-xs bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-slate-700">{t('save_template')}</button>
                </div>
            </div>
            
            {/* Template Save Input */}
            {showSaveTemplate && (
                <div className="mb-4 flex gap-2 animate-fade-in-up">
                    <input className="flex-1 border p-2 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white text-sm" placeholder="Template Name..." value={newTemplateName} onChange={e=>setNewTemplateName(e.target.value)} />
                    <button onClick={saveTemplate} className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-sm font-bold">Confirm</button>
                </div>
            )}

            {/* Add Item Row */}
            <div className="grid grid-cols-12 gap-3 mb-4 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
              <div className="col-span-4"><input list="meds-list" className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-white" placeholder={t('medication')} value={tempItem.name} onChange={(e) => setTempItem({...tempItem, name: e.target.value})} /><datalist id="meds-list">{medSuggestions.map((m, i) => <option key={i} value={m} />)}</datalist></div>
              <div className="col-span-2"><input className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-white" placeholder={t('dosage')} value={tempItem.dosage} onChange={(e) => setTempItem({...tempItem, dosage: e.target.value})} /></div>
              <div className="col-span-3"><input className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-white" placeholder={t('frequency')} value={tempItem.frequency} onChange={(e) => setTempItem({...tempItem, frequency: e.target.value})} /></div>
              <div className="col-span-2"><input className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-white" placeholder={t('duration')} value={tempItem.duration} onChange={(e) => setTempItem({...tempItem, duration: e.target.value})} /></div>
              <div className="col-span-1"><button onClick={addItem} className="w-full h-full bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center transition-colors"><Plus size={18} /></button></div>
            </div>
            
            {/* List */}
            <div className="flex-1 overflow-y-auto min-h-[200px] border border-gray-100 dark:border-slate-800 rounded-xl mb-4">
              <table className="w-full text-left rtl:text-right text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 font-bold border-b border-gray-100 dark:border-slate-800">
                  <tr><th className="p-3 w-1/3">{t('medication')}</th><th className="p-3">{t('dosage')}</th><th className="p-3">{t('frequency')}</th><th className="p-3">{t('duration')}</th><th className="p-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {rxItems.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-medium text-gray-800 dark:text-white">{item.name}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">{item.dosage}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">{item.frequency}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">{item.duration}</td>
                      <td className="p-3 text-right"><button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                  {rxItems.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400 italic">No medications added.</td></tr>}
                </tbody>
              </table>
            </div>
            
            <div className="grid grid-cols-1 gap-6 pt-4 border-t border-gray-100 dark:border-slate-800">
               <div>
                   <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">{t('instructions')}</label>
                   <textarea className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm h-24 resize-none outline-none dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]" value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} placeholder="e.g. Take after meals..." />
               </div>
            </div>
          </div>
        </div>

        {/* RIGHT: PREVIEW & TEMPLATES */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-full overflow-hidden">
          
          {/* Templates Quick Load */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-slate-800 max-h-60 overflow-y-auto custom-scrollbar">
              <h4 className="font-bold text-gray-800 dark:text-white mb-3 text-sm uppercase tracking-wide">{t('load_template')}</h4>
              <div className="flex flex-wrap gap-2">
                  {templates.map(tmp => (
                      <button key={tmp.id} onClick={() => loadTemplate(tmp.items)} className="text-xs bg-gray-100 dark:bg-slate-800 hover:bg-[var(--color-primary)] hover:text-white dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 transition-colors">
                          {tmp.name}
                      </button>
                  ))}
                  {templates.length === 0 && <span className="text-xs text-gray-400">No templates saved.</span>}
              </div>
          </div>

          {/* Live Preview Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-slate-800 flex-1 flex flex-col">
             <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">{t('print_rx')} <span className="text-xs font-normal text-gray-400 ml-auto">Preview</span></h4>
             
             {/* Paper Mockup */}
             <div className="bg-white border border-gray-200 rounded shadow-inner p-6 text-xs space-y-4 flex-1 overflow-y-auto font-serif text-slate-800 relative">
                {/* Header */}
                <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-xl font-bold text-[var(--color-primary)]">MediCore Clinic</h2>
                    <p className="text-gray-500">123 Medical Center Dr, Cairo</p>
                </div>
                
                {/* Meta */}
                <div className="flex justify-between">
                    <div>
                        <p><strong>Dr. {selectedDoctor?.name || '...'}</strong></p>
                        <p className="text-gray-500">{selectedDoctor?.title}</p>
                    </div>
                    <div className="text-right">
                        <p><strong>Patient: {selectedPatient?.name || '...'}</strong></p>
                        <p className="text-gray-500">{format(new Date(), 'yyyy-MM-dd')}</p>
                    </div>
                </div>

                {/* Diagnosis Preview */}
                {rxDiagnosis && (
                    <div className="mt-2">
                        <span className="font-bold uppercase text-gray-400 text-[10px] block">Diagnosis</span>
                        <span className="font-bold">{rxDiagnosis}</span>
                    </div>
                )}

                {/* Rx Symbol */}
                <div className="text-2xl font-bold text-slate-900 mt-4">Rx</div>

                {/* Items */}
                <div className="space-y-2 pl-4">
                    {rxItems.length === 0 && <p className="text-gray-300 italic">No items...</p>}
                    {rxItems.map((i, idx) => (
                        <div key={idx} className="border-b border-gray-100 pb-1">
                            <p className="font-bold text-sm">{i.name} <span className="font-normal text-gray-600">{i.dosage}</span></p>
                            <p className="text-gray-500 text-[10px]">{i.frequency} for {i.duration}</p>
                        </div>
                    ))}
                </div>

                {/* Notes */}
                {rxNotes && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="font-bold text-[10px] uppercase text-gray-400">Instructions</p>
                        <p className="italic">{rxNotes}</p>
                    </div>
                )}

                {/* Signature */}
                <div className="absolute bottom-8 right-8 w-32 border-t border-black pt-1 text-center">
                    Signature
                </div>
             </div>

             <button onClick={printPrescription} disabled={!selectedPatient || rxItems.length === 0} className="mt-4 w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg">
                 <Printer size={18} /> {t('print')}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Prescriptions;
