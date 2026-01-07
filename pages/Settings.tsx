
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { hashPassword } from '../utils/security';
import { Save, Upload, Trash2, Users, Settings as SettingsIcon, Plus, Shield, User, Check, X, Moon, Sun, Database, FileText, FileSpreadsheet, FileType, Snowflake, Moon as MoonIcon, Flower, Ghost, Building2, MapPin, Phone, Image as ImageIcon } from 'lucide-react';
import { UserRole } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OCCASION_THEMES } from '../services/themeConfig';

const Settings = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;

  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'data'>('general');
  const [colors, setColors] = useState({ 
    primary: '#0d9488',
    secondary: '#0f766e',
    inputBg: '#ffffff'
  });
  const [isDark, setIsDark] = useState(false);
  const [activeDecoration, setActiveDecoration] = useState('none');
  const [clinicInfo, setClinicInfo] = useState({
      name: 'MediCore Clinic',
      address: '',
      phone: '',
      logo: ''
  });

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ 
    id: 0, 
    name: '', 
    email: '', 
    password: '', 
    role: UserRole.RECEPTIONIST, 
    relatedId: 0 
  });

  // Export State
  const [exportScope, setExportScope] = useState('all');

  useEffect(() => {
      const settings = dbService.query("SELECT * FROM settings");
      const p = settings.find((s: any) => s.key === 'primary_color')?.value;
      const s = settings.find((s: any) => s.key === 'secondary_color')?.value;
      const i = settings.find((s: any) => s.key === 'input_bg_color')?.value;
      const t = settings.find((s: any) => s.key === 'theme_mode')?.value;
      const d = settings.find((s: any) => s.key === 'active_decoration')?.value;
      
      const cName = settings.find((s: any) => s.key === 'clinic_name')?.value;
      const cAddr = settings.find((s: any) => s.key === 'clinic_address')?.value;
      const cPhone = settings.find((s: any) => s.key === 'clinic_phone')?.value;
      const cLogo = settings.find((s: any) => s.key === 'clinic_logo')?.value;

      if (p) {
          setColors({ 
              primary: p, 
              secondary: s || '#0f766e', 
              inputBg: i || '#ffffff' 
          });
      }
      setIsDark(t === 'dark');
      if (d) setActiveDecoration(d);
      
      setClinicInfo({
          name: cName || 'MediCore Clinic',
          address: cAddr || '',
          phone: cPhone || '',
          logo: cLogo || ''
      });

  }, []);

  useEffect(() => {
      if (activeTab === 'users') loadUsers();
  }, [activeTab]);

  const loadUsers = () => {
      setUsers(dbService.query("SELECT * FROM users"));
      setDoctors(dbService.query("SELECT * FROM doctors"));
  };

  const handleThemeSelection = (themeId: string) => {
      setActiveDecoration(themeId);
      const themeDef = OCCASION_THEMES[themeId];
      if (themeDef) {
          const t = themeDef.colors.light;
          setColors({
              primary: t.primary,
              secondary: t.secondary,
              inputBg: t.inputBg
          });
      }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB Limit
        alert("File too large. Please upload an image smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setClinicInfo(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveGeneral = async () => {
    // Save Clinic Info
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('clinic_name', ?)", [clinicInfo.name]);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('clinic_address', ?)", [clinicInfo.address]);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('clinic_phone', ?)", [clinicInfo.phone]);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('clinic_logo', ?)", [clinicInfo.logo]);

    // Save Theme Info
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('primary_color', ?)", [colors.primary]);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('secondary_color', ?)", [colors.secondary]);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('input_bg_color', ?)", [colors.inputBg]);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme_mode', ?)", [isDark ? 'dark' : 'light']);
    dbService.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('active_decoration', ?)", [activeDecoration]);
    
    // Apply visual changes immediately
    const root = document.documentElement;
    
    if (isDark) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }

    root.classList.remove('theme-spring', 'theme-ramadan', 'theme-christmas', 'theme-halloween', 'theme-none');
    
    if (activeDecoration !== 'none') {
        root.classList.add(`theme-${activeDecoration}`);
        root.style.removeProperty('--color-primary');
        root.style.removeProperty('--color-secondary');
        root.style.removeProperty('--color-app-bg');
        root.style.removeProperty('--color-surface');
        root.style.removeProperty('--color-border');
        root.style.removeProperty('--color-input-bg');
    } else {
        root.classList.add('theme-none');
        root.style.setProperty('--color-primary', colors.primary);
        root.style.setProperty('--color-secondary', colors.secondary);
        root.style.setProperty('--color-input-bg', colors.inputBg);
    }

    window.dispatchEvent(new Event('medicore-theme-change'));
    window.dispatchEvent(new Event('medicore-logo-change')); // Trigger logo update
    alert('Settings saved successfully!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) dbService.importBackup(file);
  };

  // --- Export Logic ---
  const getExportData = (scope: string) => {
      const data: any = {};
      if (scope === 'patients' || scope === 'all') {
          data.patients = dbService.query("SELECT id, name, phone, email, gender, dob, blood_group, allergies, chronic_conditions, address FROM patients");
      }
      if (scope === 'doctors' || scope === 'all') {
          data.doctors = dbService.query("SELECT id, name, specialty, phone, email, fee FROM doctors");
      }
      if (scope === 'appointments' || scope === 'all') {
          data.appointments = dbService.query(`SELECT a.id, a.date, a.time, p.name as patient, d.name as doctor, a.status, a.type, a.totalFee, a.amountPaid, a.paymentStatus FROM appointments a LEFT JOIN patients p ON a.patientId = p.id LEFT JOIN doctors d ON a.doctorId = d.id`);
      }
      if (scope === 'inventory' || scope === 'all') {
          // Removed price from selection
          data.inventory = dbService.query("SELECT id, name, generic, form, concentration, manufacturer, stock, expiry FROM medicines");
      }
      return data;
  };

  const exportData = (format: 'csv' | 'excel' | 'pdf') => {
      const dataMap = getExportData(exportScope);
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `medicore_export_${exportScope}_${dateStr}`;

      if (format === 'excel') {
          const wb = XLSX.utils.book_new();
          Object.keys(dataMap).forEach(key => {
              const ws = XLSX.utils.json_to_sheet(dataMap[key]);
              XLSX.utils.book_append_sheet(wb, ws, key.charAt(0).toUpperCase() + key.slice(1));
          });
          XLSX.writeFile(wb, `${filename}.xlsx`);
      } 
      else if (format === 'csv') {
          const keys = Object.keys(dataMap);
          if (keys.length > 1) {
              alert("For 'All Data', please use Excel. Downloading 'Appointments' data as CSV fallback.");
              const key = dataMap.appointments ? 'appointments' : keys[0];
              const ws = XLSX.utils.json_to_sheet(dataMap[key]);
              const csv = XLSX.utils.sheet_to_csv(ws);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `medicore_${key}_${dateStr}.csv`;
              a.click();
          } else {
              const key = keys[0];
              const ws = XLSX.utils.json_to_sheet(dataMap[key]);
              const csv = XLSX.utils.sheet_to_csv(ws);
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${filename}.csv`;
              a.click();
          }
      }
      else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.text(`MediCore Data Export: ${exportScope.toUpperCase()}`, 14, 15);
          doc.setFontSize(10);
          doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
          
          let yPos = 30;
          Object.keys(dataMap).forEach((key, index) => {
              if (index > 0) { doc.addPage(); yPos = 20; }
              doc.setFontSize(14);
              doc.text(key.charAt(0).toUpperCase() + key.slice(1), 14, yPos);
              const rows = dataMap[key].map((row: any) => Object.values(row).map(v => String(v)));
              const headers = dataMap[key].length > 0 ? Object.keys(dataMap[key][0]) : [];
              autoTable(doc, { head: [headers], body: rows, startY: yPos + 5, theme: 'grid', headStyles: { fillColor: [13, 148, 136] }, styles: { fontSize: 8 } });
          });
          doc.save(`${filename}.pdf`);
      }
  };

  // --- User Management Handlers ---

  const handleSaveUser = async () => {
      if (!userForm.name || !userForm.email || !userForm.role) {
          alert("Please fill in required fields.");
          return;
      }
      if (!userForm.id && !userForm.password) {
          alert("Password is required for new users.");
          return;
      }

      try {
          let hashedPassword = userForm.password;
          if (userForm.password) {
              hashedPassword = await hashPassword(userForm.password);
          }

          if (userForm.id) {
              if (userForm.password) {
                  dbService.exec("UPDATE users SET name=?, email=?, role=?, relatedId=?, password=? WHERE id=?", [
                      userForm.name, userForm.email, userForm.role, userForm.relatedId || null, hashedPassword, userForm.id
                  ]);
              } else {
                   dbService.exec("UPDATE users SET name=?, email=?, role=?, relatedId=? WHERE id=?", [
                      userForm.name, userForm.email, userForm.role, userForm.relatedId || null, userForm.id
                  ]);
              }
              dbService.logAudit(user?.id || 0, 'USER_UPDATE', `Updated user ${userForm.name} (${userForm.role})`);
          } else {
              dbService.exec("INSERT INTO users (name, email, password, role, relatedId) VALUES (?, ?, ?, ?, ?)", [
                   userForm.name, userForm.email, hashedPassword, userForm.role, userForm.relatedId || null
              ]);
              dbService.logAudit(user?.id || 0, 'USER_CREATE', `Created user ${userForm.name} (${userForm.role})`);
          }
          setShowUserModal(false);
          loadUsers();
      } catch (e) {
          alert("Error saving user. Email might be duplicate.");
      }
  };

  const deleteUser = (id: number) => {
      if(confirm("Delete this user account permanently?")) {
          dbService.exec("DELETE FROM users WHERE id=?", [id]);
          dbService.logAudit(user?.id || 0, 'USER_DELETE', `Deleted user ID ${id}`);
          loadUsers();
      }
  };

  const openUserModal = (u?: any) => {
      if (u) {
          setUserForm({ ...u, password: '' });
      } else {
          setUserForm({ id: 0, name: '', email: '', password: '', role: UserRole.RECEPTIONIST, relatedId: 0 });
      }
      setShowUserModal(true);
  };

  const roleDefinitions = [
    { 
        role: UserRole.ADMIN, 
        label: 'Administrator',
        desc: 'Full system access. Can manage settings, users, finances, and delete records.',
        color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
    },
    { 
        role: UserRole.DOCTOR, 
        label: 'Doctor', 
        desc: 'Clinical access. Sees own appointments, manages patients, and handles prescriptions.', 
        color: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' 
    },
    { 
        role: UserRole.RECEPTIONIST, 
        label: 'Receptionist',
        desc: 'Front desk operations. Manages patient registration, appointments, and provider schedules.',
        color: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
    },
    { 
        role: UserRole.NURSE, 
        label: 'Nurse',
        desc: 'Patient care support. Can view patient history, triage visits, and manage pharmacy stock.',
        color: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400'
    },
    { 
        role: UserRole.BILLING, 
        label: 'Billing Agent',
        desc: 'Financial focus. Access to invoices, payment history, and revenue reports only.',
        color: 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400'
    }
  ];

  const decorations = [
      { id: 'none', label: 'Default', icon: <Check size={20}/> },
      { id: 'spring', label: 'Spring', icon: <Flower size={20}/> },
      { id: 'ramadan', label: 'Ramadan', icon: <MoonIcon size={20}/> },
      { id: 'christmas', label: 'Christmas', icon: <Snowflake size={20}/> },
      { id: 'halloween', label: 'Halloween', icon: <Ghost size={20}/> },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
        {/* Tab Navigation */}
        <div className="flex gap-6 border-b border-borderSubtle overflow-x-auto">
            <button className={`pb-4 px-2 font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'general' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 dark:text-gray-400'}`} onClick={() => setActiveTab('general')}><SettingsIcon size={18} /> General Settings</button>
            <button className={`pb-4 px-2 font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'users' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 dark:text-gray-400'}`} onClick={() => setActiveTab('users')}><Users size={18} /> Users & Roles</button>
            {isAdmin && (<button className={`pb-4 px-2 font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === 'data' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 dark:text-gray-400'}`} onClick={() => setActiveTab('data')}><Database size={18} /> Data Management</button>)}
        </div>
        
        {activeTab === 'general' && (
            <div className="animate-fade-in-up space-y-8">
                {/* Clinic Profile Section */}
                <div className="bg-surface p-6 rounded-2xl shadow-sm border border-borderSubtle">
                     <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <Building2 size={20} className="text-[var(--color-primary)]" /> Clinic Profile
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                         <div className="md:col-span-2">
                             <div className="flex items-start gap-6 mb-6">
                                 <div className="shrink-0 relative group">
                                     <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center overflow-hidden">
                                         {clinicInfo.logo ? (
                                             <img src={clinicInfo.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                                         ) : (
                                             <ImageIcon className="text-gray-300 dark:text-slate-600" size={32} />
                                         )}
                                     </div>
                                     <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer text-xs">
                                         Upload
                                         <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                     </label>
                                 </div>
                                 <div className="flex-1">
                                     <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Clinic Name</label>
                                     <input 
                                        className="w-full border border-gray-200 dark:border-slate-700 p-3 rounded-xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                                        value={clinicInfo.name}
                                        onChange={e => setClinicInfo({...clinicInfo, name: e.target.value})}
                                        placeholder="e.g. MediCore Clinic"
                                     />
                                     <p className="text-xs text-gray-400 mt-2">Upload a PNG or JPG logo (max 2MB) to appear on the login screen and sidebar.</p>
                                 </div>
                             </div>
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 flex items-center gap-1"><MapPin size={12}/> Address</label>
                             <input 
                                className="w-full border border-gray-200 dark:border-slate-700 p-3 rounded-xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                                value={clinicInfo.address}
                                onChange={e => setClinicInfo({...clinicInfo, address: e.target.value})}
                                placeholder="Street, City"
                             />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 flex items-center gap-1"><Phone size={12}/> Contact Phone</label>
                             <input 
                                className="w-full border border-gray-200 dark:border-slate-700 p-3 rounded-xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                                value={clinicInfo.phone}
                                onChange={e => setClinicInfo({...clinicInfo, phone: e.target.value})}
                                placeholder="(555) 000-0000"
                             />
                         </div>
                     </div>
                </div>

                {/* Theme Section */}
                <div className="bg-surface p-6 rounded-2xl shadow-sm border border-borderSubtle">
                    <div className="flex items-center justify-between mb-8 pb-8 border-b border-gray-100 dark:border-slate-700">
                        <div><label className="text-sm font-bold text-gray-700 dark:text-gray-200 block mb-1">Interface Theme</label><p className="text-xs text-gray-500 dark:text-gray-400">Toggle light/dark modes.</p></div>
                        <button onClick={() => setIsDark(!isDark)} className={`relative w-16 h-8 rounded-full transition-colors flex items-center px-1 ${isDark ? 'bg-slate-700' : 'bg-orange-100'}`}><div className={`w-6 h-6 rounded-full shadow-sm transform transition-transform duration-300 flex items-center justify-center ${isDark ? 'translate-x-8 bg-slate-900 text-yellow-400' : 'translate-x-0 bg-white text-orange-500'}`}>{isDark ? <Moon size={14} /> : <Sun size={14} />}</div></button>
                    </div>
                    <div className="mb-8 pb-8 border-b border-gray-100 dark:border-slate-700">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200 block mb-3">Active Occasion Theme</label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {decorations.map((d) => (
                                <button key={d.id} onClick={() => handleThemeSelection(d.id)} className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${activeDecoration === d.id ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 dark:bg-[var(--color-primary)]/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-300 ${activeDecoration === d.id ? 'text-[var(--color-primary)]' : ''}`}>{d.icon}</div>
                                    <span className={`text-xs font-bold ${activeDecoration === d.id ? 'text-[var(--color-primary)]' : 'text-gray-500 dark:text-gray-400'}`}>{d.label}</span>
                                    {activeDecoration === d.id && (<div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-primary)]" />)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button onClick={handleSaveGeneral} className="flex items-center gap-2 bg-gray-900 dark:bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all shadow-lg shadow-gray-200 dark:shadow-none border border-transparent dark:border-slate-700"><Save size={18} /> Save Settings</button>
                </div>
            </div>
        )}

        {/* ... Users Tab ... */}
        {activeTab === 'users' && (
             <div className="space-y-6 animate-fade-in-up">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                    <div><h3 className="text-lg font-bold text-blue-900 dark:text-blue-200">User Access Control</h3><p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Create accounts for staff members and assign their roles.</p></div>
                    <button onClick={() => openUserModal()} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all"><Plus size={18} /> Add New User</button>
                </div>
                <div className="bg-surface border border-borderSubtle rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 text-xs uppercase text-gray-500 dark:text-gray-400 font-bold"><tr><th className="p-4">Staff Member</th><th className="p-4">Access Role</th><th className="p-4">Profile Link</th><th className="p-4 text-right">Actions</th></tr></thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition">
                                    <td className="p-4"><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm text-white ${u.role === UserRole.ADMIN ? 'bg-slate-800' : 'bg-[var(--color-primary)]'}`}>{u.name.charAt(0)}</div><div><p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{u.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p></div></div></td>
                                    <td className="p-4"><span className="text-[10px] font-bold uppercase px-2 py-1 rounded border bg-slate-50 dark:bg-slate-800">{u.role}</span></td>
                                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{u.relatedId ? <span className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs"><Check size={12} /> Linked</span> : <span className="text-gray-400 text-xs italic">Unlinked</span>}</td>
                                    <td className="p-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => openUserModal(u)} className="p-2 border rounded-lg text-gray-400 hover:text-blue-600"><SettingsIcon size={16} /></button><button onClick={() => deleteUser(u.id)} className="p-2 border rounded-lg text-gray-400 hover:text-red-600"><Trash2 size={16} /></button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roleDefinitions.map((def) => (
                        <div key={def.role} className={`p-4 rounded-xl border ${def.color}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <Shield size={16} />
                                <h4 className="font-bold text-sm uppercase tracking-wider">{def.label}</h4>
                            </div>
                            <p className="text-xs opacity-90 leading-relaxed">{def.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* ... Data Tab (Same as before) ... */}
        {activeTab === 'data' && isAdmin && (
            <div className="animate-fade-in-up space-y-8">
                {/* Export Section */}
                <div className="bg-surface p-6 rounded-2xl shadow-sm border border-borderSubtle mb-6">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <FileSpreadsheet size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Data Export</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Download clinic records for reporting or external analysis.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Export Scope</label>
                            <div className="flex flex-wrap gap-2">
                                {['all', 'patients', 'appointments', 'doctors', 'inventory'].map(scope => (
                                    <button 
                                        key={scope}
                                        onClick={() => setExportScope(scope)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all border ${exportScope === scope ? 'bg-gray-900 dark:bg-slate-700 text-white border-transparent' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-gray-300'}`}
                                    >
                                        {scope}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button onClick={() => exportData('excel')} className="flex flex-col items-center justify-center gap-3 p-4 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl transition-all group">
                            <FileSpreadsheet size={32} className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Excel Report</span>
                        </button>

                        <button onClick={() => exportData('csv')} className="flex flex-col items-center justify-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl transition-all group">
                            <FileType size={32} className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-bold text-blue-800 dark:text-blue-300">CSV Data</span>
                        </button>

                        <button onClick={() => exportData('pdf')} className="flex flex-col items-center justify-center gap-3 p-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/10 dark:hover:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-xl transition-all group">
                            <FileText size={32} className="text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-bold text-rose-800 dark:text-rose-300">PDF Document</span>
                        </button>
                    </div>
                </div>

                {/* ... Backup/Restore/Export UI ... */}
                <div className="bg-surface p-6 rounded-2xl shadow-sm border border-borderSubtle">
                     <div className="flex items-start gap-4 mb-6"><div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl"><Database size={24} /></div><div><h3 className="text-lg font-bold text-gray-800 dark:text-white">Database Operations</h3></div></div>
                     <div className="space-y-4">
                         <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-700"><div><p className="font-bold text-gray-800 dark:text-gray-200">Backup Database</p></div><button onClick={() => dbService.exportBackup()} className="px-4 py-2 border rounded-lg text-sm font-bold flex items-center gap-2 transition-all"><Save size={16} /> Download Backup</button></div>
                         <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-700"><div><p className="font-bold text-gray-800 dark:text-gray-200">Restore Database</p></div><label className="px-4 py-2 border rounded-lg text-sm font-bold flex items-center gap-2 cursor-pointer transition-all"><Upload size={16} /> Upload Backup<input type="file" accept=".sqlite" className="hidden" onChange={handleImport} /></label></div>
                         <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20"><div><p className="font-bold text-red-700 dark:text-red-400">Factory Reset</p></div><button onClick={() => { if(confirm("Are you sure?")) dbService.factoryReset() }} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold flex items-center gap-2"><Trash2 size={16} /> Reset</button></div>
                     </div>
                </div>
            </div>
        )}

        {/* ... Modal ... */}
        {showUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-700/50">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2"><User size={20} className="text-[var(--color-primary)]" /> {userForm.id ? 'Edit User' : 'Create New User'}</h3>
                        <button onClick={() => setShowUserModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-4">
                         <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Full Name</label><input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} /></div>
                         <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Email</label><input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white" type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} /></div>
                         <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Password</label><input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white" type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} /></div>
                         <div className="grid grid-cols-2 gap-4">
                             <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Role</label><select className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}>{Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                             {userForm.role === UserRole.DOCTOR && (<div><label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Link Profile</label><select className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-700 dark:text-white" value={userForm.relatedId} onChange={e => setUserForm({...userForm, relatedId: Number(e.target.value)})}>{doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>)}
                         </div>
                    </div>
                    <div className="p-6 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
                        <button onClick={() => setShowUserModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
                        <button onClick={handleSaveUser} className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold shadow-lg flex items-center gap-2"><Check size={18} /> Save User</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Settings;
