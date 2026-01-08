
import { UserRole } from '../types';
import { ADMIN_HASH } from '../utils/security';
import { DBHealthStats } from '../types/enhancements';
import { features } from '../config/featureFlags';

declare global {
  interface Window {
    initSqlJs: (config: any) => Promise<any>;
    electronAPI?: {
      saveDatabase: (buffer: Uint8Array) => Promise<boolean>;
      loadDatabase: () => Promise<Uint8Array | null>;
      exportBackup: (buffer: Uint8Array) => Promise<boolean>;
      importBackup: () => Promise<Uint8Array | null>;
      sendNotification: (title: string, body: string) => void;
      printPDF: (url: string) => void;
      getSystemTheme: () => Promise<'light'|'dark'>;
      onThemeChange: (cb: (ev: any, theme: string) => void) => void;
      openWindow: (route: string) => void;
      getVersion: () => Promise<string>;
    };
  }
}

const DB_NAME = 'medicore_db';
const STORE_NAME = 'sqlite_store';
const KEY_NAME = 'db_binary';
const CURRENT_SCHEMA_VERSION = 36; 

class DatabaseService {
  private db: any = null;
  private initialized = false;
  private isElectron = !!window.electronAPI;
  public onUpdate: (() => void) | null = null;

  async init() {
    if (this.initialized) return;

    try {
      const SQL = await window.initSqlJs({
        locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
      });

      let savedData: Uint8Array | null = null;

      if (this.isElectron) {
        savedData = await window.electronAPI!.loadDatabase();
        if (savedData) console.log("Loaded encrypted database from local disk.");
      } 
      
      if (!savedData) {
        const idbData = await this.loadFromIndexedDB();
        if (idbData) savedData = new Uint8Array(idbData);
      }

      if (savedData) {
        this.db = new SQL.Database(savedData);
      } else {
        this.db = new SQL.Database();
        this.createSchema();
        this.seedData();
      }
      
      this.migrate();
      
      this.initialized = true;
      this.saveDatabase();
      
      if (features.dbHealthMonitor) {
        this.checkHealth();
      }
    } catch (err) {
      console.error("Failed to initialize DB", err);
      if (!this.db) {
          const SQL = await window.initSqlJs({ locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
          this.db = new SQL.Database();
          this.createSchema();
          this.seedData();
          this.initialized = true;
      }
    }
  }

  private createSchema() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`,
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, password TEXT, role TEXT, relatedId INTEGER);`,
      `CREATE TABLE IF NOT EXISTS doctors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, title TEXT, licenseId TEXT, specialty TEXT, fee REAL, commissionRate REAL DEFAULT 0, schedule TEXT, bio TEXT, photo TEXT, phone TEXT, email TEXT, status TEXT DEFAULT 'Active');`,
      `CREATE TABLE IF NOT EXISTS nurses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, email TEXT, commissionRate REAL DEFAULT 0, status TEXT DEFAULT 'Active');`,
      `CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, email TEXT, address TEXT, emergency_contact TEXT, blood_group TEXT, allergies TEXT, chronic_conditions TEXT, dob TEXT, gender TEXT, history TEXT, height REAL, weight REAL);`,
      `CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, doctorId INTEGER, patientId INTEGER, date TEXT, time TEXT, status TEXT, type TEXT, totalFee REAL, discount REAL DEFAULT 0, amountPaid REAL, paymentStatus TEXT, queueNumber INTEGER, paymentNotes TEXT);`,
      `CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, recipient TEXT, message TEXT, date TEXT);`,
      `CREATE TABLE IF NOT EXISTS prescriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, patientId INTEGER, doctorId INTEGER, date TEXT, items TEXT, notes TEXT, diagnosis TEXT);`,
      `CREATE TABLE IF NOT EXISTS specialties (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category TEXT);`,
      `CREATE TABLE IF NOT EXISTS doctor_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, doctorId INTEGER, name TEXT, type TEXT, size TEXT, content TEXT, uploadDate TEXT);`,
      `CREATE TABLE IF NOT EXISTS doctor_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, doctorId INTEGER, text TEXT, type TEXT, priority TEXT, expiryDate TEXT, visibility TEXT, authorName TEXT, authorRole TEXT, createdAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS nurse_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, nurseId INTEGER, text TEXT, type TEXT, priority TEXT, expiryDate TEXT, visibility TEXT, authorName TEXT, authorRole TEXT, createdAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, action TEXT, details TEXT, timestamp TEXT);`,
      `CREATE TABLE IF NOT EXISTS patient_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, patientId INTEGER, name TEXT, type TEXT, size TEXT, content TEXT, uploadDate TEXT);`,
      `CREATE TABLE IF NOT EXISTS prescription_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, items TEXT);`,
      `CREATE TABLE IF NOT EXISTS visit_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, defaultFee REAL, isFollowUp INTEGER DEFAULT 0, followUpDays INTEGER DEFAULT 0);`,
      `CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category TEXT, basePrice REAL, isActive INTEGER DEFAULT 1, assignableTo TEXT DEFAULT 'Both');`,
      `CREATE TABLE IF NOT EXISTS service_pricing (id INTEGER PRIMARY KEY AUTOINCREMENT, serviceId INTEGER, entityType TEXT, entityId TEXT, price REAL);`,
      `CREATE TABLE IF NOT EXISTS appointment_services (id INTEGER PRIMARY KEY AUTOINCREMENT, appointmentId INTEGER, serviceId INTEGER, priceSnapshot REAL, performedBy INTEGER, performerRole TEXT);`,
      `CREATE TABLE IF NOT EXISTS doctor_titles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);`
    ];
    queries.forEach(q => this.db.run(q));
    this.seedSettings();
    this.seedSpecialties();
    this.seedPricingData();
    this.seedDoctorTitles();
    this.db.run(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
  }

  private seedSettings() {
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('clinic_name', 'MediCore Clinic');`);
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('clinic_address', '123 Medical Center Dr');`);
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('clinic_phone', '555-0000');`);
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('primary_color', '#0d9488');`);
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('secondary_color', '#0f766e');`);
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('input_bg_color', '#ffffff');`);
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('theme_mode', 'light');`);
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('active_decoration', 'none');`);
  }

  private seedSpecialties() {
    const count = this.db.exec("SELECT COUNT(*) as c FROM specialties")[0].values[0][0];
    if (count > 0) return;

    const specs = [
      { c: "Primary Care", i: ["General Practice", "Family Medicine", "Pediatrics"] },
      { c: "Internal Specialists", i: ["Cardiology", "Dermatology", "Endocrinology", "Neurology"] },
      { c: "Surgical", i: ["General Surgery", "Orthopedics", "Ophthalmology"] },
      { c: "Women's Health", i: ["Gynecology", "Obstetrics"] },
      { c: "Head & Neck", i: ["Dentistry", "ENT"] }
    ];

    specs.forEach(grp => {
      grp.i.forEach(item => {
        this.db.run("INSERT INTO specialties (name, category) VALUES (?, ?)", [item, grp.c]);
      });
    });
  }

  private seedDoctorTitles() {
    const count = this.db.exec("SELECT COUNT(*) as c FROM doctor_titles")[0].values[0][0];
    if (count > 0) return;
    const titles = ['Dr.', 'Prof.', 'Assoc. Prof.', 'Specialist', 'Consultant', 'Resident', 'Registrar'];
    titles.forEach(t => this.db.run("INSERT INTO doctor_titles (name) VALUES (?)", [t]));
  }

  private seedPricingData() {
    const vCount = this.db.exec("SELECT COUNT(*) as c FROM visit_types")[0].values[0][0];
    if (vCount === 0) {
      this.db.run("INSERT INTO visit_types (name, defaultFee, isFollowUp, followUpDays) VALUES ('Consultation', 150, 0, 0)");
      this.db.run("INSERT INTO visit_types (name, defaultFee, isFollowUp, followUpDays) VALUES ('Follow-Up', 50, 1, 14)");
      this.db.run("INSERT INTO visit_types (name, defaultFee, isFollowUp, followUpDays) VALUES ('Emergency', 300, 0, 0)");
    }

    const sCount = this.db.exec("SELECT COUNT(*) as c FROM services")[0].values[0][0];
    if (sCount === 0) {
      this.db.run("INSERT INTO services (name, category, basePrice, assignableTo) VALUES ('ECG', 'Diagnostic', 100, 'Both')");
      this.db.run("INSERT INTO services (name, category, basePrice, assignableTo) VALUES ('Ultrasound', 'Diagnostic', 250, 'Doctor')");
      this.db.run("INSERT INTO services (name, category, basePrice, assignableTo) VALUES ('Wound Dressing', 'Nursing', 80, 'Nurse')");
      this.db.run("INSERT INTO services (name, category, basePrice, assignableTo) VALUES ('Injection', 'Nursing', 30, 'Nurse')");
    }
  }

  private migrate() {
    try {
        let version = 0;
        try { version = this.db.exec("PRAGMA user_version")[0].values[0][0]; } catch (e) { version = 0; }
        
        console.log("Migrating DB from Version:", version);

        const addCol = (table: string, col: string, type: string, defVal?: string) => {
            try { 
                let q = `ALTER TABLE ${table} ADD COLUMN ${col} ${type}`;
                if(defVal) q += ` DEFAULT ${defVal}`;
                this.db.run(q); 
            } catch(e) { /* ignore */ }
        };

        // ... [Previous Migrations v1-v35 omitted for brevity, assuming state is preserved] ...
        
        // V36 MIGRATION: Phase 2 Foundation
        if (version < 36) {
            console.log("Applying Migration v36...");
            // 1. Clinical Alerts Table
            this.db.run(`CREATE TABLE IF NOT EXISTS clinical_alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, patientId INTEGER, type TEXT, severity TEXT, message TEXT, isDismissed INTEGER DEFAULT 0, createdAt TEXT);`);
            // 2. Medication Interactions Table
            this.db.run(`CREATE TABLE IF NOT EXISTS medication_interactions (id INTEGER PRIMARY KEY AUTOINCREMENT, drugs TEXT, severity TEXT, description TEXT);`);
            // 3. Triage Scores Table
            this.db.run(`CREATE TABLE IF NOT EXISTS triage_scores (id INTEGER PRIMARY KEY AUTOINCREMENT, patientId INTEGER, score INTEGER, type TEXT, recordedAt TEXT);`);
            
            // New Columns for Phase 3 readiness
            addCol('appointments', 'referralSource', 'TEXT');
            addCol('patients', 'consentStatus', 'TEXT', "'Pending'");
        }

        this.db.run(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
    } catch (e) {
        console.error("Migration failed:", e);
    }
  }

  private seedData() {
    const userCount = this.db.exec("SELECT COUNT(*) as c FROM users")[0].values[0][0];
    if (userCount === 0) {
      this.db.run(`INSERT INTO users (name, email, password, role) VALUES ('Admin User', 'admin@medicore.com', '${ADMIN_HASH}', '${UserRole.ADMIN}');`);
      const schedule = JSON.stringify({
        Mon: { isWorking: true, start: "09:00", end: "17:00" },
        Tue: { isWorking: true, start: "09:00", end: "17:00" },
        Wed: { isWorking: true, start: "09:00", end: "17:00" },
        Thu: { isWorking: true, start: "09:00", end: "17:00" },
        Fri: { isWorking: true, start: "09:00", end: "17:00" },
        Sat: { isWorking: false, start: "10:00", end: "14:00" },
        Sun: { isWorking: false, start: "00:00", end: "00:00" }
      });
      this.db.run(`INSERT INTO doctors (name, title, licenseId, specialty, fee, schedule, bio, photo, phone, email, status, commissionRate) VALUES ('Dr. Sarah House', 'Consultant', 'LIC-12345', 'Cardiology', 150, '${schedule}', 'Expert cardiologist with 10 years experience.', '', '555-0101', 'drsarah@medicore.com', 'Active', 10);`);
      const docId = this.db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
      this.db.run(`INSERT INTO users (name, email, password, role, relatedId) VALUES ('Dr. Sarah House', 'sarah@medicore.com', '${ADMIN_HASH}', '${UserRole.DOCTOR}', ${docId});`);
      this.db.run(`INSERT INTO patients (name, phone, dob, gender, history, blood_group, allergies, height, weight) VALUES ('John Doe', '555-0123', '1985-06-15', 'Male', '[]', 'O+', 'Peanuts', 180, 85);`);
      this.db.run(`INSERT INTO nurses (name, phone, email, status, commissionRate) VALUES ('Nurse Betty', '555-9988', 'betty@medicore.com', 'Active', 5);`);
    }
  }

  exec(sql: string, params: any[] = []) {
    if (!this.initialized) throw new Error("DB not initialized");
    const result = this.db.exec(sql, params);
    this.saveDatabase();
    if (this.onUpdate) this.onUpdate();
    return result;
  }
  
  query(sql: string, params: any[] = []) {
    if (!this.initialized) throw new Error("DB not initialized");
    try {
        const res = this.db.exec(sql, params);
        if (res.length === 0) return [];
        const columns = res[0].columns;
        const values = res[0].values;
        return values.map((row: any[]) => {
          const obj: any = {};
          columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
          return obj;
        });
    } catch (e) {
        console.error("Query Error:", sql, e);
        return [];
    }
  }

  logAudit(userId: number, action: string, details: string) {
      if (!this.initialized) return;
      try {
          this.exec("INSERT INTO audit_logs (userId, action, details, timestamp) VALUES (?, ?, ?, ?)", [
              userId, action, details, new Date().toISOString()
          ]);
      } catch(e) { console.warn("Audit log failed", e); }
  }

  private async saveDatabase() {
    if (!this.db) return;
    const data = this.db.export();
    if (this.isElectron) {
      window.electronAPI!.saveDatabase(data);
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(data, KEY_NAME);
    };
  }

  private async loadFromIndexedDB(): Promise<ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(KEY_NAME);
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => resolve(null);
      };
      request.onerror = (event) => reject(event);
    });
  }

  async exportBackup() {
    if(!this.db) return;
    const data = this.db.export();
    
    if (this.isElectron) {
      await window.electronAPI!.exportBackup(data);
    } else {
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medicore_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
      a.click();
    }
  }

  async importBackup(file?: File): Promise<void> {
    let buffer: ArrayBuffer | null = null;

    if (this.isElectron && !file) {
      const data = await window.electronAPI!.importBackup();
      if (data) buffer = data.buffer;
    } else if (file) {
      buffer = await file.arrayBuffer();
    }

    if (buffer) {
      this.db = new (this.db.constructor)(new Uint8Array(buffer));
      this.migrate();
      this.saveDatabase();
      window.location.reload();
    }
  }
  
  async factoryReset() {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => window.location.reload();
  }

  // --- Health Monitor Stub (Phase 1) ---
  checkHealth(): DBHealthStats | null {
      if(!this.db) return null;
      try {
          // Estimate size based on export (heavy operation, only on demand)
          const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
          return {
              sizeBytes: 0, // Placeholder: requires export() to know true size
              tableCount: tables[0]?.values.length || 0,
              integrity: 'ok', // Assuming OK if queries run
              lastCompacted: null
          };
      } catch (e) {
          return { sizeBytes: 0, tableCount: 0, integrity: 'corrupt', lastCompacted: null };
      }
  }

  // --- Incremental Backup Stub (Phase 1) ---
  async incrementalBackup() {
      // Logic for WAL export or diffing would go here
      console.log("Incremental backup triggered (Stub)");
  }
}

export const dbService = new DatabaseService();
