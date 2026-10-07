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
  markedPresent?: boolean;
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

export type TaskStatus = "open" | "in_progress" | "done";

export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  brief: string;
  description: string;
  assigneeUserId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
}

export type TaskActivityKind =
  | "created"
  | "status"
  | "reassigned"
  | "priority"
  | "due"
  | "edited"
  | "description"
  | "comment";

export interface TaskActivity {
  id: string;
  taskId: string;
  actorUserId: string;
  kind: TaskActivityKind;
  detail: string;
  createdAt: string;
}

export interface Database {
  people: Person[];
  attendance: AttendanceRecord[];
  leave: LeaveRequest[];
  tasks: Task[];
  taskComments: TaskComment[];
  taskActivity: TaskActivity[];
}
