import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Person, Role, TeamId } from "../types";
import { AssignedTags } from "./PersonDetail";
import {
  TEAMS,
  createPerson,
  deletePerson,
  attendanceStatus,
  isPersonActive,
  personTeams,
  setPersonRole,
  teamName,
  togglePersonTeam,
  useDatabase,
  useSession,
} from "../store";

type Filter = "all" | "admin" | "team_lead" | "officer" | "employee" | TeamId;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "admin", label: "Admin" },
  { id: "team_lead", label: "Team leads" },
  { id: "officer", label: "Officers" },
  { id: "employee", label: "Team" },
  ...TEAMS.map((team) => ({ id: team.id, label: team.name.replace("PSS ", "PSS ") })),
];

const initials = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

const formatJoined = (value?: string) => {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function UserManagement() {
  const db = useDatabase();
  const session = useSession();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "employee" as Role,
    team: "offensive" as TeamId,
    userId: "",
  });

  const people = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return db.people
      .filter((person) => {
        if (filter === "officer") return person.role === "officer" || person.role === "team_lead";
        if (filter === "admin" || filter === "team_lead" || filter === "employee") {
          return person.role === filter;
        }
        if (filter !== "all") return personTeams(person).includes(filter);
        return true;
      })
      .filter((person) => {
        if (!needle) return true;
        return [person.name, person.userId, person.username, person.email]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.userId.localeCompare(a.userId));
  }, [db.people, filter, query]);

  const counts = {
    total: db.people.length,
    active: db.people.filter(isPersonActive).length,
    admins: db.people.filter((person) => person.role === "admin").length,
  };

  const run = async (action: () => Promise<void>) => {
    try {
      setError("");
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this person.");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await createPerson(form);
      setForm({ ...form, name: "", username: "", email: "", password: "", userId: "" });
      setShowForm(false);
    });
  };

  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>User management</h1>
          <p className="muted">
            {counts.total} total · {counts.active} active · {counts.admins} admins
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((open) => !open)}>
          New user
        </button>
      </div>

      {showForm ? (
        <form className="card" onSubmit={submit}>
          <h2>New user</h2>
          <div className="row" style={{ marginTop: 12 }}>
            <label>
              Name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
            <label>
              Username
              <input
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </label>
            <label>
              User ID
              <input
                value={form.userId}
                placeholder="PSS002"
                onChange={(event) => setForm({ ...form, userId: event.target.value })}
              />
            </label>
            <label>
              Role
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                <option value="employee">Team</option>
                <option value="officer">Officer</option>
                <option value="team_lead">Team lead</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {form.role !== "admin" ? (
              <label>
                Team
                <select
                  value={form.team}
                  onChange={(event) => setForm({ ...form, team: event.target.value as TeamId })}
                >
                  {TEAMS.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button className="btn" type="submit">
              Create account
            </button>
          </div>
        </form>
      ) : null}

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search by name, ID, username, or email..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="filters">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? "chip on" : "chip"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>ID no</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Teams</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {people.length === 0 ? (
              <tr>
                <td colSpan={9}>No people match this view.</td>
              </tr>
            ) : (
              people.map((person) => (
                <UserRow
                  key={person.userId}
                  person={person}
                  self={session?.userId === person.userId}
                  onRole={(role) => void run(() => setPersonRole(person.userId, role))}
                  onTeam={(team) => void run(() => togglePersonTeam(person.userId, team))}
                  onDelete={() => {
                    if (
                      confirm(
                        `Permanently delete ${person.name}? Their account, attendance, and leave records will be removed from PostgreSQL.`
                      )
                    ) {
                      void run(() => deletePerson(person.userId));
                    }
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserRow({
  person,
  self,
  onRole,
  onTeam,
  onDelete,
}: {
  person: Person;
  self: boolean;
  onRole: (role: Role) => void;
  onTeam: (team: TeamId) => void;
  onDelete: () => void;
}) {
  const db = useDatabase();
  const active = isPersonActive(person);
  const teams = personTeams(person);
  const today = attendanceStatus(person.userId, db.attendance, db.leave);

  return (
    <tr>
      <td>
        <div className="user-cell">
          <span className="avatar">{initials(person.name)}</span>
          <div>
            <Link className="name-btn" to={`/users/${person.userId}`}>
              {person.name}
            </Link>
            <AssignedTags person={person} />
          </div>
        </div>
      </td>
      <td>{person.userId}</td>
      <td>{person.username}</td>
      <td>{person.email}</td>
      <td>
        <select value={person.role} onChange={(event) => onRole(event.target.value as Role)}>
          <option value="employee">Team</option>
          <option value="officer">Officer</option>
          <option value="team_lead">Team lead</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td>
        {person.role === "admin" ? (
          "—"
        ) : (
          <div className="domain-list">
            {TEAMS.map((team) => (
              <button
                key={team.id}
                type="button"
                className={teams.includes(team.id) ? "domain on" : "domain"}
                onClick={() => onTeam(team.id)}
                title={teams.includes(team.id) ? `Remove ${team.name}` : `Add ${team.name}`}
              >
                {teamName(team.id).replace("Development", "Product")}
              </button>
            ))}
          </div>
        )}
      </td>
      <td>
        {person.role !== "admin" && today === "late" ? (
          <span className="badge late">Late</span>
        ) : person.role !== "admin" && today === "on_time" ? (
          <span className="badge">On time</span>
        ) : person.role !== "admin" && today === "leave" ? (
          <span className="badge leave">Leave</span>
        ) : person.role !== "admin" ? (
          <span className="badge wait">Not in</span>
        ) : (
          <span className={active ? "status on" : "status off"}>{active ? "Active" : "Inactive"}</span>
        )}
      </td>
      <td>{formatJoined(person.joined)}</td>
      <td>
        <div className="row">
          {self ? (
            <span className="muted">You</span>
          ) : (
            <>
              <button className="text-btn danger" onClick={onDelete}>
                Delete permanently
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
