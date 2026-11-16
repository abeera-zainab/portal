import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  addPublicHoliday,
  addWorkingDay,
  deletePublicHoliday,
  deleteWorkingDay,
  useDatabase,
  useSession,
} from "../store";

const formatDateLong = (day: string) => {
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const weekdayName = (day: string) => {
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { weekday: "long" });
};

const isDayWeekendNatural = (day: string) => {
  const date = new Date(`${day}T12:00:00`);
  const dow = date.getDay();
  return dow === 0 || dow === 6;
};

export function HolidayManagement() {
  const db = useDatabase();
  const session = useSession();
  const canManage = session?.role === "admin" || session?.role === "hr";

  const [activeTab, setActiveTab] = useState<"holidays" | "working_days">("holidays");

  // Public holiday form state
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayError, setHolidayError] = useState("");
  const [savingHoliday, setSavingHoliday] = useState(false);

  // Working day form state
  const [workingDate, setWorkingDate] = useState("");
  const [workingReason, setWorkingReason] = useState("");
  const [workingError, setWorkingError] = useState("");
  const [savingWorking, setSavingWorking] = useState(false);

  const holidays = useMemo(
    () => [...(db.publicHolidays || [])].sort((a, b) => a.date.localeCompare(b.date)),
    [db.publicHolidays]
  );

  const workingDays = useMemo(
    () => [...(db.workingDays || [])].sort((a, b) => a.date.localeCompare(b.date)),
    [db.workingDays]
  );

  const handleAddHoliday = async (event: FormEvent) => {
    event.preventDefault();
    if (!holidayDate || !holidayName.trim()) {
      setHolidayError("Please choose a date and enter a holiday name.");
      return;
    }
    setSavingHoliday(true);
    setHolidayError("");
    try {
      await addPublicHoliday(holidayDate, holidayName.trim());
      setHolidayDate("");
      setHolidayName("");
    } catch (err) {
      setHolidayError(err instanceof Error ? err.message : "Could not add public holiday.");
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (date: string) => {
    try {
      await deletePublicHoliday(date);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove public holiday.");
    }
  };

  const handleAddWorkingDay = async (event: FormEvent) => {
    event.preventDefault();
    if (!workingDate) {
      setWorkingError("Please choose a date.");
      return;
    }
    setSavingWorking(true);
    setWorkingError("");
    try {
      await addWorkingDay(workingDate, workingReason.trim());
      setWorkingDate("");
      setWorkingReason("");
    } catch (err) {
      setWorkingError(err instanceof Error ? err.message : "Could not add working day.");
    } finally {
      setSavingWorking(false);
    }
  };

  const handleDeleteWorkingDay = async (date: string) => {
    try {
      await deleteWorkingDay(date);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove working day.");
    }
  };

  const selectedHolidayWeekday = holidayDate ? weekdayName(holidayDate) : "";
  const holidayIsWeekday = holidayDate ? !isDayWeekendNatural(holidayDate) : false;

  const selectedWorkingWeekday = workingDate ? weekdayName(workingDate) : "";
  const workingIsWeekend = workingDate ? isDayWeekendNatural(workingDate) : false;

  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Holidays & Schedule</h1>
          <p className="muted">
            Turn working days into public holidays, and convert weekends into active working days.
          </p>
        </div>
      </div>

      <div className="dash-stats">
        <article className="card stat">
          <span>Public Holidays</span>
          <strong className="tone-green">{holidays.length}</strong>
        </article>
        <article className="card stat">
          <span>Working Weekends</span>
          <strong className="tone-amber">{workingDays.length}</strong>
        </article>
        <article className="card stat">
          <span>Schedule Overrides</span>
          <strong>{holidays.length + workingDays.length}</strong>
        </article>
      </div>

      <div className="filters" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={activeTab === "holidays" ? "chip on" : "chip"}
          onClick={() => setActiveTab("holidays")}
        >
          Public Holidays ({holidays.length})
        </button>
        <button
          type="button"
          className={activeTab === "working_days" ? "chip on" : "chip"}
          onClick={() => setActiveTab("working_days")}
        >
          Working Weekends ({workingDays.length})
        </button>
      </div>

      {activeTab === "holidays" && (
        <div style={{ display: "grid", gap: 24 }}>
          {canManage ? (
            <article className="card">
              <h2>Add Public Holiday on a Working Day</h2>
              <p className="muted">
                Designate a calendar date as a public holiday. If it falls on a working day, it converts into a holiday.
                Employees will not be penalized as absent.
              </p>
              <form onSubmit={handleAddHoliday} style={{ marginTop: 16 }}>
                <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
                  <label>
                    Holiday Date
                    <input
                      type="date"
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      required
                    />
                  </label>
                  <label style={{ flex: 1, minWidth: 220 }}>
                    Holiday Name
                    <input
                      type="text"
                      placeholder="e.g. Independence Day, Eid Holiday, Labour Day"
                      value={holidayName}
                      onChange={(e) => setHolidayName(e.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" className="btn" disabled={savingHoliday}>
                    {savingHoliday ? "Adding..." : "Add Public Holiday"}
                  </button>
                </div>

                {holidayDate ? (
                  <div style={{ marginTop: 10, fontSize: 13 }} className="muted">
                    Selected day: <strong>{selectedHolidayWeekday}</strong>.{" "}
                    {holidayIsWeekday ? (
                      <span className="badge holiday">
                        Working Day → Converted to Public Holiday
                      </span>
                    ) : (
                      <span className="badge wait">Weekend Holiday</span>
                    )}
                  </div>
                ) : null}

                {holidayError ? (
                  <p className="error" style={{ marginTop: 12 }}>
                    {holidayError}
                  </p>
                ) : null}
              </form>
            </article>
          ) : null}

          <article className="card">
            <h2>Public Holidays List</h2>
            <p className="muted">All scheduled public holidays recognized by attendance and dashboards.</p>
            {holidays.length === 0 ? (
              <p className="muted" style={{ marginTop: 16 }}>
                No public holidays added yet.
              </p>
            ) : (
              <table className="table" style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Holiday Name</th>
                    <th>Original Day</th>
                    {canManage ? <th>Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((holiday) => {
                    const isWeekday = !isDayWeekendNatural(holiday.date);
                    return (
                      <tr key={holiday.date}>
                        <td>
                          <strong>{formatDateLong(holiday.date)}</strong>
                        </td>
                        <td>{weekdayName(holiday.date)}</td>
                        <td>
                          <span className="badge holiday">{holiday.name}</span>
                        </td>
                        <td>
                          {isWeekday ? (
                            <span className="muted">Working Day (Converted)</span>
                          ) : (
                            <span className="muted">Weekend</span>
                          )}
                        </td>
                        {canManage ? (
                          <td>
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ padding: "4px 10px", fontSize: 13 }}
                              onClick={() => void handleDeleteHoliday(holiday.date)}
                            >
                              Remove
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </article>
        </div>
      )}

      {activeTab === "working_days" && (
        <div style={{ display: "grid", gap: 24 }}>
          {canManage ? (
            <article className="card">
              <h2>Consider Weekend as a Working Day</h2>
              <p className="muted">
                Designate a weekend day (Saturday or Sunday) as an active working day. Check-in will be open for
                staff, and attendance will be recorded normally.
              </p>
              <form onSubmit={handleAddWorkingDay} style={{ marginTop: 16 }}>
                <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
                  <label>
                    Weekend Date
                    <input
                      type="date"
                      value={workingDate}
                      onChange={(e) => setWorkingDate(e.target.value)}
                      required
                    />
                  </label>
                  <label style={{ flex: 1, minWidth: 220 }}>
                    Reason / Description (Optional)
                    <input
                      type="text"
                      placeholder="e.g. Makeup Day, Shift Swap, Critical Project Sprint"
                      value={workingReason}
                      onChange={(e) => setWorkingReason(e.target.value)}
                    />
                  </label>
                  <button type="submit" className="btn" disabled={savingWorking}>
                    {savingWorking ? "Saving..." : "Consider as Working Day"}
                  </button>
                </div>

                {workingDate ? (
                  <div style={{ marginTop: 10, fontSize: 13 }} className="muted">
                    Selected day: <strong>{selectedWorkingWeekday}</strong>.{" "}
                    {workingIsWeekend ? (
                      <span className="badge" style={{ background: "#e8f5e9", color: "#1f6b4a" }}>
                        Weekend → Converted to Working Day
                      </span>
                    ) : (
                      <span className="badge wait">Already a regular weekday</span>
                    )}
                  </div>
                ) : null}

                {workingError ? (
                  <p className="error" style={{ marginTop: 12 }}>
                    {workingError}
                  </p>
                ) : null}
              </form>
            </article>
          ) : null}

          <article className="card">
            <h2>Working Weekend Days List</h2>
            <p className="muted">Weekend dates configured to function as active working days.</p>
            {workingDays.length === 0 ? (
              <p className="muted" style={{ marginTop: 16 }}>
                No working weekend days configured yet.
              </p>
            ) : (
              <table className="table" style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Reason</th>
                    <th>Status</th>
                    {canManage ? <th>Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {workingDays.map((workingDay) => {
                    const isWk = isDayWeekendNatural(workingDay.date);
                    return (
                      <tr key={workingDay.date}>
                        <td>
                          <strong>{formatDateLong(workingDay.date)}</strong>
                        </td>
                        <td>{weekdayName(workingDay.date)}</td>
                        <td>{workingDay.reason || <span className="muted">Working Day</span>}</td>
                        <td>
                          <span className="badge" style={{ background: "#e8f5e9", color: "#1f6b4a" }}>
                            Working Day {isWk ? "(Weekend Converted)" : ""}
                          </span>
                        </td>
                        {canManage ? (
                          <td>
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ padding: "4px 10px", fontSize: 13 }}
                              onClick={() => void handleDeleteWorkingDay(workingDay.date)}
                            >
                              Revert to Weekend
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
