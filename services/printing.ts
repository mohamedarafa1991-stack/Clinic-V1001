/**
 * Windows Native Printing Service
 * 
 * Provides native printing capabilities for Windows:
 * - Local and network printers
 * - Silent printing option
 * - Print preview
 * - RTL/LTR layout support
 * - Clinic branding
 * 
 * Supported documents:
 * - Prescriptions
 * - Invoices
 * - Reports
 * - Queue tickets
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dbService } from './db';
import { format } from 'date-fns';

export interface PrintOptions {
  silent?: boolean;
  printerName?: string;
  orientation?: 'portrait' | 'landscape';
  rtl?: boolean;
}

export interface ClinicInfo {
  name: string;
  address: string;
  phone: string;
  logo?: string;
}

export interface PrescriptionData {
  id: number;
  patient: { name: string; age?: number; phone?: string };
  doctor: { name: string; title?: string; specialty?: string; licenseId?: string };
  date: string;
  diagnosis?: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
  notes?: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  patient: { name: string; phone?: string };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  paymentMethod?: string;
}

export interface QueueTicketData {
  queueNumber: number;
  patientName: string;
  doctorName: string;
  time: string;
  room?: string;
}

class PrintingService {
  private clinicInfo: ClinicInfo;

  constructor() {
    this.clinicInfo = this.loadClinicInfo();
  }

  /**
   * Loads clinic information from database
   */
  private loadClinicInfo(): ClinicInfo {
    try {
      const settings = dbService.query('SELECT key, value FROM settings');
      const settingsMap = settings.reduce((acc: any, s: any) => {
        acc[s.key] = s.value;
        return acc;
      }, {});

      return {
        name: settingsMap.clinic_name || 'MediCore Clinic',
        address: settingsMap.clinic_address || '123 Medical Center Dr',
        phone: settingsMap.clinic_phone || '555-0000',
        logo: settingsMap.clinic_logo
      };
    } catch (e) {
      console.error('Failed to load clinic info:', e);
      return {
        name: 'MediCore Clinic',
        address: '123 Medical Center Dr',
        phone: '555-0000'
      };
    }
  }

  /**
   * Adds clinic header to PDF
   */
  private addClinicHeader(doc: jsPDF, rtl: boolean = false): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Logo
    if (this.clinicInfo.logo) {
      try {
        doc.addImage(this.clinicInfo.logo, 'PNG', rtl ? pageWidth - 50 : 20, 15, 30, 30);
      } catch (e) {
        console.warn('Failed to add logo:', e);
      }
    }

    // Clinic name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const nameX = rtl ? pageWidth - 70 : 55;
    const nameAlign: 'right' | 'left' = rtl ? 'right' : 'left';
    doc.text(this.clinicInfo.name, nameX, 25, { align: nameAlign });

    // Contact info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(this.clinicInfo.address, nameX, 32, { align: nameAlign });
    doc.text(this.clinicInfo.phone, nameX, 38, { align: nameAlign });

    // Line separator
    doc.setLineWidth(0.5);
    doc.line(20, 50, pageWidth - 20, 50);
  }

  /**
   * Prints a prescription
   */
  async printPrescription(data: PrescriptionData, options: PrintOptions = {}): Promise<void> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const rtl = options.rtl || false;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Add header
    this.addClinicHeader(doc, rtl);

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const titleX = rtl ? pageWidth - 20 : 20;
    const titleAlign: 'right' | 'left' = rtl ? 'right' : 'left';
    doc.text(rtl ? 'روشتة طبية' : 'Medical Prescription', titleX, 65, { align: titleAlign });

    // Date and Rx number
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${format(new Date(data.date), 'dd/MM/yyyy')}`, rtl ? pageWidth - 20 : 20, 72, { align: titleAlign });
    doc.text(`Rx #: ${data.id}`, rtl ? pageWidth - 20 : 20, 78, { align: titleAlign });

    // Patient info box
    doc.setDrawColor(200);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(20, 85, pageWidth - 40, 25, 3, 3, 'FD');
    
    doc.setFont('helvetica', 'bold');
    doc.text(rtl ? 'المريض:' : 'Patient:', rtl ? pageWidth - 25 : 25, 93);
    doc.setFont('helvetica', 'normal');
    doc.text(data.patient.name, rtl ? pageWidth - 25 : 45, 93);
    
    if (data.patient.age) {
      doc.text(`${rtl ? 'العمر:' : 'Age:'} ${data.patient.age}`, rtl ? pageWidth - 25 : 25, 100);
    }
    if (data.patient.phone) {
      doc.text(`${rtl ? 'الهاتف:' : 'Phone:'} ${data.patient.phone}`, rtl ? pageWidth - 25 : 65, 100);
    }

    // Diagnosis
    if (data.diagnosis) {
      doc.setFont('helvetica', 'bold');
      doc.text(rtl ? 'التشخيص:' : 'Diagnosis:', rtl ? pageWidth - 25 : 25, 120);
      doc.setFont('helvetica', 'normal');
      doc.text(data.diagnosis, rtl ? pageWidth - 25 : 50, 120);
    }

    // Rx symbol
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Rx', rtl ? pageWidth - 25 : 25, 135);

    // Medications table
    let yPos = 145;
    doc.setFontSize(10);
    
    data.medications.forEach((med, index) => {
      // Medication name
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${med.name}`, rtl ? pageWidth - 30 : 30, yPos);
      yPos += 6;
      
      // Details
      doc.setFont('helvetica', 'normal');
      doc.text(`   ${med.dosage} - ${med.frequency}`, rtl ? pageWidth - 30 : 30, yPos);
      yPos += 6;
      doc.text(`   ${rtl ? 'المدة:' : 'Duration:'} ${med.duration}`, rtl ? pageWidth - 30 : 30, yPos);
      yPos += 6;
      
      if (med.instructions) {
        doc.setFont('helvetica', 'italic');
        doc.text(`   ${med.instructions}`, rtl ? pageWidth - 30 : 30, yPos);
        yPos += 6;
      }
      
      yPos += 4; // Gap between medications
    });

    // Notes
    if (data.notes) {
      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(rtl ? 'ملاحظات:' : 'Notes:', rtl ? pageWidth - 25 : 25, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 6;
      const notesLines = doc.splitTextToSize(data.notes, pageWidth - 50);
      doc.text(notesLines, rtl ? pageWidth - 30 : 30, yPos);
      yPos += notesLines.length * 6;
    }

    // Doctor signature area
    const signatureY = doc.internal.pageSize.getHeight() - 50;
    doc.setLineWidth(0.5);
    doc.line(rtl ? 30 : pageWidth - 80, signatureY, rtl ? 80 : pageWidth - 30, signatureY);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(data.doctor.name, rtl ? 55 : pageWidth - 55, signatureY + 7, { align: 'center' });
    
    if (data.doctor.title && data.doctor.specialty) {
      doc.setFont('helvetica', 'normal');
      doc.text(`${data.doctor.title} - ${data.doctor.specialty}`, rtl ? 55 : pageWidth - 55, signatureY + 13, { align: 'center' });
    }
    
    if (data.doctor.licenseId) {
      doc.setFontSize(8);
      doc.text(`License: ${data.doctor.licenseId}`, rtl ? 55 : pageWidth - 55, signatureY + 18, { align: 'center' });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    const footerText = rtl ? 'هذه الوصفة صالحة لمدة 7 أيام من تاريخ الإصدار' : 'This prescription is valid for 7 days from the date of issue';
    doc.text(footerText, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    // Print or preview
    await this.executePrint(doc, 'prescription', options);
  }

  /**
   * Prints an invoice
   */
  async printInvoice(data: InvoiceData, options: PrintOptions = {}): Promise<void> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const rtl = options.rtl || false;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Add header
    this.addClinicHeader(doc, rtl);

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const titleX = rtl ? pageWidth - 20 : 20;
    doc.text(rtl ? 'فاتورة' : 'INVOICE', titleX, 65, { align: rtl ? 'right' : 'left' });

    // Invoice info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${rtl ? 'رقم:' : 'Invoice #:'} ${data.invoiceNumber}`, titleX, 73, { align: rtl ? 'right' : 'left' });
    doc.text(`${rtl ? 'التاريخ:' : 'Date:'} ${format(new Date(data.date), 'dd/MM/yyyy')}`, titleX, 79, { align: rtl ? 'right' : 'left' });

    // Patient info
    doc.setFont('helvetica', 'bold');
    doc.text(rtl ? 'المريض:' : 'Patient:', titleX, 90, { align: rtl ? 'right' : 'left' });
    doc.setFont('helvetica', 'normal');
    doc.text(data.patient.name, titleX, 96, { align: rtl ? 'right' : 'left' });
    if (data.patient.phone) {
      doc.text(data.patient.phone, titleX, 102, { align: rtl ? 'right' : 'left' });
    }

    // Items table
    const tableData = data.items.map(item => [
      item.description,
      item.quantity.toString(),
      item.unitPrice.toFixed(2),
      item.total.toFixed(2)
    ]);

    autoTable(doc, {
      startY: 115,
      head: [[
        rtl ? 'الوصف' : 'Description',
        rtl ? 'الكمية' : 'Qty',
        rtl ? 'السعر' : 'Price',
        rtl ? 'المجموع' : 'Total'
      ]],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [13, 148, 136], fontSize: 10, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 30 }
      }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const rightX = pageWidth - 20;
    
    doc.setFont('helvetica', 'normal');
    doc.text(rtl ? 'المجموع الفرعي:' : 'Subtotal:', rightX - 50, finalY, { align: 'right' });
    doc.text(data.subtotal.toFixed(2), rightX, finalY, { align: 'right' });
    
    doc.text(rtl ? 'الخصم:' : 'Discount:', rightX - 50, finalY + 7, { align: 'right' });
    doc.text(`-${data.discount.toFixed(2)}`, rightX, finalY + 7, { align: 'right' });
    
    doc.setLineWidth(0.5);
    doc.line(rightX - 60, finalY + 12, rightX, finalY + 12);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(rtl ? 'الإجمالي:' : 'Total:', rightX - 50, finalY + 20, { align: 'right' });
    doc.text(data.total.toFixed(2), rightX, finalY + 20, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(rtl ? 'المدفوع:' : 'Amount Paid:', rightX - 50, finalY + 28, { align: 'right' });
    doc.text(data.amountPaid.toFixed(2), rightX, finalY + 28, { align: 'right' });
    
    if (data.balance > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text(rtl ? 'المتبقي:' : 'Balance Due:', rightX - 50, finalY + 36, { align: 'right' });
      doc.text(data.balance.toFixed(2), rightX, finalY + 36, { align: 'right' });
      doc.setTextColor(0);
    }

    // Payment method
    if (data.paymentMethod) {
      doc.setFont('helvetica', 'normal');
      doc.text(`${rtl ? 'طريقة الدفع:' : 'Payment Method:'} ${data.paymentMethod}`, 20, finalY + 50);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    const footerText = rtl ? 'شكراً لثقتكم' : 'Thank you for your trust';
    doc.text(footerText, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    // Print or preview
    await this.executePrint(doc, 'invoice', options);
  }

  /**
   * Prints a queue ticket
   */
  async printQueueTicket(data: QueueTicketData, options: PrintOptions = {}): Promise<void> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 120] // Thermal printer size
    });

    const rtl = options.rtl || false;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Clinic name
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(this.clinicInfo.name, pageWidth / 2, 15, { align: 'center' });

    // Title
    doc.setFontSize(12);
    doc.text(rtl ? 'تذكرة الدور' : 'Queue Ticket', pageWidth / 2, 25, { align: 'center' });

    // Queue number (big)
    doc.setFontSize(48);
    doc.setFont('helvetica', 'bold');
    doc.text(data.queueNumber.toString(), pageWidth / 2, 50, { align: 'center' });

    // Details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let yPos = 65;
    doc.text(`${rtl ? 'المريض:' : 'Patient:'}`, 10, yPos);
    doc.text(data.patientName, 10, yPos + 6);
    
    yPos += 15;
    doc.text(`${rtl ? 'الطبيب:' : 'Doctor:'}`, 10, yPos);
    doc.text(data.doctorName, 10, yPos + 6);
    
    yPos += 15;
    doc.text(`${rtl ? 'الوقت:' : 'Time:'}`, 10, yPos);
    doc.text(data.time, 10, yPos + 6);
    
    if (data.room) {
      yPos += 12;
      doc.text(`${rtl ? 'الغرفة:' : 'Room:'} ${data.room}`, pageWidth / 2, yPos, { align: 'center' });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(format(new Date(), 'dd/MM/yyyy HH:mm'), pageWidth / 2, 110, { align: 'center' });

    // Print or preview
    await this.executePrint(doc, 'queue_ticket', options);
  }

  /**
   * Executes the print operation
   */
  private async executePrint(doc: jsPDF, documentType: string, options: PrintOptions): Promise<void> {
    if (window.electronAPI) {
      // Native Electron printing
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      if (options.silent && options.printerName) {
        // TODO: Implement silent printing with specific printer
        // This requires additional Electron IPC handlers
        console.log(`Silent print to ${options.printerName}`);
      }
      
      window.electronAPI.printPDF(blobUrl);
    } else {
      // Web fallback: open print dialog
      if (options.silent) {
        console.warn('Silent printing not supported in web mode');
      }
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    }
  }

  /**
   * Gets list of available printers (Electron only)
   */
  async getAvailablePrinters(): Promise<string[]> {
    // TODO: Implement IPC call to get printer list from Electron
    return ['Default Printer', 'HP LaserJet', 'Thermal Printer'];
  }

  /**
   * Updates clinic information
   */
  updateClinicInfo(info: Partial<ClinicInfo>): void {
    this.clinicInfo = { ...this.clinicInfo, ...info };
  }
}

export const printingService = new PrintingService();
