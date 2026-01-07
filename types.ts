
export enum UserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  RECEPTIONIST = 'receptionist',
  NURSE = 'nurse',
  BILLING = 'billing'
}

export enum AppointmentStatus {
  SCHEDULED = 'Scheduled',
  CHECKED_IN = 'Checked In',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled'
}

export enum PaymentStatus {
  PENDING = 'Pending',
  PARTIAL = 'Partial',
  PAID = 'Paid'
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  relatedId?: number; // Links to Doctor ID
}

export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  fee: number;
  schedule: string; // JSON string of WorkSchedule
  bio: string;
  photo: string;
  phone?: string;
  email?: string;
}

export interface WorkSchedule {
  [day: string]: {
    isWorking: boolean;
    start: string;
    end: string;
  };
}

export interface DoctorNote {
  id: number;
  doctorId: number;
  text: string;
  type: 'Permanent' | 'Temporary';
  priority: 'Normal' | 'Important';
  expiryDate?: string;
  visibility: 'All' | 'Admin' | 'Medical';
  authorName: string;
  authorRole: string;
  createdAt: string;
}

export interface Patient {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  emergency_contact?: string;
  blood_group?: string;
  allergies?: string;
  chronic_conditions?: string; // New Field
  dob: string;
  gender: string;
  history: string; // JSON string of VisitRecord[]
  height?: number; // in cm
  weight?: number; // in kg
  // Removed Insurance fields from interface usage, though DB might still have columns
}

export interface VisitRecord {
  date: string;
  diagnosis: string;
  treatment: string;
  medications: string;
  // New Vitals
  bp?: string;
  heartRate?: string;
  temperature?: string;
}

export interface Appointment {
  id: number;
  doctorId: number;
  patientId: number;
  date: string;
  time: string;
  status: AppointmentStatus;
  type: string;
  totalFee: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  queueNumber: number;
}

export interface Notification {
  id: number;
  type: string;
  recipient: string;
  message: string;
  date: string;
}

export interface ClinicSettings {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  address: string;
}

export interface Medicine {
  id: number;
  name: string; // Trade Name
  generic: string; // Active Ingredient
  category?: string; // Therapeutic Category
  form: string; // Tablet, Syrup, Injection, etc.
  concentration: string; // 500mg, 1g, etc.
  manufacturer: string;
  // Removed Price
  
  // Legacy Inventory Fields (Optional now)
  stock?: number;
  expiry?: string;
}

export interface Prescription {
  id: number;
  patientId: number;
  doctorId: number;
  date: string;
  items: string; // JSON string of PrescriptionItem[]
  notes: string;
}

export interface PrescriptionItem {
  medicineId: number;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}
