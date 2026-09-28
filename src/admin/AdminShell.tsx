import { Navigate, Route, Routes } from "react-router-dom";
import { AccountSettings } from "../AccountSettings";
import { LeavePage } from "../LeaveReview";
import {
  AccountSettingsButton,
  DashboardIcon,
  LeaveIcon,
  LeaveNotifications,
  PeopleIcon,
  ReportIcon,
  SideLink,
} from "../ShellChrome";
import { logout, useSession } from "../store";
import { AttendanceList } from "./AttendanceList";
import { AttendanceReport } from "./AttendanceReport";
import { Dashboard } from "./Dashboard";
import { UserDetail } from "./PersonDetail";
import { UserManagement } from "./UserManagement";

export function AdminShell() {
  const session = useSession();
  if (!session) return <Navigate to="/" replace />;

  return (
    <div className="admin-frame">
      <aside className="sidenav">
        <div className="sidenav-brand">
          <img src="/pss-logo.png?v=3" alt="Pak Surveillance Shield" className="logo logo-side" />
          <strong>PSS</strong>
        </div>
        <LeaveNotifications person={session} />
        <p className="nav-label">Menu</p>
        <nav>
          <SideLink to="/dashboard" end icon={<DashboardIcon />}>
            Dashboard
          </SideLink>
          <SideLink to="/users" icon={<PeopleIcon />}>
            User management
          </SideLink>
          <SideLink to="/attendance" icon={<ReportIcon />}>
            Attendance report
          </SideLink>
          <SideLink to="/leave" end icon={<LeaveIcon />}>
            Leave
          </SideLink>
        </nav>
      </aside>
      <div className="admin-main">
        <header className="topbar">
          <div className="brand">
            <strong>PSS Attendance</strong>
            <span>Admin</span>
          </div>
          <div className="who">
            <div>
              <strong>{session.name}</strong>
              <div>
                <span>{session.userId}</span>
              </div>
            </div>
            <AccountSettingsButton />
            <button className="btn secondary" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <div className="admin-page">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users/:userId" element={<UserDetail backTo="/users" backLabel="← Back to users" />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/attendance" element={<AttendanceList />} />
            <Route path="/attendance/:userId" element={<AttendanceReport />} />
            <Route path="/leave" element={<LeavePage />} />
            <Route path="/account" element={<AccountSettings person={session} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
