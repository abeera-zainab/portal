import { useSyncExternalStore } from "react";
import type {
  Database,
  LeaveRequest,
  Person,
  Role,
  Task,
  TaskComment,
  TaskCommentKind,
  TaskPriority,
  TaskStatus,
  TeamId,
  WorkMode,
} from "./types";

export const TEAMS: { id: TeamId; name: string }[] = [
  { id: "offensive", name: "Offensive" },
  { id: "defensive", name: "Defensive" },
  { id: "ops", name: "INT" },
  { id: "product", name: "Product Development" },
];

const SESSION_KEY = "pss-attendance-session";
const TOKEN_KEY = "pss-attendance-token";

const empty = (): Database => ({
  people: [],
  attendance: [],
  leave: [],
  tasks: [],
  taskComments: [],
  taskActivity: [],
  sheetDays: [],
});

let database: Database = empty();
let sessionUserId: string | null = sessionStorage.getItem(SESSION_KEY);
let token: string | null = sessionStorage.getItem(TOKEN_KEY);
let ready = !token;
let dbError: string | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const applyState = (state: Database) => {
  database = state;
  emit();
};

const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

const clearSession = () => {
  sessionUserId = null;
  token = null;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  database = empty();
};

export const refresh = async () => {
  if (!token) {
    ready = true;
    emit();
    return;
  }
  try {
    const response = await fetch("/api/state", { headers: authHeaders() });
    if (response.status === 401) {
      clearSession();
      dbError = null;
      ready = true;
      emit();
      return;
    }
    if (!response.ok) throw new Error("Cannot reach the local PostgreSQL database.");
    applyState((await response.json()) as Database);
    dbError = null;
    ready = true;
    emit();
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Cannot reach the local PostgreSQL database.";
    emit();
    window.setTimeout(() => {
      void refresh();
    }, 1500);
  }
};

if (token) void refresh();

const mutate = async (path: string, method: string, body?: unknown) => {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; state?: Database };
  if (response.status === 401) {
    clearSession();
    ready = true;
    emit();
  }
  if (!response.ok) {
    if (payload.error) throw new Error(payload.error);
    if (response.status === 404) throw new Error("The server does not know this request yet. Restart the API with the latest code.");
    throw new Error(`Database request failed (${response.status}).`);
  }
  if (payload.state) applyState(payload.state);
  return payload;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useDatabase = () => useSyncExternalStore(subscribe, () => database);
export const useDbReady = () => useSyncExternalStore(subscribe, () => ready);
export const useDbError = () => useSyncExternalStore(subscribe, () => dbError);

export const useSession = () => {
  const db = useDatabase();
  const userId = useSyncExternalStore(subscribe, () => sessionUserId);
  return db.people.find((person) => person.userId === userId) ?? null;
};

export const teamName = (team: TeamId | null) =>
  TEAMS.find((item) => item.id === team)?.name ?? "No team";

export const isOfficer = (person: Person) => person.role === "officer" || Boolean(person.officer);

export const hasOfficerRank = (person: Person) => person.role !== "admin" && isOfficer(person);

export const hasTeamLeadRank = (person: Person) =>
  person.role !== "admin" && !isOfficer(person) && (person.role === "team_lead" || Boolean(person.mto));

export const hasLeadRights = (person: Person) => hasOfficerRank(person) || hasTeamLeadRank(person);

export const canReviewLeave = (reviewer: Person, owner: Person) => {
  if (owner.role === "admin" || reviewer.userId === owner.userId) return false;
  if (reviewer.role === "admin") return true;
  if (owner.reportsTo !== reviewer.userId) return false;
  if (hasOfficerRank(reviewer)) return !isOfficer(owner);
  if (hasTeamLeadRank(reviewer)) return !isOfficer(owner) && owner.role !== "team_lead" && !owner.mto;
  return false;
};

