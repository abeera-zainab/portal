import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { AttendanceRecord, Employee } from "../../types";
import { assignEmployeeToTeam, getAttendanceForDate, getTeamMembers } from "../../lib/firestore";
import { TEAMS, TeamId, teamName } from "../../lib/teams";
import { Select } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
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
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";

export const TeamAttendance: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [teamChoice, setTeamChoice] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<
    { employee: Employee; record?: AttendanceRecord }[]
  >([]);

  const load = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const members = await getTeamMembers(user.uid);
      const today = format(new Date(), "yyyy-MM-dd");
      const data = await Promise.all(
        members.map(async (employee) => {
          const records = await getAttendanceForDate(today, employee.uid);
          return { employee, record: records[0] };
        })
      );
      setRows(data);
      setTeamChoice(
        Object.fromEntries(data.map(({ employee }) => [employee.uid, employee.team || ""]))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleAssign = async (employee: Employee) => {
    const nextTeam = teamChoice[employee.uid];
    if (!nextTeam || nextTeam === employee.team) return;
    try {
      setSavingUid(employee.uid);
      await assignEmployeeToTeam(employee.uid, nextTeam as TeamId);
      toast.success(`${employee.name} moved to ${teamName(nextTeam)}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move employee");
    } finally {
      setSavingUid(null);
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team attendance</CardTitle>
        <CardDescription>
          Today’s check-in status. Move someone to another PSS team when their assignment changes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Check in</TableHead>
              <TableHead>Check out</TableHead>
              <TableHead>Move to team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No team members assigned to you yet
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ employee, record }) => (
                <TableRow key={employee.uid}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.empId}</TableCell>
                  <TableCell>
                    <Badge variant={record ? "success" : "secondary"}>
                      {record?.status || "Not marked"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {record?.inTime?.toDate
                      ? format(record.inTime.toDate(), "hh:mm a")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {record?.outTime?.toDate
                      ? format(record.outTime.toDate(), "hh:mm a")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Select
                        value={teamChoice[employee.uid] || employee.team || ""}
                        onChange={(event) =>
                          setTeamChoice((current) => ({
                            ...current,
                            [employee.uid]: event.target.value,
                          }))
                        }
                      >
                        {TEAMS.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          savingUid === employee.uid ||
                          (teamChoice[employee.uid] || employee.team) === employee.team
                        }
                        onClick={() => handleAssign(employee)}
                      >
                        Move
                      </Button>
                    </div>
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
