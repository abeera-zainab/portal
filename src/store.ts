import { useSyncExternalStore } from "react";
import type { Database, Person, Role, TeamId, WorkMode } from "./types";

export const TEAMS: { id: TeamId; name: string }[] = [
  { id: "offensive", name: "Offensive" },
  { id: "defensive", name: "Defensive" },
  { id: "ops", name: "INT" },
  { id: "product", name: "Product Development" },
];

const SESSION_KEY = "pss-attendance-session";

const empty = (): Database => ({ people: [], attendance: [], leave: [] });

let database: Database = empty();
let sessionUserId: string | null = sessionStorage.getItem(SESSION_KEY);
let ready = false;
let dbError: string | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const applyState = (state: Database) => {
  database = state;
  emit();
};

export const refresh = async () => {
  try {
    const response = await fetch("/api/state");
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

void refresh();

const mutate = async (path: string, method: string, body?: unknown) => {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": sessionUserId ?? "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; state?: Database };
  if (!response.ok) throw new Error(payload.error || "Database request failed.");
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

export const roleTags = (person: Person): { id: string; label: string }[] => {
  if (person.role === "admin") return [{ id: "admin", label: "Admin" }];
  const tags: { id: string; label: string }[] = [];
  if (isOfficer(person)) tags.push({ id: "officer", label: "Officer" });
  if (person.role === "team_lead") tags.push({ id: "team_lead", label: "Team lead" });
  if (person.mto) tags.push({ id: "mto", label: "MTO" });
  if (!tags.length) tags.push({ id: "employee", label: "Team" });
  return tags;
};

export const personTeams = (person: Person): TeamId[] =>
  person.teams?.length ? person.teams : person.team ? [person.team] : [];

export const isPersonActive = (person: Person) => person.active !== false;

export const todayKey = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const isLateCheckIn = (date: Date) => {
  const cutoff = new Date(date);
  cutoff.setHours(9, 30, 0, 0);
  return date.getTime() > cutoff.getTime();
};

export const isOnLeave = (userId: string, leave: Database["leave"], day = todayKey()) =>
  leave.some(
    (request) => request.userId === userId && request.status === "approved" && request.from <= day && request.to >= day
  );

export const attendanceStatus = (
  userId: string,
  attendance: Database["attendance"],
  leave: Database["leave"],
  now = new Date()
) => {
  const day = todayKey(now);
  if (isOnLeave(userId, leave, day)) return "leave" as const;
  const record = attendance.find((item) => item.userId === userId && item.date === day);
  if (record && (record.late || isLateCheckIn(new Date(record.checkIn)))) return "late" as const;
  if (record) return "on_time" as const;
  return "not_in" as const;
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
  const payload = (await response.json().catch(() => ({}))) as Person & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not sign in.");
  sessionUserId = payload.userId;
  sessionStorage.setItem(SESSION_KEY, payload.userId);
  await refresh();
};

export const logout = () => {
  sessionUserId = null;
  sessionStorage.removeItem(SESSION_KEY);
  emit();
};

export const todayRecord = (userId: string) =>
  database.attendance.find((record) => record.userId === userId && record.date === todayKey());

export const checkIn = async (userId: string) => {
  await mutate("/api/attendance/check-in", "POST", { userId });
};

export const checkOut = async (userId: string) => {
  await mutate("/api/attendance/check-out", "POST", { userId });
};

export const requestLeave = async (userId: string, from: string, to: string, reason: string) => {
  await mutate("/api/leave", "POST", { userId, from, to, reason });
};

export const reviewLeave = async (
  requestId: string,
  _reviewerId: string,
  decision: "approved" | "rejected",
  rejectionReason?: string
) => {
  await mutate(`/api/leave/${requestId}/review`, "POST", { decision, rejectionReason });
};

export const createPerson = async (input: {
  name: string;
  username: string;
  email: string;
  password: string;
  role: Role;
  team: TeamId | null;
  userId?: string;
}) => {
  await mutate("/api/people", "POST", input);
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
