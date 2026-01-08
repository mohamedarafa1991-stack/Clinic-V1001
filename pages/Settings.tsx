
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { dbService } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { useShortcuts } from '../contexts/ShortcutContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { syncService } from '../services/sync';
import { hashPassword } from '../utils/security';
import { 
  Save, Upload, Trash2, Users, Settings as SettingsIcon, Plus, 
  Database, Moon, Sun, Palette, Keyboard, RefreshCcw, Wifi, Server, X, Globe, Lock, User as UserIcon, Shield,
  CheckCircle, RotateCcw, Stethoscope, Activity, Calendar, DollarSign, Briefcase, Info, CheckSquare, Edit3, Tag, Library
} from 'lucide-react';
import { UserRole, Specialty, DoctorTitle } from '../types';
import { OCCASION_THEMES } from '../services/themeConfig';

const Settings = () => {
  const { user } = useAuth();
  const { shortcuts } = useShortcuts();
  const { language, setLanguage, saveLanguage, revertLanguage, isDirty: isLangDirty, t, dir } = useLanguage();
  const { settings, updatePreview, saveChanges: saveTheme, revertChanges: revertTheme, isDirty: isThemeDirty } = useTheme();
  
  const isAdmin = user?.role === UserRole.ADMIN;
  const isElectron = !!window.electronAPI;

  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'metadata' | 'data' | 'shortcuts' | 'sync'>('general');
  const [appVersion, setAppVersion] = useState('');
  
  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ id: 0, name: '', email: '', password: '', role: UserRole.RECEPTIONIST, relatedId: 0 });

  // Clinical Metadata State
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [titles, setTitles] = useState<DoctorTitle[]>([]);
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [specForm, setSpecForm] = useState<Partial<Specialty>>({ name: '', category: 'Primary Care' });
  const [titleForm, setTitleForm] = useState<Partial<DoctorTitle>>({ name: '' });

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);
  const [syncLog, setSyncLog] = useState<string[]>([]);

  // Init
  useEffect(() => {
      if (isElectron) {
          window.electronAPI!.getVersion().then(setAppVersion);
      }
  }, []);

  useEffect(() => { 
      if (activeTab === 'users') loadUsers(); 
      if (activeTab === 'metadata') loadMetadata();
      if (activeTab === 'sync') syncService.discoverPeers().then(setPeers);
  }, [activeTab]);

  const loadUsers = () => {
      setUsers(dbService.query("SELECT * FROM users"));
      setDoctors(dbService.query("SELECT * FROM doctors"));
  };

  const loadMetadata = () => {
      setSpecialties(dbService.query("SELECT * FROM specialties ORDER BY category, name"));
      setTitles(dbService.query("SELECT * FROM doctor_titles ORDER BY name"));
  };

  const handleThemeSelection = (themeId: string) => {
      updatePreview({ decoration: themeId });
  };

  const handleApplyChanges = () => {
      if (isThemeDirty) saveTheme();
      if (isLangDirty) saveLanguage();
  };

  const handleRevertChanges = () => {
      if (isThemeDirty) revertTheme();
      if (isLangDirty) revertLanguage();
  };

  const handleUserSave = async (e: React.FormEvent) => {
      e.preventDefault();
      let passHash = userForm.password;
      if (userForm.password && userForm.password.length < 50) { 
          passHash = await hashPassword(userForm.password);
      }
      if (userForm.id) {
          if (userForm.password) {
              dbService.exec("UPDATE users SET name=?, email=?, role=?, relatedId=?, password=? WHERE id=?", [userForm.name, userForm.email, userForm.role, userForm.relatedId, passHash, userForm.id]);
          } else {
              dbService.exec("UPDATE users SET name=?, email=?, role=?, relatedId=? WHERE id=?", [userForm.name, userForm.email, userForm.role, userForm.relatedId, userForm.id]);
          }
      } else {
          dbService.exec("INSERT INTO users (name, email, password, role, relatedId) VALUES (?, ?, ?, ?, ?)", [userForm.name, userForm.email, passHash, userForm.role, userForm.relatedId]);
      }
      setShowUserModal(false);
      loadUsers();
  };

  const deleteUser = (id: number) => {
      if(confirm(t('confirm_delete'))) {
          dbService.exec("DELETE FROM users WHERE id=?", [id]);
          loadUsers();
      }
  };

  const handleSpecSave = (e: React.FormEvent) => {
      e.preventDefault();
      if(!specForm.name) return;
      if(specForm.id) {
          dbService.exec("UPDATE specialties SET name=?, category=? WHERE id=?", [specForm.name, specForm.category, specForm.id]);
      } else {
          dbService.exec("INSERT INTO specialties (name, category) VALUES (?, ?)", [specForm.name, specForm.category]);
      }
      setShowSpecModal(false);
      loadMetadata();
  };

  const deleteSpec = (id: number) => {
      if(confirm(t('confirm_delete'))) {
          dbService.exec("DELETE FROM specialties WHERE id=?", [id]);
          loadMetadata();
      }
  };

  const handleTitleSave = (e: React.FormEvent) => {
      e.preventDefault();
      if(!titleForm.name) return;
      if(titleForm.id) {
          dbService.exec("UPDATE doctor_titles SET name=? WHERE id=?", [titleForm.name, titleForm.id]);
      } else {
          dbService.exec("INSERT INTO doctor_titles (name) VALUES (?)", [titleForm.name]);
      }
      setShowTitleModal(false);
      loadMetadata();
  };

  const deleteTitle = (id: number) => {
      const inUse = dbService.query("SELECT COUNT(*) as c FROM doctors WHERE title IN (SELECT name FROM doctor_titles WHERE id = ?)", [id])[0].c > 0;
      if (inUse) {
          alert("Cannot delete this title as it is assigned to one or more doctors.");
          return;
      }
      if(confirm(t('confirm_delete'))) {
          dbService.exec("DELETE FROM doctor_titles WHERE id=?", [id]);
          loadMetadata();
      }
  };

  const runSync = async (peer: string) => {
      setIsSyncing(true);
      setSyncLog(prev => [`Connecting to ${peer}...`, ...prev]);
      try {
          const stats = await syncService.syncWithPeer(peer);
          setSyncLog(prev => [`Sync Complete: Added ${stats.added}, Updated ${stats.updated}, Conflicts ${stats.conflicts}`, ...prev]);
      } catch (e) {
          setSyncLog(prev => [`Error syncing with ${peer}`, ...prev]);
      }
      setIsSyncing(false);
  };

  const ROLE_CARDS = [
    { 
        role: UserRole.ADMIN, 
        icon: Shield, 
        colorClass: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-900/20 dark:border-purple-800', 
        badges: ['badge_system', 'badge_admin'], 
        descKey: 'role_desc_admin', 
        permsKey: 'role_perms_admin' 
    },
    { 
        role: UserRole.DOCTOR, 
        icon: Stethoscope, 
        colorClass: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-800', 
        badges: ['badge_clinical', 'badge_admin'], 
        descKey: 'role_desc_doctor', 
        permsKey: 'role_perms_doctor' 
    },
    { 
        role: UserRole.NURSE, 
        icon: Activity, 
        colorClass: 'text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-900/20 dark:border-rose-800', 
        badges: ['badge_clinical'], 
        descKey: 'role_desc_nurse', 
        permsKey: 'role_perms_nurse' 
    },
    { 
        role: UserRole.RECEPTIONIST, 
        icon: Calendar, 
        colorClass: 'text-orange-600 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/20 dark:border-orange-800', 
        badges: ['badge_admin'], 
        descKey: 'role_desc_receptionist', 
        permsKey: 'role_perms_receptionist' 
    },
    { 
        role: UserRole.BILLING, 
        icon: DollarSign, 
        colorClass: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-800', 
        badges: ['badge_financial', 'badge_admin'], 
        descKey: 'role_desc_billing', 
        permsKey: 'role_perms_billing' 
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32" dir={dir}>
        {/* Navigation Tabs */}
        <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 overflow-x-auto pb-1">
            {[
                { id: 'general', icon: SettingsIcon, label: 'settings' },
                { id: 'users', icon: Users, label: 'user_roles' },
                ...(isAdmin ? [
                    { id: 'metadata', icon: Library, label: 'clinical_metadata' }
                ] : []),
                { id: 'shortcuts', icon: Keyboard, label: 'shortcuts' },
                ...(isAdmin ? [{ id: 'data', icon: Database, label: 'backup_restore' }, { id: 'sync', icon: RefreshCcw, label: 'network_sync' }] : [])
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-3 px-4 font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                >
                    <tab.icon size={18} className="rtl:flip-x" /> {t(tab.label as any)}
                </button>
            ))}
        </div>
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
            <div className="animate-fade-in-up space-y-8">
                {/* Language Settings */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2"><Globe size={20}/> {t('language')}</h3>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setLanguage('en')}
                            className={`px-4 py-2 rounded-lg border flex items-center gap-2 font-bold transition-all ${language === 'en' ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white dark:bg-slate-800 dark:text-white border-gray-200 dark:border-slate-700'}`}
                        >
                            <span className="text-lg">🇺🇸</span> English
                        </button>
                        <button 
                            onClick={() => setLanguage('ar')}
                            className={`px-4 py-2 rounded-lg border flex items-center gap-2 font-bold transition-all ${language === 'ar' ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white dark:bg-slate-800 dark:text-white border-gray-200 dark:border-slate-700'}`}
                        >
                            <span className="text-lg">🇪🇬</span> العربية
                        </button>
                    </div>
                </div>

                {/* Theme Selector */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold mb-6 text-gray-800 dark:text-white flex items-center gap-2"><Palette size={20}/> {t('theme')}</h3>
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={() => updatePreview({ mode: settings.mode === 'dark' ? 'light' : 'dark' })} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg flex items-center gap-2 text-sm font-bold dark:text-white border border-transparent hover:border-[var(--color-primary)] transition-all">
                            {settings.mode === 'dark' ? <Moon size={16}/> : <Sun size={16}/>} {settings.mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(OCCASION_THEMES).map(([key, theme]) => (
                            <button key={key} onClick={() => handleThemeSelection(key)} className={`p-4 border rounded-xl text-left transition-all ${settings.decoration === key ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]' : 'border-gray-200 dark:border-slate-700'}`}>
                                <span className="block font-bold text-sm text-gray-800 dark:text-white">{theme.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
            <div className="animate-fade-in-up space-y-8">
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('user_roles')}</h3>
                        <p className="text-sm text-gray-500">{t('user_roles_desc')}</p>
                    </div>
                    <button 
                        onClick={() => {
                            setUserForm({ id: 0, name: '', email: '', password: '', role: UserRole.RECEPTIONIST, relatedId: 0 });
                            setShowUserModal(true);
                        }}
                        className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
                    >
                        <Plus size={18}/> {t('add_user')}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {users.map(u => (
                        <div key={u.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 rtl:left-0 rtl:right-auto p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Shield size={64} />
                            </div>
                            
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xl font-bold text-gray-500 dark:text-gray-300">
                                    {u.name.charAt(0)}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setUserForm({...u, password: ''}); setShowUserModal(true); }} className="p-2 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"><SettingsIcon size={16}/></button>
                                    <button onClick={() => deleteUser(u.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            
                            <div className="relative z-10">
                                <h4 className="font-bold text-gray-800 dark:text-white text-lg">{u.name}</h4>
                                <p className="text-sm text-gray-500 mb-3">{u.email}</p>
                                
                                <div className="flex flex-wrap gap-2">
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border ${
                                        u.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800' :
                                        u.role === UserRole.DOCTOR ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' :
                                        'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                                    }`}>
                                        {t(u.role as any) || u.role}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Role Descriptions */}
                <div className="mt-8 border-t border-gray-100 dark:border-slate-800 pt-8">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('role_responsibilities')}</h3>
                        <p className="text-sm text-gray-500">{t('role_responsibilities_desc')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ROLE_CARDS.map((card) => (
                            <div key={card.role} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 hover:shadow-md transition-all">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-lg ${card.colorClass}`}>
                                        <card.icon size={20} />
                                    </div>
                                    <h4 className="font-bold text-gray-800 dark:text-white capitalize">{t(card.role as any)}</h4>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 min-h-[40px] leading-relaxed">
                                    {t(card.descKey as any)}
                                </p>
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {card.badges.map(b => (
                                        <span key={b} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-700">
                                            {t(b as any)}
                                        </span>
                                    ))}
                                </div>
                                <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Access</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={t(card.permsKey as any)}>{t(card.permsKey as any)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* CLINICAL METADATA TAB */}
        {activeTab === 'metadata' && (
            <div className="animate-fade-in-up space-y-8">
                {/* Doctor Titles Management */}
                <div>
                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('titles')}</h3>
                            <p className="text-sm text-gray-500">{t('clinical_metadata_desc')}</p>
                        </div>
                        <button 
                            onClick={() => { setTitleForm({ name: '' }); setShowTitleModal(true); }}
                            className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
                        >
                            <Plus size={18}/> {t('add_title')}
                        </button>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs font-bold text-gray-500 uppercase border-b border-gray-100 dark:border-slate-800">
                                <tr>
                                    <th className="p-4">{t('title')}</th>
                                    <th className="p-4 text-right">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                {titles.map(title => (
                                    <tr key={title.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                        <td className="p-4 text-sm font-bold text-gray-800 dark:text-white">{title.name}</td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button onClick={() => { setTitleForm(title); setShowTitleModal(true); }} className="p-2 text-gray-400 hover:text-[var(--color-primary)] rounded-lg"><Edit3 size={16}/></button>
                                            <button onClick={() => deleteTitle(title.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Specialties Management */}
                <div>
                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('specialties')}</h3>
                            <p className="text-sm text-gray-500">{t('specialties_desc')}</p>
                        </div>
                        <button 
                            onClick={() => { setSpecForm({ name: '', category: 'Primary Care' }); setShowSpecModal(true); }}
                            className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
                        >
                            <Plus size={18}/> {t('add_specialty')}
                        </button>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs font-bold text-gray-500 uppercase border-b border-gray-100 dark:border-slate-800">
                                <tr>
                                    <th className="p-4">{t('specialty')}</th>
                                    <th className="p-4">{t('category')}</th>
                                    <th className="p-4 text-right">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                {specialties.map(spec => (
                                    <tr key={spec.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                        <td className="p-4 text-sm font-bold text-gray-800 dark:text-white">{spec.name}</td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-400"><span className="bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-xs">{spec.category}</span></td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button onClick={() => { setSpecForm(spec); setShowSpecModal(true); }} className="p-2 text-gray-400 hover:text-[var(--color-primary)] rounded-lg"><Edit3 size={16}/></button>
                                            <button onClick={() => deleteSpec(spec.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* DATA TAB */}
        {activeTab === 'data' && (
            <div className="animate-fade-in-up space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2"><Database size={20}/> {t('backup_restore')}</h3>
                        <p className="text-sm text-gray-500 mb-6">{t('backup_desc')}</p>
                        
                        <div className="flex flex-col gap-3">
                            <button onClick={() => dbService.exportBackup()} className="w-full py-3 bg-[var(--color-primary)] hover:opacity-90 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                <Save size={18} /> {t('export_backup')}
                            </button>
                            <label className="w-full py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer border border-gray-200 dark:border-slate-700">
                                <Upload size={18} /> {t('restore_file')}
                                <input type="file" className="hidden" accept=".sqlite,.db,.enc" onChange={(e) => { if(e.target.files?.[0]) dbService.importBackup(e.target.files[0]); }} />
                            </label>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-red-200 dark:border-red-900/30">
                        <h3 className="text-lg font-bold mb-4 text-red-600 dark:text-red-400 flex items-center gap-2"><Trash2 size={20}/> {t('danger_zone')}</h3>
                        <p className="text-sm text-gray-500 mb-6">Irreversible actions. Please proceed with caution.</p>
                        <button onClick={() => { if(confirm("Are you sure? This will wipe all data.")) dbService.factoryReset(); }} className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold border border-red-100 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/30">
                            {t('factory_reset')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* SHORTCUTS TAB */}
        {activeTab === 'shortcuts' && (
            <div className="animate-fade-in-up space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2"><Keyboard size={20}/> {t('shortcuts')}</h3>
                    <div className="space-y-3">
                        {shortcuts.map(sc => (
                            <div key={sc.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-white">{sc.label}</p>
                                    <p className="text-xs text-gray-500">{sc.description}</p>
                                </div>
                                <div className="flex gap-2">
                                    {sc.keys.map((k, i) => (
                                        <kbd key={i} className="px-2 py-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg font-mono text-xs font-bold text-gray-600 dark:text-gray-300 shadow-sm min-w-[24px] text-center">
                                            {k}
                                        </kbd>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* SYNC TAB */}
        {activeTab === 'sync' && (
            <div className="animate-fade-in-up space-y-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2"><Wifi size={20} className="text-emerald-500"/> {t('network_sync')}</h3>
                            <p className="text-sm text-gray-500 mt-1">{t('sync_desc')}</p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-100 dark:border-emerald-800">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Discovery Active
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">{t('available_peers')}</h4>
                            <div className="space-y-3">
                                {peers.length === 0 ? (
                                    <div className="p-4 border border-dashed rounded-xl text-center text-gray-400 text-sm">{t('scanning')}</div>
                                ) : (
                                    peers.map(peer => (
                                        <div key={peer} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm"><Server size={18} className="text-blue-500"/></div>
                                                <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">{peer}</span>
                                            </div>
                                            <button 
                                                onClick={() => runSync(peer)}
                                                disabled={isSyncing}
                                                className="px-3 py-1.5 bg-gray-900 dark:bg-slate-600 text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50"
                                            >
                                                {isSyncing ? t('syncing') : t('sync_now')}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="bg-black/90 rounded-xl p-4 text-xs font-mono text-green-400 h-64 overflow-y-auto">
                            <p className="opacity-50 mb-2">// Sync Log Output</p>
                            {syncLog.map((log, i) => <div key={i} className="mb-1">{`> ${log}`}</div>)}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Preview Mode Sticky Footer */}
        {(isThemeDirty || isLangDirty) && (
            createPortal(
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up w-[90%] max-w-lg">
                    <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-6 border border-slate-700">
                        <div>
                            <p className="font-bold text-sm">{t('unsaved_changes')}</p>
                            <p className="text-xs text-slate-400">{t('preview_mode_active')}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleRevertChanges} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                                <RotateCcw size={14}/> {t('revert')}
                            </button>
                            <button onClick={handleApplyChanges} className="px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 transition-all">
                                <CheckCircle size={14}/> {t('apply_changes')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )
        )}

        {/* User Modal */}
        {showUserModal && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{userForm.id ? t('edit_user') : t('add_user')}</h3>
                        <button onClick={() => setShowUserModal(false)}><X size={20} className="text-gray-400"/></button>
                    </div>
                    <form onSubmit={handleUserSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('full_name')}</label>
                            <input required className="w-full border p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('email')}</label>
                            <input required type="email" className="w-full border p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-3 text-gray-400 rtl:right-3 rtl:left-auto"/>
                                <input 
                                    type="password" 
                                    className="w-full border p-2.5 pl-10 rtl:pr-10 rtl:pl-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    value={userForm.password} 
                                    onChange={e => setUserForm({...userForm, password: e.target.value})} 
                                    placeholder={userForm.id ? "Leave blank to keep current" : "Required"}
                                    required={!userForm.id}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                            <select className="w-full border p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}>
                                {Object.values(UserRole).map(r => <option key={r} value={r}>{t(r as any)}</option>)}
                            </select>
                        </div>
                        {userForm.role === UserRole.DOCTOR && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                                <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">{t('link_doctor_profile')}</label>
                                <select 
                                    className="w-full border border-blue-200 dark:border-blue-800 p-2.5 rounded-lg bg-white dark:bg-slate-900 dark:text-white" 
                                    value={userForm.relatedId} 
                                    onChange={e => setUserForm({...userForm, relatedId: Number(e.target.value)})}
                                >
                                    <option value={0}>-- Select Doctor --</option>
                                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>)}
                                </select>
                                <p className="text-[10px] text-blue-500 mt-1">{t('link_doctor_desc')}</p>
                            </div>
                        )}
                        <div className="pt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">{t('cancel')}</button>
                            <button className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold shadow-lg">{t('save')}</button>
                        </div>
                    </form>
                </div>
            </div>,
            document.body
        )}

        {/* Specialty Modal */}
        {showSpecModal && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white dark:bg-slate-900 w-full max-w-sm p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{specForm.id ? t('edit') : t('add_specialty')}</h3>
                        <button onClick={() => setShowSpecModal(false)}><X size={20} className="text-gray-400"/></button>
                    </div>
                    <form onSubmit={handleSpecSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('specialty')}</label>
                            <input required className="w-full border p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={specForm.name} onChange={e => setSpecForm({...specForm, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('category')}</label>
                            <select className="w-full border p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={specForm.category} onChange={e => setSpecForm({...specForm, category: e.target.value})}>
                                <option>Primary Care</option>
                                <option>Internal Specialists</option>
                                <option>Surgical</option>
                                <option>Women's Health</option>
                                <option>Head & Neck</option>
                                <option>Diagnostic & Critical</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="pt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowSpecModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">{t('cancel')}</button>
                            <button className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold shadow-lg">{t('save')}</button>
                        </div>
                    </form>
                </div>
            </div>,
            document.body
        )}

        {/* Title Modal */}
        {showTitleModal && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white dark:bg-slate-900 w-full max-w-sm p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{titleForm.id ? t('edit') : t('add_title')}</h3>
                        <button onClick={() => setShowTitleModal(false)}><X size={20} className="text-gray-400"/></button>
                    </div>
                    <form onSubmit={handleTitleSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('title')}</label>
                            <input required className="w-full border p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={titleForm.name} onChange={e => setTitleForm({...titleForm, name: e.target.value})} />
                        </div>
                        <div className="pt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowTitleModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">{t('cancel')}</button>
                            <button className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold shadow-lg">{t('save')}</button>
                        </div>
                    </form>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};

export default Settings;
