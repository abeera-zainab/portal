import type { Database, Person } from "./types";
import { attendanceStatus, todayKey } from "./store";

const eachDay = (from: string, to: string) => {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return days;
  while (cursor <= end) {
    days.push(todayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

export function attendanceTotals(person: Person, attendance: Database["attendance"], leave: Database["leave"]) {
  const today = todayKey();
  const history = attendance.filter((record) => record.userId === person.userId);
  const earliest = history.reduce((soonest, record) => (record.date < soonest ? record.date : soonest), today);
  const start = person.joined && person.joined < earliest ? person.joined : earliest;
  let present = 0;
  let absent = 0;
  let leaves = 0;
  let late = 0;
  for (const day of eachDay(start, today)) {
    const status = attendanceStatus(person.userId, attendance, leave, new Date(`${day}T12:00:00`), Boolean(person.lateAllowed));
    if (status === "leave") leaves += 1;
    else if (status === "late") {
      present += 1;
      late += 1;
    } else if (status === "on_time") present += 1;
    else absent += 1;
  }
  return { total: present + absent + leaves, present, absent, leaves, late };
}

export function monthTotals(person: Person, attendance: Database["attendance"], leave: Database["leave"], month = new Date()) {
  const today = todayKey();
  const monthStart = todayKey(new Date(month.getFullYear(), month.getMonth(), 1));
  const start = person.joined && person.joined > monthStart ? person.joined : monthStart;
  let present = 0;
  let absent = 0;
  let leaves = 0;
  let late = 0;
  if (start <= today) {
    for (const day of eachDay(start, today)) {
      const status = attendanceStatus(person.userId, attendance, leave, new Date(`${day}T12:00:00`), Boolean(person.lateAllowed));
      if (status === "leave") leaves += 1;
      else if (status === "late") {
        present += 1;
        late += 1;
      } else if (status === "on_time") present += 1;
      else absent += 1;
    }
  }
  return { total: present + absent + leaves, present, absent, leaves, late };
}
