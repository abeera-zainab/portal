import React, { useEffect, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Textarea } from "../ui/textarea";
import { Skeleton } from "../ui/skeleton";
import { toast } from "sonner";
import { LeaveRequest } from "../../types";
import { reviewLeaveRequest } from "../../lib/firestore";
import { useAuth } from "../../context/AuthContext";

interface LeaveInboxProps {
  title: string;
  description: string;
  loadRequests: () => Promise<LeaveRequest[]>;
}

export const LeaveInbox: React.FC<LeaveInboxProps> = ({
  title,
  description,
  loadRequests,
}) => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setRequests(await loadRequests());
    } catch (error) {
      console.error(error);
      toast.error("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const reviewerName =
    profile && "name" in profile ? profile.name : user?.email || "Reviewer";

  const handleReview = async (
    requestId: string,
    decision: "approved" | "rejected"
  ) => {
    if (!user) return;
    try {
      setBusyId(requestId);
      await reviewLeaveRequest(
        requestId,
        decision,
        user.uid,
        reviewerName,
        notes[requestId]
      );
      toast.success(decision === "approved" ? "Leave approved" : "Leave rejected");
      await refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to review request");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No leave requests
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {request.employeeName}
                    {request.empId ? (
                      <div className="text-xs text-muted-foreground">
                        {request.empId}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {request.fromDate}
                    {request.toDate !== request.fromDate ? ` → ${request.toDate}` : ""}
                  </TableCell>
                  <TableCell className="max-w-xs">{request.reason}</TableCell>
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
                  <TableCell className="text-right">
                    {request.status === "pending" ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          placeholder="Rejection reason (required to reject)"
                          value={notes[request.id] || ""}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [request.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === request.id}
                            onClick={() => {
                              if (!notes[request.id]?.trim()) {
                                toast.error("Enter a rejection reason. The employee will see it.");
                                return;
                              }
                              handleReview(request.id, "rejected");
                            }}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            disabled={busyId === request.id}
                            onClick={() => handleReview(request.id, "approved")}
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {request.reviewedByName || "Reviewed"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
