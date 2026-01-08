
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
  PAID = 'Paid',
  FREE = 'Free'
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  relatedId?: number; // Links to Doctor/Nurse ID
}

export interface Specialty {
  id: number;
  name: string;
  category: string;
}

export interface DoctorTitle {
  id: number;
  name: string;
}

export interface Doctor {
  id: number;
  name: string;
  title?: string;
  licenseId?: string;
  specialty: string;
  fee: number;
  commissionRate?: number; // Percentage 0-100
  schedule: string;
  bio: string;
  photo: string;
  phone?: string;
  email?: string;
  status?: 'Active' | 'On Leave' | 'Inactive';
}

export interface Nurse {
  id: number;
  name: string;
  phone: string;
  email: string;
  commissionRate?: number; // Percentage 0-100
  status: 'Active' | 'Inactive';
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
  type: 'Permanent' | 'Temporary' | 'Instruction';
  priority: 'Normal' | 'Important' | 'Critical';
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
  chronic_conditions?: string;
  dob: string;
  gender: string;
  history: string;
  height?: number;
  weight?: number;
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
  discount: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  queueNumber: number;
  paymentNotes?: string;
}

export interface VisitType {
  id: number;
  name: string;
  defaultFee: number;
  isFollowUp: number;
  followUpDays: number;
}

export interface Service {
  id: number;
  name: string;
  category: 'Procedure' | 'Diagnostic' | 'Nursing' | 'Other';
  basePrice: number;
  isActive: number;
  assignableTo: 'Doctor' | 'Nurse' | 'Both'; // Who can perform this?
}

export interface AppointmentService {
  id: number;
  appointmentId: number;
  serviceId: number;
  priceSnapshot: number;
  performedBy?: number; // User ID of performer
  performerRole?: string; // 'Doctor' or 'Nurse'
}

export interface Notification {
  id: number;
  type: string;
  recipient: string;
  message: string;
  date: string;
}

export interface Prescription {
  id: number;
  patientId: number;
  doctorId: number;
  date: string;
  items: string;
  notes: string;
}

export interface PrescriptionItem {
  medicineId: number;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}
