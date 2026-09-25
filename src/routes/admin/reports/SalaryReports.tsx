import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Select } from "../../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Skeleton } from "../../../components/ui/skeleton";
import { generateMonthlyReport } from "../../../lib/firestore";
import { SalaryReport } from "../../../types";
import { toast } from "sonner";
import { useAuth } from "../../../context/AuthContext";
import { Button } from "../../../components/ui/button";
import {
  addSalaryPayment,
  getSalaryPayments,
  getMonthlyAttendance,
  getMonthHolidays,
} from "../../../lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useSettings } from "../../../context/SettingsContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";
import {
  Eye,
  AlertTriangle,
  Download,
  CheckCircle,
  DollarSign,
  Loader2,
} from "lucide-react";

import { getSalaryMonthKey, getSalaryMonthDates } from "../../../lib/salary";
import { startOfMonth, subMonths, format, eachDayOfInterval } from "date-fns";
import { AttendanceRecord, Holiday } from "../../../types";

export const SalaryReports: React.FC = () => {
  const { user } = useAuth();
  const { currencySymbol, salaryStartDay } = useSettings();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(
    startOfMonth(new Date())
  );
  const [reports, setReports] = useState<SalaryReport[]>([]);
  const [paidEmployees, setPaidEmployees] = useState<Set<string>>(new Set());
  const [markingPay, setMarkingPay] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SalaryReport | null>(null);
  const [attendanceBreakdown, setAttendanceBreakdown] = useState<{
    records: Map<string, AttendanceRecord>;
    holidays: Map<string, Holiday>;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Calculate selectedMonth using the same logic as Dashboard
  const selectedMonth = getSalaryMonthKey(selectedDate, salaryStartDay);

  useEffect(() => {
    loadReports();
  }, [selectedMonth]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const [data, payments] = await Promise.all([
        generateMonthlyReport(selectedMonth),
        getSalaryPayments(selectedMonth),
      ]);
      setReports(data);
      setPaidEmployees(new Set(payments.map((p) => p.employeeUid)));
    } catch (error) {
      console.error("Error loading reports:", error);
      toast.error("Failed to load salary reports");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "Employee Name",
      "Emp ID",
      "Monthly Salary",
      "Present",
      "Leave",
      "Off",
      "Unmarked",
      "Holidays",
      "Late",
      "Half Day",
      "Off Deduction",
      "Late Deduction",
      "Half Day Ded.",
      "Early Leave Ded.",
      "Total Deductions",
      "Net Salary",
      "Status",
    ];

    const csvContent = [
      headers.join(","),
      ...reports.map((r) => {
        const isPaid = paidEmployees.has(r.employeeUid);
        return [
          `"${r.employeeName}"`,
          r.empId,
          r.monthlySalary,
          r.presentDays,
          r.leaveDays,
          r.offDays,
          r.unmarkedDays,
          r.holidayDays,
          r.lateCount,
          r.halfDayCount,
          r.offDeduction,
          r.lateDeduction,
          r.halfDayDeduction,
          r.earlyLeaveDeduction,
          r.totalDeductions,
          r.netSalary,
          isPaid ? "Paid" : "Unpaid",
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `salary_report_${selectedMonth}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMarkAsPaid = async (report: SalaryReport) => {
    if (!user) return;
    if (
      !confirm(
        `Mark ${report.employeeName} as PAID? Amount: ${currencySymbol}${report.netSalary}`
      )
    )
      return;

    try {
      setMarkingPay(true);
      await addSalaryPayment({
        employeeUid: report.employeeUid,
        salaryMonthKey: selectedMonth,
        amount: report.netSalary,
        paidAt: Timestamp.now(),
        paidBy: user.uid,
        notes: "Salary Payment",
      });
      toast.success("Marked as Paid");

      // Update local state
      const newSet = new Set(paidEmployees);
      newSet.add(report.employeeUid);
      setPaidEmployees(newSet);
    } catch (e) {
      console.error(e);
      toast.error("Failed to mark as paid");
    } finally {
      setMarkingPay(false);
    }
  };

  const handleViewDetails = async (report: SalaryReport) => {
    setSelectedReport(report);
    setIsDetailsOpen(true);
    setLoadingDetails(true);
    try {
      const [recs, hols] = await Promise.all([
        getMonthlyAttendance(report.employeeUid, selectedMonth),
        getMonthHolidays(selectedMonth),
      ]);

      const recordsMap = new Map<string, AttendanceRecord>();
      const holidayMap = new Map<string, Holiday>();

      recs.forEach(r => recordsMap.set(r.date, r));
      hols.forEach(h => holidayMap.set(h.date, h));

      setAttendanceBreakdown({ records: recordsMap, holidays: holidayMap });
    } catch (e) {
      console.error(e);
      toast.error("Failed to load details");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Generate last 12 months for filter (same as Dashboard)
  const months = Array.from({ length: 12 }, (_, i) =>
    subMonths(startOfMonth(new Date()), i)
  );

  const totalGrossSalary = reports.reduce((sum, r) => sum + r.monthlySalary, 0);
  const totalDeductions = reports.reduce(
    (sum, r) => sum + r.totalDeductions,
    0
  );
  const totalNetSalary = reports.reduce((sum, r) => sum + r.netSalary, 0);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Salary Reports</h1>
          <p className="text-muted-foreground">
            Monthly salary and deduction reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedDate.toISOString()}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="w-[180px] border rounded-md p-2"
          >
            {months.map((date) => (
              <option key={date.toISOString()} value={date.toISOString()}>
                {format(date, "MMMM yyyy")}
              </option>
            ))}
          </Select>
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Gross Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencySymbol} &nbsp;
              {totalGrossSalary.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Deductions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {currencySymbol} &nbsp;
              {totalDeductions.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Net Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currencySymbol} &nbsp;
              {totalNetSalary.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Report Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Report ({reports.length} Employees)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Emp ID</TableHead>
                  <TableHead className="text-right">Monthly Salary</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Leave</TableHead>
                  <TableHead className="text-center">Off</TableHead>
                  <TableHead className="text-center">Unmarked</TableHead>
                  <TableHead className="text-center">Holidays</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Half Day</TableHead>
                  <TableHead className="text-right">Off Deduction</TableHead>
                  <TableHead className="text-right">Late Deduction</TableHead>
                  <TableHead className="text-right">Half Day Ded.</TableHead>
                  <TableHead className="text-right">Early Leave Ded.</TableHead>
                  <TableHead className="text-right">Total Deductions</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={18}
                      className="text-center text-muted-foreground"
                    >
                      No salary data available for this month
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => (
                    <TableRow key={report.employeeUid}>
                      <TableCell className="font-medium">
                        {report.employeeName}
                      </TableCell>
                      <TableCell>{report.empId}</TableCell>
                      <TableCell className="text-right">
                        {currencySymbol}
                        {report.monthlySalary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {report.presentDays}
                      </TableCell>
                      <TableCell className="text-center">
                        {report.leaveDays}
                      </TableCell>
                      <TableCell className="text-center">
                        {report.offDays}
                      </TableCell>
                      <TableCell className="text-center text-red-500 font-medium">
                        {report.unmarkedDays}
                      </TableCell>
                      <TableCell className="text-center text-blue-600 font-medium">
                        {report.holidayDays}
                      </TableCell>
                      <TableCell className="text-center">
                        {report.lateCount}
                      </TableCell>
                      <TableCell className="text-center">
                        {report.halfDayCount}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {currencySymbol}
                        {report.offDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {currencySymbol}
                        {report.lateDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {currencySymbol}
                        {report.halfDayDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {currencySymbol}
                        {report.earlyLeaveDeduction.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {currencySymbol}
                        {report.totalDeductions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {currencySymbol}
                        {report.netSalary.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {paidEmployees.has(report.employeeUid) ? (
                          <div className="flex items-center justify-center text-green-600 font-medium gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Already Paid
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleMarkAsPaid(report)}
                            disabled={markingPay}
                            className="h-8"
                          >
                            <DollarSign className="mr-1 h-3 w-3" />
                            Pay
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(report)}
                          title="View Attendance Records"
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Attendance Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Attendance Breakdown - {selectedReport?.employeeName}
            </DialogTitle>
            <DialogDescription>
              Detailed records for {format(selectedDate, "MMMM yyyy")} (
              {selectedMonth})
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : attendanceBreakdown && selectedReport ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">
                    Basic Salary
                  </p>
                  <p className="text-lg font-bold">
                    {currencySymbol}
                    {selectedReport?.monthlySalary.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 font-bold uppercase">
                    Total Deduction
                  </p>
                  <p className="text-lg font-bold">
                    -{currencySymbol}
                    {selectedReport?.totalDeductions.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase">
                    Net Payable
                  </p>
                  <p className="text-lg font-bold">
                    {currencySymbol}
                    {selectedReport?.netSalary.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/20 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 font-bold uppercase">
                    Per Day Deduction
                  </p>
                  <p className="text-lg font-bold">
                    {currencySymbol}
                    {Math.round(
                      ((selectedReport?.monthlySalary || 0) / 30) * 100
                    ) / 100}
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks / Deductions</TableHead>
                    <TableHead className="text-center">In Time</TableHead>
                    <TableHead className="text-center">Out Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const { start, end } = getSalaryMonthDates(
                      selectedMonth,
                      salaryStartDay
                    );
                    const days = eachDayOfInterval({ start, end });
                    let lateCounter = 0;

                    return days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const record = attendanceBreakdown?.records.get(dateStr);
                      const holiday = attendanceBreakdown?.holidays.get(dateStr);
                      const isWeekend = day.getDay() === 0; // Assuming Sunday is Off

                      let status =
                        record?.status ||
                        (holiday ? "holiday" : isWeekend ? "off" : "unmarked");
                      let deductionInfo = "";
                      let statusColor = "text-slate-500";

                      if (status === "half-day") {
                        deductionInfo = "Half Day Deduction (0.5 day)";
                        statusColor = "text-orange-600 font-bold";
                      } else if (status === "late") {
                        lateCounter++;
                        const trigger = lateCounter % 3 === 0;
                        deductionInfo = `Late #${lateCounter}${trigger ? " (3rd Late: 0.5 day Ded.)" : ""
                          }`;
                        statusColor = "text-yellow-600 font-bold";
                      } else if (status === "off" || status === "unmarked") {
                        deductionInfo = "1.2x Per Day Deduction";
                        statusColor = "text-red-600 font-bold";
                        status =
                          status === "unmarked" ? "Absent/Unmarked" : "Weekly Off";
                      } else if (status === "leave") {
                        statusColor = "text-indigo-600 font-bold";
                      } else if (status === "holiday") {
                        statusColor = "text-blue-600 font-bold";
                        deductionInfo = holiday?.reason || "Public Holiday";
                      } else {
                        statusColor = "text-green-600 font-bold";
                      }

                      return (
                        <TableRow
                          key={dateStr}
                          className={
                            record?.status === "off" ||
                              status === "Absent/Unmarked"
                              ? "bg-red-50/30"
                              : ""
                          }
                        >
                          <TableCell className="font-medium whitespace-nowrap">
                            {format(day, "dd MMM (EEE)")}
                          </TableCell>
                          <TableCell className={statusColor}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {deductionInfo && (
                              <div className="flex items-center gap-1">
                                {(status === "half-day" ||
                                  status === "Absent/Unmarked" ||
                                  (status === "late" &&
                                    lateCounter % 3 === 0)) && (
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                  )}
                                {deductionInfo}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {record?.inTime
                              ? format(record.inTime.toDate(), "hh:mm a")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {record?.outTime
                              ? format(record.outTime.toDate(), "hh:mm a")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
