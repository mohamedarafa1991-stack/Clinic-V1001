
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { AppointmentStatus, PaymentStatus, Service, VisitType, Nurse } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Calendar as CalendarIcon, Clock, User, Plus, Search, AlertTriangle, 
  X, ChevronLeft, ChevronRight, MoreHorizontal,
  CheckCircle2, CreditCard, DollarSign, Wallet, Hash, Briefcase, CalendarX, ShieldAlert,
  LayoutGrid, List, FileText, Stethoscope, Tag, Syringe
} from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import ResourceSelect from '../components/ResourceSelect';

const Appointments = () => {
  const { t, dir } = useLanguage();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [visitTypes, setVisitTypes] = useState<VisitType[]>([]);
  
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Booking State
  const [newAppt, setNewAppt] = useState({
    doctorId: '', nurseId: '', patientId: '', date: format(new Date(), 'yyyy-MM-dd'), time: '', 
    type: 'Consultation', totalFee: 0, discount: 0, amountPaid: 0, paymentNotes: '',
    visitTypeId: 0,
    selectedServices: [] as Service[]
  });
  
  // Specialty filter state for booking modal
  const [filterSpecialty, setFilterSpecialty] = useState('');

  const [nextQueueNumber, setNextQueueNumber] = useState<number>(1);
  const [doctorScheduleError, setDoctorScheduleError] = useState('');
  const [shiftDisplay, setShiftDisplay] = useState('');
  const [conflict, setConflict] = useState<{ type: 'DoubleBooking' | 'Closed' | 'OverCapacity', message: string } | null>(null);

  const loadData = () => {
    let query = `
      SELECT a.*, d.name as doctorName, d.specialty, p.name as patientName, p.phone as patientPhone, p.gender as patientGender
      FROM appointments a
      LEFT JOIN doctors d ON a.doctorId = d.id
      LEFT JOIN patients p ON a.patientId = p.id
      WHERE a.date = '${filterDate}'
    `;
    let apps = dbService.query(query);
    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        apps = apps.filter((a: any) => 
            a.patientName?.toLowerCase().includes(lowerQ) || 
            a.doctorName?.toLowerCase().includes(lowerQ) ||
            a.id.toString().includes(lowerQ)
        );
    }
    apps.sort((a: any, b: any) => a.queueNumber - b.queueNumber);
    setAppointments(apps);
    setDoctors(dbService.query("SELECT * FROM doctors"));
    setNurses(dbService.query("SELECT * FROM nurses WHERE status='Active'"));
    setPatients(dbService.query("SELECT * FROM patients"));
    setServices(dbService.query("SELECT * FROM services WHERE isActive = 1 ORDER BY name"));
    setVisitTypes(dbService.query("SELECT * FROM visit_types"));
  };

  useEffect(() => { loadData(); }, [filterDate, searchQuery]);

  // Recalculate Fees when Doctor, VisitType, or Services change
  useEffect(() => {
      const doc = doctors.find(d => d.id === Number(newAppt.doctorId));
      const vType = visitTypes.find(v => v.id === newAppt.visitTypeId);
      
      let baseFee = 0;
      
      // 1. Visit Type Fee (Fallback to Doctor Base Fee if not found)
      if (vType) {
          baseFee = vType.defaultFee;
      } else {
          baseFee = doc?.fee || 0;
      }

      // 2. Services Fee (Sum of base prices)
      const servicesFee = newAppt.selectedServices.reduce((sum, s) => sum + s.basePrice, 0);

      setNewAppt(prev => ({ ...prev, totalFee: baseFee + servicesFee }));

  }, [newAppt.doctorId, newAppt.visitTypeId, newAppt.selectedServices, visitTypes, doctors]);

  useEffect(() => {
      if (!showModal || !newAppt.doctorId || !newAppt.date) {
          setShiftDisplay('');
          setNextQueueNumber(0);
          return;
      }
      setDoctorScheduleError('');
      setConflict(null);
      
      const doctor = doctors.find(d => d.id === Number(newAppt.doctorId));
      if (!doctor) return;

      try {
        const schedule = JSON.parse(doctor.schedule);
        const dateObj = parseISO(newAppt.date);
        const dayName = format(dateObj, 'EEE');
        const dayConfig = schedule[dayName];

        if (!dayConfig || !dayConfig.isWorking) {
            setDoctorScheduleError(`${doctor.name} is off on ${dayName}.`);
            setShiftDisplay(t('off_duty'));
            setNewAppt(prev => ({ ...prev, time: '' }));
            setNextQueueNumber(0);
            return;
        }

        const period = `${dayConfig.start} - ${dayConfig.end}`;
        setShiftDisplay(period);
        setNewAppt(prev => ({ ...prev, time: period }));

        const queueCountQuery = dbService.query(`SELECT COUNT(*) as count FROM appointments WHERE doctorId = ${newAppt.doctorId} AND date = '${newAppt.date}'`);
        setNextQueueNumber((queueCountQuery[0]?.count || 0) + 1);
      } catch (err) { setDoctorScheduleError("Error calculating schedule."); }
  }, [newAppt.doctorId, newAppt.date, showModal]);

  const handleDateNav = (direction: 'prev' | 'next' | 'today') => {
      const current = new Date(filterDate);
      if (direction === 'prev') setFilterDate(format(subDays(current, 1), 'yyyy-MM-dd'));
      if (direction === 'next') setFilterDate(format(addDays(current, 1), 'yyyy-MM-dd'));
      if (direction === 'today') setFilterDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleStatusChange = (id: number, status: string) => {
    dbService.exec("UPDATE appointments SET status = ? WHERE id = ?", [status, id]);
    loadData();
  };
  
  const handlePayment = (id: number, currentPaid: number, total: number, discount: number) => {
    const net = total - discount;
    const remaining = net - currentPaid;
    const amount = prompt(`Remaining Balance: ${remaining}\nEnter amount to pay:`, remaining.toString());
    if (amount === null) return;
    
    const pay = parseFloat(amount);
    if (isNaN(pay) || pay < 0 || pay > remaining) {
        alert("Invalid amount");
        return;
    }

    const newPaid = currentPaid + pay;
    const newRemaining = net - newPaid;
    let status = PaymentStatus.PARTIAL;
    if (newRemaining <= 0) status = PaymentStatus.PAID;
    if (net === 0) status = PaymentStatus.FREE;

    dbService.exec("UPDATE appointments SET amountPaid = ?, paymentStatus = ? WHERE id = ?", [newPaid, status, id]);
    loadData();
  };

  const toggleService = (svc: Service) => {
      const exists = newAppt.selectedServices.find(s => s.id === svc.id);
      if (exists) {
          setNewAppt(prev => ({ ...prev, selectedServices: prev.selectedServices.filter(s => s.id !== svc.id) }));
      } else {
          setNewAppt(prev => ({ ...prev, selectedServices: [...prev.selectedServices, svc] }));
      }
  };

  const attemptBooking = () => {
      if (!newAppt.doctorId || !newAppt.patientId || !newAppt.date) return;
      if (doctorScheduleError) { setConflict({ type: 'Closed', message: doctorScheduleError }); return; }
      
      const existingAppt = dbService.query(`SELECT * FROM appointments WHERE doctorId = ${newAppt.doctorId} AND patientId = ${newAppt.patientId} AND date = '${newAppt.date}' AND status != '${AppointmentStatus.CANCELLED}'`);
      if (existingAppt.length > 0) {
          setConflict({ type: 'DoubleBooking', message: 'Patient already has an appointment with this doctor today.' });
          return;
      }

      // Calculate Status
      const net = newAppt.totalFee - newAppt.discount;
      let finalStatus = PaymentStatus.PENDING;
      if (net === 0) finalStatus = PaymentStatus.FREE;
      else if (newAppt.amountPaid >= net) finalStatus = PaymentStatus.PAID;
      else if (newAppt.amountPaid > 0) finalStatus = PaymentStatus.PARTIAL;

      const lastQ = dbService.query(`SELECT COUNT(*) as count FROM appointments WHERE doctorId = ${newAppt.doctorId} AND date = '${newAppt.date}'`);
      const finalQueue = (lastQ[0].count || 0) + 1;

      // Map Visit Type Name
      const visitTypeName = visitTypes.find(v => v.id === newAppt.visitTypeId)?.name || 'Consultation';

      dbService.exec(
        `INSERT INTO appointments (doctorId, patientId, date, time, status, type, totalFee, discount, amountPaid, paymentStatus, queueNumber, paymentNotes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newAppt.doctorId, newAppt.patientId, newAppt.date, newAppt.time, AppointmentStatus.SCHEDULED, visitTypeName, newAppt.totalFee, newAppt.discount, newAppt.amountPaid, finalStatus, finalQueue, newAppt.paymentNotes]
      );

      // Link Services with performer info
      const apptId = dbService.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      
      // Add Visit Type as the base service (performed by Doctor)
      const vType = visitTypes.find(v => v.id === newAppt.visitTypeId);
      // We don't store Visit Type in appointment_services typically if it's the base fee, 
      // BUT for commission calculation, if the doctor gets commission on the visit fee, we should track it as a service or handle it in Finances.
      // The current schema uses 'totalFee' for the base. We will let Finances.tsx handle the base fee attribution to Doctor.
      // We only insert EXTRA services here.

      newAppt.selectedServices.forEach(s => {
          let performerId = newAppt.doctorId; 
          let performerRole = 'Doctor';
          
          // Logic: If service is Nurse-only, or Both but a Nurse is selected, assign to Nurse.
          if (s.assignableTo === 'Nurse') {
              performerId = newAppt.nurseId || '0'; // If no nurse selected, unassigned (0)
              performerRole = 'Nurse';
          } else if (s.assignableTo === 'Both' && newAppt.nurseId) {
              // If both, and nurse selected, does nurse do it? Usually Doctor does procedures unless delegated.
              // Let's assume Doctor does 'Both' unless explicitly toggled (not implemented), or if category is Nursing.
              if (s.category === 'Nursing') {
                  performerId = newAppt.nurseId;
                  performerRole = 'Nurse';
              }
          }

          dbService.exec("INSERT INTO appointment_services (appointmentId, serviceId, priceSnapshot, performedBy, performerRole) VALUES (?, ?, ?, ?, ?)", 
            [apptId, s.id, s.basePrice, performerId, performerRole]
          );
      });

      setShowModal(false); setConflict(null); loadData();
  };

  const filteredDoctors = useMemo(() => {
      if (!filterSpecialty) return doctors;
      return doctors.filter(d => d.specialty && d.specialty.includes(filterSpecialty));
  }, [doctors, filterSpecialty]);

  const stats = {
      total: appointments.length,
      scheduled: appointments.filter(a => a.status === AppointmentStatus.SCHEDULED).length,
      waiting: appointments.filter(a => a.status === AppointmentStatus.CHECKED_IN).length,
      completed: appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length
  };

  // Safe Math
  const netTotal = Math.max(0, newAppt.totalFee - newAppt.discount);
  
  // Check if any selected service requires a nurse
  const requiresNurse = newAppt.selectedServices.some(s => s.assignableTo === 'Nurse' || s.category === 'Nursing');

  return (
    <div className="pb-20 space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 transition-colors">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8">
              <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{t('appointments')}</h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">{t('overview')}</p>
                  
                  <div className="flex flex-wrap gap-3 mt-4">
                      <div className="bg-gray-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-gray-400"></span> Total: {stats.total}
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span> {t('Scheduled')}: {stats.scheduled}
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-800 text-xs font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500"></span> {t('Checked In')}: {stats.waiting}
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-800 text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span> {t('Completed')}: {stats.completed}
                      </div>
                  </div>
              </div>

              <button 
                onClick={() => { setShowModal(true); setNewAppt({...newAppt, date: format(new Date(), 'yyyy-MM-dd')}); setFilterSpecialty(''); }} 
                className="bg-[var(--color-primary)] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-[var(--color-primary)]/20 active:scale-95 group"
              >
                  <Plus className="group-hover:rotate-90 transition-transform" size={20} /> {t('new_booking')}
              </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-between items-center pt-6 border-t border-gray-100 dark:border-slate-800">
              <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button onClick={() => handleDateNav('prev')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-gray-400 transition-all shadow-sm"><ChevronLeft size={18} className="rtl:rotate-180"/></button>
                  <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent border-none font-bold text-gray-800 dark:text-white text-sm px-4 focus:ring-0 outline-none cursor-pointer" />
                  <button onClick={() => handleDateNav('next')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-gray-400 transition-all shadow-sm"><ChevronRight size={18} className="rtl:rotate-180"/></button>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-lg flex">
                      <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'}`}><List size={18} /></button>
                      <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={18} /></button>
                  </div>
                  <div className="relative flex-1 md:w-72">
                      <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input type="text" placeholder={t('search')} className="w-full pl-10 rtl:pr-10 rtl:pl-4 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none transition-all text-sm dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
              </div>
          </div>
      </div>

      {viewMode === 'list' ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right border-collapse">
                <thead className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">{t('queue_no')}</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">{t('availability')}</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">{t('patient')}</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">{t('doctor')}</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">{t('status')}</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase">{t('payment')}</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase text-end">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {appointments.length === 0 ? (
                    <tr><td colSpan={7} className="p-12 text-center text-gray-400">No appointments found.</td></tr>
                  ) : (
                    appointments.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition">
                        <td className="p-4"><span className="text-xl font-bold text-gray-800 dark:text-white">#{app.queueNumber}</span></td>
                        <td className="p-4"><span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded flex items-center gap-1 w-fit"><Clock size={12} /> {app.time}</span></td>
                        <td className="p-4">
                            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/patients', { state: { patientId: app.patientId } })}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${app.patientGender === 'Female' ? 'bg-rose-400' : 'bg-indigo-400'}`}>{app.patientName.charAt(0)}</div>
                                <div><p className="font-bold text-gray-800 dark:text-white text-sm group-hover:text-[var(--color-primary)] transition-colors">{app.patientName}</p><p className="text-xs text-gray-500">{app.patientPhone}</p></div>
                            </div>
                        </td>
                        <td className="p-4"><div><p className="text-sm font-medium text-gray-800 dark:text-gray-200">{app.doctorName}</p><p className="text-xs text-[var(--color-primary)] font-medium">{app.specialty}</p></div></td>
                        <td className="p-4">
                          <select value={app.status} onChange={(e) => handleStatusChange(app.id, e.target.value)} className="text-xs font-bold px-3 py-1.5 rounded-lg border-none outline-none cursor-pointer bg-gray-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                             {Object.values(AppointmentStatus).map(s => <option key={s} value={s}>{t(s as any)}</option>)}
                          </select>
                        </td>
                        <td className="p-4">
                           <div className="flex flex-col gap-1">
                                {app.paymentStatus === PaymentStatus.PAID ? (
                                    <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-bold bg-green-50 dark:bg-green-900/30 px-2.5 py-1.5 rounded-lg w-fit"><CheckCircle2 size={12} /> {t('Paid')}</span>
                                ) : app.paymentStatus === PaymentStatus.FREE ? (
                                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1.5 rounded-lg w-fit"><CheckCircle2 size={12} /> {t('Free')}</span>
                                ) : (
                                    <button onClick={() => handlePayment(app.id, app.amountPaid, app.totalFee, app.discount)} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-slate-800 hover:bg-[var(--color-primary)] text-gray-600 dark:text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 transition-all font-medium">
                                        <CreditCard size={12} /> {app.paymentStatus === PaymentStatus.PARTIAL ? t('Partial') : 'Pay'}
                                    </button>
                                )}
                                <span className="text-[10px] text-gray-400">Bal: {Math.max(0, app.totalFee - (app.discount || 0) - app.amountPaid)}</span>
                           </div>
                        </td>
                        <td className="p-4 text-end">
                            <button onClick={() => navigate('/prescriptions', { state: { patientId: app.patientId } })} className="text-gray-400 hover:text-[var(--color-primary)] p-2 rounded-lg transition-colors" title="New Prescription">
                                <FileText size={18} />
                            </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {appointments.length === 0 && <div className="col-span-full py-12 text-center text-gray-400">No appointments for this date.</div>}
              {appointments.map(app => (
                  <div key={app.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                      <div>
                          <div className="flex justify-between items-start mb-3">
                              <span className="text-2xl font-bold text-[var(--color-primary)]">#{app.queueNumber}</span>
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">{t(app.status)}</span>
                          </div>
                          <h4 className="font-bold text-gray-800 dark:text-white truncate">{app.patientName}</h4>
                          <p className="text-xs text-gray-500 mb-4">{app.doctorName}</p>
                      </div>
                      <select className="bg-gray-50 dark:bg-slate-800 border-none text-xs rounded-lg p-2 font-medium w-full" value={app.status} onChange={(e) => handleStatusChange(app.id, e.target.value)}>
                          {Object.values(AppointmentStatus).map(s => <option key={s} value={s}>{t(s as any)}</option>)}
                      </select>
                  </div>
              ))}
          </div>
      )}

      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end" dir={dir}>
           <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
           <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-up border-l rtl:border-l-0 rtl:border-r border-gray-200 dark:border-slate-800">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
                  <div className="flex items-center gap-3">
                     <div className="bg-gray-900 dark:bg-slate-700 text-white p-2.5 rounded-xl"><Plus size={20} /></div>
                     <div><h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('new_booking')}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{t('schedule_visit')}</p></div>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500"><X size={24}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-slate-800/50 relative">
                  {conflict && (
                      <div className="absolute inset-x-4 top-4 z-20 animate-fade-in-up">
                          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 border border-red-100 dark:border-red-900 ring-4 ring-red-50 dark:ring-red-900/20">
                              <div className="flex items-start gap-4 mb-4">
                                  <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl"><ShieldAlert size={24} /></div>
                                  <div><h4 className="font-bold text-red-700 dark:text-red-400 text-lg mb-1">{t('conflict_alert')}</h4><p className="text-sm text-gray-600 dark:text-gray-300">{conflict.message}</p></div>
                              </div>
                              <div className="flex gap-3">
                                  <button onClick={() => setConflict(null)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-xl font-bold">{t('cancel')}</button>
                              </div>
                          </div>
                      </div>
                  )}

                  <div className={`space-y-5 transition-opacity ${conflict ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                     <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><User size={14}/> {t('patient')} & {t('doctor')}</h4>
                        <div className="space-y-4">
                            {/* Specialty Filter */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('specialty')}</label>
                                <ResourceSelect 
                                    resource="specialties"
                                    value={filterSpecialty}
                                    onChange={setFilterSpecialty}
                                    placeholder="Filter by Specialty"
                                    allowAdd={false}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('doctor')}</label>
                                <select className="w-full border dark:border-slate-700 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white" onChange={(e) => { 
                                    setNewAppt({...newAppt, doctorId: e.target.value}); 
                                }} value={newAppt.doctorId}>
                                    <option value="">-- {t('search')} --</option>
                                    {filteredDoctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>)}
                                </select>
                             </div>
                             <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('patient')}</label>
                                <select className="w-full border dark:border-slate-700 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 dark:text-white" onChange={(e) => setNewAppt({...newAppt, patientId: e.target.value})} value={newAppt.patientId}>
                                    <option value="">-- {t('search')} --</option>
                                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                             </div>
                        </div>
                     </div>
                     
                     <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-3"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Clock size={14}/> {t('schedule')}</h4></div>
                        <div className="mb-4"><input type="date" className="w-full border dark:border-slate-700 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 font-bold text-gray-800 dark:text-white" value={newAppt.date} onChange={e => setNewAppt({...newAppt, date: e.target.value})} /></div>
                        {(!newAppt.doctorId || !newAppt.date) ? <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-100 dark:border-slate-700 rounded-xl">{t('availability')}</div> : doctorScheduleError ? <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-3"><AlertTriangle size={20} /> <span className="font-medium">{doctorScheduleError}</span></div> : <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4"><div className="flex items-center gap-2 mb-3"><Briefcase size={18} className="text-emerald-700" /><p className="text-emerald-900 dark:text-emerald-100 font-bold text-lg">{shiftDisplay}</p></div><div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2 flex items-center justify-between"><span className="text-xs font-bold text-emerald-700">{t('queue_no')}</span><span className="text-lg font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1"><Hash size={16}/> {nextQueueNumber}</span></div></div>}
                     </div>

                     {/* Visit Type & Services Selector */}
                     <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Tag size={14}/> {t('visit_type')}</h4>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {visitTypes.map(vt => (
                                <button 
                                    key={vt.id}
                                    onClick={() => setNewAppt({...newAppt, visitTypeId: vt.id})}
                                    className={`p-3 rounded-lg border text-sm font-bold text-left transition-all ${newAppt.visitTypeId === vt.id ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700'}`}
                                >
                                    {vt.name}
                                </button>
                            ))}
                        </div>

                        <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">{t('add_service')}</h4>
                            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto mb-4">
                                {services.map(svc => {
                                    const isSelected = newAppt.selectedServices.some(s => s.id === svc.id);
                                    const color = svc.category === 'Procedure' ? 'blue' : svc.category === 'Nursing' ? 'pink' : 'gray';
                                    return (
                                        <button 
                                            key={svc.id} 
                                            onClick={() => toggleService(svc)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isSelected ? `bg-${color}-100 text-${color}-700 border-${color}-200 dark:bg-${color}-900/30 dark:text-${color}-300 dark:border-${color}-800` : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700'}`}
                                        >
                                            {isSelected && <span className="mr-1">✓</span>} {svc.name} <span className="opacity-70 ml-1">({svc.basePrice})</span>
                                        </button>
                                    );
                                })}
                            </div>
                            
                            {requiresNurse && (
                                <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-xl border border-pink-100 dark:border-pink-800 mt-2">
                                    <label className="block text-xs font-bold text-pink-700 dark:text-pink-300 mb-1.5 flex items-center gap-2"><Syringe size={14}/> Assisting Nurse</label>
                                    <select 
                                        className="w-full border border-pink-200 dark:border-pink-700 p-2 rounded-lg bg-white dark:bg-slate-900 dark:text-white text-sm"
                                        value={newAppt.nurseId}
                                        onChange={(e) => setNewAppt({...newAppt, nurseId: e.target.value})}
                                    >
                                        <option value="">-- Select Nurse --</option>
                                        {nurses.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                    </select>
                                    <p className="text-[10px] text-pink-500 mt-1">* Required for selected nursing services</p>
                                </div>
                            )}
                        </div>
                     </div>

                     <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><DollarSign size={14}/> {t('payment')}</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('consultation_fee')}</label>
                                <input type="number" className="w-full border dark:border-slate-700 p-2 rounded-lg font-mono font-bold bg-gray-50 dark:bg-slate-800 dark:text-white" value={newAppt.totalFee} onChange={e => setNewAppt({...newAppt, totalFee: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">{t('discount')}</label>
                                <input type="number" className="w-full border dark:border-slate-700 p-2 rounded-lg font-mono bg-gray-50 dark:bg-slate-800 dark:text-white" value={newAppt.discount} onChange={e => setNewAppt({...newAppt, discount: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase">{t('net_total')}</span>
                            <span className="text-xl font-bold text-gray-800 dark:text-white">EGP {netTotal}</span>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">{t('amount_paid')}</label>
                            <input 
                                type="number" 
                                className="w-full border dark:border-slate-700 p-2 rounded-lg font-mono font-bold bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]" 
                                value={newAppt.amountPaid} 
                                onChange={e => {
                                    const val = Number(e.target.value);
                                    if(val <= netTotal) setNewAppt({...newAppt, amountPaid: val});
                                }} 
                            />
                        </div>
                     </div>
                  </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 z-30">
                 <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 rounded-lg font-bold">{t('cancel')}</button>
                 <button onClick={attemptBooking} disabled={!newAppt.time || !newAppt.patientId || !!conflict || (requiresNurse && !newAppt.nurseId)} className="px-6 py-2 rounded-lg bg-[var(--color-primary)] text-white font-bold disabled:opacity-50 hover:opacity-90">{t('confirm_booking')}</button>
              </div>
           </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Appointments;
