# MediCore Architecture Documentation

This document provides a deep dive into the architectural decisions, patterns, and structure of the MediCore Clinic Management System.

## Table of Contents
- [Overview](#overview)
- [System Design](#system-design)
- [Core Services](#core-services)
- [Data Flow](#data-flow)
- [Storage Architecture](#storage-architecture)
- [Security Model](#security-model)
- [Performance Optimizations](#performance-optimizations)
- [Extension Points](#extension-points)

---

## Overview

MediCore is built as an **offline-first**, **desktop-native** clinic management system with these architectural principles:

1. **Data Sovereignty**: All data stays on local devices
2. **Zero Dependencies**: Works completely offline
3. **Optional Sync**: LAN synchronization when needed
4. **Medical-Grade Security**: Encryption at rest and in transit
5. **User Experience First**: Instant responses, no loading spinners
6. **Progressive Enhancement**: Degrades gracefully in constrained environments

## System Design

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Electron Shell                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │              React SPA (Renderer)                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │  Pages   │  │Components│  │   Contexts       │ │  │
│  │  │          │  │          │  │  (State Mgmt)    │ │  │
│  │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │  │
│  │       └─────────────┴────────────────┬─┘           │  │
│  │                                      │             │  │
│  │  ┌───────────────────────────────────▼──────────┐  │  │
│  │  │           Service Layer                     │  │  │
│  │  │  • dbService    • printingService          │  │  │
│  │  │  • lanSyncService • designSystem           │  │  │
│  │  │  • broadcastService                        │  │  │
│  │  └───────────────────┬────────────────────────┘  │  │
│  │                      │                            │  │
│  │  ┌───────────────────▼────────────────────────┐  │  │
│  │  │         Storage & Persistence             │  │  │
│  │  │  • SQL.js (in-memory SQLite)              │  │  │
│  │  │  • IndexedDB (web persistence)            │  │  │
│  │  └───────────────────┬────────────────────────┘  │  │
│  └────────────────────────┼─────────────────────────┘  │
│                           │ IPC Bridge                  │
│  ┌────────────────────────▼─────────────────────────┐  │
│  │              Main Process                        │  │
│  │  • File System I/O                               │  │
│  │  • AES-256 Encryption/Decryption                 │  │
│  │  • Native Printing                               │  │
│  │  • Storage Path Management (Portable/Installed)  │  │
│  │  • Window Management & Tray                      │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌───────────┐       ┌──────────┐        ┌──────────┐
    │  Local    │       │ Network  │        │  Windows │
    │   Disk    │       │ Printers │        │   APIs   │
    └───────────┘       └──────────┘        └──────────┘
```

### Technology Stack Decisions

**React 19**: Latest features (Suspense, automatic batching, improved error boundaries)
**TypeScript**: Type safety critical for medical data
**Vite**: Fast dev server, optimized production builds
**Electron**: Native desktop capabilities (printing, file system, encryption)
**SQL.js**: Full SQL capabilities without server dependency
**Tailwind CSS**: Rapid UI development, consistent design tokens

---

## Core Services

### 1. Database Service (`services/db.ts`)

**Purpose**: Central data access layer with encryption, migrations, and audit logging.

**Key Features:**
- In-memory SQLite via SQL.js
- Auto-migration system with version tracking
- Audit trail for all critical operations
- Graceful error handling (never crashes UI)
- Support for transactions (implicit via batch operations)

**Schema Version Management:**
```typescript
const CURRENT_SCHEMA_VERSION = 36;

migrate() {
  let version = this.db.exec("PRAGMA user_version")[0].values[0][0];
  
  if (version < 36) {
    // Apply migration 36
    this.db.run(`CREATE TABLE IF NOT EXISTS clinical_alerts ...`);
  }
  
  this.db.run(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
}
```

**Usage Pattern:**
```typescript
// Read operations
const patients = dbService.query("SELECT * FROM patients WHERE status = ?", ['Active']);

// Write operations
dbService.exec("INSERT INTO patients (...) VALUES (...)", [values]);

// Audit logging
dbService.logAudit(userId, 'UPDATE_PATIENT', `Modified patient #${patientId}`);
```

### 2. Storage Manager (`electron/storage.ts`)

**Purpose**: Handles dual-mode storage (installed vs portable).

**Detection Logic:**
- Checks for `.portable` marker file in executable directory
- Falls back to `app.getPath('userData')` if marker absent
- Creates required subdirectories on init

**Paths Provided:**
- Database: `medicore.enc`
- Encryption key: `secure.key`
- Backups: `backups/`
- Logs: `logs/`
- Temp files: `temp/`

### 3. LAN Sync Service (`services/lanSync.ts`)

**Purpose**: Optional encrypted synchronization between clinic PCs.

**Modes:**
- **Standalone** (default): No sync
- **LAN Server**: Broadcasts availability, accepts sync requests
- **LAN Client**: Connects to server for sync

**Conflict Resolution Strategies:**
1. **Local Wins**: Keep local changes, discard remote
2. **Remote Wins**: Accept remote changes, overwrite local
3. **Latest Timestamp**: Compare timestamps, keep newer
4. **Manual Review**: Store conflicts for admin review

**Security:**
- AES-256-CTR encryption for all network traffic
- Shared encryption key required (manual setup)
- Audit log for every sync operation
- No silent overwrites (explicit approval required)

### 4. Printing Service (`services/printing.ts`)

**Purpose**: Native Windows printing with RTL support.

**Capabilities:**
- Generate PDF documents (prescriptions, invoices, tickets, reports)
- Print silently or with preview
- Support RTL (Arabic) layouts
- Embed clinic branding (logo, colors, contact info)

**Document Types:**
- **Prescriptions**: Rx symbol, medication list, doctor signature
- **Invoices**: Itemized billing, payment status, totals
- **Queue Tickets**: Large queue number, patient/doctor info
- **Reports**: Financial summaries, patient lists

### 5. Design System (`services/designSystem.ts`)

**Purpose**: Unified theme tokens and component styles.

**Exports:**
- Color palettes (light/dark modes)
- Spacing scale
- Typography system
- Shadow definitions
- Border radius values
- Component class builders

**Usage:**
```typescript
import { buildButtonClasses } from '../services/designSystem';

<button className={buildButtonClasses('primary')}>Save</button>
```

---

## Data Flow

### User Action → Database Update

```
1. User clicks "Save Patient"
2. Component calls handleSave()
3. Form data validated
4. dbService.exec() called with parameterized query
5. SQL.js updates in-memory database
6. dbService.saveDatabase() exports binary
7. Electron saves encrypted binary to disk
8. IndexedDB updated (web mode fallback)
9. broadcastService notifies other tabs
10. UI updates with new data
11. Audit log created
```

### Page Load → Data Display

```
1. Component mounts
2. useEffect triggers data fetch
3. dbService.query() executes SQL
4. Results mapped to TypeScript interfaces
5. State updated (useState)
6. React re-renders with data
7. Loading spinner hidden
```

### Cross-Tab Synchronization

```
1. Tab A updates database
2. dbService.saveDatabase() called
3. broadcastService.notify('db-update') sent
4. Tab B receives message
5. Tab B dispatches 'external-db-change' event
6. Tab B components refresh data
```

---

## Storage Architecture

### Dual-Mode Storage

**Installed Mode:**
```
C:\Users\{username}\AppData\Roaming\MediCore\
├── medicore.enc         (encrypted database)
├── secure.key           (AES-256 key)
├── backups\
│   ├── medicore_backup_2024-01-10.sqlite
│   └── ...
├── logs\
│   └── app.log
└── temp\
```

**Portable Mode:**
```
E:\MedicorePortable\     (USB drive)
├── MediCore.exe
├── .portable            (marker file)
├── MedicoreData\
│   ├── medicore.enc
│   ├── secure.key
│   ├── backups\
│   ├── logs\
│   └── temp\
└── resources\
```

### Encryption at Rest

**Algorithm**: AES-256-CTR
**Key Storage**: Separate file (`secure.key`)
**Key Generation**: `crypto.randomBytes(32)` on first launch
**IV**: Random 16 bytes prepended to ciphertext

**Encryption Flow:**
```typescript
1. Export database as Uint8Array
2. Generate random IV
3. Create cipher with key + IV
4. Encrypt data
5. Prepend IV to encrypted data
6. Write to disk
```

**Decryption Flow:**
```typescript
1. Read file from disk
2. Extract IV (first 16 bytes)
3. Extract ciphertext (remaining bytes)
4. Create decipher with key + IV
5. Decrypt data
6. Load into SQL.js
```

### Backup Strategy

**Automatic Backups:**
- Triggered on every DB write (via saveDatabase())
- Encrypted copy stored in `backups/`
- Filename includes date (YYYY-MM-DD format)

**Manual Backups:**
- User-initiated via Settings > Backup & Restore
- Exports unencrypted `.sqlite` file
- Can be re-imported on any device

**Import Process:**
1. User selects `.sqlite` file
2. File loaded into memory
3. SQL.js creates new database instance
4. Migration applied (if schema outdated)
5. Saved to disk (encrypted)
6. Page reloaded to reflect changes

---

## Security Model

### Authentication

**Password Hashing:**
- Algorithm: bcrypt
- Work factor: 10 rounds
- Salt: Automatically generated per password

**Session Management:**
- Stored in React Context (AuthContext)
- No persistence (logout on close)
- Role-based permissions enforced client-side

**Default Credentials:**
- Email: `admin@medicore.com`
- Password: `Admin123!` (hashed as `ADMIN_HASH`)
- ⚠️ Must be changed on first login

### Authorization

**Role Hierarchy:**
```
ADMIN > DOCTOR > NURSE > RECEPTIONIST > BILLING
```

**Permission Matrix:**
| Feature | Admin | Doctor | Nurse | Receptionist | Billing |
|---------|-------|--------|-------|--------------|---------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Appointments | ✅ | ✅ | ✅ | ✅ | ❌ |
| Patients | ✅ | ✅ | ✅ | ✅ | ❌ |
| Doctors | ✅ | ❌ | ❌ | ✅ | ❌ |
| Nurses | ✅ | ❌ | ❌ | ✅ | ❌ |
| Services | ✅ | ❌ | ❌ | ✅ | ❌ |
| Prescriptions | ✅ | ✅ | ✅ | ❌ | ❌ |
| Finances | ✅ | ❌ | ❌ | ❌ | ✅ |
| Settings | ✅ | ❌ | ❌ | ❌ | ❌ |

**Enforcement:**
```tsx
<Route path="settings" element={
  <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
    <Settings />
  </ProtectedRoute>
} />
```

### Audit Logging

**Logged Actions:**
- User login/logout
- Patient record creation/modification
- Prescription issuance
- Payment processing
- Settings changes
- LAN sync operations
- Backup/restore operations

**Audit Log Schema:**
```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  userId INTEGER,
  action TEXT,
  details TEXT,
  timestamp TEXT
);
```

---

## Performance Optimizations

### React Optimizations

**Lazy Loading:**
```typescript
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
```
- Splits code into chunks
- Loads pages on-demand
- Reduces initial bundle size

**Memoization:**
```typescript
const filteredPatients = useMemo(() => 
  patients.filter(p => p.name.includes(search)),
  [patients, search]
);
```
- Prevents unnecessary recalculations
- Used for expensive operations (filtering, sorting)

**Virtual Scrolling:**
```typescript
import { FixedSizeList } from 'react-window';
```
- Renders only visible items
- Handles 10,000+ records smoothly

### Database Optimizations

**Indexed Columns:**
- `patients.phone` (for search)
- `appointments.doctorId` (for doctor schedule)
- `appointments.date` (for calendar views)
- `prescriptions.patientId` (for patient history)

**Query Patterns:**
```typescript
// Good: Parameterized query
dbService.query("SELECT * FROM patients WHERE id = ?", [patientId]);

// Bad: String interpolation (SQL injection risk)
dbService.query(`SELECT * FROM patients WHERE id = ${patientId}`);
```

**Batch Operations:**
```typescript
// Instead of 100 individual inserts:
for (const patient of patients) {
  dbService.exec("INSERT INTO patients ...", [patient]);
}

// Use transaction:
dbService.exec("BEGIN TRANSACTION");
for (const patient of patients) {
  dbService.exec("INSERT INTO patients ...", [patient]);
}
dbService.exec("COMMIT");
```

### Bundle Optimization

**Vite Tree Shaking:**
- Removes unused code
- Only includes imported functions
- Reduces final bundle size

**CDN Assets:**
- Tailwind CSS loaded from CDN
- SQL.js loaded from CDN
- Reduces bundle size by ~500KB

**Code Splitting:**
- Pages split into separate chunks
- Routes lazy-loaded
- Common dependencies in shared chunk

---

## Extension Points

### Adding New Features

**1. New Page:**
```typescript
// 1. Create pages/NewFeature.tsx
export default function NewFeature() { ... }

// 2. Add route in App.tsx
const NewFeature = React.lazy(() => import('./pages/NewFeature'));
<Route path="new-feature" element={<NewFeature />} />

// 3. Add translations in utils/translations.ts
export const translations = {
  en: { new_feature: "New Feature", ... },
  ar: { new_feature: "ميزة جديدة", ... }
};

// 4. Add navigation link in components/Layout.tsx
<NavLink to="/new-feature">{t('new_feature')}</NavLink>
```

**2. New Service:**
```typescript
// 1. Create services/newService.ts
class NewService {
  async doSomething() { ... }
}
export const newService = new NewService();

// 2. Use in components
import { newService } from '../services/newService';
const result = await newService.doSomething();
```

**3. New Database Table:**
```typescript
// 1. Increment schema version in services/db.ts
const CURRENT_SCHEMA_VERSION = 37;

// 2. Add migration
if (version < 37) {
  this.db.run(`
    CREATE TABLE IF NOT EXISTS new_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      value TEXT
    )
  `);
}

// 3. Update TypeScript types in types.ts
export interface NewTable {
  id: number;
  name: string;
  value: string;
}
```

### Customization Points

**Theme Customization:**
- Modify `services/themeConfig.ts` for new seasonal themes
- Add colors to `services/designSystem.ts`
- Update CSS custom properties in `index.html`

**Translation Expansion:**
- Add new language in `utils/translations.ts`
- Update `Language` type in contexts
- Test RTL support if applicable

**Role Customization:**
- Add new role in `types.ts` enum
- Update permission checks in routes
- Add role card in Settings page

---

## Future Enhancements

**Planned Features:**
- [ ] Multi-clinic support (enterprise edition)
- [ ] Cloud backup integration (optional)
- [ ] Mobile companion app (read-only)
- [ ] Lab integration (HL7/FHIR)
- [ ] WhatsApp appointment reminders
- [ ] Voice dictation for notes
- [ ] AI-powered diagnosis suggestions
- [ ] Inventory management
- [ ] Pharmacy integration

**Technical Debt:**
- Migrate from HashRouter to BrowserRouter (Electron routing)
- Add comprehensive unit tests
- Implement E2E tests (Playwright)
- Add performance monitoring
- Optimize database indexes
- Implement incremental backups

---

**Last Updated**: 2024-01-10
**Version**: 1.0.0
