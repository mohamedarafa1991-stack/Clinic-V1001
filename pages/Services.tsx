
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import { Service, VisitType } from '../types';
import { Plus, Edit3, Trash2, Tag, Briefcase, X, Save } from 'lucide-react';
import { createPortal } from 'react-dom';

const Services = () => {
  const { t, dir } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [visitTypes, setVisitTypes] = useState<VisitType[]>([]);
  
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState<Partial<Service>>({ name: '', category: 'Procedure', basePrice: 0, isActive: 1, assignableTo: 'Both' });
  
  const [editingVisitType, setEditingVisitType] = useState<VisitType | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setServices(dbService.query("SELECT * FROM services ORDER BY name"));
    setVisitTypes(dbService.query("SELECT * FROM visit_types"));
  };

  const handleServiceSave = (e: React.FormEvent) => {
      e.preventDefault();
      if(!serviceForm.name) return;
      if (serviceForm.id) {
          dbService.exec("UPDATE services SET name=?, category=?, basePrice=?, assignableTo=? WHERE id=?", [serviceForm.name, serviceForm.category, serviceForm.basePrice, serviceForm.assignableTo, serviceForm.id]);
      } else {
          dbService.exec("INSERT INTO services (name, category, basePrice, isActive, assignableTo) VALUES (?, ?, ?, 1, ?)", [serviceForm.name, serviceForm.category, serviceForm.basePrice, serviceForm.assignableTo]);
      }
      setShowServiceModal(false);
      loadData();
  };

  const deleteService = (id: number) => {
      if(confirm(t('confirm_delete'))) {
          dbService.exec("UPDATE services SET isActive = 0 WHERE id=?", [id]);
          loadData();
      }
  };

  const updateVisitType = (v: VisitType) => {
      dbService.exec("UPDATE visit_types SET defaultFee=? WHERE id=?", [v.defaultFee, v.id]);
      setEditingVisitType(null);
      loadData();
  };

  return (
    <div className="pb-20 space-y-8" dir={dir}>
        <div className="flex justify-between items-end">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{t('services')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('services_desc')}</p>
            </div>
        </div>

        {/* Visit Types Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Briefcase size={20} className="text-[var(--color-primary)]"/> {t('visit_type')} & Fees</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {visitTypes.map(vt => (
                    <div key={vt.id} className="p-4 border border-gray-100 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center group hover:border-[var(--color-primary)] transition-colors">
                        <div>
                            <h4 className="font-bold text-gray-800 dark:text-white">{vt.name}</h4>
                            <p className="text-xs text-gray-500">{vt.isFollowUp ? 'Follow-up' : 'Primary'} • {vt.defaultFee} EGP</p>
                        </div>
                        <button onClick={() => setEditingVisitType(vt)} className="p-2 text-gray-400 hover:text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 size={16}/></button>
                    </div>
                ))}
            </div>
        </div>

        {/* Service Catalog */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2"><Tag size={20} className="text-[var(--color-primary)]"/> {t('pricing_services')}</h3>
                <button onClick={() => { setServiceForm({ name: '', category: 'Procedure', basePrice: 0, assignableTo: 'Both' }); setShowServiceModal(true); }} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-lg hover:opacity-90">
                    <Plus size={16}/> {t('add_service')}
                </button>
            </div>
            <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-slate-800/50 text-xs font-bold text-gray-500 uppercase border-b border-gray-100 dark:border-slate-800">
                    <tr>
                        <th className="p-4">{t('service_name')}</th>
                        <th className="p-4">{t('category')}</th>
                        <th className="p-4">{t('assignable_to')}</th>
                        <th className="p-4 text-right">{t('base_price')}</th>
                        <th className="p-4 text-right">{t('actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {services.filter(s => s.isActive).map(svc => (
                        <tr key={svc.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                            <td className="p-4 text-sm font-bold text-gray-800 dark:text-white">{svc.name}</td>
                            <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${svc.category === 'Procedure' ? 'bg-blue-100 text-blue-700' : svc.category === 'Diagnostic' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{svc.category}</span></td>
                            <td className="p-4 text-xs font-bold text-gray-500">{t(svc.assignableTo?.toLowerCase() as any)}</td>
                            <td className="p-4 text-right font-mono text-sm text-gray-700 dark:text-gray-300">{svc.basePrice} EGP</td>
                            <td className="p-4 text-right flex justify-end gap-2">
                                <button onClick={() => { setServiceForm(svc); setShowServiceModal(true); }} className="p-2 text-gray-400 hover:text-[var(--color-primary)] rounded-lg"><Edit3 size={16}/></button>
                                <button onClick={() => deleteService(svc.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Service Modal */}
        {showServiceModal && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{serviceForm.id ? t('edit') : t('add_service')}</h3>
                        <button onClick={() => setShowServiceModal(false)}><X size={20} className="text-gray-400"/></button>
                    </div>
                    <form onSubmit={handleServiceSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('service_name')}</label>
                            <input required className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('category')}</label>
                                <select className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={serviceForm.category} onChange={e => setServiceForm({...serviceForm, category: e.target.value as any})}>
                                    <option value="Procedure">Procedure</option>
                                    <option value="Diagnostic">Diagnostic</option>
                                    <option value="Nursing">Nursing</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('assignable_to')}</label>
                                <select className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={serviceForm.assignableTo || 'Both'} onChange={e => setServiceForm({...serviceForm, assignableTo: e.target.value as any})}>
                                    <option value="Both">Both</option>
                                    <option value="Doctor">Doctor Only</option>
                                    <option value="Nurse">Nurse Only</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('base_price')}</label>
                            <input required type="number" className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-mono" value={serviceForm.basePrice} onChange={e => setServiceForm({...serviceForm, basePrice: Number(e.target.value)})} />
                        </div>
                        <div className="pt-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowServiceModal(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-bold">{t('cancel')}</button>
                            <button className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold shadow-lg hover:opacity-90">{t('save')}</button>
                        </div>
                    </form>
                </div>
            </div>,
            document.body
        )}

        {/* Visit Type Modal */}
        {editingVisitType && createPortal(
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <div className="bg-white dark:bg-slate-900 w-full max-w-sm p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{editingVisitType.name}</h3>
                        <button onClick={() => setEditingVisitType(null)}><X size={20} className="text-gray-400"/></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('visit_fee')}</label>
                            <input 
                                type="number" 
                                className="w-full border p-3 rounded-xl bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white font-mono font-bold" 
                                value={editingVisitType.defaultFee} 
                                onChange={e => setEditingVisitType({...editingVisitType, defaultFee: Number(e.target.value)})} 
                            />
                        </div>
                        <div className="pt-4 flex justify-end gap-2">
                            <button onClick={() => setEditingVisitType(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-bold">{t('cancel')}</button>
                            <button onClick={() => updateVisitType(editingVisitType)} className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold shadow-lg hover:opacity-90">{t('save')}</button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};

export default Services;
