import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Skeleton } from "../../../components/ui/skeleton";
import { Plus, Edit, Trash2, Ban, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { teamName } from "../../../lib/teams";
import {
  getAllEmployees,
  deleteEmployee,
  toggleEmployeeStatus,
} from "../../../lib/firestore";
import { Employee } from "../../../types";
import { toast } from "sonner";
import { AddEmployeeDialog } from "./AddEmployeeDialog";
import { EditEmployeeDialog } from "./EditEmployeeDialog";
import { useSettings } from "../../../context/SettingsContext";
import { Badge } from "../../../components/ui/badge";

export const EmployeeList: React.FC = () => {
  const { currencySymbol } = useSettings();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await getAllEmployees();
      setEmployees(data);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (employee: Employee) => {
    const newStatus = !employee.isActive;
    const action = newStatus ? "activate" : "deactivate";

    if (
      !confirm(`Are you sure you want to ${action} ${employee.name}'s account?`)
    )
      return;

    try {
      await toggleEmployeeStatus(employee.uid, newStatus);
      toast.success(`Employee account ${action}d successfully`);
      await loadEmployees();
    } catch (error) {
      toast.error(`Failed to ${action} employee account`);
    }
  };

  const handleDelete = async (uid: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      await deleteEmployee(uid);
      toast.success("Employee deleted successfully");
      await loadEmployees();
    } catch (error) {
      toast.error("Failed to delete employee");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage employee accounts</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Employees ({employees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Monthly Salary</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    No employees found. Add your first employee to get started.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((employee) => (
                  <TableRow key={employee.uid}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/admin/employees/${employee.uid}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {employee.name}
                      </Link>
                    </TableCell>
                    <TableCell>{employee.empId}</TableCell>
                    <TableCell>{employee.username || "—"}</TableCell>
                    <TableCell>{teamName(employee.team)}</TableCell>
                    <TableCell>
                      {employee.role === "team_lead" ? "Team Lead" : "Employee"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={employee.isActive ? "success" : "destructive"}
                      >
                        {employee.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {currencySymbol}
                      {employee.monthlySalary.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => handleToggleStatus(employee)}
                          variant="outline"
                          size="sm"
                          title={
                            employee.isActive
                              ? "Deactivate Account"
                              : "Activate Account"
                          }
                          className={
                            employee.isActive
                              ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                              : "text-green-600 hover:text-green-700 hover:bg-green-50"
                          }
                        >
                          {employee.isActive ? (
                            <Ban className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          onClick={() => setEditingEmployee(employee)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() =>
                            handleDelete(employee.uid, employee.name)
                          }
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {showAddDialog && (
        <AddEmployeeDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSuccess={() => {
            setShowAddDialog(false);
            loadEmployees();
          }}
        />
      )}

      {editingEmployee && (
        <EditEmployeeDialog
          employee={editingEmployee}
          open={!!editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSuccess={() => {
            setEditingEmployee(null);
            loadEmployees();
          }}
        />
      )}
    </div>
  );
};
