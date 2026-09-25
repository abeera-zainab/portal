import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AttendanceRecord, Employee } from "../../../types";
import { getEmployee, getEmployeeAttendanceHistory } from "../../../lib/firestore";
import { teamName } from "../../../lib/teams";
import { formatWorkedMinutes } from "../../../lib/attendanceRules";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

const toDate = (timestamp: AttendanceRecord["inTime"]) => {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === "function") return timestamp.toDate();
  return null;
};

const formatTime = (timestamp: AttendanceRecord["inTime"]) => {
  const date = toDate(timestamp);
  return date ? format(date, "hh:mm a") : "—";
};

export const EmployeeHistory: React.FC = () => {
  const { uid } = useParams();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!uid) return;
      try {
        setLoading(true);
        const [profile, history] = await Promise.all([
          getEmployee(uid),
          getEmployeeAttendanceHistory(uid),
        ]);
        setEmployee(profile);
        setRecords(history);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load attendance history");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uid]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!employee) {
    return <p className="text-muted-foreground">Employee not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/employees">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Employees
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold">{employee.name}</h1>
        <p className="text-muted-foreground">
          User ID {employee.empId}
          {employee.username ? ` · @${employee.username}` : ""} · {teamName(employee.team)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance history ({records.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
                <TableHead>Time tracked</TableHead>
                <TableHead>Late</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No attendance records yet
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => {
                  const start = toDate(record.inTime);
                  const end = toDate(record.outTime);
                  const minutes =
                    record.workedMinutes ??
                    (start && end
                      ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
                      : null);
                  return (
                    <TableRow key={record.date}>
                      <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{record.status}</Badge>
                      </TableCell>
                      <TableCell>{formatTime(record.inTime)}</TableCell>
                      <TableCell>{formatTime(record.outTime)}</TableCell>
                      <TableCell>
                        {minutes === null ? "—" : formatWorkedMinutes(minutes)}
                      </TableCell>
                      <TableCell>
                        {record.lateMinutes ? `${record.lateMinutes} min` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
