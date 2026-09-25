import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  getAllEmployees,
  getAttendanceForDate,
  adminUpsertAttendance,
} from "../../../lib/firestore";
import { Employee, AttendanceRecord } from "../../../types";
import { format, parse } from "date-fns";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";

export const AttendanceView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // Manage Attendance State
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [manageEmployee, setManageEmployee] = useState("");
  const [manageDate, setManageDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [manageMode, setManageMode] = useState<"attendance" | "leave" | "off">(
    "attendance"
  );
  const [manageInTime, setManageInTime] = useState("");
  const [manageOutTime, setManageOutTime] = useState("");
  const [manageReason, setManageReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      loadAttendance();
    }
  }, [selectedDate, employees]);

  // Load existing record when employee/date changes in modal
  useEffect(() => {
    if (isManageOpen && manageEmployee && manageDate) {
      loadExistingRecord();
    }
  }, [isManageOpen, manageEmployee, manageDate]);

  const loadEmployees = async () => {
    try {
      const data = await getAllEmployees();
      setEmployees(data);
    } catch (error) {
      toast.error("Failed to load employees");
    }
  };

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const data = await getAttendanceForDate(selectedDate);
      setRecords(data);
    } catch (error) {
      toast.error("Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  const loadExistingRecord = async () => {
    try {
      const records = await getAttendanceForDate(manageDate, manageEmployee);
      if (records.length > 0) {
        const record = records[0];

        if (record.status === "leave") {
          setManageMode("leave");
        } else if (record.status === "off") {
          setManageMode("off");
        } else {
          setManageMode("attendance");
        }

        setManageInTime(
          record.inTime ? format(record.inTime.toDate(), "HH:mm") : ""
        );
        setManageOutTime(
          record.outTime ? format(record.outTime.toDate(), "HH:mm") : ""
        );
        setManageReason(record.leaveReason || "");
      } else {
        // Reset if no record
        setManageMode("attendance");
        setManageInTime("");
        setManageOutTime("");
        setManageReason("");
      }
    } catch (error) {
      console.error("Error loading record:", error);
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageEmployee || !manageDate) {
      toast.error("Please select employee and date");
      return;
    }

    // Validation
    if (manageMode === "attendance") {
      if (!manageInTime) {
        toast.error("In Time is required for Attendance");
        return;
      }

      const todayStr = format(new Date(), "yyyy-MM-dd");
      if (manageDate < todayStr && !manageOutTime) {
        toast.error("Out Time is required for past dates");
        return;
      }
    }

    try {
      setSaving(true);

      // Convert time strings to Date objects
      let inTimeDate: Date | undefined;
      let outTimeDate: Date | undefined;

      if (manageInTime) {
        inTimeDate = parse(
          `${manageDate} ${manageInTime}`,
          "yyyy-MM-dd HH:mm",
          new Date()
        );
      }

      if (manageOutTime) {
        outTimeDate = parse(
          `${manageDate} ${manageOutTime}`,
          "yyyy-MM-dd HH:mm",
          new Date()
        );
      }

      await adminUpsertAttendance(manageEmployee, manageDate, {
        mode: manageMode,
        inTime: inTimeDate || null,
        outTime: outTimeDate || null,
        leaveReason: manageReason || undefined,
      });

      toast.success("Attendance updated successfully");
      setIsManageOpen(false);
      loadAttendance(); // Refresh list
    } catch (error) {
      console.error(error);
      toast.error("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const getEmployeeRecord = (employeeUid: string) => {
    return records.find((r) => r.employeeUid === employeeUid);
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">Not Marked</Badge>;

    const variants: Record<string, any> = {
      present: { variant: "success", label: "Present" },
      leave: { variant: "default", label: "Leave" },
      off: { variant: "destructive", label: "Off" },
      late: { variant: "warning", label: "Late" },
      holiday: { variant: "secondary", label: "Holiday" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading && employees.length === 0) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance View</h1>
          <p className="text-muted-foreground">
            View and manage employee attendance
          </p>
        </div>
        <Button onClick={() => setIsManageOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Manage Attendance
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Attendance for {format(new Date(selectedDate), "MMMM dd, yyyy")}
            </CardTitle>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>In Time</TableHead>
                <TableHead>Out Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees
                .filter((employee) => {
                  if (!employee.createdAt) return true;
                  const joinDate = employee.createdAt.toDate();
                  const joinDateStr = format(joinDate, "yyyy-MM-dd");
                  return selectedDate >= joinDateStr;
                })
                .map((employee) => {
                  const record = getEmployeeRecord(employee.uid);
                  return (
                    <TableRow key={employee.uid}>
                      <TableCell className="font-medium">
                        {employee.name}
                      </TableCell>
                      <TableCell>{employee.empId}</TableCell>
                      <TableCell>{getStatusBadge(record?.status)}</TableCell>
                      <TableCell>
                        {record?.inTime
                          ? format(record.inTime.toDate(), "hh:mm a")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {record?.outTime
                          ? format(record.outTime.toDate(), "hh:mm a")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="sm:max-w-[500px] w-full">
          <DialogHeader>
            <DialogTitle>Manage Attendance</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveAttendance} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee</Label>
                <Select
                  value={manageEmployee}
                  onChange={(e) => setManageEmployee(e.target.value)}
                  className="w-full border rounded-md p-2"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.uid} value={emp.uid}>
                      {emp.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={manageDate}
                  onChange={(e) => setManageDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <Button
                type="button"
                variant={manageMode === "attendance" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setManageMode("attendance")}
              >
                Present
              </Button>
              <Button
                type="button"
                variant={manageMode === "leave" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setManageMode("leave")}
              >
                Leave
              </Button>
              <Button
                type="button"
                variant={manageMode === "off" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => setManageMode("off")}
              >
                Off
              </Button>
            </div>

            {manageMode === "attendance" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inTime">In Time *</Label>
                  <Input
                    id="inTime"
                    type="time"
                    value={manageInTime}
                    onChange={(e) => setManageInTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outTime">
                    Out Time{" "}
                    {manageDate < format(new Date(), "yyyy-MM-dd") ? "*" : ""}
                  </Label>
                  <Input
                    id="outTime"
                    type="time"
                    value={manageOutTime}
                    onChange={(e) => setManageOutTime(e.target.value)}
                    required={manageDate < format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
              </div>
            )}

            {(manageMode === "leave" || manageMode === "off") && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  value={manageReason}
                  onChange={(e) => setManageReason(e.target.value)}
                  placeholder={`Enter reason for ${manageMode}`}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsManageOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Attendance"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