export const roleTags = (person: Person): { id: string; label: string }[] => {
  if (person.role === "admin") return [{ id: "admin", label: "Admin" }];
  if (person.role === "hr") return [{ id: "hr", label: "HR" }];
  const tags: { id: string; label: string }[] = [];
  if (isOfficer(person)) tags.push({ id: "officer", label: "Officer" });
  if (person.role === "team_lead") tags.push({ id: "team_lead", label: "Team lead" });
  if (person.mto) tags.push({ id: "mto", label: "MTO" });
  if (!tags.length) tags.push({ id: "employee", label: "Team" });
  return tags;
};

export const personTeams = (person: Person): TeamId[] =>
  person.teams?.length ? person.teams : person.team ? [person.team] : [];

export const isCiso = (person: Person) =>
  person.userId === "PSS002" || person.username.toLowerCase() === "hassanazwar";

export const reportingTitle = (person: Person) => {
  if (isCiso(person)) return "CISO";
  const parts: string[] = [];
  if (person.role === "officer" || person.officer) parts.push("Officer");
  if (person.role === "team_lead") parts.push("Team lead");
  if (person.role === "admin") parts.push("Admin");
  return parts.join(", ") || "Team";
};

export const canReceiveReports = (person: Person) => {
  if (!isPersonActive(person)) return false;
  if (isCiso(person)) return true;
  if (person.role === "admin") return false;
  return (
    person.role === "team_lead" ||
    person.role === "officer" ||
    Boolean(person.officer) ||
    Boolean(person.mto) ||
    hasTeamLeadRank(person)
  );
};

export const isDirectReport = (lead: Person, person: Person) =>
  person.userId !== lead.userId &&
  person.role !== "admin" &&
  isPersonActive(person) &&
  person.reportsTo === lead.userId;

export const sharesTeam = (left: Person, right: Person) =>
  personTeams(left).some((team) => personTeams(right).includes(team));

export const teamRoster = (lead: Person, people: Person[]) => {
  if (lead.role === "admin") {
    return people.filter((person) => person.role !== "admin" && isPersonActive(person));
  }
  return people.filter((person) => isDirectReport(lead, person));
};

export const reviewableLeave = (lead: Person, people: Person[], leave: LeaveRequest[]) =>
  leave.filter((request) => {
    const owner = people.find((person) => person.userId === request.userId);
    if (!owner) return false;
    return canReviewLeave(lead, owner);
  });

export const isPersonActive = (person: Person) => person.active !== false;

export const isHrPss = (person: Person) => person.role === "hr" && person.username.toLowerCase() === "hr-pss";

export const attendanceHref = (userId: string, from: string) => `/attendance/${userId}?from=${encodeURIComponent(from)}`;

export const canEditAttendance = (person: Person | null) => Boolean(person && person.role === "hr" && !isHrPss(person));

export const canMarkPresent = (person: Person | null) => Boolean(person && (person.role === "admin" || person.role === "hr"));

export const canGrantLeave = (person: Person | null) => Boolean(person && isHrPss(person));

export const canSeeLate = (person: Person | null) =>
  Boolean(
    person &&
      (person.role === "admin" ||
        person.role === "hr" ||
        person.role === "team_lead" ||
        hasTeamLeadRank(person) ||
        hasOfficerRank(person))
  );

export const todayKey = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const isLateCheckIn = (date: Date, lateAllowed = false) => {
  const cutoff = new Date(date);
  if (lateAllowed) cutoff.setHours(11, 0, 0, 0);
  else cutoff.setHours(9, 30, 0, 0);
  return date.getTime() > cutoff.getTime();
};

export const isOnLeave = (userId: string, leave: Database["leave"], day = todayKey()) =>
  leave.some(
    (request) => request.userId === userId && request.status === "approved" && request.from <= day && request.to >= day
  );

export type DayStatus = "on_time" | "late" | "leave" | "not_in" | "absentee" | "weekend";

export const isWeekend = (day: string) => {
  const weekday = new Date(`${day}T12:00:00`).getDay();
  return weekday === 0 || weekday === 6;
};

const shiftDay = (day: string, delta: number) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + delta);
  return todayKey(date);
};

const checkedInLate = (userId: string, attendance: Database["attendance"], day: string, lateAllowed: boolean) => {
  const record = attendance.find((item) => item.userId === userId && item.date === day);
  if (!record || record.markedPresent || !record.checkIn) return false;
  return isLateCheckIn(new Date(record.checkIn), lateAllowed);
};

