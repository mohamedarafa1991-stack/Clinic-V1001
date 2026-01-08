
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { dbService } from '../services/db';
import { AppointmentStatus, UserRole } from '../types';
import { 
  Users, CheckCircle, Activity, DollarSign, Clock, Stethoscope, 
  TrendingUp, Plus, Calendar, User, Megaphone, CheckSquare,
  UserPlus, Zap
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const Dashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { resolvedColors } = useTheme(); // Consuming resolved theme colors from Context
  const navigate = useNavigate();
  
  // State
  const [stats, setStats] = useState({ waiting: 0, completed: 0, revenue: 0, activeClinics: 0 });
  const [queues, setQueues] = useState<any[]>([]);
  const [activePatient, setActivePatient] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  const isDoctor = user?.role === UserRole.DOCTOR;

  const refreshData = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    let doctorFilter = '';
    if (isDoctor && user?.relatedId) {
        doctorFilter = `AND doctorId = ${user.relatedId}`;
    }

    try {
        const qWait = `SELECT COUNT(*) as count FROM appointments WHERE date = '${today}' AND status = '${AppointmentStatus.CHECKED_IN}' ${doctorFilter}`;
        const qComp = `SELECT COUNT(*) as count FROM appointments WHERE date = '${today}' AND status = '${AppointmentStatus.COMPLETED}' ${doctorFilter}`;
        const qRev = `SELECT SUM(amountPaid) as total FROM appointments WHERE date = '${today}' ${doctorFilter}`;
        const qClinics = isDoctor 
            ? `SELECT COUNT(*) as count FROM appointments WHERE date = '${today}' AND status = '${AppointmentStatus.IN_PROGRESS}' ${doctorFilter}`
            : `SELECT COUNT(DISTINCT doctorId) as count FROM appointments WHERE date = '${today}' AND status IN ('${AppointmentStatus.CHECKED_IN}', '${AppointmentStatus.IN_PROGRESS}')`;

        setStats({
            waiting: dbService.query(qWait)[0]?.count || 0,
            completed: dbService.query(qComp)[0]?.count || 0,
            revenue: dbService.query(qRev)[0]?.total || 0,
            activeClinics: dbService.query(qClinics)[0]?.count || 0
        });
    } catch (e) {
        console.error("Stats Error", e);
    }

    let docQuery = "SELECT * FROM doctors";
    if (isDoctor && user?.relatedId) {
        docQuery += ` WHERE id = ${user.relatedId}`;
    }
    const doctors = dbService.query(docQuery);

    const queueData = doctors.map((doc: any) => {
      const q = dbService.query(`
        SELECT a.*, p.name as patientName, p.gender as patientGender 
        FROM appointments a 
        JOIN patients p ON a.patientId = p.id
        WHERE a.doctorId = ${doc.id} AND a.date = '${today}' AND a.status = '${AppointmentStatus.CHECKED_IN}'
        ORDER BY a.queueNumber ASC
      `);
      return { doctor: doc, patients: q };
    });
    setQueues(queueData);

    const activeQ = `
        SELECT a.*, p.name as patientName, p.dob as patientDob, d.name as doctorName
        FROM appointments a
        JOIN patients p ON a.patientId = p.id
        JOIN doctors d ON a.doctorId = d.id
        WHERE a.date = '${today}' AND a.status = '${AppointmentStatus.IN_PROGRESS}' ${doctorFilter}
        ORDER BY a.queueNumber ASC LIMIT 1
    `;
    const active = dbService.query(activeQ);
    setActivePatient(active[0] || null);

    const trafficData = [
        { name: '9AM', count: 0 }, { name: '11AM', count: 0 }, 
        { name: '1PM', count: 0 }, { name: '3PM', count: 0 }, { name: '5PM', count: 0 }
    ];
    setChartData(trafficData.map(d => ({ ...d, count: Math.floor(Math.random() * 8) + 2 })));

  }, [user, isDoctor]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleCallPatient = (id: number) => {
    if (activePatient && isDoctor && !confirm("Finish current visit first?")) return;
    dbService.exec("UPDATE appointments SET status = ? WHERE id = ?", [AppointmentStatus.IN_PROGRESS, id]);
    refreshData();
  };

  const handleFinishVisit = (id: number) => {
    dbService.exec("UPDATE appointments SET status = ? WHERE id = ?", [AppointmentStatus.COMPLETED, id]);
    refreshData();
  };

  const StatCard = ({ title, value, icon: Icon, colorClass, subText }: any) => (
      <div className="bg-surface p-1 rounded-2xl shadow-sm border border-borderSubtle hover:shadow-md transition-all group relative overflow-hidden">
           <div className={`absolute top-0 ltr:left-0 rtl:right-0 w-1 h-full ${colorClass.border}`}></div>
           <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${colorClass.bg} ${colorClass.text}`}>
                      <Icon size={24} />
                  </div>
                  {subText && (
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${colorClass.bg} ${colorClass.text}`}>
                          {subText}
                      </span>
                  )}
              </div>
              <div>
                  <h3 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{value}</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t(title)}</p>
              </div>
           </div>
      </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
            {t('welcome')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            {new Date().toLocaleDateString()}
            <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
            {t('overview')}
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-surface p-1.5 rounded-xl border border-borderSubtle shadow-sm transition-colors">
            <button onClick={() => navigate('/appointments')} className="flex flex-col items-center justify-center w-16 h-14 gap-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors group">
                <Calendar size={18} className="text-slate-500 group-hover:text-[var(--color-primary)]" />
                <span className="text-[10px] font-bold text-slate-500">{t('schedule')}</span>
            </button>
            <div className="w-px h-8 bg-slate-100 dark:bg-slate-700"></div>
            <button onClick={() => navigate('/patients')} className="flex flex-col items-center justify-center w-16 h-14 gap-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors group">
                <UserPlus size={18} className="text-slate-500 group-hover:text-[var(--color-primary)]" />
                <span className="text-[10px] font-bold text-slate-500">{t('new_patient')}</span>
            </button>
            <div className="w-px h-8 bg-slate-100 dark:bg-slate-700"></div>
            <button onClick={() => navigate('/appointments')} className="flex items-center gap-2 px-4 h-12 bg-[var(--color-primary)] hover:opacity-90 text-white rounded-lg text-sm font-bold shadow-lg shadow-[var(--color-primary)]/20 transition-all active:scale-95 ms-1">
                <Plus size={18} /> {t('new_booking')}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up">
        <StatCard title="waiting_room" value={stats.waiting} icon={Clock} colorClass={{ bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'bg-orange-500' }} subText="Live" />
        <StatCard title="completed_visits" value={stats.completed} icon={CheckCircle} colorClass={{ bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'bg-emerald-500' }} />
        <StatCard title="total_revenue" value={`EGP ${stats.revenue.toLocaleString()}`} icon={DollarSign} colorClass={{ bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'bg-blue-500' }} />
        <StatCard title="active_doctors" value={stats.activeClinics} icon={Stethoscope} colorClass={{ bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'bg-purple-500' }} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
            {activePatient ? (
                <div className="bg-surface rounded-3xl p-1 shadow-md border border-borderSubtle animate-fade-in-up transition-colors ring-4 ring-[var(--color-primary)]/5">
                    <div className="bg-slate-900 dark:bg-slate-800 rounded-[22px] p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--color-primary)] opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 animate-pulse-slow"></div>
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-[var(--color-secondary)] opacity-10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3"></div>
                        
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
                            <div>
                                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-4 text-white shadow-sm">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-secondary)] opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-secondary)]"></span>
                                    </span>
                                    {t('in_consultation')}
                                </div>
                                <h2 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight">#{activePatient.queueNumber}</h2>
                                <p className="text-xl md:text-2xl font-medium text-slate-300">{activePatient.patientName}</p>
                                
                                <div className="flex flex-wrap gap-4 mt-6 text-sm text-slate-400">
                                    <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5"><User size={14} /> Dr. {activePatient.doctorName}</span>
                                    <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5"><Clock size={14} /> {new Date().toLocaleTimeString()}</span>
                                </div>
                            </div>
                            
                            <div className="mt-8 md:mt-0 flex flex-col gap-3 min-w-[180px]">
                                <button onClick={() => handleFinishVisit(activePatient.id)} className="bg-white text-slate-900 px-6 py-4 rounded-xl font-bold hover:bg-[var(--color-secondary)] hover:text-white hover:shadow-xl hover:shadow-[var(--color-secondary)]/20 transition-all flex items-center justify-center gap-2 group shadow-lg">
                                    <CheckSquare size={20} className="group-hover:scale-110 transition-transform" /> {t('finish_visit')}
                                </button>
                                <button onClick={() => navigate('/patients')} className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-sm border border-white/10">
                                    <Stethoscope size={16} /> {t('clinical_history')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center transition-colors">
                    <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300 dark:text-slate-500">
                        <Stethoscope size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">{t('room_empty')}</h3>
                    <p className="text-slate-500 dark:text-slate-500 text-sm">Waiting for patients.</p>
                </div>
            )}

            <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Users size={20} className="text-[var(--color-primary)]"/> {t('live_queues')}
                </h3>
                {queues.length === 0 ? (
                    <div className="text-center py-10 bg-surface rounded-2xl border border-borderSubtle"><p className="text-slate-400">No active queues found.</p></div>
                ) : (
                    <div className={`grid grid-cols-1 ${!isDoctor ? 'md:grid-cols-2' : ''} gap-6`}>
                        {queues.map((q, idx) => (
                        <div key={idx} className="bg-surface rounded-2xl shadow-sm border border-borderSubtle flex flex-col h-[400px] transition-colors overflow-hidden">
                            <div className="p-5 border-b border-borderSubtle flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 text-[var(--color-primary)] flex items-center justify-center font-bold text-lg shadow-sm border border-borderSubtle">{q.doctor.name.charAt(0)}</div>
                                    <div><h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{q.doctor.name}</h4><p className="text-xs text-slate-400 font-medium">{q.doctor.specialty}</p></div>
                                </div>
                                <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2.5 py-1 rounded-lg text-xs font-bold border border-[var(--color-primary)]/20">{q.patients.length} Waiting</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                {q.patients.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-600"><Clock size={32} className="mb-2 opacity-50" /><p className="text-sm font-medium">All caught up!</p></div>
                                ) : (
                                    q.patients.map((p: any, i: number) => (
                                        <div key={p.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-[var(--color-primary)] dark:hover:border-[var(--color-primary)] hover:shadow-md transition-all group relative overflow-hidden">
                                            {i === 0 && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-primary)]"></div>}
                                            <div className="flex items-center gap-4 ps-2">
                                                <div className="text-center w-10">
                                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">No.</span>
                                                    <span className={`block text-xl font-bold ${i === 0 ? 'text-[var(--color-primary)]' : 'text-slate-800 dark:text-white'}`}>#{p.queueNumber}</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">{p.patientName}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] px-1.5 rounded border ${p.patientGender === 'Female' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900' : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:border-blue-900'}`}>{p.patientGender}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => handleCallPatient(p.id)} className={`px-3 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 active:scale-95 ${i === 0 ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20 hover:opacity-90' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-[var(--color-primary)] hover:text-white hover:shadow-md'}`}>
                                                <Megaphone size={14} /> {t('call_patient')}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        <div className="space-y-8">
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-borderSubtle transition-colors h-[300px] flex flex-col">
                <h4 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <TrendingUp size={18} className="text-[var(--color-primary)]"/> {t('traffic_trends')}
                </h4>
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={resolvedColors.primary} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={resolvedColors.primary} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.1} />
                            <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#fff' }} cursor={{ stroke: resolvedColors.primary, strokeWidth: 1 }}/>
                            <Area type="monotone" dataKey="count" stroke={resolvedColors.primary} strokeWidth={3} fillOpacity={1} fill="url(#colorTraffic)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-black dark:to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg border border-slate-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)] opacity-10 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                    <h4 className="font-bold mb-3 flex items-center gap-2"><Activity size={16} className="text-emerald-400"/> {t('system_status')}</h4>
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-xs text-slate-300 border-b border-white/10 pb-2"><span>Database</span><span className="text-emerald-400 font-bold flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> Online</span></div>
                        <div className="flex justify-between text-xs text-slate-300 border-b border-white/10 pb-2"><span>Sync Status</span><span className="text-emerald-400 font-bold">Local</span></div>
                        <div className="flex justify-between text-xs text-slate-300 pb-2"><span>Backup</span><span className="text-orange-400 font-bold">Recommended</span></div>
                    </div>
                    {user?.role === UserRole.ADMIN && (
                        <button onClick={() => navigate('/settings')} className="w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors border border-white/10 flex items-center justify-center gap-2">
                            <Zap size={14} /> Run Backup Now
                        </button>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
