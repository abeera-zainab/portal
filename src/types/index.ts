import { Timestamp } from "firebase/firestore";

export type AttendanceStatus =
  | "present"
  | "leave"
  | "off"
  | "holiday"
  | "late"
  | "half-day";

export type StaffRole = "employee" | "team_lead";

export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export interface Admin {
  uid: string;
  name: string;
  email: string;
  role: "admin";
  createdAt: Timestamp;
}

export interface Employee {
  uid: string;
  name: string;
  email: string;
  username: string;
  empId: string;
  team?: string | null;
  designation?: string;
  monthlySalary: number;
  cnic?: string;
  address?: string;
  createdBy: string;
  createdAt: Timestamp;
  isActive?: boolean;
  role?: StaffRole;
  teamLeadUid?: string | null;
}

export interface AttendanceRecord {
  employeeUid: string;
  date: string;
  status: AttendanceStatus;
  inTime?: Timestamp;
  outTime?: Timestamp;
  leaveReason?: string;
  markedBy: string;
  lateMinutes?: number;
  workedMinutes?: number;
  earlyLeaveHours?: number;
  overtimeHours?: number;
  overtimeStatus?: "approved" | "rejected";
  overtimeReason?: string | null;
  imageUrl?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Holiday {
  date: string;
  reason?: string;
  createdAt: Timestamp;
}

export interface SalaryReport {
  employeeUid: string;
  employeeName: string;
  empId: string;
  monthlySalary: number;
  presentDays: number;
  leaveDays: number;
  offDays: number;
  unmarkedDays: number;
  holidayDays: number;
  lateCount: number;
  halfDayCount: number;
  earlyLeaveHours: number;
  offDeduction: number;
  lateDeduction: number;
  halfDayDeduction: number;
  earlyLeaveDeduction: number;
  totalDeductions: number;
  netSalary: number;
}

export interface AttendanceStats {
  presentDays: number;
  leaveDays: number;
  offDays: number;
  lateDays: number;
  halfDayDays: number;
  earlyLeaveHours: number;
  estimatedNetSalary: number;
}

export interface PortalSettings {
  currency?: string;
  logoUrl?: string;
  darkLogoUrl?: string;
  lightLogoUrl?: string;
  portalLightLogoUrl?: string;
  portalDarkLogoUrl?: string;
  loginLightLogoUrl?: string;
  loginDarkLogoUrl?: string;
  salaryStartDay?: number;
  officeStartTime?: string;
  officeEndTime?: string;
  lateMarkAfterMinutes?: number;
  enableCameraCapture?: boolean;
  updatedAt?: Timestamp;
}

export interface SalaryPayment {
  id?: string;
  employeeUid: string;
  salaryMonthKey: string;
  amount: number;
  paidAt: Timestamp;
  paidBy: string;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  employeeUid: string;
  employeeName: string;
  empId?: string;
  team?: string | null;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveRequestStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;
  reviewNote?: string;
  teamLeadUid?: string | null;
  createdAt: Timestamp;
}
