import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Employee, LeaveRequest } from "../../types";
import {
  createLeaveRequest,
  getLeaveRequestsForEmployee,
} from "../../lib/firestore";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { toast } from "sonner";

export const EmployeeLeave: React.FC = () => {
  const { user, profile } = useAuth();
  const employee = profile as Employee | null;
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  const load = async () => {
    if (!user) return;
    setRequests(await getLeaveRequestsForEmployee(user.uid));
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !employee) return;
    if (!fromDate || !toDate || !reason.trim()) {
      toast.error("Enter dates and a reason.");
      return;
    }
    if (toDate < fromDate) {
      toast.error("End date cannot be before start date.");
      return;
    }

    try {
      setSubmitting(true);
      await createLeaveRequest({
        employeeUid: user.uid,
        employeeName: employee.name,
        empId: employee.empId,
        team: employee.team || null,
        fromDate,
        toDate,
        reason: reason.trim(),
        teamLeadUid: employee.teamLeadUid || null,
      });
      toast.success("Leave request submitted");
      setReason("");
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit leave");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Request leave</CardTitle>
          <CardDescription>
            Your team lead or an administrator will approve or reject this request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fromDate">From</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toDate">To</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dates</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rejection reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No leave requests yet
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {request.fromDate}
                      {request.toDate !== request.fromDate ? ` → ${request.toDate}` : ""}
                    </TableCell>
                    <TableCell>{request.reason}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === "approved"
                            ? "success"
                            : request.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.status === "rejected"
                        ? request.reviewNote || "Rejected"
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
