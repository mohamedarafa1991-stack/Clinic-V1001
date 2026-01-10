/**
 * @deprecated This file is deprecated. Use lanSync.ts instead.
 * 
 * The new LANSyncService provides:
 * - Encrypted communication
 * - Conflict resolution strategies
 * - Audit logging
 * - Better error handling
 * 
 * This file is kept for backward compatibility only.
 */

import { dbService } from './db';

interface SyncStats {
  added: number;
  updated: number;
  conflicts: number;
  errors: number;
}

export class SyncService {
  /**
   * Mock implementation of network discovery.
   * In a real Electron app, this would use Bonjour/Zeroconf or a known server IP.
   */
  async discoverPeers(): Promise<string[]> {
    // Return dummy IPs for the UI demo
    return ['192.168.1.105 (Reception)', '192.168.1.108 (Dr. Office)'];
  }

  /**
   * Merges an external dataset (e.g., from a JSON export of another DB) into the local SQL.js DB.
   * Uses 'last_modified' logic if available, otherwise inserts new records.
   */
  async mergeData(externalData: any): Promise<SyncStats> {
    const stats: SyncStats = { added: 0, updated: 0, conflicts: 0, errors: 0 };
    
    // 1. Merge Patients
    if (externalData.patients) {
      externalData.patients.forEach((extPatient: any) => {
        try {
          const local = dbService.query(`SELECT * FROM patients WHERE id = ${extPatient.id}`);
          if (local.length === 0) {
            // New Record - Insert with preserve ID if possible, or auto-inc
            // For simplicity in this demo, we let auto-inc handle it but map old IDs would be better
            // Ideally, we use UUIDs for syncable rows. Here we check by Name/Phone to avoid dupes.
            const dupeCheck = dbService.query(`SELECT id FROM patients WHERE phone = '${extPatient.phone}'`);
            if (dupeCheck.length === 0) {
               dbService.exec(
                 `INSERT INTO patients (name, phone, email, address, emergency_contact, blood_group, allergies, chronic_conditions, dob, gender, history, height, weight) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                 [extPatient.name, extPatient.phone, extPatient.email, extPatient.address, extPatient.emergency_contact, extPatient.blood_group, extPatient.allergies, extPatient.chronic_conditions, extPatient.dob, extPatient.gender, extPatient.history, extPatient.height, extPatient.weight]
               );
               stats.added++;
            }
          } else {
            // Update logic would go here (compare timestamps if we had them)
            // Assuming external is newer for this manual sync
            stats.conflicts++; // Marking potential conflict
          }
        } catch (e) {
          stats.errors++;
        }
      });
    }

    // 2. Merge Appointments
    // ... Similar logic for appointments ...

    return stats;
  }

  /**
   * Triggers a manual export -> transfer -> import simulation
   */
  async syncWithPeer(peerId: string): Promise<SyncStats> {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 2000));
    
    // Simulate receiving data
    const mockData = {
      patients: [
        { name: 'Synced Patient A', phone: '555-9999', dob: '1990-01-01', gender: 'Female', history: '[]' }
      ]
    };

    return this.mergeData(mockData);
  }
}

export const syncService = new SyncService();
