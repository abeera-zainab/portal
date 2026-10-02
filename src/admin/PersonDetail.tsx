import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { Person, WorkMode } from "../types";
import {
  attendanceStatus,
  canReceiveReports,
  hasLeadRights,
  hasOfficerRank,
  hasTeamLeadRank,
  isCiso,
  isDirectReport,
  isOfficer,
  isPersonActive,
  personTeams,
  roleTags,
  setLateAllowed,
  setPersonActive,
  setPersonTags,
  setReportsTo,
  setWorkMode,
  reportingTitle,
  teamName,
  updatePersonAccount,
  useDatabase,
  useSession,
} from "../store";

export function assignedPlaceTags(person: Person) {
  if (person.role === "admin") return [];
  const tags: { id: string; label: string; className: string }[] = [];
  if (person.lateAllowed) tags.push({ id: "late", label: "Until 11:00", className: "badge late" });
  if (person.workMode === "wfh") tags.push({ id: "wfh", label: "Work from home", className: "badge" });
  if (person.workMode === "remote") tags.push({ id: "remote", label: "Remote", className: "badge remote" });
  return tags;
}

export function AssignedTags({ person }: { person: Person }) {
  const db = useDatabase();
  const roles = roleTags(person).filter((tag) => tag.id === "officer" || tag.id === "team_lead" || tag.id === "mto");
  const places = assignedPlaceTags(person);
  const status = person.role === "admin" ? null : attendanceStatus(person.userId, db.attendance, db.leave, new Date(), Boolean(person.lateAllowed));
  const onLeave = status === "leave";
  const lateToday = status === "late";
  const absenteeToday = status === "absentee";
  if (!roles.length && !places.length && !onLeave && !lateToday && !absenteeToday) return null;
  return (
    <div className="role-tags">
      {roles.map((tag) => (
        <span
          key={tag.id}
          className={tag.id === "officer" ? "badge officer" : tag.id === "mto" ? "badge mto" : "badge lead"}
        >
          {tag.label}
        </span>
      ))}
      {places.map((tag) => (
        <span key={tag.id} className={tag.className}>
          {tag.label}
        </span>
      ))}
      {onLeave ? <span className="badge leave">Leave</span> : null}
      {lateToday ? <span className="badge late">Late</span> : null}
      {absenteeToday ? <span className="badge no">Absentee</span> : null}
    </div>
  );
}

export function canViewPerson(viewer: Person | null, person: Person) {
  if (!viewer) return false;
  if (person.role === "hr" && viewer.role !== "hr") return false;
  if (viewer.role === "admin" || viewer.role === "hr" || viewer.userId === person.userId) return true;
  return isDirectReport(viewer, person);
}

export function canAdjustPerson(viewer: Person | null, person: Person) {
  if (!viewer) return false;
  if (viewer.role === "admin") return true;
  if (viewer.userId === person.userId) return hasLeadRights(viewer);
  if (!isDirectReport(viewer, person)) return false;
  if (hasOfficerRank(viewer)) return !isOfficer(person);
  if (hasTeamLeadRank(viewer)) return !isOfficer(person) && person.role !== "team_lead" && !person.mto;
  return false;
}

export function PersonAdjust({ person }: { person: Person }) {
  const session = useSession();
  const [error, setError] = useState("");
  if (!canAdjustPerson(session, person)) return null;
  const active = isPersonActive(person);

  const run = async (action: () => Promise<void>) => {
    try {
      setError("");
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this person.");
    }
  };

  const setPlace = (workMode: WorkMode | null) => {
    void run(() => setWorkMode(person.userId, workMode));
  };

  return (
    <section className="card">
      <h2>Tags and status</h2>
      <p className="muted">Choose one or more tags. A team lead can also be an officer and an MTO.</p>
      {person.role === "admin" ? null : (
        <fieldset className="tag-picks">
          <legend>Tags</legend>
          <label>
            <input
              type="checkbox"
              checked={isOfficer(person)}
              onChange={(event) =>
                void run(() => setPersonTags(person.userId, { officer: event.target.checked, mto: Boolean(person.mto) }))
              }
            />
            Officer
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(person.mto)}
              onChange={(event) =>
                void run(() => setPersonTags(person.userId, { officer: isOfficer(person), mto: event.target.checked }))
              }
            />
            MTO
          </label>
        </fieldset>
      )}
      {person.role === "admin" ? null : (
        <div className="role-tags">
          <button
            type="button"
            className={person.lateAllowed ? "domain on" : "domain"}
            onClick={() => void run(() => setLateAllowed(person.userId, !person.lateAllowed))}
          >
            Late check-in until 11:00
          </button>
          <button
            type="button"
            className={person.workMode === "wfh" ? "domain on" : "domain"}
            onClick={() => setPlace(person.workMode === "wfh" ? null : "wfh")}
          >
            Work from home
          </button>
          <button
            type="button"
            className={person.workMode === "remote" ? "domain on" : "domain"}
            onClick={() => setPlace(person.workMode === "remote" ? null : "remote")}
          >
            Remote
          </button>
        </div>
      )}
      <div className="row" style={{ marginTop: 14 }}>
        <span className={active ? "status on" : "status off"}>{active ? "Active" : "Inactive"}</span>
        {session?.userId === person.userId ? (
          <span className="muted">You cannot change your own status.</span>
        ) : (
          <button className="btn secondary" onClick={() => void run(() => setPersonActive(person.userId, !active))}>
            {active ? "Mark inactive" : "Mark active"}
          </button>
        )}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 6.5l3 3" />
    </svg>
  );
}

