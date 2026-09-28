import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Person, WorkMode } from "../types";
import {
  attendanceStatus,
  isOfficer,
  isPersonActive,
  personTeams,
  roleTags,
  setLateAllowed,
  setOfficerTag,
  setPersonActive,
  setWorkMode,
  teamName,
  useDatabase,
  useSession,
} from "../store";

export function assignedPlaceTags(person: Person) {
  if (person.role === "admin") return [];
  const tags: { id: string; label: string; className: string }[] = [];
  if (person.lateAllowed) tags.push({ id: "late", label: "Late check-in", className: "badge late" });
  if (person.workMode === "wfh") tags.push({ id: "wfh", label: "Work from home", className: "badge" });
  if (person.workMode === "remote") tags.push({ id: "remote", label: "Remote", className: "badge remote" });
  return tags;
}

export function AssignedTags({ person }: { person: Person }) {
  const db = useDatabase();
  const roles = roleTags(person).filter((tag) => tag.id === "officer" || tag.id === "team_lead" || tag.id === "mto");
  const places = assignedPlaceTags(person);
  const status = person.role === "admin" ? null : attendanceStatus(person.userId, db.attendance, db.leave);
  const onLeave = status === "leave";
  const lateToday = status === "late";
  if (!roles.length && !places.length && !onLeave && !lateToday) return null;
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
    </div>
  );
}

function sharesTeam(viewer: Person, person: Person) {
  const leadTeams = personTeams(viewer);
  return personTeams(person).some((team) => leadTeams.includes(team));
}

export function canAdjustPerson(viewer: Person | null, person: Person) {
  if (!viewer) return false;
  if (viewer.role === "admin") return true;
  if (viewer.role !== "team_lead" || person.role === "admin") return false;
  return sharesTeam(viewer, person);
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
      <p className="muted">Only tags you turn on are shown on the user list.</p>
      {person.role === "admin" ? null : (
        <div className="role-tags">
          <button
            type="button"
            className={isOfficer(person) ? "domain on" : "domain"}
            onClick={() => void run(() => setOfficerTag(person.userId, !isOfficer(person)))}
          >
            Officer
          </button>
          <button
            type="button"
            className={person.lateAllowed ? "domain on" : "domain"}
            onClick={() => void run(() => setLateAllowed(person.userId, !person.lateAllowed))}
          >
            Late check-in
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

export function UserDetail({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  const { userId = "" } = useParams();
  const db = useDatabase();
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

  const active = isPersonActive(person);

  return (
    <section className="manage">
      <Link className="back-link" to={backTo}>
        {backLabel}
      </Link>
      <div className="manage-head">
        <div>
          <h1>{person.name}</h1>
          <p className="muted">
            {person.userId} · @{person.username} · {person.email}
            {personTeams(person).length
              ? ` · ${personTeams(person).map((team) => teamName(team)).join(", ")}`
              : ""}
          </p>
          <AssignedTags person={person} />
        </div>
        <Link className="btn secondary" to={`/attendance/${person.userId}`}>
          Attendance report
        </Link>
      </div>
      <div className="card">
        <h2>Account</h2>
        <p>
          <span className={active ? "status on" : "status off"}>{active ? "Active" : "Inactive"}</span>
        </p>
        <p className="muted">Joined {person.joined || "—"}</p>
      </div>
      <PersonAdjust person={person} />
    </section>
  );
}
