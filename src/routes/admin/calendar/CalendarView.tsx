import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Select } from "../../../components/ui/select";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  Info,
  Loader2,
} from "lucide-react";
import { format, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import {
  getAllEmployees,
  getMonthlyAttendance,
  getMonthHolidays,
} from "../../../lib/firestore";
import { getSalaryMonthKey, getSalaryMonthDates } from "../../../lib/salary";
import { Employee, AttendanceRecord, Holiday } from "../../../types";
import { toast } from "sonner";

import { useSettings } from "../../../context/SettingsContext";

export const CalendarView: React.FC = () => {
  const { salaryStartDay } = useSettings();
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<Map<string, AttendanceRecord>>(
    new Map()
  );
  const [holidays, setHolidays] = useState<Map<string, Holiday>>(new Map());

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDateDetails, setSelectedDateDetails] = useState<{
    date: Date;
    record?: AttendanceRecord;
    holiday?: Holiday;
  } | null>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadCalendarData();
    }
  }, [selectedEmployee, currentMonth, salaryStartDay]);

  const loadEmployees = async () => {
    try {
      const data = await getAllEmployees();
      setEmployees(data);
      if (data.length > 0) {
        setSelectedEmployee(data[0].uid);
      }
    } catch (error) {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarData = async () => {
    if (!selectedEmployee) return;

    try {
      setCalendarLoading(true);

      const salaryMonthKey = getSalaryMonthKey(currentMonth, salaryStartDay);

      const [recs, hols] = await Promise.all([
        getMonthlyAttendance(selectedEmployee, salaryMonthKey),
        getMonthHolidays(salaryMonthKey),
      ]);

      const recordsMap = new Map<string, AttendanceRecord>();
      const holidayMap = new Map<string, Holiday>();

      recs.forEach((record) => {
        recordsMap.set(record.date, record);
      });
      hols.forEach((holiday) => {
        holidayMap.set(holiday.date, holiday);
      });

      setRecords(recordsMap);
      setHolidays(holidayMap);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load calendar data");
    } finally {
      setCalendarLoading(false);
    }
  };

  const getDayStyle = (dateStr: string) => {
    const baseStyle =
      "h-24 w-full p-2 border dark:border-slate-700 rounded-lg flex flex-col items-start justify-start transition-all hover:shadow-md relative";
    // All days in this view are "current" for the salary month
    const opacity = "opacity-100";

    if (holidays.has(dateStr)) {
      return `${baseStyle} ${opacity} bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50`;
    }

    const record = records.get(dateStr);
    if (!record)
      return `${baseStyle} ${opacity} bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700`;

    switch (record.status) {
      case "present":
        return `${baseStyle} ${opacity} bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/50`;
      case "leave":
        return `${baseStyle} ${opacity} bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50`;
      case "off":
        return `${baseStyle} ${opacity} bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50`;
      case "late":
        return `${baseStyle} ${opacity} bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/50`;
      case "half-day":
        return `${baseStyle} ${opacity} bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/50`;
      default:
        return `${baseStyle} ${opacity} bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700`;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-green-500">Present</Badge>;
      case "leave":
        return <Badge className="bg-emerald-500">Leave</Badge>;
      case "off":
        return <Badge variant="destructive">Off</Badge>;
      case "late":
        return <Badge className="bg-yellow-500 text-black">Late</Badge>;
      case "half-day":
        return <Badge className="bg-orange-500">Half Day</Badge>;
      case "holiday":
        return <Badge className="bg-indigo-500">Holiday</Badge>;
      default:
        return null;
    }
  };

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const record = records.get(dateStr);
    const holiday = holidays.get(dateStr);

    setSelectedDateDetails({
      date: day,
      record,
      holiday,
    });
    setIsDialogOpen(true);
  };

  // Calculate Salary Month Range
  const salaryMonthKey = getSalaryMonthKey(currentMonth, salaryStartDay);
  const { start: monthStart, end: monthEnd } = getSalaryMonthDates(
    salaryMonthKey,
    salaryStartDay
  );
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay();

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold dark:text-white">Calendar View</h1>
        <p className="text-muted-foreground dark:text-slate-400">
          View employee attendance by Salary Month
        </p>
      </div>

      <Card className="relative dark:bg-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle className="dark:text-white">
                Employee Calendar
              </CardTitle>
              <Select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-64 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                disabled={calendarLoading}
              >
                {employees.map((emp) => (
                  <option key={emp.uid} value={emp.uid}>
                    {emp.name} ({emp.empId})
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-4">
                <span className="font-semibold text-lg dark:text-white">
                  {format(monthStart, "MMM yyyy")} Salary Month
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    variant="outline"
                    size="icon"
                    disabled={calendarLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    variant="outline"
                    size="icon"
                    disabled={calendarLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <span className="text-sm text-muted-foreground dark:text-slate-400">
                {format(monthStart, "MMM d")} -{" "}
                {format(monthEnd, "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading Overlay */}
          {calendarLoading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground dark:text-slate-300">
                  Loading data...
                </span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mb-6 flex flex-wrap gap-4 text-sm dark:text-slate-300">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 rounded" />
              <span>Leave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 rounded" />
              <span>Late</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-800 rounded" />
              <span>Half Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded" />
              <span>Off</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 rounded" />
              <span>Holiday</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-muted-foreground dark:text-slate-300 py-2"
              >
                {day}
              </div>
            ))}

            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24" />
            ))}

            {calendarDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const record = records.get(dateStr);
              const holiday = holidays.get(dateStr);
              // const isCurrent = isSameMonth(day, currentMonth); // No longer needed

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  className={getDayStyle(dateStr)}
                  disabled={calendarLoading}
                >
                  <span className="font-semibold mb-1 dark:text-white">
                    {format(day, "d")}
                  </span>

                  {holiday && (
                    <span className="text-xs text-indigo-700 dark:text-indigo-400 font-medium truncate w-full text-left">
                      {holiday.reason || "Holiday"}
                    </span>
                  )}

                  {record && (
                    <div className="flex flex-col items-start w-full gap-1">
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded-full w-fit
                        ${record.status === "present"
                            ? "bg-green-200 text-green-800"
                            : record.status === "leave"
                              ? "bg-emerald-200 text-emerald-800"
                              : record.status === "late"
                                ? "bg-yellow-200 text-yellow-800"
                                : record.status === "half-day"
                                  ? "bg-orange-200 text-orange-800"
                                  : record.status === "off"
                                    ? "bg-red-200 text-red-800"
                                    : ""
                          }
                      `}
                      >
                        {record.status.charAt(0).toUpperCase() +
                          record.status.slice(1)}
                      </span>
                      {record.inTime && (
                        <span className="text-[10px] text-muted-foreground dark:text-slate-400">
                          In: {format(record.inTime.toDate(), "hh:mm a")}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] w-full dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-white">
              <CalendarIcon className="h-5 w-5" />
              {selectedDateDetails &&
                format(selectedDateDetails.date, "MMMM dd, yyyy")}
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              Daily attendance details
            </DialogDescription>
          </DialogHeader>

          {selectedDateDetails && (
            <div className="space-y-4 py-4">
              {/* Status Section */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <span className="font-medium dark:text-white">Status</span>
                {selectedDateDetails.holiday ? (
                  getStatusBadge("holiday")
                ) : selectedDateDetails.record ? (
                  getStatusBadge(selectedDateDetails.record.status)
                ) : (
                  <Badge variant="outline">No Record</Badge>
                )}
              </div>

              {/* Holiday Details */}
              {selectedDateDetails.holiday && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <Info className="h-4 w-4" /> Holiday Information
                  </h4>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-100 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                      Reason:{" "}
                      {selectedDateDetails.holiday.reason || "Public Holiday"}
                    </p>
                  </div>
                </div>
              )}

              {/* Attendance Details */}
              {selectedDateDetails.record && (
                <div className="space-y-4">
                  {/* Timings */}
                  {(selectedDateDetails.record.status === "present" ||
                    selectedDateDetails.record.status === "late" ||
                    selectedDateDetails.record.status === "half-day") && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground dark:text-slate-400 text-xs uppercase font-bold">
                            <Clock className="h-3 w-3" /> In Time
                          </div>
                          <div className="font-mono font-medium dark:text-white">
                            {selectedDateDetails.record.inTime
                              ? format(
                                selectedDateDetails.record.inTime.toDate(),
                                "hh:mm a"
                              )
                              : "--:--"}
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground dark:text-slate-400 text-xs uppercase font-bold">
                            <Clock className="h-3 w-3" /> Out Time
                          </div>
                          <div className="font-mono font-medium dark:text-white">
                            {selectedDateDetails.record.outTime
                              ? format(
                                selectedDateDetails.record.outTime.toDate(),
                                "hh:mm a"
                              )
                              : "--:--"}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Leave Details */}
                  {selectedDateDetails.record.status === "leave" && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Info className="h-4 w-4" /> Leave Details
                      </h4>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-lg">
                        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
                          Reason:{" "}
                          {selectedDateDetails.record.leaveReason ||
                            "No reason provided"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Off Details */}
                  {selectedDateDetails.record.status === "off" && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-lg">
                      <p className="text-sm font-medium text-red-900 dark:text-red-300">
                        Weekly Off / Non-working Day
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
