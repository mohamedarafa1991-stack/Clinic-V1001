# MediCore Clinic Management System

<div align="center">

**Production-Ready, Offline-First Clinic Management System**

[![Windows](https://img.shields.io/badge/Windows-10%2F11-blue.svg)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](package.json)

</div>

## 🏥 Overview

MediCore is a comprehensive, offline-first clinic management system designed for medical facilities requiring secure, reliable, and feature-rich software. Built with medical-grade stability and compliance in mind.

### ✨ Key Features

- **🔒 Offline-First**: Full functionality without internet connectivity
- **📱 Dual-Mode Storage**: Installed (AppData) or Portable (USB-ready)
- **🌐 Optional LAN Sync**: Secure, encrypted multi-PC synchronization
- **🖨️ Native Windows Printing**: Prescriptions, invoices, reports, queue tickets
- **🌍 Full Bilingual**: Arabic (RTL) and English (LTR) with complete translations
- **🎨 Adaptive Theming**: Light/Dark modes + seasonal decorations
- **🔐 Role-Based Access**: Admin, Doctor, Nurse, Receptionist, Billing
- **💾 Encrypted Database**: AES-256 encryption for sensitive medical data
- **📊 Advanced Analytics**: Financial tracking, performance metrics, trends
- **⚡ Modern Stack**: React 19, TypeScript, Electron, SQL.js

---

## 📋 Table of Contents

- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Deployment Modes](#deployment-modes)
- [Features Overview](#features-overview)
- [Architecture](#architecture)
- [Security](#security)
- [Development](#development)
- [Building](#building)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## 💻 System Requirements

### Minimum
- **OS**: Windows 10 (64-bit)
- **RAM**: 4GB
- **Storage**: 500MB free space
- **Display**: 1280x720 resolution

### Recommended
- **OS**: Windows 11 (64-bit)
- **RAM**: 8GB+
- **Storage**: 2GB free space
- **Display**: 1920x1080 resolution
- **Network**: For LAN sync (optional)

---

## 📦 Installation

### Option 1: Installed Mode (Recommended)

1. Download `MediCore-Setup-1.0.0.exe`
2. Run the installer
3. Follow installation wizard
4. Data stored in: `%APPDATA%/MediCore`
5. Launch from Desktop shortcut or Start Menu

### Option 2: Portable Mode (USB/Network Drives)

1. Download `MediCore-1.0.0-portable.exe`
2. Extract to desired location (USB drive, network share, etc.)
3. Create `.portable` marker file in the same directory
4. Run `MediCore.exe`
5. Data stored beside executable in `MedicoreData/` folder

**Creating .portable marker:**
```cmd
cd path\to\MediCore
type nul > .portable
```

### First Launch

Default credentials:
- **Email**: `admin@medicore.com`
- **Password**: `Admin123!`

⚠️ **Change default password immediately after first login!**

---

## 🔄 Deployment Modes

### 1. Standalone Mode (Default)
- No network synchronization
- Fully independent operation
- Ideal for single-PC clinics

### 2. LAN Server Mode
- Broadcasts availability on local network
- Accepts sync requests from clients
- One server per clinic network recommended

### 3. LAN Client Mode
- Connects to LAN Server for data sync
- Encrypted bidirectional sync
- Configurable conflict resolution

**Enabling LAN Sync:**
1. Go to **Settings** > **Network Sync**
2. Choose mode (Server or Client)
3. Configure encryption key (shared across devices)
4. Enable sync and select conflict strategy

---

## 🎯 Features Overview

### Dashboard
- Live patient queues
- Active doctor status
- Today's statistics
- Revenue tracking
- System alerts
- Customizable widgets

### Appointments
- Queue management
- Visit types (Consultation, Follow-up, Emergency)
- Payment processing (Full, Partial, Pending)
- Multi-service bookings
- Conflict detection
- Print queue tickets

### Patients (EMR)
- Complete medical records
- Demographics & biometrics
- Clinical history timeline
- Vitals tracking (BP, HR, BMI trends)
- Document uploads
- Allergy & condition management
- Quick appointment booking

### Doctors
- Professional profiles
- Editable titles & specialties
- Schedule configuration
- Internal notes system with visibility controls
- Document management
- Performance metrics
- Revenue tracking

### Nurses
- Staff profiles
- Service assignments
- Performance tracking
- Revenue participation
- Notes system

### Services & Pricing
- Consultation types
- Follow-up rules
- Procedures (IUD, dressing, InBody, etc.)
- Provider-specific pricing
- Commission rules
- Category management

### Prescriptions
- Template system
- Medication database
- Dosage & frequency management
- Professional PDF export
- Print with clinic branding
- RTL/LTR layout support

### Finances
- Revenue dashboard
- Commission calculations (doctor & nurse)
- Payment tracking
- Discount management
- Pending balances
- Export reports (PDF, Excel, CSV)

### Settings
- **Appearance**: Theme, colors, seasonal decorations
- **Language**: English/Arabic switching
- **Users & Roles**: Permission management
- **Clinical Metadata**: Specialties, titles, visit types
- **Keyboard Shortcuts**: Customizable hotkeys
- **Backup & Restore**: Encrypted exports/imports
- **LAN Sync**: Network configuration
- **System Info**: Version, storage mode

### Queue Display
- Waiting room TV screen
- Real-time queue updates
- Multi-language support
- Large, readable text

---

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React 19 (with Suspense & lazy loading)
- TypeScript (strict mode)
- Tailwind CSS (via CDN)
- Lucide React (icons)
- Recharts (analytics)
- React Router (HashRouter for Electron)

**Backend:**
- SQL.js (in-memory SQLite)
- IndexedDB (browser persistence)
- Electron (desktop wrapper)

**Security:**
- AES-256-CTR encryption
- bcrypt password hashing
- PBKDF2 key derivation

**Build Tools:**
- Vite (bundler)
- TypeScript Compiler
- Electron Builder (packaging)

### Project Structure

```
medicore-clinic-ms/
├── src/
│   └── App.tsx                  # Main app entry
├── components/
│   ├── Layout.tsx               # Main layout wrapper
│   ├── ThemeDecorator.tsx       # Seasonal decorations
│   ├── FileDropzone.tsx         # File upload handler
│   ├── SpecialtySelect.tsx      # Specialty picker
│   ├── ResourceSelect.tsx       # Resource picker
│   └── ui/
│       └── Select.tsx           # Custom select component
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Appointments.tsx
│   ├── Patients.tsx
│   ├── Doctors.tsx
│   ├── Nurses.tsx
│   ├── Services.tsx
│   ├── Prescriptions.tsx
│   ├── Finances.tsx
│   ├── Notifications.tsx
│   ├── Settings.tsx
│   └── QueueDisplay.tsx
├── contexts/
│   ├── AuthContext.tsx          # Authentication state
│   ├── LanguageContext.tsx      # i18n state
│   ├── ThemeContext.tsx         # Theme state
│   └── ShortcutContext.tsx      # Keyboard shortcuts
├── services/
│   ├── db.ts                    # Database service
│   ├── lanSync.ts               # LAN synchronization
│   ├── printing.ts              # Windows printing
│   ├── designSystem.ts          # UI design tokens
│   ├── themeConfig.ts           # Theme configuration
│   ├── broadcast.ts             # Cross-tab communication
│   └── sync.ts                  # Legacy sync (deprecated)
├── electron/
│   ├── main.ts                  # Electron main process
│   ├── preload.ts               # Preload script (IPC bridge)
│   └── storage.ts               # Storage path manager
├── utils/
│   ├── translations.ts          # i18n strings
│   └── security.ts              # Crypto utilities
├── types/
│   └── enhancements.ts          # TypeScript definitions
└── config/
    └── featureFlags.ts          # Feature toggles
```

### Database Schema

**Core Tables:**
- `users` - System users with roles
- `doctors` - Doctor profiles & schedules
- `nurses` - Nurse profiles
- `patients` - Patient demographics & medical info
- `appointments` - Visit bookings & payments
- `prescriptions` - Rx records
- `services` - Billable procedures
- `service_pricing` - Provider-specific pricing
- `appointment_services` - Services per visit
- `specialties` - Medical specialties
- `visit_types` - Consultation types
- `doctor_notes` - Internal notes
- `nurse_notes` - Nurse notes
- `doctor_documents` - Uploaded files
- `patient_documents` - Patient files
- `audit_logs` - System audit trail
- `settings` - Key-value configuration

---

## 🔐 Security

### Data Protection
- **AES-256 Encryption**: Database encrypted at rest (Electron mode)
- **bcrypt Hashing**: Password hashing with salt
- **PBKDF2**: Key derivation for encryption keys
- **Audit Logging**: All critical actions logged

### Access Control
- **Role-Based Permissions**: 5-tier role system
- **Session Management**: Auto-logout on inactivity
- **Protected Routes**: Client-side route guards

### Network Security (LAN Sync)
- **Encrypted Transport**: AES-256-CTR for sync data
- **No Silent Writes**: All changes require explicit approval
- **Conflict Resolution**: User-configurable strategies
- **Audit Trail**: Complete sync history

---

## 🛠️ Development

### Prerequisites
- Node.js 18+ 
- npm 9+
- Git

### Setup

```bash
# Clone repository
git clone <repository-url>
cd medicore-clinic-ms

# Install dependencies
npm install

# Run development server (web mode)
npm run dev

# Run in Electron dev mode
npm run electron:dev
```

### Development URLs
- **Web**: http://localhost:5173
- **Electron**: Launches automatically

### Environment Variables
Create `.env.local`:
```
VITE_API_URL=http://localhost:3000  # If using external API
VITE_ENABLE_DEV_TOOLS=true
```

---

## 📦 Building

### Web Build
```bash
npm run build
# Output: dist/
```

### Windows Installer
```bash
npm run electron:build:win
# Output: dist/MediCore-Setup-1.0.0.exe
```

### Portable Version
```bash
npm run electron:build:portable
# Output: dist/MediCore-1.0.0-portable.exe
```

### All Platforms
```bash
npm run dist
```

---

## ⚙️ Configuration

### Clinic Branding
1. Go to **Settings** > **Appearance**
2. Upload clinic logo
3. Set primary/secondary colors
4. Configure clinic name, address, phone

### User Management
1. Go to **Settings** > **Users & Roles**
2. Add user with email, name, role
3. Link to doctor/nurse profile (optional)
4. Assign permissions

### LAN Sync Setup (Multi-PC Clinic)
1. **On Server PC:**
   - Settings > Network Sync
   - Mode: LAN Server
   - Enable sync
   - Copy encryption key

2. **On Client PCs:**
   - Settings > Network Sync
   - Mode: LAN Client
   - Paste encryption key
   - Enter server address
   - Enable sync

3. **Sync Manually:**
   - Click "Discover Peers"
   - Select peer
   - Click "Sync Now"
   - Review conflicts (if any)

### Keyboard Shortcuts
Customizable in **Settings** > **Shortcuts**

Default shortcuts:
- `Ctrl+N` - New appointment
- `Ctrl+P` - New patient
- `Ctrl+S` - Save
- `Ctrl+F` - Search
- `Esc` - Close modal

---

## 🐛 Troubleshooting

### Database Not Loading
**Symptom**: Stuck on "Loading MediCore..."

**Solutions:**
1. Check storage path permissions
2. Delete corrupted DB: `%APPDATA%/MediCore/medicore.enc`
3. Restore from backup

### Portable Mode Not Working
**Symptom**: Data not saved beside executable

**Solutions:**
1. Verify `.portable` file exists
2. Check folder write permissions
3. Run as Administrator (if on network drive)

### LAN Sync Fails
**Symptom**: "Sync Failed" error

**Solutions:**
1. Verify encryption keys match
2. Check firewall allows port 8899
3. Ensure both PCs on same network
4. Disable VPN temporarily

### Printing Not Working
**Symptom**: PDF generated but won't print

**Solutions:**
1. Check default printer is set
2. Update printer drivers
3. Try "Print Preview" first
4. Check printer queue for errors

### RTL Layout Issues
**Symptom**: Arabic text misaligned

**Solutions:**
1. Switch language from Settings
2. Refresh page (Ctrl+R)
3. Clear browser cache

---

## 📄 License

Proprietary software. All rights reserved.

© 2024 MediCore. Unauthorized copying or distribution prohibited.

---

## 🤝 Support

For technical support, feature requests, or bug reports:

- **Email**: support@medicore.com
- **Docs**: https://docs.medicore.com
- **Issue Tracker**: [Internal only]

---

## 📝 Changelog

### Version 1.0.0 (2024-01-XX)
- ✨ Initial production release
- 🔒 Dual-mode storage (Installed/Portable)
- 🌐 Optional LAN sync with encryption
- 🖨️ Native Windows printing
- 🌍 Full Arabic/English bilingual support
- 🎨 Unified design system
- 💾 AES-256 database encryption
- 📊 Advanced financial analytics
- 🏥 Complete EMR functionality
- ⚡ Performance optimizations

---

## 🙏 Acknowledgments

Built with:
- React, TypeScript, Electron
- SQL.js, Recharts, Tailwind CSS
- Lucide React, jsPDF, date-fns

---

**Made with ❤️ for healthcare professionals**
