export type Role = "admin" | "hr" | "team_lead" | "officer" | "employee";

export type TeamId = "offensive" | "defensive" | "ops" | "product";

export type WorkMode = "wfh" | "remote";

export interface Person {
  userId: string;
  name: string;
  username: string;
  email: string;
  password: string;
  role: Role;
  team: TeamId | null;
  teams?: TeamId[];
  active?: boolean;
  joined?: string;
  lateAllowed?: boolean;
  officer?: boolean;
  mto?: boolean;
  workMode?: WorkMode | null;
  reportsTo?: string;
}

export interface AttendanceRecord {
  userId: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  late: boolean;
  workedMinutes?: number;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  from: string;
  to: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
}

export interface Database {
  people: Person[];
  attendance: AttendanceRecord[];
  leave: LeaveRequest[];
}
