
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import { Nurse } from '../types';
import { Plus, Edit3, Trash2, Syringe, Mail, Phone, X, Save, DollarSign } from 'lucide-react';
import { createPortal } from 'react-dom';

const Nurses = () => {
  const { t, dir } = useLanguage();
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [nurseForm, setNurseForm] = useState<Partial<Nurse>>({ name: '', phone: '', email: '', status: 'Active', commissionRate: 0 });

  useEffect(() => {
    loadNurses();
  }, []);

  const loadNurses = () => {
    setNurses(dbService.query("SELECT * FROM nurses ORDER BY name"));
  };

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      if(!nurseForm.name) return;
      if (nurseForm.id) {
          dbService.exec("UPDATE nurses SET name=?, phone=?, email=?, status=?, commissionRate=? WHERE id=?", [nurseForm.name, nurseForm.phone, nurseForm.email, nurseForm.status, nurseForm.commissionRate, nurseForm.id]);
      } else {
          dbService.exec("INSERT INTO nurses (name, phone, email, status, commissionRate) VALUES (?, ?, ?, ?, ?)", [nurseForm.name, nurseForm.phone, nurseForm.email, nurseForm.status, nurseForm.commissionRate || 0]);
      }
      setShowModal(false);
      loadNurses();
  };

  const handleDelete = (id: number) => {
      if(confirm(t('confirm_delete'))) {
          dbService.exec("DELETE FROM nurses WHERE id=?", [id]);
          loadNurses();
      }
  };

  return (
    <div className="pb-20 space-y-8" dir={dir}>
        <div className="flex justify-between items-end">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{t('nurses')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Staff Management</p>
            </div>
            <button onClick={() => { setNurseForm({ name: '', phone: '', email: '', status: 'Active', commissionRate: 0 }); setShowModal(true); }} className="bg-[var(--color-primary)] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 shadow-lg font-bold">
                <Plus size={18} /> {t('add_nurse')}
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nurses.map(nurse => (
                <div key={nurse.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:border-[var(--color-primary)] transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 flex items-center justify-center">
                            <Syringe size={20} />
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setNurseForm(nurse); setShowModal(true); }} className="p-2 text-gray-400 hover:text-[var(--color-primary)] hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg"><Edit3 size={16}/></button>
                            <button onClick={() => handleDelete(nurse.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{nurse.name}</h3>
                    <div className="flex gap-2 mb-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${nurse.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{nurse.status}</span>
                        {nurse.commissionRate ? <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">{nurse.commissionRate}% Comm.</span> : null}
                    </div>
                    
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Phone size={14} /> {nurse.phone}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Mail size={14} /> {nurse.email}
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Modal */}
        {showModal && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{nurseForm.id ? t('edit_profile') : t('add_nurse')}</h3>
                        <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400"/></button>
                    </div>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('full_name')}</label>
                            <input required className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={nurseForm.name} onChange={e => setNurseForm({...nurseForm, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('phone')}</label>
                            <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={nurseForm.phone} onChange={e => setNurseForm({...nurseForm, phone: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('email')}</label>
                            <input className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={nurseForm.email} onChange={e => setNurseForm({...nurseForm, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">Commission % <DollarSign size={12}/></label>
                            <input type="number" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={nurseForm.commissionRate} onChange={e => setNurseForm({...nurseForm, commissionRate: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('status')}</label>
                            <select className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={nurseForm.status} onChange={e => setNurseForm({...nurseForm, status: e.target.value as any})}>
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>
                        <div className="pt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-bold">{t('cancel')}</button>
                            <button className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold shadow-lg hover:opacity-90">{t('save')}</button>
                        </div>
                    </form>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};

export default Nurses;
