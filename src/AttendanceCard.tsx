import { useEffect, useState } from "react";
import type { Person } from "./types";
import {
  attendanceStatus,
  checkIn,
  checkOut,
  formatClock,
  formatWorked,
  isOnLeave,
  minutesBetween,
  todayKey,
  useDatabase,
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
  const onLeave = isOnLeave(person.userId, db.leave);
  const status = attendanceStatus(person.userId, db.attendance, db.leave, now, Boolean(person.lateAllowed));
  const weekend = status === "weekend";

  return (
    <section className="card">
      <h2>{heading}</h2>
      <p className="muted">
        {weekend
          ? "Saturday and Sunday are a weekend holiday."
          : onLeave
          ? "You are on approved leave today."
          : person.lateAllowed
            ? "11:00 AM is your last on-time check-in. Checking in after 11:00 AM is late."
            : "9:30 AM is the last on-time check-in. Checking in after 9:30 AM is late."}
      </p>
      <div className="role-tags">
        {onLeave ? <span className="badge leave">Leave</span> : null}
        {person.lateAllowed ? <span className="badge late">Late check-in</span> : null}
        {person.workMode === "wfh" ? <span className="badge">Work from home</span> : null}
        {person.workMode === "remote" ? <span className="badge remote">Remote</span> : null}
      </div>
      <div className="clock">{formatWorked(tracked).replace("—", "0h 0m")}</div>
      <p>
        {status === "late" ? <span className="badge late">Late</span> : null}
        {status === "on_time" ? <span className="badge">On time</span> : null}
        {status === "leave" ? <span className="badge leave">Leave</span> : null}
        {status === "not_in" ? <span className="badge wait">Not in</span> : null}
        {status === "weekend" ? <span className="badge holiday">Weekend</span> : null}
        {status === "absentee" ? <span className="badge no">Absentee</span> : null}
        {record ? (
          <span className="muted"> · In {formatClock(record.checkIn)} · Out {formatClock(record.checkOut)}</span>
        ) : (
          <span className="muted"> · Not checked in yet</span>
        )}
      </p>
      <div className="row">
        <button className="btn" disabled={weekend || Boolean(record?.checkIn)} onClick={() => run(() => checkIn(person.userId))}>
          Check in
        </button>
        <button
          className="btn secondary"
          disabled={weekend || !record?.checkIn || Boolean(record.checkOut)}
          onClick={() => run(() => checkOut(person.userId))}
        >
          Check out
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
