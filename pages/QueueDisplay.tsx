
import React, { useEffect, useState } from 'react';
import { dbService } from '../services/db';
import { AppointmentStatus } from '../types';
import { Clock, Activity } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const QueueDisplay = () => {
  const { t } = useLanguage();
  const [current, setCurrent] = useState<any[]>([]);
  const [next, setNext] = useState<any[]>([]);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    // Clock Tick
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // Data Poll
    const refresh = () => {
      const today = new Date().toISOString().split('T')[0];
      // Fetch In Progress
      const inProgress = dbService.query(`
        SELECT a.queueNumber, d.name as doctorName, d.specialty
        FROM appointments a
        JOIN doctors d ON a.doctorId = d.id
        WHERE a.date = '${today}' AND a.status = '${AppointmentStatus.IN_PROGRESS}'
        ORDER BY a.queueNumber ASC
      `);
      
      // Fetch Waiting
      const waiting = dbService.query(`
        SELECT a.queueNumber, d.name as doctorName
        FROM appointments a
        JOIN doctors d ON a.doctorId = d.id
        WHERE a.date = '${today}' AND a.status = '${AppointmentStatus.CHECKED_IN}'
        ORDER BY a.queueNumber ASC
        LIMIT 4
      `);

      setCurrent(inProgress);
      setNext(waiting);
    };

    refresh();
    const poller = setInterval(refresh, 5000); // 5s Refresh

    return () => { clearInterval(timer); clearInterval(poller); };
  }, []);

  return (
    <div className="h-screen w-screen bg-slate-900 text-white overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <div className="h-24 bg-slate-800 border-b border-slate-700 flex justify-between items-center px-10 shadow-lg z-10">
        <div className="flex items-center gap-4">
           <div className="bg-emerald-500 p-2 rounded-xl"><Activity size={40} className="text-white"/></div>
           <h1 className="text-4xl font-bold tracking-tight">MediCore Clinic</h1>
        </div>
        <div className="text-right">
           <div className="text-3xl font-mono font-bold text-emerald-400">{time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
           <div className="text-slate-400 text-lg">{time.toLocaleDateString()}</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12">
         {/* Main Stage: Now Serving */}
         <div className="col-span-8 bg-slate-900 p-12 border-r border-slate-800 flex flex-col justify-center">
            <h2 className="text-5xl font-bold text-emerald-500 mb-12 uppercase tracking-widest text-center">{t('now_serving')}</h2>
            
            {current.length === 0 ? (
                <div className="text-center text-slate-600 text-4xl font-light italic">
                   {t('waiting_list')}...
                </div>
            ) : (
                <div className="space-y-8">
                    {current.map((item, i) => (
                        <div key={i} className="bg-slate-800 rounded-3xl p-8 border-l-8 border-emerald-500 shadow-2xl flex items-center justify-between animate-fade-in-up">
                            <div>
                                <span className="text-3xl text-slate-400 block mb-2">{t('room')} {i + 1}</span>
                                <span className="text-2xl text-slate-300 font-bold block">{item.doctorName}</span>
                                <span className="text-xl text-emerald-600/80 uppercase tracking-wider">{item.specialty}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[120px] font-bold text-white leading-none tracking-tighter">#{item.queueNumber}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
         </div>

         {/* Sidebar: Next Up */}
         <div className="col-span-4 bg-slate-950 p-8">
            <h3 className="text-2xl font-bold text-slate-400 mb-8 border-b border-slate-800 pb-4 uppercase tracking-widest flex items-center gap-3">
               <Clock size={24}/> {t('next_in_line')}
            </h3>
            
            <div className="space-y-4">
               {next.length === 0 ? (
                   <p className="text-slate-600 italic text-center mt-10">Queue Empty</p>
               ) : (
                   next.map((item, i) => (
                       <div key={i} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex justify-between items-center opacity-80">
                           <div>
                               <span className="text-4xl font-bold text-white block">#{item.queueNumber}</span>
                           </div>
                           <div className="text-right">
                               <span className="text-sm text-slate-500 uppercase font-bold">Waiting for</span>
                               <span className="text-lg text-slate-300 block">{item.doctorName}</span>
                           </div>
                       </div>
                   ))
               )}
            </div>
            
            <div className="absolute bottom-8 right-8 left-[68%]">
                <div className="bg-emerald-900/20 border border-emerald-900/50 p-4 rounded-xl text-center">
                    <p className="text-emerald-400 text-lg">Please have your ID ready.</p>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default QueueDisplay;
