import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Users,
  CheckCircle,
  Coffee,
  Clock,
  Plus,
  CalendarDays,
  Settings,
  ArrowRight,
  UserCog,
  Banknote,
  TrendingDown,
} from "lucide-react";
import {
  getAllEmployees,
  getAllAdmins,
  getAttendanceForDate,
  generateMonthlyReport,
  getPortalSettings,
} from "../../../lib/firestore";
import { getSalaryMonthKey } from "../../../lib/salary";
import {
  format,
  subMonths,
  subDays,
  eachDayOfInterval,
  isValid,
  parseISO,
} from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Employee } from "../../../types";
import { Select } from "../../../components/ui/select";
import { useSettings } from "../../../context/SettingsContext";
import { useAuth } from "../../../context/AuthContext";

interface ActivityItem {
  uid: string;
  name: string;
  empId: string;
  time?: string;
  reason?: string;
  status: string;
}

type FilterType = "today" | "yesterday" | "custom" | "month";

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings: portalSettings } = useSettings();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);

  // Filter State
  const [filterType, setFilterType] = useState<FilterType>("today");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    // Default to the 15th of the current month to ensure we get the current salary cycle
    // (since cycle starts on 6th, 1st would give previous month)
    (() => {
      const d = new Date();
      d.setDate(15);
      return d.toISOString();
    })()
  );
  const [customRange, setCustomRange] = useState({
    start: format(new Date(), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });

  const [stats, setStats] = useState({
    present: 0,
    leave: 0,
    off: 0,
    absent: 0,
    late: 0,
    admins: 0,
    totalSalary: 0,
    totalDeductions: 0,
  });
  const [lateArrivals, setLateArrivals] = useState<ActivityItem[]>([]);
  const [onLeave, setOnLeave] = useState<ActivityItem[]>([]);

  // Generate last 12 months for filter
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    d.setDate(15); // Set to 15th to capture the correct salary cycle
    return d;
  });

  useEffect(() => {
    loadDashboardData();
  }, [filterType, selectedMonth, customRange.start, customRange.end]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Determine Date Range based on Filter
      let startDate: Date;
      let endDate: Date;
      let isMonthlyReport = false;

      const today = new Date();

      switch (filterType) {
        case "today":
          startDate = today;
          endDate = today;
          break;
        case "yesterday":
          const yesterday = subDays(today, 1);
          startDate = yesterday;
          endDate = yesterday;
          break;
        case "custom":
          startDate = parseISO(customRange.start);
          endDate = parseISO(customRange.end);
          if (!isValid(startDate) || !isValid(endDate)) {
            setLoading(false);
            return; // Invalid dates
          }
          break;
        case "month":
          startDate = parseISO(selectedMonth);
          endDate = parseISO(selectedMonth); // Just used for month key
          isMonthlyReport = true;
          break;
        default:
          startDate = today;
          endDate = today;
      }

      // 2. Fetch Base Data
      const [employees, admins] = await Promise.all([
        getAllEmployees(),
        getAllAdmins(),
      ]);
      setTotalEmployees(employees.length);

      // 3. Fetch Attendance Data
      let aggregatedStats = {
        present: 0,
        late: 0,
        leave: 0,
        off: 0,
        unmarked: 0,
      };

      let lateList: ActivityItem[] = [];
      let leaveList: ActivityItem[] = [];
      let totalDeductions = 0;

      if (isMonthlyReport) {
        // --- MONTHLY REPORT LOGIC ---
        const settings = await getPortalSettings();
        const salaryStartDay = settings?.salaryStartDay || 6;
        const salaryMonthKey = getSalaryMonthKey(startDate, salaryStartDay);

        const monthlyReports = await generateMonthlyReport(salaryMonthKey);

        // Calculate Totals
        monthlyReports.forEach((report) => {
          aggregatedStats.present += report.presentDays;
          aggregatedStats.late += report.lateCount;
          aggregatedStats.leave += report.leaveDays;
          aggregatedStats.off += report.offDays;
          aggregatedStats.unmarked += report.unmarkedDays;
          totalDeductions += report.totalDeductions;
        });

        // Top Lists
        const topLate = [...monthlyReports]
          .sort((a, b) => b.lateCount - a.lateCount)
          .filter((r) => r.lateCount > 0)
          .slice(0, 5);

        lateList = topLate.map((r) => ({
          uid: r.employeeUid,
          name: r.employeeName,
          empId: r.empId,
          time: `${r.lateCount} days`,
          status: "late",
        }));

        const topLeaves = [...monthlyReports]
          .sort((a, b) => b.leaveDays - a.leaveDays)
          .filter((r) => r.leaveDays > 0)
          .slice(0, 5);

        leaveList = topLeaves.map((r) => ({
          uid: r.employeeUid,
          name: r.employeeName,
          empId: r.empId,
          reason: `${r.leaveDays} days`,
          status: "leave",
        }));
      } else {
        // --- DAILY / RANGE LOGIC ---
        const days = eachDayOfInterval({ start: startDate, end: endDate });

        // Limit range to prevent overload (e.g., max 60 days)
        if (days.length > 60) {
          toast.error("Date range too large. Please select a smaller range.");
          setLoading(false);
          return;
        }

        const recordsPromises = days.map((day) =>
          getAttendanceForDate(format(day, "yyyy-MM-dd"))
        );
        const allDaysRecords = await Promise.all(recordsPromises);

        const empMap = new Map<string, Employee>();
        employees.forEach((emp) => empMap.set(emp.uid, emp));

        allDaysRecords.forEach((dayRecords) => {
          const markedEmpIds = new Set<string>();

          dayRecords.forEach((record) => {
            markedEmpIds.add(record.employeeUid);

            switch (record.status) {
              case "present":
                aggregatedStats.present++;
                break;
              case "late":
                aggregatedStats.present++;
                aggregatedStats.late++;
                // Add to late list if it's a single day view or small range
                if (days.length === 1) {
                  const emp = empMap.get(record.employeeUid);
                  if (emp) {
                    lateList.push({
                      uid: emp.uid,
                      name: emp.name,
                      empId: emp.empId,
                      time: record.inTime
                        ? format(record.inTime.toDate(), "hh:mm a")
                        : "-",
                      status: "late",
                    });
                  }
                }
                break;
              case "leave":
                aggregatedStats.leave++;
                if (days.length === 1) {
                  const emp = empMap.get(record.employeeUid);
                  if (emp) {
                    leaveList.push({
                      uid: emp.uid,
                      name: emp.name,
                      empId: emp.empId,
                      reason: record.leaveReason || "No reason",
                      status: "leave",
                    });
                  }
                }
                break;
              case "off":
                aggregatedStats.off++;
                break;
            }
          });

          // Unmarked for this day
          aggregatedStats.unmarked += Math.max(
            0,
            employees.length - markedEmpIds.size
          );
        });

        // If range > 1 day, we might want to aggregate late/leave lists differently?
        // For now, let's just show "Multiple Days Selected" or keep empty if > 1 day
        if (days.length > 1) {
          lateList = []; // Too complex to show individual records for range
          leaveList = [];
        }
      }

      // 4. Calculate Financials
      // Salary Liability is always Monthly Total for context
      const totalSalary = employees.reduce(
        (sum, emp) => sum + (emp.monthlySalary || 0),
        0
      );

      setStats({
        present: aggregatedStats.present,
        late: aggregatedStats.late,
        leave: aggregatedStats.leave,
        off: aggregatedStats.off,
        absent: aggregatedStats.unmarked,
        admins: admins.length,
        totalSalary: totalSalary,
        totalDeductions: totalDeductions, // Only populated for Monthly view
      });

      setLateArrivals(lateList);
      setOnLeave(leaveList);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "today" || value === "yesterday" || value === "custom") {
      setFilterType(value as FilterType);
    } else {
      setFilterType("month");
      setSelectedMonth(value);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const getLabelPrefix = () => {
    if (filterType === "today") return "Today";
    if (filterType === "yesterday") return "Yesterday";
    if (filterType === "custom") return "Range";
    return "Total";
  };

  const getLabelSuffix = () => {
    if (filterType === "month") return "(Monthly)";
    return "";
  };

  const labelPrefix = getLabelPrefix();
  const labelSuffix = getLabelSuffix();
  const currencyCode = portalSettings?.currency || "INR";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-[#005e7c] to-[#007a9e] dark:from-slate-800 dark:to-slate-900 p-8 rounded-3xl text-white shadow-lg relative overflow-hidden">
        {/* Decorative Circles */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 dark:bg-white/5 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/10 dark:bg-white/5 rounded-full blur-2xl"></div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight">
            {getGreeting()}, {profile?.name || "Admin"}
          </h1>
          <p className="text-blue-100 dark:text-slate-300 mt-2 text-lg">
            Overview for {format(new Date(), "EEEE, MMMM dd, yyyy")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center relative z-10 bg-white/10 dark:bg-white/5 p-2 rounded-xl backdrop-blur-sm border border-white/20 dark:border-white/10">
          {filterType === "custom" && (
            <div className="flex gap-2 animate-in fade-in slide-in-from-right-4">
              <input
                type="date"
                value={customRange.start}
                onChange={(e) =>
                  setCustomRange((prev) => ({ ...prev, start: e.target.value }))
                }
                className="h-10 rounded-lg border-none bg-white/20 dark:bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/70 focus:ring-2 focus:ring-white/50 outline-none"
              />
              <span className="self-center text-white/80">-</span>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) =>
                  setCustomRange((prev) => ({ ...prev, end: e.target.value }))
                }
                className="h-10 rounded-lg border-none bg-white/20 dark:bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/70 focus:ring-2 focus:ring-white/50 outline-none"
              />
            </div>
          )}

          <Select
            value={filterType === "month" ? selectedMonth : filterType}
            onChange={handleFilterChange}
            className="w-[180px] bg-white/90 dark:bg-slate-700 text-slate-900 dark:text-white border-none focus:ring-2 focus:ring-white/50"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="custom">Custom Range</option>
            <option disabled>──────────</option>
            {months.map((date) => (
              <option key={date.toISOString()} value={date.toISOString()}>
                {format(date, "MMMM yyyy")}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Stats Grid - 3 Column Layout for better spacing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Row 1: People & Attendance */}
        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 hover:shadow-lg transition-all duration-300 group">
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-blue-50 dark:from-blue-900/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400 uppercase tracking-wider">
              Total Employees
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-slate-800 dark:text-white mt-2">
              {totalEmployees}
            </div>
            <p className="text-sm text-muted-foreground dark:text-slate-400 mt-1 font-medium">
              Active workforce
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 hover:shadow-lg transition-all duration-300 group">
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-green-50 dark:from-green-900/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400 uppercase tracking-wider">
              {labelPrefix} Present {labelSuffix}
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-slate-800 dark:text-white mt-2">
              {stats.present}
            </div>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 inline-block" />
              {filterType === "today" ? "Present today" : "Records found"}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 hover:shadow-lg transition-all duration-300 group">
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-orange-50 dark:from-orange-900/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400 uppercase tracking-wider">
              {labelPrefix} Late {labelSuffix}
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-slate-800 dark:text-white mt-2">
              {stats.late}
            </div>
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400 inline-block" />
              Late arrivals
            </p>
          </CardContent>
        </Card>

        {/* Row 2: Status & Absences */}
        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 hover:shadow-lg transition-all duration-300 group">
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-purple-50 dark:from-purple-900/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400 uppercase tracking-wider">
              {labelPrefix} Leaves {labelSuffix}
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Coffee className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-slate-800 dark:text-white mt-2">
              {stats.leave}
            </div>
            <p className="text-sm text-muted-foreground dark:text-slate-400 mt-1 font-medium">
              Approved leaves
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 hover:shadow-lg transition-all duration-300 group">
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-pink-50 dark:from-pink-900/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400 uppercase tracking-wider">
              {labelPrefix} Off {labelSuffix}
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <CalendarDays className="h-5 w-5 text-pink-600 dark:text-pink-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-slate-800 dark:text-white mt-2">
              {stats.off}
            </div>
            <p className="text-sm text-muted-foreground dark:text-slate-400 mt-1 font-medium">
              Off days
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 hover:shadow-lg transition-all duration-300 group">
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-gray-100 dark:from-gray-800/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400 uppercase tracking-wider">
              {filterType === "today"
                ? "Today Unmarked"
                : `Total Unmarked ${labelSuffix}`}
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-slate-800 dark:text-white mt-2">
              {stats.absent}
            </div>
            <p className="text-sm text-muted-foreground dark:text-slate-400 mt-1 font-medium">
              {filterType === "today" ? "Not marked yet" : "Unmarked days"}
            </p>
          </CardContent>
        </Card>

        {/* Row 3: Financials */}
        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 hover:shadow-lg transition-all duration-300 group md:col-span-1 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Salary Liability
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 mt-2">
              {new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: currencyCode,
                maximumFractionDigits: 0,
              }).format(stats.totalSalary)}
            </div>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">
              Total monthly payout
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-slate-900 hover:shadow-lg transition-all duration-300 group md:col-span-1 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 uppercase tracking-wider">
              Total Deductions
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-red-700 dark:text-red-400 mt-2">
              {filterType === "month" ? (
                new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: currencyCode,
                  maximumFractionDigits: 0,
                }).format(stats.totalDeductions)
              ) : (
                <span className="text-xl text-red-400 dark:text-red-500 font-normal">
                  N/A
                </span>
              )}
            </div>
            <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1 font-medium">
              {filterType === "month"
                ? "For selected month"
                : "Monthly view only"}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-md bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 hover:shadow-lg transition-all duration-300 group md:col-span-1 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              Total Admins
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <UserCog className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-400 mt-2">
              {stats.admins}
            </div>
            <p className="text-sm text-indigo-600/80 dark:text-indigo-400/80 mt-1 font-medium">
              System administrators
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Late Arrivals List */}
        <Card className="border-none shadow-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="border-b border-gray-100 dark:border-slate-700 pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-2 text-slate-800 dark:text-white">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                    <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  Late Arrivals
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  {filterType === "today"
                    ? "Employees who arrived late today"
                    : "Late records for selected period"}
                </CardDescription>
              </div>
              {lateArrivals.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/30"
                  onClick={() => navigate("/admin/attendance")}
                >
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {lateArrivals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <CheckCircle className="h-12 w-12 text-green-400 dark:text-green-500 mb-3 opacity-50" />
                <p className="font-medium">No late arrivals found</p>
                <p className="text-xs text-muted-foreground dark:text-slate-500">
                  Everyone is on time!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {lateArrivals.slice(0, 5).map((item, idx) => (
                  <div
                    key={`${item.uid}-${idx}`}
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-orange-700 dark:text-orange-400 font-bold text-sm shadow-inner">
                        {item.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white group-hover:text-orange-700 dark:group-hover:text-orange-400 transition-colors">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-slate-400 font-mono">
                          {item.empId}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-800">
                        {item.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* On Leave List */}
        <Card className="border-none shadow-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
          <CardHeader className="border-b border-gray-100 dark:border-slate-700 pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-2 text-slate-800 dark:text-white">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                    <Coffee className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  On Leave
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  {filterType === "today"
                    ? "Employees on leave today"
                    : "Leave records for selected period"}
                </CardDescription>
              </div>
              {onLeave.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                  onClick={() => navigate("/admin/attendance")}
                >
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {onLeave.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Users className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3 opacity-50" />
                <p className="font-medium">No employees on leave</p>
                <p className="text-xs text-muted-foreground dark:text-slate-500">
                  Full attendance today!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {onLeave.slice(0, 5).map((item, idx) => (
                  <div
                    key={`${item.uid}-${idx}`}
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-700 dark:text-purple-400 font-bold text-sm shadow-inner">
                        {item.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-slate-400 font-mono">
                          {item.empId}
                        </p>
                      </div>
                    </div>
                    <div className="text-right max-w-[150px]">
                      <p
                        className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-md truncate"
                        title={item.reason}
                      >
                        {item.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          className="group bg-white dark:bg-slate-800 border-none shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden relative"
          onClick={() => navigate("/admin/employees")}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 dark:from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-8 flex items-center gap-6 relative z-10">
            <div className="h-14 w-14 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
              <Plus className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                Add Employee
              </h3>
              <p className="text-sm text-muted-foreground dark:text-slate-400 mt-1">
                Register new staff member
              </p>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
          </CardContent>
        </Card>

        <Card
          className="group bg-white dark:bg-slate-800 border-none shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden relative"
          onClick={() => navigate("/admin/reports")}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 dark:from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-8 flex items-center gap-6 relative z-10">
            <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
              <Banknote className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                Salary Reports
              </h3>
              <p className="text-sm text-muted-foreground dark:text-slate-400 mt-1">
                View monthly payroll
              </p>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </CardContent>
        </Card>

        <Card
          className="group bg-white dark:bg-slate-800 border-none shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden relative"
          onClick={() => navigate("/admin/settings")}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/10 dark:from-gray-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-8 flex items-center gap-6 relative z-10">
            <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
              <Settings className="h-7 w-7 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-800 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                System Settings
              </h3>
              <p className="text-sm text-muted-foreground dark:text-slate-400 mt-1">
                Configure portal options
              </p>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-slate-300 dark:text-slate-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-hover:translate-x-1 transition-all" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