function AccountCard({ person }: { person: Person }) {
  const db = useDatabase();
  const session = useSession();
  const canEdit = canAdjustPerson(session, person);
  const manager = db.people.find((item) => item.userId === person.reportsTo);
  const managers = useMemo(
    () =>
      db.people
        .filter(canReceiveReports)
        .filter((item) => item.userId !== person.userId)
        .sort((a, b) => {
          if (isCiso(a) !== isCiso(b)) return isCiso(a) ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    [db.people, person.userId]
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.name);
  const [email, setEmail] = useState(person.email);
  const [username, setUsername] = useState(person.username);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const active = isPersonActive(person);

  useEffect(() => {
    setEditing(false);
    setPassword("");
    setConfirm("");
    setError("");
    setSaved("");
  }, [person.userId]);

  useEffect(() => {
    if (editing) return;
    setName(person.name);
    setEmail(person.email);
    setUsername(person.username);
  }, [editing, person.name, person.email, person.username]);

  const changeReports = async (reportsTo: string) => {
    try {
      setError("");
      setSaved("");
      await setReportsTo(person.userId, reportsTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update who this person reports to.");
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (password && password !== confirm) {
      setSaved("");
      setError("The new passwords do not match.");
      return;
    }
    if (password && password.length < 6) {
      setSaved("");
      setError("Password must be at least 6 characters.");
      return;
    }
    try {
      setError("");
      await updatePersonAccount(person.userId, {
        name,
        email,
        username,
        ...(password ? { password } : {}),
      });
      setPassword("");
      setConfirm("");
      setSaved("Account updated.");
      setEditing(false);
    } catch (err) {
      setSaved("");
      setError(err instanceof Error ? err.message : "Could not update this account.");
    }
  };

  return (
    <section className="card">
      <div className="card-title">
        <h2>Account</h2>
        {canEdit ? (
          <button
            type="button"
            className={editing ? "icon-btn active" : "icon-btn"}
            aria-label="Edit account"
            aria-expanded={editing}
            onClick={() => setEditing((current) => !current)}
          >
            <PencilIcon />
          </button>
        ) : null}
      </div>
      <dl className="profile-facts">
        <div>
          <dt>User ID</dt>
          <dd>{person.userId}</dd>
        </div>
        <div>
          <dt>Username</dt>
          <dd>@{person.username}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{person.email}</dd>
        </div>
        {person.role === "admin" ? null : (
          <div>
            <dt>Reports to</dt>
            <dd>
              {session?.role === "admin" ? (
                <select value={person.reportsTo ?? ""} onChange={(event) => void changeReports(event.target.value)}>
                  <option value="">Select a person</option>
                  {managers.map((item) => (
                    <option key={item.userId} value={item.userId}>
                      {item.name} · {reportingTitle(item)}
                    </option>
                  ))}
                </select>
              ) : manager ? (
                `${manager.name} · ${reportingTitle(manager)}`
              ) : (
                "—"
              )}
            </dd>
          </div>
        )}
        <div>
          <dt>Teams</dt>
          <dd>
            {personTeams(person).length
              ? personTeams(person).map((team) => (
                  <span key={team} className="badge team">
                    {teamName(team)}
                  </span>
                ))
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={active ? "status on" : "status off"}>{active ? "Active" : "Inactive"}</span>
          </dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{person.joined || "—"}</dd>
        </div>
      </dl>
      {editing ? (
        <form onSubmit={save} className="profile-form">
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
          <label>
            New password
            <input type="password" value={password} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>
            Confirm password
            <input type="password" value={confirm} autoComplete="new-password" onChange={(event) => setConfirm(event.target.value)} />
          </label>
          <button className="btn" type="submit">
            Save details
          </button>
        </form>
      ) : null}
      {saved ? <p className="muted">{saved}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

export function UserDetail({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  const { userId = "" } = useParams();
  const db = useDatabase();
  const session = useSession();
  const person = db.people.find((item) => item.userId === userId);

  if (!person) {
    return (
      <section className="manage">
        <Link className="back-link" to={backTo}>
          {backLabel}
        </Link>
        <p>That person could not be found.</p>
      </section>
    );
  }

  if (person.role === "hr" && session?.role !== "hr") {
    return (
      <section className="manage">
        <Link className="back-link" to={backTo}>
          {backLabel}
        </Link>
        <p>That person could not be found.</p>
      </section>
    );
  }

  if (!canViewPerson(session, person)) {
    return (
      <section className="manage">
        <Link className="back-link" to={backTo}>
          {backLabel}
        </Link>
        <p>You can only open people who report to you.</p>
      </section>
    );
  }

  return (
    <section className="manage">
      <Link className="back-link" to={backTo}>
        {backLabel}
      </Link>
      <header className="profile-head">
        <span className="avatar lg" aria-hidden="true">
          {initials(person.name)}
        </span>
        <div>
          <h1>{person.name}</h1>
          <AssignedTags person={person} />
          <p className="muted">{person.userId}</p>
        </div>
        <Link className="btn secondary" to={`/attendance/${person.userId}`}>
          Attendance report
        </Link>
      </header>
      <AccountCard person={person} />
      <PersonAdjust person={person} />
    </section>
  );
}
