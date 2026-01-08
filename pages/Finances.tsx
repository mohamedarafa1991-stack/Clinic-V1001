
import React, { useState, useMemo, useEffect } from 'react';
import { dbService } from '../services/db';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { 
  DollarSign, TrendingUp, CreditCard, AlertCircle, Users, 
  Download, Wallet, ArrowUpRight, Briefcase, BarChart2
} from 'lucide-react';
import { parseISO, isSameMonth, format, startOfMonth, endOfMonth } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const Finances = () => {
  const [timeRange, setTimeRange] = useState<'all' | 'month' | 'custom'>('all');
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [chartMetric, setChartMetric] = useState<'revenue' | 'patients'>('revenue');
  const [primaryColor, setPrimaryColor] = useState('#0d9488');

  // Load Theme Color
  useEffect(() => {
      const updateColor = () => {
          const style = getComputedStyle(document.body);
          const color = style.getPropertyValue('--color-primary').trim();
          if(color) setPrimaryColor(color);
      };
      updateColor();
      window.addEventListener('medicore-theme-change', updateColor);
      return () => window.removeEventListener('medicore-theme-change', updateColor);
  }, []);

  // Load Data
  const appointments = dbService.query("SELECT * FROM appointments");
  const doctors = dbService.query("SELECT * FROM doctors");
  const nurses = dbService.query("SELECT * FROM nurses");
  const appServices = dbService.query("SELECT * FROM appointment_services");
  
  // --- Data Processing ---
  const filteredAppointments = useMemo(() => {
    let filtered = appointments;
    if (timeRange === 'month') {
        const now = new Date();
        filtered = appointments.filter((a: any) => isSameMonth(parseISO(a.date), now));
    }
    if (timeRange === 'custom') {
        filtered = appointments.filter((a: any) => a.date >= customStart && a.date <= customEnd);
    }
    return filtered;
  }, [appointments, timeRange, customStart, customEnd]);

  const filteredAppIds = useMemo(() => new Set(filteredAppointments.map((a: any) => a.id)), [filteredAppointments]);

  // 1. KPI Calculations
  const kpi = useMemo(() => {
    let totalRevenue = 0;
    let totalBilled = 0;
    let totalOutstanding = 0;
    let paidCount = 0;

    filteredAppointments.forEach((a: any) => {
      const collected = a.amountPaid || 0;
      const billed = (a.totalFee || 0) - (a.discount || 0); // Net Billed
      
      totalRevenue += collected;
      totalBilled += billed;
      
      if (collected > 0) paidCount++;
    });

    totalOutstanding = Math.max(0, totalBilled - totalRevenue);
    const collectionRate = totalBilled > 0 ? (totalRevenue / totalBilled) * 100 : 0;
    const avgTransaction = paidCount > 0 ? totalRevenue / paidCount : 0;

    return { totalRevenue, totalBilled, totalOutstanding, collectionRate, avgTransaction, count: filteredAppointments.length };
  }, [filteredAppointments]);

  // 2. Trend Data (Daily Revenue & Patients)
  const trendData = useMemo(() => {
    const map: Record<string, { revenue: number, patients: number }> = {};
    filteredAppointments.forEach((a: any) => {
        const d = a.date; 
        if (!map[d]) map[d] = { revenue: 0, patients: 0 };
        map[d].revenue += (a.amountPaid || 0);
        map[d].patients += 1;
    });
    return Object.keys(map).sort().map(date => ({ 
        date, 
        revenue: map[date].revenue,
        patients: map[date].patients 
    }));
  }, [filteredAppointments]);

  // 3. Provider Performance & Commission Logic
  const providerStats = useMemo(() => {
    const stats: Record<string, any> = {};
    
    // Init Doctors
    doctors.forEach((d: any) => {
        stats[`D-${d.id}`] = { 
            id: d.id, 
            type: 'Doctor',
            name: d.name, 
            specialty: d.specialty,
            commissionRate: d.commissionRate || 0,
            patients: 0,
            revenue: 0, // Attributed Revenue
            commission: 0 
        };
    });

    // Init Nurses
    nurses.forEach((n: any) => {
        stats[`N-${n.id}`] = { 
            id: n.id, 
            type: 'Nurse',
            name: n.name, 
            specialty: 'Nursing',
            commissionRate: n.commissionRate || 0,
            patients: 0,
            revenue: 0,
            commission: 0 
        };
    });

    // We must iterate appointments to handle base fees (Consultation) AND services
    filteredAppointments.forEach((a: any) => {
        // A. Base Visit Revenue -> Assigned to Main Doctor
        const docKey = `D-${a.doctorId}`;
        if (stats[docKey]) {
            stats[docKey].patients++;
            // Calculate base fee portion: Total - Services. 
            // Simplified: We check services linked to this appointment
            const servicesForApp = appServices.filter((s: any) => s.appointmentId === a.id);
            const servicesTotal = servicesForApp.reduce((sum: number, s: any) => sum + (s.priceSnapshot || 0), 0);
            
            // The "Visit Fee" is roughly Total - Services. 
            // However, discounts apply to the whole.
            // Commission Logic: We apply collection ratio to attribute realized revenue.
            
            const collectionRatio = a.totalFee > 0 ? (a.amountPaid / a.totalFee) : 0;
            
            // Base Fee Revenue (Doctor)
            const baseFeeBilled = Math.max(0, a.totalFee - servicesTotal); 
            // We assume discount applies proportionally or to base fee first? 
            // Let's apply collection ratio to everything for fairness.
            
            const baseFeeCollected = baseFeeBilled * collectionRatio;
            
            stats[docKey].revenue += baseFeeCollected;
            stats[docKey].commission += (baseFeeCollected * (stats[docKey].commissionRate / 100));

            // B. Service Revenue -> Assigned to Performer
            servicesForApp.forEach((s: any) => {
                const serviceCollected = (s.priceSnapshot || 0) * collectionRatio;
                let performerKey = '';
                
                if (s.performerRole === 'Nurse' && s.performedBy) performerKey = `N-${s.performedBy}`;
                else if (s.performerRole === 'Doctor' && s.performedBy) performerKey = `D-${s.performedBy}`;
                else performerKey = docKey; // Fallback to main doctor

                if (stats[performerKey]) {
                    stats[performerKey].revenue += serviceCollected;
                    stats[performerKey].commission += (serviceCollected * (stats[performerKey].commissionRate / 100));
                    // Note: Patient count logic for nurses is tricky, we can count distinct appointments they served
                }
            });
        }
    });

    return Object.values(stats).sort((a: any, b: any) => b.revenue - a.revenue);
  }, [filteredAppointments, doctors, nurses, appServices]);

  // 4. Specialty Data (Derived from Provider Stats for visual consistency)
  const specialtyData = useMemo(() => {
      const map: Record<string, number> = {};
      providerStats.forEach((p: any) => {
          if (p.type === 'Doctor') {
              map[p.specialty] = (map[p.specialty] || 0) + p.revenue;
          } else {
              map['Nursing'] = (map['Nursing'] || 0) + p.revenue;
          }
      });
      return Object.keys(map).map(name => ({ name, value: map[name] }));
  }, [providerStats]);

  // --- Export ---
  const exportReport = () => {
    const doc = new jsPDF();
    let rangeText = timeRange === 'all' ? 'All Time' : 'Current Month';
    if (timeRange === 'custom') rangeText = `${customStart} to ${customEnd}`;

    doc.text(`Financial & Commission Report (${rangeText})`, 14, 20);
    
    autoTable(doc, {
        startY: 30,
        head: [['Provider', 'Role', 'Revenue (Collected)', 'Comm %', 'Commission']],
        body: providerStats.map((d: any) => [
            d.name, d.type, 
            d.revenue.toFixed(2), d.commissionRate + '%', d.commission.toFixed(2)
        ]),
        theme: 'grid'
    });
    
    doc.save('finance_commission_report.pdf');
  };

  const COLORS = [primaryColor, '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];

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
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <TrendingUp size={18} className="text-[var(--color-primary)]"/> Performance Trends
                    </h3>
                    <div className="flex gap-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button 
                            onClick={() => setChartMetric('revenue')} 
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${chartMetric === 'revenue' ? 'bg-white dark:bg-slate-700 shadow text-[var(--color-primary)]' : 'text-gray-500'}`}
                        >
                            Revenue
                        </button>
                        <button 
                            onClick={() => setChartMetric('patients')} 
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${chartMetric === 'patients' ? 'bg-white dark:bg-slate-700 shadow text-[var(--color-primary)]' : 'text-gray-500'}`}
                        >
                            Volume
                        </button>
                    </div>
                </div>
                <div className="flex-1 w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartMetric === 'revenue' ? primaryColor : '#3b82f6'} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={chartMetric === 'revenue' ? primaryColor : '#3b82f6'} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.1} />
                            <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => chartMetric === 'revenue' ? `EGP ${val}` : val} tick={{fill: '#94a3b8'}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff', borderRadius: '8px' }}
                                formatter={(val: number) => [chartMetric === 'revenue' ? `EGP ${val.toLocaleString()}` : val, chartMetric === 'revenue' ? 'Revenue' : 'Patients']}
                            />
                            <Area 
                                type="monotone" 
                                dataKey={chartMetric} 
                                stroke={chartMetric === 'revenue' ? primaryColor : '#3b82f6'} 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#colorMetric)" 
                                animationDuration={1000} 
                            />
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

        {/* Detailed Provider Performance Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-white text-lg">Provider Commission Ledger</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Revenue attribution and commission calculations based on realized collection.</p>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 text-xs uppercase text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-6 py-4 font-bold">Provider</th>
                            <th className="px-6 py-4 font-bold">Role</th>
                            <th className="px-6 py-4 font-bold">Patients Served</th>
                            <th className="px-6 py-4 font-bold text-right">Attributed Revenue</th>
                            <th className="px-6 py-4 font-bold text-right">Comm %</th>
                            <th className="px-6 py-4 font-bold text-right">Commission</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {providerStats.map((p: any) => (
                            <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-gray-900 dark:text-white text-sm">{p.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.specialty}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${p.type === 'Doctor' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                        {p.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {p.patients}
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                                    EGP {p.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-bold text-gray-500">
                                    {p.commissionRate}%
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                    EGP {p.commission.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default Finances;