export const attendanceStatus = (
  userId: string,
  attendance: Database["attendance"],
  leave: Database["leave"],
  now = new Date(),
  lateAllowed = false
): DayStatus => {
  const day = todayKey(now);
  if (isWeekend(day)) return "weekend";
  const record = attendance.find((item) => item.userId === userId && item.date === day);
  if (record?.markedPresent) return "on_time";
  if (isOnLeave(userId, leave, day)) return "leave";
  if (!record || !record.checkIn) return "not_in";
  if (!isLateCheckIn(new Date(record.checkIn), lateAllowed)) return "on_time";
  let cursor = shiftDay(day, -1);
  let priorLate = 0;
  for (let guard = 0; priorLate < 3 && guard < 40; guard += 1) {
    if (isWeekend(cursor)) {
      cursor = shiftDay(cursor, -1);
      continue;
    }
    if (isOnLeave(userId, leave, cursor)) {
      cursor = shiftDay(cursor, -1);
      continue;
    }
    if (!checkedInLate(userId, attendance, cursor, lateAllowed)) break;
    priorLate += 1;
    cursor = shiftDay(cursor, -1);
  }
  return priorLate >= 3 ? "absentee" : "late";
};

export const dayStatusLabel = (status: DayStatus, absentLabel = "Not in") => {
  if (status === "on_time") return "On time";
  if (status === "late") return "Late";
  if (status === "leave") return "Leave";
  if (status === "absentee") return "Absentee";
  if (status === "weekend") return "—";
  return absentLabel;
};

export const dayStatusClass = (status: DayStatus) => {
  if (status === "late") return "badge late";
  if (status === "absentee") return "badge no";
  if (status === "leave") return "badge leave";
  if (status === "on_time") return "badge";
  if (status === "weekend") return "badge wait";
  return "badge wait";
};

