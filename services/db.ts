
import { UserRole } from '../types';
import { ADMIN_HASH } from '../utils/security';

// Declare global sql.js init function
declare global {
  interface Window {
    initSqlJs: (config: any) => Promise<any>;
  }
}

const DB_NAME = 'medicore_db';
const STORE_NAME = 'sqlite_store';
const KEY_NAME = 'db_binary';
// Bump version to force re-seed with Price Data
const CURRENT_SCHEMA_VERSION = 23; 

class DatabaseService {
  private db: any = null;
  private initialized = false;

  async init() {
    if (this.initialized) return;

    try {
      const SQL = await window.initSqlJs({
        locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
      });

      // Try to load from IndexedDB
      const savedData = await this.loadFromIndexedDB();

      if (savedData) {
        this.db = new SQL.Database(new Uint8Array(savedData));
      } else {
        this.db = new SQL.Database();
        this.createSchema();
        this.seedData();
      }
      
      // Run migrations to ensure schema integrity for existing DBs
      this.migrate();
      
      this.initialized = true;
      this.saveToIndexedDB();
    } catch (err) {
      console.error("Failed to initialize DB", err);
      // Fallback: Create fresh in-memory DB if loading fails to allow app access
      if (!this.db) {
          console.warn("Falling back to fresh in-memory database.");
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
      `CREATE TABLE IF NOT EXISTS doctors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, specialty TEXT, fee REAL, schedule TEXT, bio TEXT, photo TEXT, phone TEXT, email TEXT);`,
      `CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, email TEXT, address TEXT, emergency_contact TEXT, blood_group TEXT, allergies TEXT, chronic_conditions TEXT, dob TEXT, gender TEXT, history TEXT, height REAL, weight REAL);`,
      `CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, doctorId INTEGER, patientId INTEGER, date TEXT, time TEXT, status TEXT, type TEXT, totalFee REAL, amountPaid REAL, paymentStatus TEXT, queueNumber INTEGER, paymentNotes TEXT);`,
      `CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, recipient TEXT, message TEXT, date TEXT);`,
      // New Medicines Schema WITH Price
      `CREATE TABLE IF NOT EXISTS medicines (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, generic TEXT, category TEXT, form TEXT, concentration TEXT, manufacturer TEXT, price REAL, stock INTEGER, expiry TEXT);`,
      `CREATE TABLE IF NOT EXISTS prescriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, patientId INTEGER, doctorId INTEGER, date TEXT, items TEXT, notes TEXT);`,
      `CREATE TABLE IF NOT EXISTS specialties (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);`,
      `CREATE TABLE IF NOT EXISTS doctor_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, doctorId INTEGER, name TEXT, type TEXT, size TEXT, content TEXT, uploadDate TEXT);`,
      `CREATE TABLE IF NOT EXISTS doctor_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, doctorId INTEGER, text TEXT, type TEXT, priority TEXT, expiryDate TEXT, visibility TEXT, authorName TEXT, authorRole TEXT, createdAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER, action TEXT, details TEXT, timestamp TEXT);`
    ];
    queries.forEach(q => this.db.run(q));
    
    this.seedSettings();
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

  private migrate() {
    try {
        let version = 0;
        try {
            version = this.db.exec("PRAGMA user_version")[0].values[0][0];
        } catch (e) { version = 0; }
        
        console.log("Migrating DB from Version:", version);

        const addCol = (table: string, col: string, type: string) => {
            try { this.db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch(e) { /* ignore */ }
        };

        // Ensure columns exist
        addCol('patients', 'email', 'TEXT');
        addCol('patients', 'address', 'TEXT');
        addCol('patients', 'emergency_contact', 'TEXT');
        addCol('patients', 'blood_group', 'TEXT');
        addCol('patients', 'allergies', 'TEXT');
        addCol('patients', 'chronic_conditions', 'TEXT');
        addCol('patients', 'height', 'REAL');
        addCol('patients', 'weight', 'REAL');
        addCol('doctors', 'phone', 'TEXT');
        addCol('doctors', 'email', 'TEXT');
        addCol('appointments', 'paymentNotes', 'TEXT');
        addCol('doctor_notes', 'type', 'TEXT');
        addCol('doctor_notes', 'priority', 'TEXT');
        addCol('doctor_notes', 'expiryDate', 'TEXT');
        addCol('doctor_notes', 'visibility', 'TEXT');
        addCol('doctor_notes', 'authorName', 'TEXT');
        addCol('doctor_notes', 'authorRole', 'TEXT');
        addCol('doctor_notes', 'createdAt', 'TEXT');
        
        // Ensure medicines has price
        addCol('medicines', 'price', 'REAL');

        // VERSION 23: Re-seed with Prices
        if (version < 23) {
            console.log("Migrating to v23: Adding Prices to Drug Index...");
            this.db.run(`DROP TABLE IF EXISTS medicines`);
            this.db.run(`CREATE TABLE medicines (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, generic TEXT, category TEXT, form TEXT, concentration TEXT, manufacturer TEXT, price REAL, stock INTEGER, expiry TEXT);`);
            this.seedEgyptianDrugs();
        }

        this.seedSettings();

        const count = this.db.exec(`SELECT COUNT(*) as c FROM specialties`)[0].values[0][0];
        if (count === 0) {
            const specs = ['General Practitioner', 'Cardiology', 'Dermatology', 'Pediatrics', 'Neurology', 'Orthopedics', 'Dentistry', 'Psychiatry'];
            specs.forEach((s: string) => this.db.run(`INSERT INTO specialties (name) VALUES (?)`, [s]));
        }

        this.db.run(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
        console.log("Migration Complete. DB Version now:", CURRENT_SCHEMA_VERSION);
    } catch (e) {
        console.error("Migration failed:", e);
    }
  }

  private seedEgyptianDrugs() {
      this.db.run(`DELETE FROM medicines`);
      this.db.exec("BEGIN TRANSACTION");

      try {
        // --- HELPER FUNCTIONS ---
        const insert = (name: string, generic: string, category: string, form: string, conc: string, man: string, price: number) => {
            this.db.run(
                `INSERT INTO medicines (name, generic, category, form, concentration, manufacturer, price, stock, expiry) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, '')`,
                [name, generic, category, form, conc, man, price]
            );
        };

        const addLine = (category: string, name: string, generic: string, man: string, variants: string[], basePrice: number) => {
            variants.forEach((v, idx) => {
               const parts = v.split(' ');
               const form = parts.length > 1 ? parts.pop() || 'Pack' : 'Pack';
               const conc = parts.join(' ');
               const fullName = `${name} ${conc}`.trim();
               // Slight price variation based on concentration/index
               const realPrice = Math.round(basePrice + (idx * 15)); 
               insert(fullName, generic, category, form, conc, man, realPrice);
            });
        };

        // --- 1. TRADE NAMES WITH REALISTIC PRICES (EGP) ---
        
        // Antibiotics
        addLine('Antibiotics', 'Augmentin', 'Amox/Clav', 'GSK', ['1g Tab', '625mg Tab', '375mg Tab', '156mg Syrup', '312mg Syrup', '457mg Syrup', '1.2g Vial', '600mg Vial'], 89);
        addLine('Antibiotics', 'Hibiotic', 'Amox/Clav', 'Amoun', ['1g Tab', '625mg Tab', '375mg Tab', '230mg Syrup', '460mg Syrup', '600mg Susp'], 75);
        addLine('Antibiotics', 'Curam', 'Amox/Clav', 'Sandoz', ['1g Tab', '625mg Tab', '156.25mg Syrup', '312.5mg Syrup', '457mg Syrup', '642.9mg Susp'], 79);
        addLine('Antibiotics', 'Megamox', 'Amox/Clav', 'Hikma', ['1g Tab', '625mg Tab', '457mg Syrup', '228mg Syrup'], 65);
        addLine('Antibiotics', 'Deltaclav', 'Amox/Clav', 'Delta Pharma', ['457mg Syrup', '228mg Syrup'], 45);
        addLine('Antibiotics', 'Flumox', 'Amox/Fluclox', 'EIPICO', ['250mg Cap', '500mg Cap', '1g Tab', '500mg Vial', '1g Vial', '250mg Syrup'], 42);
        addLine('Antibiotics', 'Zithromax', 'Azithromycin', 'Pfizer', ['250mg Cap', '500mg Vial', '200mg/5ml Susp', '1200mg Susp'], 90);
        addLine('Antibiotics', 'Zisrocin', 'Azithromycin', 'EIPICO', ['500mg Cap', '200mg/5ml Susp'], 35);
        addLine('Antibiotics', 'Klacid', 'Clarithromycin', 'Abbott', ['250mg Tab', '500mg Tab', '500mg XL Tab', '125mg/5ml Susp', '250mg/5ml Susp'], 110);
        addLine('Antibiotics', 'Ciprobay', 'Ciprofloxacin', 'Bayer', ['250mg Tab', '500mg Tab', '750mg Tab'], 65);
        addLine('Antibiotics', 'Ciprofar', 'Ciprofloxacin', 'Pharco', ['250mg Tab', '500mg Tab', '750mg Tab'], 28);
        addLine('Antibiotics', 'Tavanic', 'Levofloxacin', 'Sanofi', ['500mg Tab', '500mg Vial'], 85);
        addLine('Antibiotics', 'Unibiotic', 'Levofloxacin', 'United', ['500mg Tab', '750mg Tab'], 45);
        addLine('Antibiotics', 'Rocephin', 'Ceftriaxone', 'Roche', ['1g Vial', '500mg Vial'], 120);
        addLine('Antibiotics', 'Cefotax', 'Cefotaxime', 'EIPICO', ['1g Vial', '500mg Vial', '250mg Vial'], 32);
        addLine('Antibiotics', 'Unasyn', 'Ampicillin/Sulbactam', 'Pfizer', ['375mg Tab', '1.5g Vial', '3g Vial', '750mg Vial'], 60);
        addLine('Antibiotics', 'Dalacin C', 'Clindamycin', 'Pfizer', ['150mg Cap', '300mg Cap', '600mg Vial'], 55);
        
        // Analgesics
        addLine('Analgesics', 'Panadol', 'Paracetamol', 'GSK', ['Advance 500mg Tab', 'Extra 500mg Tab', 'Joint 665mg Tab', 'Cold+Flu Day Tab', 'Cold+Flu All in One Tab', 'Sinus Tab'], 25);
        addLine('Analgesics', 'Abimol', 'Paracetamol', 'GSK', ['500mg Tab', 'Extra Tab', '150mg Supp', '300mg Supp'], 18);
        addLine('Analgesics', 'Cetal', 'Paracetamol', 'EIPICO', ['500mg Tab', 'Drops', 'Syrup', '120mg Supp'], 12);
        addLine('Analgesics', 'Cataflam', 'Diclofenac K', 'Novartis', ['25mg Tab', '50mg Tab', '75mg Amp', 'Drops', 'Susp'], 45);
        addLine('Analgesics', 'Voltaren', 'Diclofenac Na', 'Novartis', ['25mg Tab', '50mg Tab', '100mg Tab', '75mg Amp', '100mg Supp', 'Emulgel'], 50);
        addLine('Analgesics', 'Brufen', 'Ibuprofen', 'Abbott', ['200mg Tab', '400mg Tab', '600mg Tab', 'Syrup', 'Granules'], 35);
        addLine('Analgesics', 'Marcofen', 'Ibuprofen', 'Marcyrl', ['400mg Tab', 'SR 800mg Tab'], 22);
        addLine('Analgesics', 'Ketolgin', 'Ketoprofen', 'Amoun', ['25mg Tab', '50mg Cap', '200mg SR Cap', 'Amp', 'Gel'], 28);
        addLine('Analgesics', 'Celebrex', 'Celecoxib', 'Pfizer', ['100mg Cap', '200mg Cap'], 115);
        
        // GI
        addLine('Gastrointestinal', 'Antinal', 'Nifuroxazide', 'Amoun', ['200mg Cap', 'Susp'], 21);
        addLine('Gastrointestinal', 'Streptoquin', 'Diiodohydroxyquinoline', 'CID', ['Tab', 'Susp'], 15);
        addLine('Gastrointestinal', 'Flagyl', 'Metronidazole', 'Sanofi', ['250mg Tab', '500mg Tab', '125mg Susp'], 18);
        addLine('Gastrointestinal', 'Nexium', 'Esomeprazole', 'AstraZeneca', ['20mg Tab', '40mg Tab', '40mg Vial', '10mg Sachet'], 140);
        addLine('Gastrointestinal', 'Controloc', 'Pantoprazole', 'Takeda', ['20mg Tab', '40mg Tab', '40mg Vial'], 90);
        addLine('Gastrointestinal', 'Zurcal', 'Pantoprazole', 'Aug Pharma', ['20mg Tab', '40mg Tab', '40mg Vial'], 55);
        addLine('Gastrointestinal', 'Gast-Reg', 'Trimebutine', 'Amoun', ['100mg Tab', '200mg Tab', 'Amp', 'Susp'], 38);
        addLine('Gastrointestinal', 'Visceralgine', 'Tiemonium', 'Sedico', ['Tab', 'Syrup', 'Amp'], 28);
        addLine('Gastrointestinal', 'Spasmo-Digestin', 'Enzymes', 'EIPICO', ['Tab'], 25);
        addLine('Gastrointestinal', 'Gaviscon', 'Na Alginate', 'Reckitt', ['Susp', 'Advance Susp', 'Sachets'], 180);
        
        // Cardio
        addLine('Cardiovascular', 'Concor', 'Bisoprolol', 'Merck', ['2.5mg Tab', '5mg Tab', '10mg Tab', '5 Plus Tab', '10 Plus Tab'], 55);
        addLine('Cardiovascular', 'Tritace', 'Ramipril', 'Sanofi', ['1.25mg Tab', '2.5mg Tab', '5mg Tab', '10mg Tab', 'Comp Tab'], 48);
        addLine('Cardiovascular', 'Ezaprol', 'Enalapril', 'Multi-Apex', ['5mg Tab', '10mg Tab', '20mg Tab'], 35);
        addLine('Cardiovascular', 'Norvasc', 'Amlodipine', 'Pfizer', ['5mg Tab', '10mg Tab'], 60);
        addLine('Cardiovascular', 'Plavix', 'Clopidogrel', 'Sanofi', ['75mg Tab'], 210);
        addLine('Cardiovascular', 'Lipitor', 'Atorvastatin', 'Pfizer', ['10mg Tab', '20mg Tab', '40mg Tab', '80mg Tab'], 180);
        addLine('Cardiovascular', 'Ator', 'Atorvastatin', 'EIPICO', ['10mg Tab', '20mg Tab', '40mg Tab'], 55);
        addLine('Cardiovascular', 'Crestor', 'Rosuvastatin', 'AstraZeneca', ['5mg Tab', '10mg Tab', '20mg Tab', '40mg Tab'], 190);
        addLine('Cardiovascular', 'Lasix', 'Furosemide', 'Sanofi', ['40mg Tab', 'Amp'], 18);
        addLine('Cardiovascular', 'Aldactone', 'Spironolactone', 'Pfizer', ['25mg Tab', '100mg Tab'], 45);

        // Diabetes
        addLine('Diabetes', 'Glucophage', 'Metformin', 'Merck', ['500mg Tab', '1000mg Tab', 'XR 500mg Tab', 'XR 1000mg Tab'], 35);
        addLine('Diabetes', 'Cidophage', 'Metformin', 'CID', ['500mg Tab', '1000mg Tab', '850mg Tab'], 20);
        addLine('Diabetes', 'Amaryl', 'Glimepiride', 'Sanofi', ['1mg Tab', '2mg Tab', '3mg Tab', '4mg Tab'], 45);
        addLine('Diabetes', 'Diamicron', 'Gliclazide', 'Servier', ['30mg MR Tab', '60mg MR Tab'], 65);
        addLine('Diabetes', 'Januvia', 'Sitagliptin', 'MSD', ['50mg Tab', '100mg Tab'], 220);
        addLine('Diabetes', 'Galvus', 'Vildagliptin', 'Novartis', ['50mg Tab'], 180);
        addLine('Diabetes', 'Lantus', 'Insulin Glargine', 'Sanofi', ['SoloStar Pen', 'Vial'], 350);
        addLine('Diabetes', 'Mixtard 30', 'Biphasic Insulin', 'Novo Nordisk', ['Penfill', 'Vial'], 150);

        // Resp
        addLine('Respiratory', 'Ventolin', 'Salbutamol', 'GSK', ['Inhaler', 'Syrup', '2mg Tab', 'Nebule'], 45);
        addLine('Respiratory', 'Farcolin', 'Salbutamol', 'Pharco', ['Inhaler', 'Syrup', 'Sol'], 22);
        addLine('Respiratory', 'Mucosolvan', 'Ambroxol', 'Sanofi', ['Syrup', 'Tab', 'Drops', 'Cap'], 30);
        addLine('Respiratory', 'Zyrtec', 'Cetirizine', 'GSK', ['10mg Tab', 'Syrup', 'Drops'], 45);
        addLine('Respiratory', 'Claritin', 'Loratadine', 'Bayer', ['10mg Tab', 'Syrup'], 50);
        addLine('Respiratory', 'Telfast', 'Fexofenadine', 'Sanofi', ['120mg Tab', '180mg Tab'], 65);
        addLine('Respiratory', 'Otriwin', 'Xylometazoline', 'GSK', ['Adult Drops', 'Pediatric Drops', 'Adult Spray', 'Menthol Spray'], 35);

        // Vitamins
        addLine('Vitamins', 'Milga', 'Benfotiamine/B6/B12', 'Eva Pharma', ['Tab', 'Advance Tab'], 65);
        addLine('Vitamins', 'Neuroton', 'Vitamin B Complex', 'Amoun', ['Tab', 'Amp'], 42);
        addLine('Vitamins', 'Thiotacid', 'Thioctic Acid', 'Eva Pharma', ['300mg Tab', '600mg Tab', 'Amp'], 75);
        addLine('Vitamins', 'Kerovit', 'Multivitamin', 'Amoun', ['Cap'], 55);
        addLine('Vitamins', 'Sanso D3', 'Vitamin D3', 'Aug Pharma', ['1000IU Tab', '5000IU Tab', '10000IU Tab', 'Drops'], 85);
        addLine('Vitamins', 'C-Retard', 'Vitamin C', 'Hikma', ['500mg Cap'], 28);
        addLine('Vitamins', 'Cevarol', 'Vitamin C', 'Memphis', ['500mg Tab'], 18);

        // --- 2. MATRIX (Generics with Prices) ---
        
        const egyptianFactories = [
            'EIPICO', 'Amoun', 'Pharco', 'Eva Pharma', 'Sedico', 'Marcyrl', 
            'Hikma', 'Sigma', 'Nile', 'Memphis', 'Alexandria', 'Kahira', 
            'CID', 'Mepaco', 'Global Napi', 'Future', 'Utopia', 'Aug Pharma', 
            'Rameda', 'Apex', 'Multi-Apex', 'Mash Premiere', 'Nerhadou', 
            'Grand Pharma', 'Sunny', 'Borg', 'Western', 'Chemipharm', 'Adwia', 
            'Delta Pharma', 'Al Andalous', 'Misr'
        ];

        const matrixData: any = {
            'Antibiotics': [
                { g: 'Amoxicillin', f: ['250mg Cap', '500mg Cap', '125mg Susp', '250mg Susp'], p: 25 },
                { g: 'Doxycycline', f: ['100mg Cap'], p: 20 },
                { g: 'Cephalexin', f: ['250mg Cap', '500mg Cap', '250mg Syrup'], p: 30 },
                { g: 'Levofloxacin', f: ['500mg Tab', '750mg Tab'], p: 45 },
                { g: 'Metronidazole', f: ['250mg Tab', '500mg Tab', '125mg Susp'], p: 15 },
                { g: 'Clindamycin', f: ['150mg Cap', '300mg Cap', '600mg Vial'], p: 35 },
                { g: 'Cefixime', f: ['200mg Cap', '400mg Cap', '100mg Syrup'], p: 55 },
                { g: 'Azithromycin', f: ['250mg Cap', '500mg Tab', 'Susp'], p: 35 },
                { g: 'Ciprofloxacin', f: ['250mg Tab', '500mg Tab', '750mg Tab'], p: 28 },
                { g: 'Ceftriaxone', f: ['500mg Vial', '1g Vial'], p: 40 },
                { g: 'Cefotaxime', f: ['500mg Vial', '1g Vial'], p: 25 },
                { g: 'Gentamicin', f: ['40mg Amp', '80mg Amp'], p: 12 }
            ],
            'Analgesics': [
                { g: 'Paracetamol', f: ['500mg Tab', 'Suppository', 'Syrup'], p: 10 },
                { g: 'Ibuprofen', f: ['200mg Tab', '400mg Tab', '600mg Tab', 'Syrup'], p: 18 },
                { g: 'Diclofenac Sodium', f: ['25mg Tab', '50mg Tab', '75mg Amp', 'Suppository'], p: 22 },
                { g: 'Ketoprofen', f: ['50mg Cap', '100mg Tab', 'Gel'], p: 25 },
                { g: 'Naproxen', f: ['250mg Tab', '500mg Tab'], p: 30 },
                { g: 'Meloxicam', f: ['7.5mg Tab', '15mg Tab', 'Amp'], p: 28 },
                { g: 'Piroxicam', f: ['10mg Cap', '20mg Cap', 'Amp'], p: 18 },
                { g: 'Indomethacin', f: ['25mg Cap', 'Supp'], p: 15 }
            ],
            'Cardiovascular': [
                { g: 'Atenolol', f: ['50mg Tab', '100mg Tab'], p: 18 },
                { g: 'Captopril', f: ['25mg Tab', '50mg Tab'], p: 22 },
                { g: 'Enalapril', f: ['5mg Tab', '10mg Tab', '20mg Tab'], p: 25 },
                { g: 'Lisinopril', f: ['5mg Tab', '10mg Tab', '20mg Tab'], p: 30 },
                { g: 'Losartan', f: ['50mg Tab', '100mg Tab'], p: 40 },
                { g: 'Valsartan', f: ['40mg Tab', '80mg Tab', '160mg Tab'], p: 55 },
                { g: 'Simvastatin', f: ['10mg Tab', '20mg Tab', '40mg Tab'], p: 45 },
                { g: 'Atorvastatin', f: ['10mg Tab', '20mg Tab', '40mg Tab'], p: 60 },
                { g: 'Furosemide', f: ['40mg Tab', 'Amp'], p: 12 },
                { g: 'Spironolactone', f: ['25mg Tab', '100mg Tab'], p: 35 },
                { g: 'Amiodarone', f: ['200mg Tab', 'Amp'], p: 40 },
                { g: 'Digoxin', f: ['0.25mg Tab', 'Amp'], p: 15 }
            ],
            'Gastrointestinal': [
                { g: 'Omeprazole', f: ['20mg Cap', '40mg Cap'], p: 25 },
                { g: 'Pantoprazole', f: ['20mg Tab', '40mg Tab'], p: 35 },
                { g: 'Lansoprazole', f: ['15mg Cap', '30mg Cap'], p: 40 },
                { g: 'Esomeprazole', f: ['20mg Tab', '40mg Tab'], p: 55 },
                { g: 'Domperidone', f: ['10mg Tab', 'Susp'], p: 18 },
                { g: 'Mebeverine', f: ['135mg Tab', '200mg Retard'], p: 32 },
                { g: 'Lactulose', f: ['Syrup'], p: 22 },
                { g: 'Famotidine', f: ['20mg Tab', '40mg Tab'], p: 20 },
                { g: 'Hyoscine Butylbromide', f: ['10mg Tab', 'Amp'], p: 18 }
            ],
            'Respiratory': [
                { g: 'Salbutamol', f: ['2mg Tab', 'Syrup', 'Inhaler'], p: 20 },
                { g: 'Theophylline', f: ['SR 200mg Tab', 'SR 300mg Tab', 'Syrup'], p: 18 },
                { g: 'Acetylcysteine', f: ['200mg Sachet', '600mg Sachet'], p: 45 },
                { g: 'Fexofenadine', f: ['120mg Tab', '180mg Tab'], p: 35 },
                { g: 'Cetirizine', f: ['10mg Tab', 'Syrup', 'Drops'], p: 25 },
                { g: 'Loratadine', f: ['10mg Tab', 'Syrup'], p: 22 },
                { g: 'Chlorpheniramine', f: ['4mg Tab', 'Amp'], p: 8 }
            ],
            'Neurology & Psychiatry': [
                { g: 'Fluoxetine', f: ['20mg Cap'], p: 35 },
                { g: 'Sertraline', f: ['50mg Tab', '100mg Tab'], p: 65 },
                { g: 'Escitalopram', f: ['10mg Tab', '20mg Tab'], p: 75 },
                { g: 'Amitriptyline', f: ['10mg Tab', '25mg Tab'], p: 15 },
                { g: 'Carbamazepine', f: ['200mg Tab', '400mg CR Tab', 'Syrup'], p: 30 },
                { g: 'Gabapentin', f: ['100mg Cap', '300mg Cap', '400mg Cap'], p: 55 },
                { g: 'Pregabalin', f: ['50mg Cap', '75mg Cap', '150mg Cap'], p: 70 },
                { g: 'Olanzapine', f: ['5mg Tab', '10mg Tab'], p: 60 },
                { g: 'Risperidone', f: ['2mg Tab', '4mg Tab'], p: 50 }
            ],
            'Diabetes': [
                { g: 'Metformin', f: ['500mg Tab', '850mg Tab', '1000mg Tab'], p: 25 },
                { g: 'Glimepiride', f: ['1mg Tab', '2mg Tab', '3mg Tab', '4mg Tab'], p: 30 },
                { g: 'Gliclazide', f: ['30mg MR Tab', '60mg MR Tab'], p: 45 },
                { g: 'Pioglitazone', f: ['15mg Tab', '30mg Tab'], p: 55 }
            ],
            'Dermatology': [
                { g: 'Fusidic Acid', f: ['Cream', 'Ointment'], p: 22 },
                { g: 'Betamethasone', f: ['Cream', 'Ointment'], p: 18 },
                { g: 'Miconazole', f: ['Cream', 'Spray'], p: 25 },
                { g: 'Clotrimazole', f: ['Cream', 'Sol'], p: 15 },
                { g: 'Hydrocortisone', f: ['Cream'], p: 12 },
                { g: 'Acyclovir', f: ['Cream'], p: 20 },
                { g: 'Gentamicin', f: ['Cream', 'Ointment'], p: 15 }
            ],
            'Ophthalmology': [
                { g: 'Tobramycin', f: ['Drops', 'Ointment'], p: 25 },
                { g: 'Ofloxacin', f: ['Drops'], p: 28 },
                { g: 'Timolol', f: ['Drops'], p: 22 },
                { g: 'Dorzolamide', f: ['Drops'], p: 45 },
                { g: 'Latanoprost', f: ['Drops'], p: 85 },
                { g: 'Hyaluronic Acid', f: ['Drops'], p: 95 },
                { g: 'Prednisolone', f: ['Drops'], p: 20 },
                { g: 'Ciprofloxacin', f: ['Drops'], p: 25 }
            ],
            'Urology': [
                { g: 'Tamsulosin', f: ['0.4mg Cap'], p: 65 },
                { g: 'Finasteride', f: ['5mg Tab'], p: 45 },
                { g: 'Sildenafil', f: ['50mg Tab', '100mg Tab'], p: 35 },
                { g: 'Tadalafil', f: ['5mg Tab', '20mg Tab'], p: 55 }
            ]
        };

        const publicSector = ['Nile', 'Memphis', 'Alexandria', 'Kahira', 'CID', 'Misr'];
        const majorPrivate = ['EIPICO', 'Pharco', 'Amoun', 'Eva Pharma', 'Sedico'];

        Object.keys(matrixData).forEach(category => {
            const drugs = matrixData[category];
            drugs.forEach((drug: any) => {
                egyptianFactories.forEach(man => {
                    let probability = 0.3; 
                    if (publicSector.includes(man) || majorPrivate.includes(man)) {
                        probability = 0.8;
                    }

                    if (Math.random() < probability) {
                        drug.f.forEach((variant: string, idx: number) => {
                            const parts = variant.split(' ');
                            const form = parts.length > 1 ? parts.pop() || 'Pack' : 'Pack';
                            const conc = parts.join(' ');
                            
                            const fullName = `${drug.g} ${conc} (${man})`;
                            
                            // Variation: Public sector slightly cheaper, Private slightly more expensive
                            let priceMod = publicSector.includes(man) ? 0.8 : 1.1;
                            const finalPrice = Math.round(drug.p * priceMod + (idx * 10));

                            insert(fullName, drug.g, category, form, conc, man, finalPrice);
                        });
                    }
                });
            });
        });

        this.db.exec("COMMIT");
      } catch (e) {
          this.db.exec("ROLLBACK");
          console.error("Bulk insertion error", e);
      }
  }

  private seedData() {
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
    
    this.db.run(`INSERT INTO doctors (name, specialty, fee, schedule, bio, photo, phone, email) VALUES ('Dr. Sarah House', 'Cardiology', 150, '${schedule}', 'Expert cardiologist with 10 years experience.', '', '555-0101', 'drsarah@medicore.com');`);
    
    const docId = this.db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];
    this.db.run(`INSERT INTO users (name, email, password, role, relatedId) VALUES ('Dr. Sarah House', 'sarah@medicore.com', '${ADMIN_HASH}', '${UserRole.DOCTOR}', ${docId});`);

    this.db.run(`INSERT INTO patients (name, phone, dob, gender, history, blood_group, allergies, height, weight) VALUES ('John Doe', '555-0123', '1985-06-15', 'Male', '[]', 'O+', 'Peanuts', 180, 85);`);
    this.db.run(`INSERT INTO patients (name, phone, dob, gender, history, blood_group) VALUES ('Jane Smith', '555-9876', '1990-11-22', 'Female', '[]', 'A+');`);
    
    this.seedEgyptianDrugs();
  }

  exec(sql: string, params: any[] = []) {
    if (!this.initialized) throw new Error("DB not initialized");
    const result = this.db.exec(sql, params);
    this.saveToIndexedDB();
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
          columns.forEach((col: string, i: number) => {
            obj[col] = row[i];
          });
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
      } catch(e) {
          console.warn("Audit log failed", e);
      }
  }

  // Persistence
  private async loadFromIndexedDB(): Promise<ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event: any) => {
        const db = event.target.result;
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(KEY_NAME);

        getRequest.onsuccess = () => {
          resolve(getRequest.result);
        };
        getRequest.onerror = () => {
          resolve(null);
        };
      };

      request.onerror = (event) => reject(event);
    });
  }

  private async saveToIndexedDB() {
    if (!this.db) return;
    const data = this.db.export();
    
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(data, KEY_NAME);
    };
  }

  exportBackup() {
    if(!this.db) return;
    const data = this.db.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medicore_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
    a.click();
  }

  async importBackup(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    this.db = new (this.db.constructor)(new Uint8Array(buffer));
    this.migrate(); // Ensure loaded DB is migrated to latest schema
    this.saveToIndexedDB();
    window.location.reload();
  }
  
  async factoryReset() {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => window.location.reload();
  }
}

export const dbService = new DatabaseService();
