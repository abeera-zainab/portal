import { useMemo, useState } from "react";
import type { AttendanceRecord, LeaveRequest } from "./types";
import { attendanceStatus, todayKey } from "./store";

const FULL_DAY = 8 * 60;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const dayKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const hoursLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")} hrs`;
};

const startOfWeek = (date: Date) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
};

function monthGrid(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date; outside: boolean }[] = [];
  for (let index = pad; index > 0; index -= 1) {
    cells.push({ date: new Date(year, month, 1 - index), outside: true });
  }
  for (let day = 1; day <= days; day += 1) {
    cells.push({ date: new Date(year, month, day), outside: false });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, cells.length - (pad + days) + 1), outside: true });
  }
  return cells;
}

export function AttendanceCalendar({
  history,
  leave,
  userId,
  lateAllowed = false,
}: {
  history: AttendanceRecord[];
  leave: LeaveRequest[];
  userId: string;
  lateAllowed?: boolean;
}) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const today = todayKey();
  const byDate = useMemo(() => new Map(history.map((record) => [record.date, record])), [history]);

  const cells =
    mode === "month"
      ? monthGrid(cursor)
      : Array.from({ length: 7 }, (_, index) => {
          const start = startOfWeek(cursor);
          const date = new Date(start);
          date.setDate(start.getDate() + index);
          return { date, outside: false };
        });

  const title =
    mode === "month"
      ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : `${cells[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${cells[6].date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  const shift = (direction: number) => {
    const next = new Date(cursor);
    if (mode === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * 7);
    setCursor(next);
  };

  return (
    <section className="card calendar">
      <div className="calendar-head">
        <div className="calendar-nav">
          <button type="button" className="btn secondary" onClick={() => shift(-1)} aria-label="Previous">
            ←
          </button>
          <h2>{title}</h2>
          <button type="button" className="btn secondary" onClick={() => shift(1)} aria-label="Next">
            →
          </button>
        </div>
        <div className="filters">
          <button type="button" className={mode === "week" ? "chip on" : "chip"} onClick={() => setMode("week")}>
            Week
          </button>
          <button type="button" className={mode === "month" ? "chip on" : "chip"} onClick={() => setMode("month")}>
            Month
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {WEEKDAYS.map((name) => (
          <div key={name} className="calendar-weekday">
            {name}
          </div>
        ))}
        {cells.map(({ date, outside }) => {
          const key = dayKey(date);
          const record = byDate.get(key);
          const status = attendanceStatus(userId, history, leave, date, lateAllowed);
          const weekend = status === "weekend";
          const onLeave = status === "leave";
          const minutes =
            record?.workedMinutes ??
            (record?.checkIn && !record.checkOut && key === today
              ? Math.max(0, Math.round((Date.now() - new Date(record.checkIn).getTime()) / 60000))
              : undefined);
          const open = Boolean(record?.checkIn && !record.checkOut);
          const late = status === "late";
          const absentee = status === "absentee";
          const tone = weekend ? "" : onLeave ? "leave" : absentee ? "late" : !record ? "" : late ? "late" : open ? "open" : (minutes ?? 0) >= FULL_DAY ? "full" : "short";
          const width = minutes === undefined ? 0 : Math.min(100, Math.round((minutes / FULL_DAY) * 100));
          return (
            <div key={key} className={`calendar-day${outside ? " outside" : ""}${key === today ? " today" : ""}`}>
              <strong>{date.getDate()}</strong>
              {!weekend && onLeave ? <span className="badge leave">Leave</span> : null}
              {absentee ? <span className="badge no">Absentee</span> : null}
              {!weekend && !onLeave && minutes !== undefined ? (
                <>
                  <span className={`calendar-hours ${tone}`}>{hoursLabel(minutes)}</span>
                  <span className={`calendar-bar ${tone}`}>
                    <span style={{ width: `${width}%` }} />
                  </span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