export const formatClock = (iso?: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export const formatWorked = (minutes?: number) => {
  if (minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

export const minutesBetween = (startIso: string, end: Date) =>
  Math.max(0, Math.round((end.getTime() - new Date(startIso).getTime()) / 60000));

export const login = async (identifier: string, password: string) => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const payload = (await response.json().catch(() => ({}))) as Person & { error?: string; token?: string };
  if (!response.ok || !payload.token) throw new Error(payload.error || "Could not sign in.");
  sessionUserId = payload.userId;
  token = payload.token;
  sessionStorage.setItem(SESSION_KEY, payload.userId);
  sessionStorage.setItem(TOKEN_KEY, payload.token);
  await refresh();
};

export const logout = async () => {
  const current = token;
  clearSession();
  ready = true;
  dbError = null;
  emit();
  if (!current) return;
  await fetch("/api/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${current}` },
  }).catch(() => undefined);
};

export const todayRecord = (userId: string) =>
  database.attendance.find((record) => record.userId === userId && record.date === todayKey());

export const checkIn = async (userId: string) => {
  await mutate("/api/attendance/check-in", "POST", { userId });
};

export const checkOut = async (userId: string) => {
  await mutate("/api/attendance/check-out", "POST", { userId });
};

export const saveAttendance = async (userId: string, date: string, checkIn: string, checkOutTime?: string) => {
  await mutate("/api/attendance", "PUT", { userId, date, checkIn, checkOut: checkOutTime || "" });
};

export const deleteAttendance = async (userId: string, date: string) => {
  await mutate("/api/attendance", "DELETE", { userId, date });
};

export const markPresent = async (userId: string, date: string, present = true) => {
  await mutate("/api/attendance/present", "POST", { userId, date, present });
};

export const requestLeave = async (userId: string, from: string, to: string, reason: string) => {
  await mutate("/api/leave", "POST", { userId, from, to, reason });
};

export const grantLeave = async (userId: string, from: string, to: string, reason: string) => {
  await mutate("/api/leave/grant", "POST", { userId, from, to, reason });
};

export const reviewLeave = async (
  requestId: string,
  _reviewerId: string,
  decision: "approved" | "rejected",
  rejectionReason?: string
) => {
  await mutate(`/api/leave/${requestId}/review`, "POST", { decision, rejectionReason });
};

export const deleteLeave = async (requestId: string) => {
  await mutate(`/api/leave/${requestId}`, "DELETE");
};

// Task permissions. The server applies the same rules.

export const canUseTasks = (person: Person | null) => Boolean(person && person.role !== "hr");

export const canAssignTasks = (person: Person | null) => Boolean(person && (person.role === "admin" || hasLeadRights(person)));

export const isTaskAssignable = (person: Person) => isPersonActive(person) && person.role !== "admin" && person.role !== "hr";

export const canAssignTo = (assigner: Person, person: Person) => {
  if (!isTaskAssignable(person)) return false;
  if (assigner.role === "admin") return true;
  if (!hasLeadRights(assigner)) return false;
  return sharesTeam(assigner, person);
};

export const assignableFor = (assigner: Person, people: Person[]) =>
  people.filter((person) => canAssignTo(assigner, person)).sort((a, b) => a.name.localeCompare(b.name));

export const isTaskOwner = (person: Person, task: Task) => person.role === "admin" || task.createdBy === person.userId;

export const canEditTask = (person: Person | null, task: Task) => Boolean(person && isTaskOwner(person, task));

export const canWorkTask = (person: Person | null, task: Task) => Boolean(person && task.assigneeUserId === person.userId);

export const canDeleteTask = (person: Person | null, task: Task) => Boolean(person && isTaskOwner(person, task));

export const leadsTeamOf = (lead: Person, assignee: Person | undefined) =>
  Boolean(assignee && hasLeadRights(lead) && sharesTeam(lead, assignee));

export const canCommentOnTask = (person: Person | null, task: Task, people: Person[]) => {
  if (!person) return false;
  if (isTaskOwner(person, task) || canWorkTask(person, task)) return true;
  const assignee = people.find((item) => item.userId === task.assigneeUserId);
  return leadsTeamOf(person, assignee);
};

export const canViewTask = (person: Person | null, task: Task, people: Person[]) => {
  if (!person || person.role === "hr") return false;
  if (isTaskOwner(person, task) || canWorkTask(person, task)) return true;
  const assignee = people.find((item) => item.userId === task.assigneeUserId);
  return Boolean(assignee && sharesTeam(person, assignee));
};

export const visibleTasks = (person: Person | null, tasks: Task[], people: Person[]) =>
  tasks.filter((task) => canViewTask(person, task, people));

export const isTaskOverdue = (task: Task, day = todayKey()) =>
  Boolean(task.dueDate && task.status !== "done" && task.dueDate < day);

/**
 * Whether the viewer may type in a sheet cell. Responses belong to the assignee; comments follow the
 * thread rules. Nothing new can be written in a future column. `own` is the viewer's existing entry.
 */
export const canWriteTaskCell = (
  person: Person | null,
  task: Task,
  kind: TaskCommentKind,
  day: string,
  people: Person[],
  own?: TaskComment
) => {
  if (!person || person.role === "hr") return false;
  if (!own && day > todayKey()) return false;
  if (kind === "response") return canWorkTask(person, task);
  return canCommentOnTask(person, task, people);
};

export const canAddSheetDay = (person: Person | null) => Boolean(person && person.role === "admin");

export const canWriteResponse = (person: Person | null, task: Task, day: string, own?: TaskComment) =>
  canWriteTaskCell(person, task, "response", day, [], own);

export const createTask = async (input: {
  title: string;
  brief?: string;
  assigneeUserId: string;
  priority?: TaskPriority;
  dueDate?: string;
}) => {
  await mutate("/api/tasks", "POST", input);
};

export const updateTask = async (
  taskId: string,
  input: {
    title?: string;
    brief?: string;
    description?: string;
    assigneeUserId?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string | null;
  }
) => {
  await mutate(`/api/tasks/${encodeURIComponent(taskId)}`, "PATCH", input);
};

export const commentOnTask = async (taskId: string, body: string) => {
  await mutate(`/api/tasks/${encodeURIComponent(taskId)}/comments`, "POST", { body });
};

/** Admin opens a review-date column on the sheet. */
export const addSheetDay = async (day: string) => {
  await mutate("/api/tasks/sheet-days", "POST", { day });
};

/** Saves (or clears, when body is empty) the viewer's entry in one sheet cell. */
export const saveTaskCell = async (taskId: string, input: { day: string; kind: TaskCommentKind; body: string }) => {
  await mutate(`/api/tasks/${encodeURIComponent(taskId)}/cells`, "PUT", input);
};

export const deleteTask = async (taskId: string) => {
  await mutate(`/api/tasks/${encodeURIComponent(taskId)}`, "DELETE");
};

export const createPerson = async (input: {
  name: string;
  username: string;
  email: string;
  password: string;
  role: Role;
  team: TeamId | null;
  userId?: string;
  reportsTo?: string;
}) => {
  await mutate("/api/people", "POST", input);
};

export const setReportsTo = async (userId: string, reportsTo: string) => {
  const manager = database.people.find((item) => item.userId === reportsTo);
  const teams = manager ? personTeams(manager) : [];
  await mutate(`/api/people/${encodeURIComponent(userId)}`, "PATCH", {
    reportsTo,
    ...(teams.length ? { teams, team: teams[0] } : {}),
  });
};

export const assignTeam = async (userId: string, team: TeamId) => {
  await mutate(`/api/people/${encodeURIComponent(userId)}`, "PATCH", { team, teams: [team] });
};

export const setPersonRole = async (userId: string, role: Role) => {
  const person = database.people.find((item) => item.userId === userId);
  const teams = role === "admin" ? [] : person ? personTeams(person) : [];
  await mutate(`/api/people/${encodeURIComponent(userId)}`, "PATCH", {
    role,
    teams,
    team: teams[0] ?? null,
  });
};

export const togglePersonTeam = async (userId: string, team: TeamId) => {
  const person = database.people.find((item) => item.userId === userId);
  if (!person) throw new Error("Person not found.");
  const current = personTeams(person);
  const teams = current.includes(team) ? current.filter((item) => item !== team) : [...current, team];
  await mutate(`/api/people/${encodeURIComponent(userId)}`, "PATCH", { teams, team: teams[0] ?? null });
};

export const setPersonActive = async (userId: string, active: boolean) => {
  await mutate(`/api/people/${encodeURIComponent(userId)}`, "PATCH", { active });
};

export const updatePersonAccount = async (
  userId: string,
  input: { name: string; email: string; username: string; password?: string }
) => {
  await mutate(`/api/people/${encodeURIComponent(userId)}`, "PATCH", input);
};

export const setLateAllowed = async (userId: string, lateAllowed: boolean) => {
  await mutate(`/api/people/${encodeURIComponent(userId)}`, "PATCH", { lateAllowed });
};

export const setPersonTags = async (userId: string, tags: { officer: boolean; mto: boolean }) => {
  const person = database.people.find((item) => item.userId === userId);
  if (!person) throw new Error("Person not found.");
  const teams = personTeams(person);
  const body: { officer: boolean; mto: boolean; role?: Role; teams?: TeamId[]; team?: TeamId | null } = {
    officer: tags.officer,
    mto: tags.mto,
  };
  if (!tags.officer && person.role === "officer") {
    body.role = "employee";
    body.teams = teams;
    body.team = teams[0] ?? null;
  }
  await mutate(`/api/people/${encodeURIComponent(userId)}`, "PATCH", body);
};

export const setWorkMode = async (userId: string, workMode: WorkMode | null) => {
  await mutate(`/api/people/${encodeURIComponent(userId)}`, "PATCH", { workMode });
};

export const deletePerson = async (userId: string) => {
  await mutate(`/api/people/${encodeURIComponent(userId)}`, "DELETE");
};

export const updateAccount = async (input: { currentPassword: string; email?: string; password?: string }) => {
  await mutate("/api/account", "PATCH", input);
};

export const historyFor = (userId: string) =>
  database.attendance
    .filter((record) => record.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date));
