import React, { useState, useMemo } from 'react';
import { dbService } from '../services/db';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { 
  DollarSign, TrendingUp, CreditCard, AlertCircle, Users, 
  Download, Wallet, ArrowUpRight,
  Briefcase
} from 'lucide-react';
import { parseISO, isSameMonth, format, startOfMonth, endOfMonth } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const Finances = () => {
  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'custom'>('all');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  // Load Data
  const appointments = dbService.query("SELECT * FROM appointments");
  const doctors = dbService.query("SELECT * FROM doctors");
  
  // --- Data Processing ---
  const filteredAppointments = useMemo(() => {
    if (timeRange === 'all') return appointments;
    if (timeRange === 'month') {
        const now = new Date();
        return appointments.filter((a: any) => isSameMonth(parseISO(a.date), now));
    }
    if (timeRange === 'custom') {
        return appointments.filter((a: any) => a.date >= customStart && a.date <= customEnd);
    }
    return appointments;
  }, [appointments, timeRange, customStart, customEnd]);

  // 1. KPI Calculations
  const kpi = useMemo(() => {
    let totalRevenue = 0;
    let totalBilled = 0;
    let totalOutstanding = 0;
    let paidCount = 0;

    filteredAppointments.forEach((a: any) => {
      totalRevenue += a.amountPaid || 0;
      totalBilled += a.totalFee || 0;
      if (a.paymentStatus === 'Paid' || a.paymentStatus === 'Partial') paidCount++;
    });

    totalOutstanding = totalBilled - totalRevenue;
    const collectionRate = totalBilled > 0 ? (totalRevenue / totalBilled) * 100 : 0;
    const avgTransaction = paidCount > 0 ? totalRevenue / paidCount : 0;

    return { totalRevenue, totalBilled, totalOutstanding, collectionRate, avgTransaction, count: filteredAppointments.length };
  }, [filteredAppointments]);

  // 2. Trend Data (Daily Revenue)
  const trendData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAppointments.forEach((a: any) => {
        const d = a.date; 
        map[d] = (map[d] || 0) + a.amountPaid;
    });
    return Object.keys(map).sort().map(date => ({ date, revenue: map[date] }));
  }, [filteredAppointments]);

  // 3. Revenue by Specialty
  const specialtyData = useMemo(() => {
    const map: Record<string, number> = {};
    const docMap: Record<number, any> = {};
    doctors.forEach((d: any) => docMap[d.id] = d);

    filteredAppointments.forEach((a: any) => {
        const doc = docMap[a.doctorId];
        const spec = doc?.specialty || 'General';
        map[spec] = (map[spec] || 0) + a.amountPaid;
    });

    return Object.keys(map).map(name => ({ name, value: map[name] }));
  }, [filteredAppointments, doctors]);

  // 4. Doctor Performance Table Data
  const doctorStats = useMemo(() => {
    const stats: Record<number, any> = {};
    doctors.forEach((d: any) => {
        stats[d.id] = { 
            id: d.id, 
            name: d.name, 
            specialty: d.specialty,
            patients: 0,
            billed: 0,
            collected: 0,
            outstanding: 0 
        };
    });

    filteredAppointments.forEach((a: any) => {
        if (stats[a.doctorId]) {
            stats[a.doctorId].patients++;
            stats[a.doctorId].billed += a.totalFee;
            stats[a.doctorId].collected += a.amountPaid;
            stats[a.doctorId].outstanding += (a.totalFee - a.amountPaid);
        }
    });

    return Object.values(stats).sort((a: any, b: any) => b.collected - a.collected);
  }, [filteredAppointments, doctors]);

  // --- Export ---
  const exportReport = () => {
    const doc = new jsPDF();
    let rangeText = timeRange === 'all' ? 'All Time' : 'Current Month';
    if (timeRange === 'custom') rangeText = `${customStart} to ${customEnd}`;

    doc.text(`Financial Report (${rangeText})`, 14, 20);
    
    autoTable(doc, {
        startY: 30,
        head: [['Doctor', 'Specialty', 'Patients', 'Billed', 'Collected', 'Outstanding']],
        body: doctorStats.map((d: any) => [
            d.name, d.specialty, d.patients, 
            d.billed.toFixed(2), d.collected.toFixed(2), d.outstanding.toFixed(2)
        ]),
        theme: 'grid'
    });
    
    doc.save('finance_report.pdf');
  };

  const COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
               <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Financial Overview</h2>
               <p className="text-gray-500 dark:text-gray-400 mt-1">Revenue tracking, doctor performance, and billing ledger.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full md:w-auto">
                {timeRange === 'custom' && (
                    <div className="flex items-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-1 gap-2 shadow-sm animate-fade-in-up">
                        <input 
                            type="date" 
                            className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-300 outline-none px-2 py-1"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                        />
                        <span className="text-gray-400 text-xs">-</span>
                        <input 
                            type="date" 
                            className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-300 outline-none px-2 py-1"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                        />
                    </div>
                )}
                
                <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-1 flex">
                        <button 
                            onClick={() => setTimeRange('all')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${timeRange === 'all' ? 'bg-gray-900 dark:bg-slate-700 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                        >
                            All Time
                        </button>
                        <button 
                            onClick={() => setTimeRange('month')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${timeRange === 'month' ? 'bg-gray-900 dark:bg-slate-700 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                        >
                            This Month
                        </button>
                        <button 
                            onClick={() => setTimeRange('custom')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${timeRange === 'custom' ? 'bg-gray-900 dark:bg-slate-700 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                        >
                            Custom
                        </button>
                    </div>
                    <button onClick={exportReport} className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-[var(--color-primary)]/20 hover:opacity-90 transition flex items-center gap-2 text-sm">
                        <Download size={16} /> Export
                    </button>
                </div>
            </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm relative overflow-hidden group transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Wallet size={64} className="text-[var(--color-primary)]" />
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <DollarSign size={20} />
                    </div>
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Total Revenue</span>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white">EGP {kpi.totalRevenue.toLocaleString()}</h3>
                <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                        <ArrowUpRight size={12} /> {kpi.collectionRate.toFixed(1)}%
                    </span>
                    <span className="text-gray-400">Collection Rate</span>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm relative overflow-hidden group transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <AlertCircle size={64} className="text-orange-500" />
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg">
                        <TrendingUp size={20} />
                    </div>
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Outstanding</span>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white">EGP {kpi.totalOutstanding.toLocaleString()}</h3>
                <p className="mt-2 text-xs text-orange-600 dark:text-orange-400 font-medium">Pending payments to collect</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm relative overflow-hidden group transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Users size={64} className="text-blue-500" />
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                        <Users size={20} />
                    </div>
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Patient Volume</span>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{kpi.count}</h3>
                <p className="mt-2 text-xs text-gray-400">Total appointments in period</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm relative overflow-hidden group transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <CreditCard size={64} className="text-purple-500" />
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                        <CreditCard size={20} />
                    </div>
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">Avg. Ticket</span>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white">EGP {kpi.avgTransaction.toFixed(0)}</h3>
                <p className="mt-2 text-xs text-gray-400">Per paid visit</p>
            </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                    <TrendingUp size={18} className="text-[var(--color-primary)]"/> Income Trend
                </h3>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                            <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `EGP ${val}`} tick={{fill: '#94a3b8'}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: '8px' }}
                                formatter={(val: number) => [`EGP ${val.toLocaleString()}`, 'Revenue']}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Specialty Distribution */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                    <Briefcase size={18} className="text-orange-500"/> Revenue by Specialty
                </h3>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={specialtyData} 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={60} 
                                outerRadius={80} 
                                paddingAngle={5} 
                                dataKey="value"
                                stroke="none"
                            >
                                {specialtyData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `EGP ${value.toLocaleString()}`} contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: '8px' }} />
                            <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '11px', paddingTop: '20px', color: '#94a3b8'}} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Detailed Doctor Performance Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">Individual Doctor Performance</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Breakdown of billing, collections, and debt per specialist.</p>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 text-xs uppercase text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-6 py-4 font-bold">Specialist</th>
                            <th className="px-6 py-4 font-bold">Visits</th>
                            <th className="px-6 py-4 font-bold text-right">Total Billed</th>
                            <th className="px-6 py-4 font-bold text-right">Collected</th>
                            <th className="px-6 py-4 font-bold text-right">Outstanding</th>
                            <th className="px-6 py-4 font-bold text-center">Collection %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {doctorStats.map((doc: any) => {
                            const rate = doc.billed > 0 ? (doc.collected / doc.billed) * 100 : 0;
                            return (
                                <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 dark:text-white text-sm">{doc.name}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{doc.specialty}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-md text-xs font-bold border border-blue-100 dark:border-blue-900/40">
                                            {doc.patients}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-600 dark:text-gray-300">
                                        EGP {doc.billed.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                        EGP {doc.collected.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium text-rose-500 dark:text-rose-400">
                                        EGP {doc.outstanding.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-16 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${rate >= 90 ? 'bg-emerald-500' : rate >= 50 ? 'bg-orange-400' : 'bg-red-500'}`} 
                                                    style={{ width: `${rate}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{rate.toFixed(0)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default Finances;