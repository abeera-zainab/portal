import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import type { Person } from "./types";
import { canReviewLeave, hasLeadRights, hasOfficerRank, hasTeamLeadRank, isOfficer, useDatabase } from "./store";

export function SideLink({
  to,
  end,
  icon,
  children,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
      <span className="nav-ico" aria-hidden="true">
        {icon}
      </span>
      {children}
    </NavLink>
  );
}

export function LeaveNotifications({ person }: { person: Person }) {
  const db = useDatabase();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const items = leaveAlerts(person, db.people, db.leave);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="note-wrap" ref={wrap}>
      <button
        type="button"
        className={open ? "nav-note on" : "nav-note"}
        aria-label="Leave notifications"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <BellIcon />
        <span>Notifications</span>
        {items.length ? <span className="note-badge">{items.length}</span> : null}
      </button>
      {open ? (
        <div className="note-panel" role="region" aria-label="Leave notifications">
          <strong>Leave</strong>
          {items.length === 0 ? (
            <p className="muted">No leave notifications.</p>
          ) : (
            <div className="note-list">
              {items.map((item) => (
                <Link key={item.id} className="note-item" to={item.href} onClick={() => setOpen(false)}>
                  <span>{item.title}</span>
                  <small>{item.detail}</small>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AccountSettingsButton() {
  return (
    <NavLink
      to="/account"
      end
      className={({ isActive }) => (isActive ? "icon-btn active" : "icon-btn")}
      aria-label="Account settings"
      title="Account settings"
    >
      <GearIcon />
    </NavLink>
  );
}

function leaveAlerts(
  person: Person,
  people: Person[],
  leave: { id: string; userId: string; from: string; to: string; status: string; rejectionReason?: string }[]
) {
  const range = (from: string, to: string) => (to !== from ? `${from} to ${to}` : from);
  const items: { id: string; title: string; detail: string; href: string }[] = [];

  for (const request of leave) {
    if (request.userId !== person.userId) continue;
    const dates = range(request.from, request.to);
    if (request.status === "pending") {
      items.push({
        id: request.id,
        title:
          person.role === "admin" || hasOfficerRank(person)
            ? "Your leave is with an admin"
            : hasTeamLeadRank(person)
              ? "Your leave is with an officer or an admin"
              : "Your leave request is pending",
        detail: dates,
        href: "/leave",
      });
    } else if (request.status === "approved") {
      items.push({
        id: request.id,
        title: "Your leave was approved",
        detail: dates,
        href: "/leave",
      });
    } else if (request.status === "rejected") {
      items.push({
        id: request.id,
        title: "Your leave was rejected",
        detail: request.rejectionReason ? `${dates}. ${request.rejectionReason}` : dates,
        href: "/leave",
      });
    }
  }

  const pending = leave.filter((request) => request.status === "pending" && request.userId !== person.userId);
  if (person.role === "admin") {
    for (const request of pending) {
      const owner = people.find((item) => item.userId === request.userId);
      const name = owner?.name ?? request.userId;
      const standing = !owner
        ? ""
        : isOfficer(owner)
          ? " (officer)"
          : owner.role === "team_lead"
            ? " (team lead)"
            : owner.mto
              ? " (MTO)"
              : "";
      items.push({
        id: request.id,
        title: `${name}${standing} requested leave`,
        detail: range(request.from, request.to),
        href: "/leave",
      });
    }
  } else if (hasLeadRights(person)) {
    for (const request of pending) {
      const owner = people.find((item) => item.userId === request.userId);
      if (!owner || !canReviewLeave(person, owner)) continue;
      items.push({
        id: request.id,
        title: `${owner.name} requested leave`,
        detail: range(request.from, request.to),
        href: "/leave",
      });
    }
  }

  return items;
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 9a6 6 0 1 1 12 0c0 7 2 7 2 7H4s2 0 2-7" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7V20a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S14 16 14.5 19" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 14.6c2.2.3 3.8 1.6 4.5 4.4" />
    </svg>
  );
}

export function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M4 10h16" />
    </svg>
  );
}

export function LeaveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 4h8l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M15 4v4h4M8 13h8M8 17h5" />
    </svg>
  );
}

export function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c.8-3.2 3.4-5 7-5s6.2 1.8 7 5" />
    </svg>
  );
}
