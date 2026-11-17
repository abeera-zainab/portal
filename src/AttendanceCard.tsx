import { useEffect, useState } from "react";
import type { Person } from "./types";
import {
  attendanceStatus,
  checkIn,
  checkOut,
  formatClock,
  formatWorked,
  holidayFor,
  minutesBetween,
  todayKey,
  useDatabase,
  workingDayFor,
} from "./store";

export function AttendanceCard({ person, heading = "Today" }: { person: Person; heading?: string }) {
  const db = useDatabase();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState("");
  const record = db.attendance.find((item) => item.userId === person.userId && item.date === todayKey());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const run = async (action: () => Promise<void>) => {
    try {
      setError("");
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update attendance.");
    }
  };

  const tracked = record?.checkIn
    ? record.workedMinutes ?? minutesBetween(record.checkIn, record.checkOut ? new Date(record.checkOut) : now)
    : undefined;
  const beforeJoin = Boolean(person.joined && todayKey(now) < person.joined);
  const today = todayKey(now);
  const holiday = holidayFor(today, db.publicHolidays);
  const wkDay = workingDayFor(today, db.workingDays);
  const status = attendanceStatus(person.userId, db.attendance, db.leave, now, undefined, db.publicHolidays, db.workingDays);
  const onLeave = status === "leave";
  const weekend = status === "weekend";

  return (
    <section className="card">
      <h2>{heading}</h2>
      <p className="muted">
        {holiday
          ? `Today is a public holiday (${holiday.name}). You can still check in; check-ins after 9:30 AM are late.`
          : wkDay
          ? `Today is a working weekend day${wkDay.reason ? ` (${wkDay.reason})` : ""}. Check-ins after 9:30 AM are late.`
          : weekend
          ? "You can check in today. Check-ins after 9:30 AM are late."
          : beforeJoin
          ? `Attendance starts on ${person.joined}.`
          : onLeave
          ? "You are on approved leave today."
          : "Check in any time. Check-ins after 9:30 AM are late."}
      </p>
      <div className="role-tags">
        {holiday ? <span className="badge holiday">{holiday.name}</span> : null}
        {wkDay ? <span className="badge" style={{ background: "#e8f5e9", color: "#1f6b4a" }}>Working Day</span> : null}
        {onLeave ? <span className="badge leave">Leave</span> : null}
        {person.workMode === "wfh" ? <span className="badge">Work from home</span> : null}
        {person.workMode === "remote" ? <span className="badge remote">Remote</span> : null}
      </div>
      <div className="clock">{formatWorked(tracked).replace("—", "0h 0m")}</div>
      <p>
        {beforeJoin ? (
          <span className="muted">Not joined</span>
        ) : (
          <>
            {status === "holiday" ? <span className="badge holiday">Holiday</span> : null}
            {status === "late" ? <span className="badge late">Late</span> : null}
            {status === "on_time" ? <span className="badge">On time</span> : null}
            {status === "leave" ? <span className="badge leave">Leave</span> : null}
            {status === "not_in" ? <span className="badge wait">Not in</span> : null}
            {record ? (
              <span className="muted"> · In {formatClock(record.checkIn)} · Out {formatClock(record.checkOut)}</span>
            ) : (
              <span className="muted"> · Not checked in yet</span>
            )}
          </>
        )}
      </p>
      <div className="row">
        <button
          className="btn"
          disabled={beforeJoin || Boolean(record?.checkIn)}
          onClick={() => run(() => checkIn(person.userId))}
        >
          Check in
        </button>
        <button
          className="btn secondary"
          disabled={beforeJoin || weekend || !record?.checkIn || Boolean(record.checkOut)}
          onClick={() => run(() => checkOut(person.userId))}
        >
          Check out
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
