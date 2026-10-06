import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PeriodChart } from "./PeriodChart";
import type { LeaveRequest, Person } from "./types";
import { attendanceHref, deleteLeave, isOnLeave, personTeams, reviewableLeave, reviewLeave, teamName, teamRoster, todayKey, useDatabase, useSession } from "./store";

const GREEN = "#1f6b4a";
const AMBER = "#9a5b12";
const RED = "#9f1239";
const LEAVE = "#1d4e89";

const tooltipStyle = {
  background: "#fffdf8",
  border: "1px solid #e4d9c8",
  borderRadius: 12,
  fontSize: 13,
};

const noon = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
};

const periodDays = (mode: "week" | "month") => {
  const today = noon(new Date());
  const start = new Date(today);
  if (mode === "week") {
    const weekday = start.getDay();
    start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  } else {
    start.setDate(1);
  }
  const days: Date[] = [];
  for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    days.push(noon(cursor));
  }
  return days;
};

type LeaveFocus =
  | { kind: "pending" | "approved" | "rejected"; title: string }
  | { kind: "day"; title: string; day: string };

export function TeamLeaveBoard({ lead }: { lead: Person }) {
  const db = useDatabase();
  const [range, setRange] = useState<"week" | "month">("week");
  const [focus, setFocus] = useState<LeaveFocus | null>(null);
  const requests = reviewableLeave(lead, db.people, db.leave);
  const members = useMemo(() => teamRoster(lead, db.people), [db.people, lead]);
  const pending = requests.filter((request) => request.status === "pending");
  const accepted = requests.filter((request) => request.status === "approved");
  const rejected = requests.filter((request) => request.status === "rejected");
  const leadTeams = personTeams(lead);

  const open = (next: LeaveFocus) => {
    setFocus((current) => (current && current.title === next.title && current.kind === next.kind ? null : next));
  };

  const mix = [
    { name: "Pending", value: pending.length, color: AMBER },
    { name: "Accepted", value: accepted.length, color: GREEN },
    { name: "Rejected", value: rejected.length, color: RED },
  ];

  const trend = periodDays(range).map((date) => {
    const day = todayKey(date);
    return {
      day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      when: day,
      onLeave: members.filter((person) => isOnLeave(person.userId, db.leave, day)).length,
    };
  });

  const listed =
    focus?.kind === "pending" ? pending : focus?.kind === "approved" ? accepted : focus?.kind === "rejected" ? rejected : [];

  const dayPeople =
    focus?.kind === "day" ? members.filter((person) => isOnLeave(person.userId, db.leave, focus.day)) : [];

  return (
    <>
      <p className="muted">Review leave from your team. Click a count or the chart to see who it includes.</p>
      <div className="dash-stats">
        <button
          type="button"
          className={focus?.kind === "pending" ? "card stat dash-hit on" : "card stat dash-hit"}
          onClick={() => open({ kind: "pending", title: "Pending leave" })}
        >
          <span>Pending</span>
          <strong className="tone-amber">{pending.length}</strong>
        </button>
        <button
          type="button"
          className={focus?.kind === "approved" ? "card stat dash-hit on" : "card stat dash-hit"}
          onClick={() => open({ kind: "approved", title: "Accepted leave" })}
        >
          <span>Accepted</span>
          <strong className="tone-green">{accepted.length}</strong>
        </button>
        <button
          type="button"
          className={focus?.kind === "rejected" ? "card stat dash-hit on" : "card stat dash-hit"}
          onClick={() => open({ kind: "rejected", title: "Rejected leave" })}
        >
          <span>Rejected</span>
          <strong>{rejected.length}</strong>
        </button>
        <article className="card stat">
          <span>Total leaves</span>
          <strong>{requests.length}</strong>
        </article>
      </div>

      <div className="dash-charts">
        <article className="card">
          <h2>Requests</h2>
          <p className="muted">Pending, accepted, and rejected leave on your team.</p>
          <div className="chart-box">
            {requests.length === 0 ? (
              <p className="muted chart-empty">No leave requests yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={3}
                    onClick={(slice) => {
                      const name = String(slice.name);
                      const kind = name === "Pending" ? "pending" : name === "Accepted" ? "approved" : "rejected";
                      open({ kind, title: `${name} leave` });
                    }}
                  >
                    {mix.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} cursor="pointer" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    onClick={(item) => {
                      const name = String(item.value);
                      const kind = name === "Pending" ? "pending" : name === "Accepted" ? "approved" : "rejected";
                      open({ kind, title: `${name} leave` });
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="card">
          <div className="calendar-head">
            <div>
              <h2>{range === "week" ? "This week" : "This month"}</h2>
              <p className="muted">Bars show people on approved leave. The line is the leave trend. Click a bar to see who.</p>
            </div>
            <div className="filters">
              <button type="button" className={range === "week" ? "chip on" : "chip"} onClick={() => setRange("week")}>
                Week
              </button>
              <button type="button" className={range === "month" ? "chip on" : "chip"} onClick={() => setRange("month")}>
                Month
              </button>
            </div>
          </div>
          <div className="chart-box">
            <PeriodChart
              data={trend}
              bars={[{ key: "onLeave", name: "On leave", color: LEAVE }]}
              trendKey="onLeave"
              trendName="Leave trend"
              trendColor={LEAVE}
              onBarClick={(_key, row) => open({ kind: "day", day: String(row.when), title: `On leave · ${row.day}` })}
            />
          </div>
        </article>
      </div>

      {focus ? (
        <article className="card roster">
          <h2>{focus.title}</h2>
          <p className="muted">
            {(focus.kind === "day" ? dayPeople.length : listed.length)}{" "}
            {focus.kind === "day"
              ? dayPeople.length === 1
                ? "person"
                : "people"
              : listed.length === 1
                ? "request"
                : "requests"}
            .
          </p>
          {focus.kind === "day" ? (
            dayPeople.length === 0 ? (
              <p className="muted">No one was on leave.</p>
            ) : (
              <div className="roster-team">
                <ul>
                  {dayPeople.map((person) => (
                    <li key={person.userId}>
                      <Link className="roster-person" to={attendanceHref(person.userId, "leave")}>
                        <span>
                          {person.name}
                          <small>{person.userId}</small>
                        </span>
                        <span>{personTeams(person).filter((team) => leadTeams.includes(team)).map((team) => teamName(team)).join(", ")}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ) : listed.length === 0 ? (
            <p className="muted">No leave requests match this view.</p>
          ) : (
            <div className="roster-team">
              <ul>
                {listed.map((request) => {
                  const owner = db.people.find((person) => person.userId === request.userId);
                  return (
                    <li key={request.id}>
                      <Link className="roster-person" to={attendanceHref(request.userId, "leave")}>
                        <span>
                          {owner?.name ?? request.userId}
                          <small>
                            {request.from}
                            {request.to !== request.from ? ` to ${request.to}` : ""}
                          </small>
                        </span>
                        <span>{request.reason}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </article>
      ) : null}

      <LeaveInbox requests={requests} reviewerId={lead.userId} title="Team leave" />
    </>
  );
}

export function LeaveInbox({
  requests,
  reviewerId,
  title,
}: {
  requests: LeaveRequest[];
  reviewerId: string;
  title: string;
}) {
  const db = useDatabase();
  const session = useSession();
  const isAdmin = session?.role === "admin";
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const review = async (id: string, decision: "approved" | "rejected") => {
    try {
      await reviewLeave(id, reviewerId, decision, notes[id]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review this request.");
    }
  };

  const remove = async (request: LeaveRequest) => {
    const owner = db.people.find((person) => person.userId === request.userId);
    const name = owner?.name ?? request.userId;
    if (!confirm(`Delete ${name}'s leave from ${request.from}${request.to !== request.from ? ` to ${request.to}` : ""}? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteLeave(request.id);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this leave.");
    }
  };

  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted">
        {isAdmin
          ? "You can approve or reject a request again after it has been decided, or delete it. A rejection needs a reason. That reason is what the employee sees."
          : "A rejection needs a reason. That reason is what the employee sees."}
      </p>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Person</th>
            <th>Dates</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan={5}>No leave requests.</td>
            </tr>
          ) : (
            requests.map((request) => {
              const owner = db.people.find((person) => person.userId === request.userId);
              return (
                <tr key={request.id}>
                  <td>
                    <Link className="name-btn" to={attendanceHref(request.userId, "leave")}>
                      {owner?.name ?? request.userId}
                    </Link>
                    <div className="muted">{owner?.userId}</div>
                  </td>
                  <td>
                    {request.from}
                    {request.to !== request.from ? ` → ${request.to}` : ""}
                  </td>
                  <td>{request.reason}</td>
                  <td>
                    <span
                      className={
                        request.status === "approved" ? "badge" : request.status === "rejected" ? "badge no" : "badge wait"
                      }
                    >
                      {request.status}
                    </span>
                  </td>
                  <td>
                    {request.userId !== reviewerId && (isAdmin || request.status === "pending") ? (
                      <div className="row">
                        <input
                          placeholder="Rejection reason"
                          value={notes[request.id] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [request.id]: event.target.value }))
                          }
                        />
                        <button
                          className="btn"
                          disabled={request.status === "approved"}
                          onClick={() => review(request.id, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="btn danger"
                          disabled={request.status === "rejected"}
                          onClick={() => review(request.id, "rejected")}
                        >
                          Reject
                        </button>
                        {isAdmin ? (
                          <button className="btn secondary" onClick={() => remove(request)}>
                            Delete
                          </button>
                        ) : null}
                      </div>
                    ) : request.status === "rejected" ? (
                      request.rejectionReason
                    ) : request.userId === reviewerId ? (
                      isAdmin ? (
                        <button className="btn secondary" onClick={() => remove(request)}>
                          Delete
                        </button>
                      ) : (
                        "Your request"
                      )
                    ) : (
                      "Approved"
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

export function LeavePage() {
  const db = useDatabase();
  const session = useSession();
  const accepted = db.leave.filter((request) => request.status === "approved").length;
  const rejected = db.leave.filter((request) => request.status === "rejected").length;
  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Leave</h1>
          <p className="muted">
            Accepted and rejected requests are counted here. You can change a decision or delete a leave.
          </p>
        </div>
      </div>
      <div className="dash-stats">
        <article className="card stat">
          <span>Total leaves</span>
          <strong>{db.leave.length}</strong>
        </article>
        <article className="card stat">
          <span>Accepted</span>
          <strong className="tone-green">{accepted}</strong>
        </article>
        <article className="card stat">
          <span>Rejected</span>
          <strong className="tone-amber">{rejected}</strong>
        </article>
      </div>
      <LeaveInbox requests={db.leave} reviewerId={session?.userId ?? ""} title="Leave requests" />
    </section>
  );
}
