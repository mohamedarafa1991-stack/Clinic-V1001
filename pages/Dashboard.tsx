
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/db';
import { AppointmentStatus, UserRole } from '../types';
import { 
  Users, CheckCircle, Activity, DollarSign, Clock, Play, Stethoscope, 
  TrendingUp, Plus, Calendar, ArrowUpRight, User, BookOpen
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ waiting: 0, completed: 0, revenue: 0, activeClinics: 0, totalDrugs: 0 });
  const [queues, setQueues] = useState<any[]>([]);
  const [activePatient, setActivePatient] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [formularyData, setFormularyData] = useState<any[]>([]);

  const isDoctor = user?.role === UserRole.DOCTOR;

  const refreshData = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    let doctorFilter = '';
    
    if (isDoctor && user.relatedId) {
        doctorFilter = `AND doctorId = ${user.relatedId}`;
    }

    // 1. Core Stats
    const qWait = `SELECT COUNT(*) as count FROM appointments WHERE date = '${today}' AND status = '${AppointmentStatus.CHECKED_IN}' ${doctorFilter}`;
    const qComp = `SELECT COUNT(*) as count FROM appointments WHERE date = '${today}' AND status = '${AppointmentStatus.COMPLETED}' ${doctorFilter}`;
    const qRev = `SELECT SUM(amountPaid) as total FROM appointments WHERE date = '${today}' ${doctorFilter}`;
    const qClinics = `SELECT COUNT(DISTINCT doctorId) as count FROM appointments WHERE date = '${today}' AND status IN ('${AppointmentStatus.CHECKED_IN}', '${AppointmentStatus.IN_PROGRESS}')`;
    const qDrugs = `SELECT COUNT(*) as count FROM medicines`;

    setStats({
      waiting: dbService.query(qWait)[0]?.count || 0,
      completed: dbService.query(qComp)[0]?.count || 0,
      revenue: dbService.query(qRev)[0]?.total || 0,
      activeClinics: dbService.query(qClinics)[0]?.count || 0,
      totalDrugs: dbService.query(qDrugs)[0]?.count || 0
    });

    // 2. Queues
    let docQuery = "SELECT * FROM doctors";
    if (isDoctor && user.relatedId) {
        docQuery += ` WHERE id = ${user.relatedId}`;
    }
    const doctors = dbService.query(docQuery);

    const queueData = doctors.map((doc: any) => {
      const q = dbService.query(`
        SELECT a.*, p.name as patientName 
        FROM appointments a 
        JOIN patients p ON a.patientId = p.id
        WHERE a.doctorId = ${doc.id} AND a.date = '${today}' AND a.status = '${AppointmentStatus.CHECKED_IN}'
        ORDER BY a.queueNumber ASC
      `);
      return { doctor: doc, patients: q };
    });
    setQueues(queueData);

    // 3. Active Patient
    const activeQ = `
        SELECT a.*, p.name as patientName, d.name as doctorName
        FROM appointments a
        JOIN patients p ON a.patientId = p.id
        JOIN doctors d ON a.doctorId = d.id
        WHERE a.date = '${today}' AND a.status = '${AppointmentStatus.IN_PROGRESS}' ${doctorFilter}
        ORDER BY a.queueNumber ASC LIMIT 1
    `;
    const active = dbService.query(activeQ);
    setActivePatient(active[0] || null);

    // 4. Traffic Chart Data
    const allToday = dbService.query(`SELECT queueNumber, status FROM appointments WHERE date = '${today}' ${doctorFilter}`);
    const bins = [
        { name: 'Morning', count: 0 },
        { name: 'Afternoon', count: 0 },
        { name: 'Evening', count: 0 },
    ];
    const totalToday = allToday.length;
    if (totalToday > 0) {
        bins[0].count = Math.floor(totalToday * 0.4);
        bins[1].count = Math.floor(totalToday * 0.4);
        bins[2].count = totalToday - bins[0].count - bins[1].count;
    }
    setChartData(bins);

    // 5. Formulary Data (Categories)
    const catCounts = dbService.query(`SELECT category, COUNT(*) as count FROM medicines GROUP BY category ORDER BY count DESC LIMIT 6`);
    const formattedCats = catCounts.map((c: any) => ({ name: c.category || 'Uncategorized', value: c.count }));
    setFormularyData(formattedCats);

  }, [user, isDoctor]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 30000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const updateStatus = (id: number, status: string) => {
    dbService.exec("UPDATE appointments SET status = ? WHERE id = ?", [status, id]);
    refreshData();
  };

  const FORMULARY_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#64748b'];

  return (
    <div className="space-y-6 pb-20">
      {/* ... (Header Section) ... */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
            {isDoctor ? 'My Medical Dashboard' : 'Clinic Operations Center'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
            Real-time Overview
          </p>
        </div>
        
        {/* Quick Actions Toolbar */}
        <div className="flex items-center gap-3 bg-surface p-2 rounded-xl border border-borderSubtle shadow-sm transition-colors">
            <button onClick={() => navigate('/appointments')} className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition-colors">
                <Calendar size={16} /> Appointments
            </button>
            <button onClick={() => navigate('/patients')} className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition-colors">
                <Users size={16} /> Patients
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <button onClick={() => navigate('/appointments')} className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 text-white rounded-lg text-sm font-bold shadow-lg shadow-[var(--color-primary)]/20 transition-all active:scale-95">
                <Plus size={16} /> New Booking
            </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isDoctor ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
        {/* Waiting */}
        <div className="bg-surface p-1 rounded-2xl shadow-sm border border-borderSubtle hover:shadow-md transition-all group relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
           <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl group-hover:scale-110 transition-transform"><Clock size={24} /></div>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full">LIVE</span>
              </div>
              <div>
                  <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.waiting}</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{isDoctor ? 'Patients in Queue' : 'Total Waiting'}</p>
              </div>
           </div>
        </div>
        
        {/* Completed */}
        <div className="bg-surface p-1 rounded-2xl shadow-sm border border-borderSubtle hover:shadow-md transition-all group relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
           <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform"><CheckCircle size={24} /></div>
              </div>
              <div>
                  <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.completed}</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Visits Completed</p>
              </div>
           </div>
        </div>

        {/* Active Clinics / Doctors */}
        {!isDoctor && (
           <div className="bg-surface p-1 rounded-2xl shadow-sm border border-borderSubtle hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <div className="p-5">
                 <div className="flex justify-between items-start mb-4">
                     <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform"><Activity size={24} /></div>
                 </div>
                 <div>
                     <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{stats.activeClinics}</h3>
                     <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Doctors</p>
                 </div>
              </div>
           </div>
        )}

        {/* Revenue */}
        <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] p-1 rounded-2xl shadow-lg shadow-[var(--color-primary)]/20 text-white group relative overflow-hidden">
           <div className="absolute -right-6 -top-6 bg-white/10 w-32 h-32 rounded-full blur-2xl"></div>
           <div className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md"><DollarSign size={24} className="text-white" /></div>
                  <ArrowUpRight className="opacity-75" />
              </div>
              <div>
                  <h3 className="text-3xl font-bold">EGP {stats.revenue}</h3>
                  <p className="text-sm font-medium opacity-90">{isDoctor ? 'My Production' : 'Total Revenue'}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column */}
        <div className="xl:col-span-2 space-y-8">
            {/* Active Patient Hero */}
            {activePatient ? (
                <div className="bg-surface rounded-3xl p-1 shadow-sm border border-borderSubtle animate-fade-in-up transition-colors">
                    <div className="bg-slate-900 dark:bg-slate-800 rounded-[22px] p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)] opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
                            <div>
                                <div className="inline-flex items-center gap-2 bg-[var(--color-primary)] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-4">
                                    <Activity size={12} className="animate-pulse" /> In Progress
                                </div>
                                <h2 className="text-4xl md:text-5xl font-bold mb-2">Queue #{activePatient.queueNumber}</h2>
                                <p className="text-xl md:text-2xl font-medium text-slate-300">{activePatient.patientName}</p>
                                <div className="flex gap-4 mt-4 text-sm text-slate-400">
                                    <span className="flex items-center gap-1"><User size={14} /> Dr. {activePatient.doctorName}</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> Checked in {activePatient.time.split(' - ')[0]}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => updateStatus(activePatient.id, AppointmentStatus.COMPLETED)}
                                className="mt-8 md:mt-0 bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-emerald-400 hover:text-emerald-950 hover:shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2 group"
                            >
                                <CheckCircle size={20} /> Complete Visit
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-borderSubtle rounded-3xl p-12 text-center transition-colors">
                    <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300 dark:text-slate-600">
                        <Stethoscope size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Active Visits</h3>
                    <p className="text-slate-500 dark:text-slate-500">Waiting for patients to be called in.</p>
                </div>
            )}

            {/* Live Queues */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Users size={20} className="text-[var(--color-primary)]"/> Live Queues
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {queues.map((q, idx) => (
                    <div key={idx} className="bg-surface rounded-2xl shadow-sm border border-borderSubtle flex flex-col h-[350px] transition-colors">
                        <div className="p-5 border-b border-borderSubtle flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-100 dark:border-indigo-800">
                                    {q.doctor.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{q.doctor.name}</h4>
                                    <p className="text-xs text-slate-400 font-medium">{q.doctor.specialty}</p>
                                </div>
                            </div>
                            <span className="bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-lg text-xs font-bold border border-orange-100 dark:border-orange-800">
                                {q.patients.length}
                            </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {q.patients.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-600">
                                    <p className="text-sm font-medium">Queue Empty</p>
                                </div>
                            ) : (
                                q.patients.map((p: any) => (
                                    <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-600 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl font-bold text-slate-400 dark:text-slate-500 group-hover:text-[var(--color-primary)] transition-colors w-8">#{p.queueNumber}</span>
                                            <div>
                                                <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{p.patientName}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">Waiting...</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => updateStatus(p.id, AppointmentStatus.IN_PROGRESS)}
                                            className="p-2 bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-400 rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-all shadow-sm"
                                            title="Call Patient"
                                        >
                                            <Play size={16} fill="currentColor" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
            
            {/* Traffic Chart */}
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-borderSubtle transition-colors h-[300px] flex flex-col">
                <h4 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <TrendingUp size={18} className="text-[var(--color-primary)]"/> Clinic Traffic
                </h4>
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                            <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#fff' }} 
                                cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1 }}
                            />
                            <Area type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorTraffic)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Formulary / Catalog Insights */}
            <div className="bg-surface p-6 rounded-2xl shadow-sm border border-borderSubtle transition-colors h-[300px] flex flex-col">
                <h4 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <BookOpen size={18} className="text-[var(--color-primary)]"/> Catalog Distribution
                </h4>
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={formularyData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} fontSize={10} tick={{fill: '#94a3b8'}} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }} cursor={{fill: 'transparent'}} />
                            <Bar dataKey="value" barSize={15} radius={[0, 4, 4, 0]}>
                                {formularyData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={FORMULARY_COLORS[index % FORMULARY_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            
            {/* Quick Tips / System Status */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-800 dark:to-black rounded-2xl p-6 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <h4 className="font-bold mb-2 flex items-center gap-2"><Activity size={16} className="text-emerald-400"/> System Status</h4>
                    <p className="text-xs text-slate-300 leading-relaxed mb-4">
                        Database online. Managing <strong>{stats.totalDrugs.toLocaleString()}</strong> pharmacy items.
                    </p>
                    <button onClick={() => navigate('/settings')} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
                        Manage System
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
