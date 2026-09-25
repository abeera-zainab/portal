import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "sonner";
import { RequireAuth } from "./components/auth/RequireAuth";
import { ThemeProvider } from "./context/ThemeContext";

import { Login } from "./routes/shared/Login";
import { AdminLogin } from "./routes/shared/AdminLogin";
import { AccessDenied } from "./routes/shared/AccessDenied";

import { EmployeeLayout } from "./routes/employee/Layout";
import { EmployeeDashboard } from "./routes/employee/Dashboard";
import { EmployeeCalendar } from "./routes/employee/Calendar";
import { EmployeeSalary } from "./routes/employee/Salary";
import { EmployeeLeave } from "./routes/employee/Leave";
import { TeamLeaveInbox } from "./routes/team/LeaveInbox";
import { TeamAttendance } from "./routes/team/TeamAttendance";

import { AdminLayout } from "./routes/admin/Layout";
import { AdminDashboard } from "./routes/admin/dashboard/Dashboard";
import { EmployeeList } from "./routes/admin/employees/EmployeeList";
import { EmployeeHistory } from "./routes/admin/employees/EmployeeHistory";
import { AdminList } from "./routes/admin/admins/AdminList";
import { AttendanceView } from "./routes/admin/attendance/AttendanceView";
import { CalendarView } from "./routes/admin/calendar/CalendarView";
import { HolidayManagement } from "./routes/admin/holidays/HolidayManagement";
import { SalaryReports } from "./routes/admin/reports/SalaryReports";
import { PaidSalaries } from "./routes/admin/reports/PaidSalaries";
import { OvertimePage } from "./routes/admin/overtime/Overtime";
import { Settings } from "./routes/admin/settings/Settings";
import { AdminLeaveInbox } from "./routes/admin/leave/LeaveInbox";
import { SettingsProvider } from "./context/SettingsContext";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/access-denied" element={<AccessDenied />} />

              <Route
                path="/"
                element={
                  <RequireAuth roles={["employee", "team_lead"]}>
                    <EmployeeLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<EmployeeDashboard />} />
                <Route path="calendar" element={<EmployeeCalendar />} />
                <Route path="salary" element={<EmployeeSalary />} />
                <Route path="leave" element={<EmployeeLeave />} />
                <Route
                  path="team/leave"
                  element={
                    <RequireAuth roles={["team_lead"]}>
                      <TeamLeaveInbox />
                    </RequireAuth>
                  }
                />
                <Route
                  path="team/attendance"
                  element={
                    <RequireAuth roles={["team_lead"]}>
                      <TeamAttendance />
                    </RequireAuth>
                  }
                />
              </Route>

              <Route
                path="/admin"
                element={
                  <RequireAuth roles={["admin"]}>
                    <AdminLayout />
                  </RequireAuth>
                }
              >
                <Route
                  index
                  element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="employees" element={<EmployeeList />} />
                <Route path="employees/:uid" element={<EmployeeHistory />} />
                <Route path="admins" element={<AdminList />} />
                <Route path="attendance" element={<AttendanceView />} />
                <Route path="leave" element={<AdminLeaveInbox />} />
                <Route path="calendar" element={<CalendarView />} />
                <Route path="holidays" element={<HolidayManagement />} />
                <Route path="reports" element={<SalaryReports />} />
                <Route path="paid-salaries" element={<PaidSalaries />} />
                <Route path="overtime" element={<OvertimePage />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>

          <Toaster position="bottom-right" richColors />
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
