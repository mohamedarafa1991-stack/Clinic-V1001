import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { Send, Check, Clock, MessageSquare, MessageCircle, FileText, Phone } from 'lucide-react';
import { Notification } from '../types';

const Notifications = () => {
  const [logs, setLogs] = useState<Notification[]>([]);
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');

  useEffect(() => {
    refreshLogs();
  }, []);

  const refreshLogs = () => {
    setLogs(dbService.query("SELECT * FROM notifications ORDER BY id DESC"));
  };

  const templates = [
      { label: "Appointment Reminder", text: "Hello, this is a reminder from MediCore Clinic regarding your appointment tomorrow. Please reply to confirm." },
      { label: "Report Ready", text: "Your medical test reports are ready for collection at MediCore Clinic. You can pick them up during working hours." },
      { label: "Follow-up Check", text: "Dr. Sarah asks how you are feeling today? Please let us know if your symptoms have improved." },
      { label: "Payment Receipt", text: "Thank you for your visit. We have received your payment. An official receipt has been emailed to you." }
  ];

  const handleWhatsAppSend = () => {
    if (!message || !recipient) return;
    
    // 1. Sanitize Phone Number (Remove spaces, dashes, parentheses)
    // WhatsApp requires international format without + or 00. 
    // For this generic demo, we strip non-digits. In a real scenario, you might prepend a country code if missing.
    const cleanNumber = recipient.replace(/\D/g, '');

    if (cleanNumber.length < 5) {
        alert("Please enter a valid phone number.");
        return;
    }

    // 2. Log to Local Database (Record that we initiated contact)
    dbService.exec("INSERT INTO notifications (type, recipient, message, date) VALUES (?, ?, ?, ?)", [
        'WhatsApp', recipient, message, new Date().toLocaleString()
    ]);
    
    // 3. Construct WhatsApp URL
    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;

    // 4. Open in new tab (Triggers WhatsApp Web or App)
    window.open(waUrl, '_blank');
    
    // 5. Reset Form
    setMessage('');
    setRecipient('');
    refreshLogs();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
        {/* Composer */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 flex flex-col h-full transition-colors">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <MessageCircle size={24} className="text-emerald-500" /> WhatsApp Direct
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Send messages via your installed WhatsApp application.</p>
            </div>
            
            <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Recipient Number</label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input 
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm dark:text-white" 
                            placeholder="e.g. 201234567890"
                            value={recipient}
                            onChange={e => setRecipient(e.target.value)}
                        />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Include country code, no symbols.</p>
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Message Content</label>
                    <textarea 
                        className="w-full h-40 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none text-sm leading-relaxed dark:text-white" 
                        placeholder="Type your message here..."
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                    ></textarea>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Quick Templates</label>
                    <div className="grid grid-cols-1 gap-2">
                        {templates.map((t, i) => (
                            <button 
                                key={i}
                                onClick={() => setMessage(t.text)}
                                className="text-left text-xs bg-gray-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-gray-600 dark:text-gray-300 hover:text-emerald-700 dark:hover:text-emerald-400 p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-900 transition-all flex items-start gap-2 group"
                            >
                                <FileText size={14} className="mt-0.5 opacity-50 group-hover:opacity-100" />
                                <div>
                                    <span className="font-bold block">{t.label}</span>
                                    <span className="opacity-75 truncate block w-48">{t.text}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button 
                onClick={handleWhatsAppSend}
                disabled={!message || !recipient}
                className="mt-6 w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2 disabled:opacity-50 disabled:shadow-none active:scale-[0.98]"
            >
                <Send size={18} /> Open in WhatsApp
            </button>
        </div>

        {/* Log */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden h-full transition-colors">
             <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex justify-between items-center backdrop-blur-sm sticky top-0 z-10">
                 <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Clock size={18} className="text-gray-400" /> Message History
                 </h3>
                 <div className="flex items-center gap-2">
                     <span className="text-xs font-bold bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-2 py-1 rounded-md text-gray-500 dark:text-gray-300 shadow-sm">
                        {logs.length} Records
                     </span>
                 </div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30 dark:bg-slate-800/30">
                 {logs.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-gray-600">
                         <MessageSquare size={48} className="mb-4 opacity-20" />
                         <p className="font-medium">No communication logs found</p>
                     </div>
                 ) : (
                     logs.map(log => (
                         <div key={log.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4 hover:shadow-md transition-shadow group">
                             <div className="flex justify-between items-start mb-2">
                                 <div className="flex items-center gap-2">
                                     <div className={`p-1.5 rounded-full ${log.type === 'WhatsApp' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                        {log.type === 'WhatsApp' ? <MessageCircle size={14} /> : <MessageSquare size={14} />}
                                     </div>
                                     <span className="font-bold text-gray-800 dark:text-white">{log.recipient}</span>
                                 </div>
                                 <span className="text-[10px] font-medium text-gray-400 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-full">{log.date}</span>
                             </div>
                             <div className="pl-9">
                                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{log.message}</p>
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Check size={12} /> Logged locally
                                </div>
                             </div>
                         </div>
                     ))
                 )}
             </div>
        </div>
    </div>
  );
};

export default Notifications;