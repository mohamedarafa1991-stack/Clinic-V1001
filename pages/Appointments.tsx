import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { dbService } from '../services/db';
import { AppointmentStatus, PaymentStatus } from '../types';
import { 
  Calendar as CalendarIcon, Clock, User, Plus, Search, AlertTriangle, 
  X, ChevronLeft, ChevronRight, MoreHorizontal,
  CheckCircle2, CreditCard, DollarSign, Wallet, Hash, Briefcase, CalendarX, ShieldAlert
} from 'lucide-react';
import { format, addDays, subDays, parseISO } from 'date-fns';

const Appointments = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [newAppt, setNewAppt] = useState({
    doctorId: '',
    patientId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '', // This will now hold the "Start - End" string
    type: 'Consultation',
    totalFee: 150,
    paymentType: 'Pending', // Pending, Full, Partial, Free
    amountPaid: 0,
    paymentNotes: ''
  });

  // Queue & Schedule State
  const [nextQueueNumber, setNextQueueNumber] = useState<number>(1);
  const [doctorScheduleError, setDoctorScheduleError] = useState('');
  const [shiftDisplay, setShiftDisplay] = useState(''); // To display "09:00 - 17:00"

  // Conflict Handling State
  const [conflict, setConflict] = useState<{ type: 'DoubleBooking' | 'Closed' | 'OverCapacity', message: string } | null>(null);

  // --- Data Loading ---
  const loadData = () => {
    // Basic Query
    let query = `
      SELECT a.*, d.name as doctorName, d.specialty, p.name as patientName, p.phone as patientPhone, p.gender as patientGender
      FROM appointments a
      LEFT JOIN doctors d ON a.doctorId = d.id
      LEFT JOIN patients p ON a.patientId = p.id
      WHERE a.date = '${filterDate}'
    `;

    // Execute
    let apps = dbService.query(query);

    // Frontend Filter for Search
    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        apps = apps.filter((a: any) => 
            a.patientName.toLowerCase().includes(lowerQ) || 
            a.doctorName.toLowerCase().includes(lowerQ) ||
            a.id.toString().includes(lowerQ)
        );
    }

    // Sort by Queue Number since Time is now a range
    apps.sort((a: any, b: any) => a.queueNumber - b.queueNumber);

    setAppointments(apps);
    setDoctors(dbService.query("SELECT * FROM doctors"));
    setPatients(dbService.query("SELECT * FROM patients"));
  };

  useEffect(() => {
    loadData();
  }, [filterDate, searchQuery]);

  // --- Schedule & Queue Calculation Logic ---
  useEffect(() => {
      if (!showModal || !newAppt.doctorId || !newAppt.date) {
          setShiftDisplay('');
          setNextQueueNumber(0);
          return;
      }

      // Reset errors on change
      setDoctorScheduleError('');
      setConflict(null);
      
      const doctor = doctors.find(d => d.id === Number(newAppt.doctorId));
      if (!doctor) return;

      try {
        const schedule = JSON.parse(doctor.schedule);
        const dateObj = parseISO(newAppt.date);
        const dayName = format(dateObj, 'EEE'); // Mon, Tue...
        const dayConfig = schedule[dayName];

        // 1. Check Schedule (Basic Availability)
        if (!dayConfig || !dayConfig.isWorking) {
            setDoctorScheduleError(`${doctor.name} is off on ${dayName}.`);
            setShiftDisplay('Clinic Closed');
            setNewAppt(prev => ({ ...prev, time: '' }));
            setNextQueueNumber(0);
            return;
        }

        // 2. Set Availability Period
        const period = `${dayConfig.start} - ${dayConfig.end}`;
        setShiftDisplay(period);
        setNewAppt(prev => ({ ...prev, time: period })); // Save range as time

        // 3. Calculate Next Queue Number
        const queueCountQuery = dbService.query(`
            SELECT COUNT(*) as count FROM appointments 
            WHERE doctorId = ${newAppt.doctorId} 
            AND date = '${newAppt.date}'
        `);
        const currentCount = queueCountQuery[0]?.count || 0;
        setNextQueueNumber(currentCount + 1);

      } catch (err) {
          console.error(err);
          setDoctorScheduleError("Error calculating schedule.");
      }

  }, [newAppt.doctorId, newAppt.date, showModal]);


  // --- Payment Logic Handlers ---
  const handlePaymentTypeChange = (type: string) => {
      let paid = 0;
      if (type === 'Full') paid = newAppt.totalFee;
      if (type === 'Free' || type === 'Pending') paid = 0;
      
      setNewAppt({ 
          ...newAppt, 
          paymentType: type, 
          amountPaid: paid 
      });
  };

  const handleTotalFeeChange = (fee: number) => {
      setNewAppt(prev => ({
          ...prev,
          totalFee: fee,
          amountPaid: prev.paymentType === 'Full' ? fee : prev.amountPaid
      }));
  };

  // --- Actions ---

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
  
  const handlePayment = (id: number, fee: number) => {
    dbService.exec("UPDATE appointments SET amountPaid = ?, paymentStatus = ? WHERE id = ?", [fee, PaymentStatus.PAID, id]);
    loadData();
  };

  // --- Conflict Detection & Resolution ---

  const suggestNextAvailable = () => {
    // Find next 7 days where doctor is working
    const doctor = doctors.find(d => d.id === Number(newAppt.doctorId));
    if (!doctor) return;
    
    let checkDate = parseISO(newAppt.date);
    const schedule = JSON.parse(doctor.schedule);
    
    // Look up to 14 days ahead
    for (let i = 1; i <= 14; i++) {
        checkDate = addDays(checkDate, 1);
        const dayName = format(checkDate, 'EEE');
        if (schedule[dayName]?.isWorking) {
            setNewAppt(prev => ({ ...prev, date: format(checkDate, 'yyyy-MM-dd') }));
            setConflict(null); // Clear conflict as we moved to a valid date
            return;
        }
    }
    alert("No available slots found in the next 14 days.");
  };

  const validateBooking = () => {
      if (!newAppt.doctorId || !newAppt.patientId || !newAppt.date) return false;

      // 1. Check if Doctor is actually working (Redundant but safe)
      if (doctorScheduleError) {
          setConflict({ type: 'Closed', message: doctorScheduleError });
          return false;
      }

      // 2. Check for Double Booking (Same Patient, Same Doctor, Same Day)
      // Note: In real world, maybe they see different doctors, but seeing same doctor twice same day is rare unless follow-up
      const existingAppt = dbService.query(`
          SELECT * FROM appointments 
          WHERE doctorId = ${newAppt.doctorId} 
          AND patientId = ${newAppt.patientId} 
          AND date = '${newAppt.date}'
          AND status != '${AppointmentStatus.CANCELLED}'
      `);

      if (existingAppt.length > 0) {
          setConflict({ 
              type: 'DoubleBooking', 
              message: 'This patient already has an active appointment with this doctor on this date.' 
          });
          return false;
      }

      return true;
  };

  const finalizeBooking = () => {
    // Determine Final Payment Status Enum
    let finalStatus = PaymentStatus.PENDING;
    let finalFee = newAppt.totalFee;
    let finalPaid = newAppt.amountPaid;
    let notes = newAppt.paymentNotes;

    if (newAppt.paymentType === 'Full') {
        finalStatus = PaymentStatus.PAID;
    } else if (newAppt.paymentType === 'Partial') {
        finalStatus = PaymentStatus.PARTIAL;
    } else if (newAppt.paymentType === 'Free') {
        finalStatus = PaymentStatus.PAID;
        finalFee = 0; // Override fee to 0 so no debt remains
        finalPaid = 0;
        notes = `Waived/Free: ${notes}`;
    }

    // Double check queue number right before insert to prevent race condition (basic)
    const lastQ = dbService.query(`SELECT COUNT(*) as count FROM appointments WHERE doctorId = ${newAppt.doctorId} AND date = '${newAppt.date}'`);
    const finalQueue = (lastQ[0].count || 0) + 1;

    dbService.exec(
      `INSERT INTO appointments (doctorId, patientId, date, time, status, type, totalFee, amountPaid, paymentStatus, queueNumber, paymentNotes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
          newAppt.doctorId, 
          newAppt.patientId, 
          newAppt.date, 
          newAppt.time, // Saves "09:00 - 17:00"
          AppointmentStatus.SCHEDULED, 
          newAppt.type, 
          finalFee, 
          finalPaid, 
          finalStatus, 
          finalQueue, 
          notes
      ]
    );
    setShowModal(false);
    setConflict(null);
    loadData();
  };

  const attemptBooking = () => {
      if (validateBooking()) {
          finalizeBooking();
      }
      // If validateBooking returns false, 'conflict' state is set, rendering the warning UI
  };

  // --- Calculations ---
  const stats = {
      total: appointments.length,
      scheduled: appointments.filter(a => a.status === AppointmentStatus.SCHEDULED).length,
      waiting: appointments.filter(a => a.status === AppointmentStatus.CHECKED_IN).length,
      completed: appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length
  };

  return (
    <div className="pb-20 space-y-6">
      {/* --- Main Header Area --- */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 transition-colors">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-8">
              <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Appointment Manager</h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">Schedule, track, and manage daily patient visits.</p>
                  
                  {/* Stats Ribbon */}
                  <div className="flex flex-wrap gap-3 mt-4">
                      <div className="bg-gray-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-gray-400"></span> Total: {stats.total}
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span> Scheduled: {stats.scheduled}
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-800 text-xs font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500"></span> Waiting: {stats.waiting}
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-100 dark:border-green-800 text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span> Completed: {stats.completed}
                      </div>
                  </div>
              </div>

              {/* Primary CTA */}
              <button 
                  onClick={() => {
                      // Reset state for new booking
                      setNewAppt({
                        doctorId: '',
                        patientId: '',
                        date: format(new Date(), 'yyyy-MM-dd'),
                        time: '',
                        type: 'Consultation',
                        totalFee: 150,
                        paymentType: 'Pending',
                        amountPaid: 0,
                        paymentNotes: ''
                      });
                      setConflict(null);
                      setDoctorScheduleError('');
                      setShowModal(true);
                  }}
                  className="bg-gray-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-gray-200 dark:shadow-none active:scale-95 group"
              >
                  <Plus className="group-hover:rotate-90 transition-transform" size={20} /> New Booking
              </button>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center pt-6 border-t border-gray-100 dark:border-slate-800">
              {/* Date Navigator */}
              <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button onClick={() => handleDateNav('prev')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm"><ChevronLeft size={18}/></button>
                  <div className="relative">
                       <input 
                          type="date" 
                          value={filterDate}
                          onChange={(e) => setFilterDate(e.target.value)}
                          className="bg-transparent border-none font-bold text-gray-800 dark:text-white text-sm px-4 focus:ring-0 outline-none cursor-pointer"
                       />
                  </div>
                  <button onClick={() => handleDateNav('next')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm"><ChevronRight size={18}/></button>
                  <button onClick={() => handleDateNav('today')} className="ml-2 px-3 py-1.5 bg-white dark:bg-slate-700 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-200 shadow-sm hover:text-[var(--color-primary)]">Today</button>
              </div>

              {/* Search Filter */}
              <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                      type="text" 
                      placeholder="Search patient, doctor..." 
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-all text-sm dark:text-white"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                  />
              </div>
          </div>
      </div>

      {/* --- Appointments List --- */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Queue No.</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Availability</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Patient</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Doctor</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment</th>
                <th className="p-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {appointments.length === 0 ? (
                <tr>
                    <td colSpan={7} className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-600">
                            <CalendarIcon size={32} />
                        </div>
                        <h3 className="text-gray-800 dark:text-white font-bold">No appointments found</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Try changing the date or clearing filters.</p>
                    </td>
                </tr>
              ) : (
                appointments.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition group">
                    <td className="p-4">
                        <div className="flex flex-col">
                            <span className="text-xl font-bold text-gray-800 dark:text-white">#{app.queueNumber}</span>
                        </div>
                    </td>
                    <td className="p-4">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded flex items-center gap-1 w-fit">
                            <Clock size={12} /> {app.time}
                        </span>
                    </td>
                    <td className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${app.patientGender === 'Female' ? 'bg-rose-400' : 'bg-indigo-400'}`}>
                                {app.patientName.charAt(0)}
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 dark:text-white text-sm">{app.patientName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{app.patientPhone || 'No Phone'}</p>
                            </div>
                        </div>
                    </td>
                    <td className="p-4">
                        <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{app.doctorName}</p>
                            <p className="text-xs text-[var(--color-primary)] font-medium">{app.specialty}</p>
                        </div>
                    </td>
                    <td className="p-4">
                      <select 
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border-none outline-none cursor-pointer transition-colors
                          ${app.status === AppointmentStatus.SCHEDULED ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40' : ''}
                          ${app.status === AppointmentStatus.CHECKED_IN ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40' : ''}
                          ${app.status === AppointmentStatus.IN_PROGRESS ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40' : ''}
                          ${app.status === AppointmentStatus.COMPLETED ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40' : ''}
                          ${app.status === AppointmentStatus.CANCELLED ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40' : ''}
                        `}
                      >
                         {Object.values(AppointmentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                       {app.paymentStatus === PaymentStatus.PAID ? (
                         <div className="flex flex-col items-start gap-1">
                             <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-bold bg-green-50 dark:bg-green-900/30 px-2.5 py-1.5 rounded-lg border border-green-100 dark:border-green-900/40 w-fit">
                                <CheckCircle2 size={12} /> PAID
                             </span>
                             {app.totalFee === 0 && <span className="text-[10px] text-gray-400 italic">Waived</span>}
                         </div>
                       ) : (
                         <div className="flex flex-col gap-1">
                             <button 
                                onClick={() => handlePayment(app.id, app.totalFee)}
                                className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-slate-800 hover:bg-[var(--color-primary)] text-gray-600 dark:text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-[var(--color-primary)] transition-all font-medium"
                             >
                                <CreditCard size={12} /> Pay {app.totalFee - app.amountPaid}
                             </button>
                             {app.paymentStatus === PaymentStatus.PARTIAL && (
                                 <span className="text-[10px] text-orange-500 font-bold ml-1">Partial: {app.amountPaid} Paid</span>
                             )}
                         </div>
                       )}
                    </td>
                    <td className="p-4 text-right">
                       <button className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors">
                           <MoreHorizontal size={18} />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- New Booking Drawer --- */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
           {/* Backdrop */}
           <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
           
           {/* Drawer */}
           <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-fade-in-up border-l border-gray-200 dark:border-slate-800">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10 sticky top-0">
                  <div className="flex items-center gap-3">
                     <div className="bg-gray-900 dark:bg-slate-700 text-white p-2.5 rounded-xl shadow-lg shadow-gray-200 dark:shadow-none">
                        <Plus size={20} />
                     </div>
                     <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">New Booking</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Schedule a new visit</p>
                     </div>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500 dark:text-gray-400"><X size={24}/></button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-slate-800/50 relative">
                  {/* Conflict Overlay */}
                  {conflict && (
                      <div className="absolute inset-x-4 top-4 z-20 animate-fade-in-up">
                          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 border border-red-100 dark:border-red-900 ring-4 ring-red-50 dark:ring-red-900/20">
                              <div className="flex items-start gap-4 mb-4">
                                  <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                                      {conflict.type === 'Closed' ? <CalendarX size={24} /> : <ShieldAlert size={24} />}
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-red-700 dark:text-red-400 text-lg mb-1">Booking Conflict Detected</h4>
                                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{conflict.message}</p>
                                  </div>
                              </div>
                              
                              <div className="flex flex-col gap-3">
                                  <button 
                                      onClick={suggestNextAvailable}
                                      className="w-full py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl font-bold border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center gap-2"
                                  >
                                      <CalendarIcon size={16} /> Suggest Next Available Slot
                                  </button>
                                  
                                  <div className="flex gap-3">
                                      <button 
                                          onClick={() => setConflict(null)}
                                          className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                                      >
                                          Cancel
                                      </button>
                                      <button 
                                          onClick={finalizeBooking}
                                          className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                                      >
                                          <AlertTriangle size={16} /> Force Override
                                      </button>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  <div className={`space-y-5 transition-opacity duration-300 ${conflict ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                     <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><User size={14}/> Key Details</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Doctor</label>
                                <select 
                                    className="w-full border dark:border-slate-700 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white"
                                    onChange={(e) => {
                                        const dId = e.target.value;
                                        const doc = doctors.find(d => d.id === Number(dId));
                                        setNewAppt({...newAppt, doctorId: dId, totalFee: doc?.fee || 150 });
                                    }}
                                    value={newAppt.doctorId}
                                >
                                    <option value="">Select Specialist</option>
                                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>)}
                                </select>
                             </div>
                             
                             <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Patient</label>
                                <select 
                                    className="w-full border dark:border-slate-700 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white"
                                    onChange={(e) => setNewAppt({...newAppt, patientId: e.target.value})}
                                    value={newAppt.patientId}
                                >
                                    <option value="">Select Patient</option>
                                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                             </div>
                        </div>
                     </div>
                     
                     <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Clock size={14}/> Schedule</h4>
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
                            <input 
                                type="date" 
                                className="w-full border dark:border-slate-700 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-bold text-gray-800 dark:text-white" 
                                value={newAppt.date} 
                                onChange={e => setNewAppt({...newAppt, date: e.target.value})} 
                            />
                        </div>

                        {/* Availability Info Card */}
                        <div className="mb-4">
                             {(!newAppt.doctorId || !newAppt.date) ? (
                                 <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-100 dark:border-slate-700 rounded-xl">
                                     Select Doctor and Date to check availability
                                 </div>
                             ) : doctorScheduleError ? (
                                 <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-3 border border-red-100 dark:border-red-900/30">
                                     <AlertTriangle size={20} /> 
                                     <span className="font-medium">{doctorScheduleError}</span>
                                 </div>
                             ) : (
                                 <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 animate-fade-in-up">
                                     <div className="flex items-center justify-between mb-2">
                                         <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Doctor Available</p>
                                         <span className="bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Working Today</span>
                                     </div>
                                     <div className="flex items-center gap-2 mb-3">
                                         <Briefcase size={18} className="text-emerald-700 dark:text-emerald-400" />
                                         <p className="text-emerald-900 dark:text-emerald-100 font-bold text-lg">{shiftDisplay}</p>
                                     </div>
                                     <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2 flex items-center justify-between border border-emerald-100/50 dark:border-emerald-900/30">
                                         <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Estimated Queue Position</span>
                                         <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1"><Hash size={16}/> {nextQueueNumber}</span>
                                     </div>
                                 </div>
                             )}
                        </div>
                     </div>

                     <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><DollarSign size={14}/> Payment & Billing</h4>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Total Fee (EGP)</label>
                            <input 
                                type="number" 
                                className="w-full border dark:border-slate-700 p-2.5 rounded-lg font-mono font-bold text-lg bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white" 
                                value={newAppt.totalFee} 
                                onChange={e => handleTotalFeeChange(Number(e.target.value))} 
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {['Pending', 'Full', 'Partial', 'Free'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => handlePaymentTypeChange(type)}
                                    className={`p-3 rounded-lg border text-sm font-bold flex flex-col items-center justify-center gap-1 transition-all ${newAppt.paymentType === type ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]' : 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                                >
                                    {type === 'Pending' && <Clock size={16} />}
                                    {type === 'Full' && <CheckCircle2 size={16} />}
                                    {type === 'Partial' && <Wallet size={16} />}
                                    {type === 'Free' && <DollarSign size={16} className="line-through" />}
                                    {type === 'Full' ? 'Fully Paid' : type}
                                </button>
                            ))}
                        </div>

                        {newAppt.paymentType === 'Partial' && (
                            <div className="mb-4 animate-fade-in-up">
                                <label className="block text-sm font-bold text-orange-600 mb-1.5">Amount Paid Now (EGP)</label>
                                <input 
                                    type="number" 
                                    className="w-full border border-orange-200 dark:border-orange-800 p-2.5 rounded-lg font-mono font-bold bg-orange-50 dark:bg-orange-900/20 focus:bg-white dark:focus:bg-slate-800 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" 
                                    value={newAppt.amountPaid} 
                                    onChange={e => setNewAppt({...newAppt, amountPaid: Number(e.target.value)})} 
                                />
                                <p className="text-xs text-orange-500 mt-1 text-right">Remaining: {Math.max(0, newAppt.totalFee - newAppt.amountPaid)} EGP</p>
                            </div>
                        )}

                        {(newAppt.paymentType === 'Partial' || newAppt.paymentType === 'Free') && (
                            <div className="animate-fade-in-up">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{newAppt.paymentType === 'Free' ? 'Reason for Waiver' : 'Payment Notes'}</label>
                                <input 
                                    className="w-full border dark:border-slate-700 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:text-white" 
                                    placeholder={newAppt.paymentType === 'Free' ? "e.g. Charity, Staff Family" : "e.g. Deposit only"}
                                    value={newAppt.paymentNotes} 
                                    onChange={e => setNewAppt({...newAppt, paymentNotes: e.target.value})} 
                                />
                            </div>
                        )}
                     </div>
                  </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 z-30">
                 <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-bold transition-colors">Cancel</button>
                 <button 
                    onClick={attemptBooking} 
                    disabled={!newAppt.time || !newAppt.patientId || !!conflict}
                    className={`px-6 py-2 rounded-lg text-white font-bold transition-all shadow-lg flex items-center gap-2
                        ${(!newAppt.time || !newAppt.patientId || !!conflict) 
                            ? 'bg-gray-300 dark:bg-slate-700 cursor-not-allowed shadow-none' 
                            : 'bg-[var(--color-primary)] hover:opacity-90 shadow-[var(--color-primary)]/30'
                        }`}
                >
                    Confirm Booking
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Appointments;