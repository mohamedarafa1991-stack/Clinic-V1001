/**
 * Storage Path Manager
 * 
 * Handles dual-mode storage for MediCore:
 * - Installed Mode: Uses %APPDATA%/MediCore
 * - Portable Mode: Uses executable directory
 * 
 * Detection is automatic based on presence of .portable marker file
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export enum StorageMode {
  INSTALLED = 'installed',
  PORTABLE = 'portable'
}

class StoragePathManager {
  private mode: StorageMode;
  private basePath: string;

  constructor() {
    this.mode = this.detectMode();
    this.basePath = this.resolveBasePath();
    this.ensureDirectories();
  }

  /**
   * Detects if running in portable mode
   * Checks for .portable marker file in executable directory
   */
  private detectMode(): StorageMode {
    try {
      const exeDir = path.dirname(app.getPath('exe'));
      const portableMarker = path.join(exeDir, '.portable');
      
      if (fs.existsSync(portableMarker)) {
        console.log('🔵 Portable Mode Detected');
        return StorageMode.PORTABLE;
      }
    } catch (e) {
      // Fallback to installed mode on error
      console.warn('Error detecting portable mode:', e);
    }
    
    console.log('🔵 Installed Mode Active');
    return StorageMode.INSTALLED;
  }

  /**
   * Resolves the base storage path based on mode
   */
  private resolveBasePath(): string {
    if (this.mode === StorageMode.PORTABLE) {
      // Store data beside executable
      try {
        const exeDir = path.dirname(app.getPath('exe'));
        return path.join(exeDir, 'MedicoreData');
      } catch (e) {
        console.error('Failed to get portable path, falling back to userData:', e);
        return app.getPath('userData');
      }
    }
    
    // Installed mode: use standard AppData location
    return app.getPath('userData');
  }

  /**
   * Ensures all required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      this.basePath,
      path.join(this.basePath, 'backups'),
      path.join(this.basePath, 'logs'),
      path.join(this.basePath, 'temp')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });
  }

  /**
   * Gets the current storage mode
   */
  getMode(): StorageMode {
    return this.mode;
  }

  /**
   * Gets the base storage path
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Gets the encrypted database file path
   */
  getDatabasePath(): string {
    return path.join(this.basePath, 'medicore.enc');
  }

  /**
   * Gets the encryption key file path
   */
  getKeyPath(): string {
    return path.join(this.basePath, 'secure.key');
  }

  /**
   * Gets the backups directory path
   */
  getBackupPath(): string {
    return path.join(this.basePath, 'backups');
  }

  /**
   * Gets the logs directory path
   */
  getLogPath(): string {
    return path.join(this.basePath, 'logs');
  }

  /**
   * Gets the temp directory path
   */
  getTempPath(): string {
    return path.join(this.basePath, 'temp');
  }

  /**
   * Returns info about current storage configuration
   */
  getStorageInfo(): {
    mode: StorageMode;
    basePath: string;
    databasePath: string;
    isWritable: boolean;
  } {
    let isWritable = false;
    try {
      fs.accessSync(this.basePath, fs.constants.W_OK);
      isWritable = true;
    } catch (e) {
      console.error('Storage path not writable:', e);
    }

    return {
      mode: this.mode,
      basePath: this.basePath,
      databasePath: this.getDatabasePath(),
      isWritable
    };
  }
}

export const storageManager = new StoragePathManager();
