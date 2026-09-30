import { Navigate, Route, Routes } from "react-router-dom";
import { AccountSettings } from "../AccountSettings";
import { AccountSettingsButton, ReportIcon, SideLink } from "../ShellChrome";
import { logout, useSession } from "../store";
import { AttendanceList } from "./AttendanceList";
import { AttendanceReport } from "./AttendanceReport";

export function HrShell() {
  const session = useSession();
  if (!session) return <Navigate to="/" replace />;

  return (
    <div className="admin-frame">
      <aside className="sidenav">
        <div className="sidenav-brand">
          <img src="/pss-logo.png?v=3" alt="Pak Surveillance Shield" className="logo logo-side" />
          <strong>PSS</strong>
        </div>
        <p className="nav-label">Menu</p>
        <nav>
          <SideLink to="/attendance" icon={<ReportIcon />}>
            Attendance
          </SideLink>
        </nav>
      </aside>
      <div className="admin-main">
        <header className="topbar">
          <div className="brand">
            <strong>PSS Attendance</strong>
            <span>HR</span>
          </div>
          <div className="who">
            <div>
              <strong>{session.name}</strong>
              <div>
                <span>HR · {session.userId}</span>
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
            <Route path="/attendance" element={<AttendanceList />} />
            <Route path="/attendance/:userId" element={<AttendanceReport />} />
            <Route path="/account" element={<AccountSettings person={session} />} />
            <Route path="*" element={<Navigate to="/attendance" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
