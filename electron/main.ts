
import { app, BrowserWindow, ipcMain, dialog, nativeTheme, Notification, Tray, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Buffer } from 'buffer';

// Workaround for missing @types/node
declare var __dirname: string;

// --- F. Security: AES-256 Encryption for Database ---
const ENCRYPTION_KEY_PATH = path.join(app.getPath('userData'), 'secure.key');
const DB_PATH = path.join(app.getPath('userData'), 'medicore.enc');

function getEncryptionKey(): Buffer {
  if (fs.existsSync(ENCRYPTION_KEY_PATH)) { return fs.readFileSync(ENCRYPTION_KEY_PATH); }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(ENCRYPTION_KEY_PATH, key);
  return key;
}

const ALGORITHM = 'aes-256-ctr';
const SECRET_KEY = getEncryptionKey();

function encrypt(buffer: Buffer): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  const result = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  return result;
}

function decrypt(buffer: Buffer): Buffer {
  const iv = buffer.slice(0, 16);
  const content = buffer.slice(16);
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  const result = Buffer.concat([decipher.update(content), decipher.final()]);
  return result;
}

// --- G. Window Management ---
let mainWindow: BrowserWindow | null = null;
let queueWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0f172a', symbolColor: '#ffffff' }
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../build/index.html')}`;
  win.loadURL(startUrl);
  return win;
}

function createQueueWindow() {
  if (queueWindow) { queueWindow.focus(); return; }
  queueWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'MediCore Queue Display',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true }
  });
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../build/index.html')}`;
  queueWindow.loadURL(`${startUrl}#/queue-tv`);
  queueWindow.on('closed', () => { queueWindow = null; });
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png'); // Ensure icon exists or use generic
  // Fallback if no icon
  if(!fs.existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: () => mainWindow?.show() },
    { label: 'Launch Queue TV', click: () => createQueueWindow() },
    { type: 'separator' },
    { label: 'Quit MediCore', click: () => app.quit() }
  ]);
  tray.setToolTip('MediCore Clinic System');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

app.whenReady().then(() => {
  mainWindow = createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if ((process as any).platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('db-load', async () => {
  if (fs.existsSync(DB_PATH)) {
    try {
      const encryptedData = fs.readFileSync(DB_PATH);
      return decrypt(encryptedData);
    } catch (e) { console.error("Decryption failed", e); return null; }
  }
  return null;
});

ipcMain.handle('db-save', async (event, data: Uint8Array) => {
  try {
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, encrypt(buffer));
    return true;
  } catch (e) { return false; }
});

ipcMain.handle('db-export', async (event, data: Uint8Array) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Backup',
    defaultPath: `medicore_backup_${new Date().toISOString().split('T')[0]}.sqlite`,
    filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }]
  });
  if (filePath) { fs.writeFileSync(filePath, Buffer.from(data)); return true; }
  return false;
});

ipcMain.handle('db-import', async () => {
  const { filePaths } = await dialog.showOpenDialog({ title: 'Import Database', properties: ['openFile'], filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }] });
  if (filePaths.length > 0) { return fs.readFileSync(filePaths[0]); }
  return null;
});

ipcMain.on('notify', (event, { title, body }) => {
  new Notification({ title, body }).show();
});

ipcMain.on('print-pdf', (event, url) => {
  const win = new BrowserWindow({ show: false });
  win.loadURL(url);
  win.webContents.on('did-finish-load', () => {
    win.webContents.print({ printBackground: true }, () => { win.close(); });
  });
});

ipcMain.handle('get-system-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
nativeTheme.on('updated', () => { BrowserWindow.getAllWindows().forEach(win => { win.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light'); }); });

ipcMain.on('open-window', (event, route) => {
  if (route === '/queue-tv') { createQueueWindow(); }
  // Add other specific windows if needed
});

ipcMain.handle('get-version', () => app.getVersion());
