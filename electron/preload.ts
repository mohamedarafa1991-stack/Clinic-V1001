
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // A. File System & Backup
  saveDatabase: (buffer: Uint8Array) => ipcRenderer.invoke('db-save', buffer),
  loadDatabase: () => ipcRenderer.invoke('db-load'),
  exportBackup: (buffer: Uint8Array) => ipcRenderer.invoke('db-export', buffer),
  importBackup: () => ipcRenderer.invoke('db-import'),
  
  // B. Notifications
  sendNotification: (title: string, body: string) => ipcRenderer.send('notify', { title, body }),
  
  // C. PDF & Print
  printPDF: (blobUrl: string) => ipcRenderer.send('print-pdf', blobUrl),
  
  // D. System Theme
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onThemeChange: (callback: any) => ipcRenderer.on('theme-changed', callback),
  
  // G. Multi-window
  openWindow: (route: string) => ipcRenderer.send('open-window', route),
  
  // H. App Info
  getVersion: () => ipcRenderer.invoke('get-version'),
});
