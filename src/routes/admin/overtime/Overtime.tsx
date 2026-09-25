import React, { useState, useEffect } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Badge } from "../../../components/ui/badge";
import { toast } from "sonner";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import {
  getAllEmployees,
  getPortalSettings,
  updateAttendance,
} from "../../../lib/firestore";
import { getSalaryMonthKey, getSalaryMonthDates } from "../../../lib/salary";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { AttendanceRecord } from "../../../types";

interface OvertimeRecord extends AttendanceRecord {
  id: string; // employeeUid
  employeeName: string;
  empId: string;
  dateStr: string;
}

export const OvertimePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(
    startOfMonth(new Date())
  );

  // Dialog State
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<OvertimeRecord | null>(
    null
  );
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // Generate last 12 months for filter
  const months = Array.from({ length: 12 }, (_, i) =>
    subMonths(startOfMonth(new Date()), i)
  );

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Employees
      const emps = await getAllEmployees();
      const empMap = new Map(emps.map((e) => [e.uid, e]));

      // 2. Determine Date Range
      const settings = await getPortalSettings();
      const startDay = settings?.salaryStartDay || 6;
      const salaryMonthKey = getSalaryMonthKey(selectedDate, startDay);
      const { start, end } = getSalaryMonthDates(salaryMonthKey, startDay);

      // 3. Fetch Records for each day in the range
      const newRecords: OvertimeRecord[] = [];

      // Iterate through each day
      const current = new Date(start);
      const promises = [];

      while (current <= end) {
        const dateStr = format(current, "yyyy-MM-dd");
        const recordsRef = collection(
          db,
          `attendance_${salaryMonthKey}/${dateStr}/records`
        );

        promises.push(
          getDocs(recordsRef).then((snapshot) => {
            snapshot.forEach((doc) => {
              const data = doc.data() as AttendanceRecord;
              if (data.overtimeHours && data.overtimeHours > 0) {
                const emp = empMap.get(doc.id);
                if (emp) {
                  newRecords.push({
                    ...data,
                    id: doc.id,
                    employeeName: emp.name,
                    empId: emp.empId,
                    dateStr: dateStr,
                  });
                }
              }
            });
          })
        );

        current.setDate(current.getDate() + 1);
      }

      await Promise.all(promises);

      // Sort by date (desc) then name
      newRecords.sort((a, b) => {
        if (a.dateStr !== b.dateStr) return b.dateStr.localeCompare(a.dateStr);
        return a.employeeName.localeCompare(b.employeeName);
      });

      setRecords(newRecords);
    } catch (error) {
      console.error("Error loading overtime data:", error);
      toast.error("Failed to load overtime records");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClick = (record: OvertimeRecord) => {
    setSelectedRecord(record);
    setRejectReason("");
    setIsRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!selectedRecord || !rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      setProcessing(true);

      await updateAttendance(selectedRecord.dateStr, selectedRecord.id, {
        overtimeStatus: "rejected",
        overtimeReason: rejectReason,
      });

      toast.success("Overtime rejected successfully");
      setIsRejectDialogOpen(false);

      // Update local state
      setRecords((prev) =>
        prev.map((r) => {
          if (
            r.id === selectedRecord.id &&
            r.dateStr === selectedRecord.dateStr
          ) {
            return {
              ...r,
              overtimeStatus: "rejected",
              overtimeReason: rejectReason,
            };
          }
          return r;
        })
      );
    } catch (error) {
      console.error("Error rejecting overtime:", error);
      toast.error("Failed to reject overtime");
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (record: OvertimeRecord) => {
    try {
      await updateAttendance(record.dateStr, record.id, {
        overtimeStatus: "approved",
        overtimeReason: null,
      });

      toast.success("Overtime approved successfully");

      // Update local state
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id === record.id && r.dateStr === record.dateStr) {
            return { ...r, overtimeStatus: "approved", overtimeReason: null };
          }
          return r;
        })
      );
    } catch (error) {
      console.error("Error approving overtime:", error);
      toast.error("Failed to approve overtime");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Overtime Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and manage employee overtime hours
          </p>
        </div>

        <Select
          value={selectedDate.toISOString()}
          onChange={(e) => setSelectedDate(new Date(e.target.value))}
          className="w-[200px]"
        >
          {months.map((date) => (
            <option key={date.toISOString()} value={date.toISOString()}>
              {format(date, "MMMM yyyy")}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overtime Records</CardTitle>
          <CardDescription>
            Showing records for {format(selectedDate, "MMMM yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-4 text-gray-300" />
              <p>No overtime records found for this month</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Overtime</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={`${record.id}-${record.dateStr}`}>
                      <TableCell className="font-medium">
                        {format(new Date(record.dateStr), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {record.employeeName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {record.empId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.inTime
                          ? format(record.inTime.toDate(), "hh:mm a")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {record.outTime
                          ? format(record.outTime.toDate(), "hh:mm a")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {record.overtimeHours} hrs
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.overtimeStatus === "rejected" ? (
                          <div className="flex items-center text-red-600 gap-1">
                            <XCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Rejected
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center text-green-600 gap-1">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Approved
                            </span>
                          </div>
                        )}
                        {record.overtimeReason && (
                          <div
                            className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate"
                            title={record.overtimeReason}
                          >
                            {record.overtimeReason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.overtimeStatus === "rejected" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleApprove(record)}
                          >
                            Re-Approve
                          </Button>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRejectClick(record)}
                          >
                            Reject
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Overtime</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this overtime claim.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Input
                id="reason"
                placeholder="e.g., Unauthorized overtime"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={processing || !rejectReason.trim()}
            >
              {processing ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
