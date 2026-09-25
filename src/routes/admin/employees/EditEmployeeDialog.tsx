import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Select } from "../../../components/ui/select";
import { updateEmployee, syncEmployeeIdentity, assignEmployeeToTeam } from "../../../lib/firestore";
import { Employee, StaffRole } from "../../../types";
import { TEAMS, isTeamId } from "../../../lib/teams";
import { toast } from "sonner";
import { useSettings } from "../../../context/SettingsContext";

interface EditEmployeeDialogProps {
  employee: Employee;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditEmployeeDialog: React.FC<EditEmployeeDialogProps> = ({
  employee,
  open,
  onClose,
  onSuccess,
}) => {
  const { currencySymbol } = useSettings();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: employee.name,
    username: employee.username || "",
    empId: employee.empId,
    team: employee.team || "",
    designation: employee.designation || "",
    monthlySalary: employee.monthlySalary.toString(),
    cnic: employee.cnic || "",
    address: employee.address || "",
    role: (employee.role || "employee") as StaffRole,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (
      !formData.name ||
      !formData.username ||
      !formData.empId ||
      !formData.team ||
      !formData.designation ||
      !formData.monthlySalary
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!isTeamId(formData.team)) {
      toast.error("Choose a team");
      return;
    }

    const salary = parseFloat(formData.monthlySalary);
    if (isNaN(salary) || salary <= 0) {
      toast.error("Please enter a valid monthly salary");
      return;
    }

    try {
      setLoading(true);

      const username = await syncEmployeeIdentity(
        employee.uid,
        employee.email,
        formData.empId,
        formData.username,
        employee.username
      );

      const updates: Record<string, unknown> = {
        name: formData.name,
        username,
        empId: formData.empId.trim(),
        designation: formData.designation,
        monthlySalary: salary,
        role: formData.role,
      };

      // Only add optional fields if they have values
      if (formData.cnic && formData.cnic.trim()) {
        updates.cnic = formData.cnic;
      }
      if (formData.address && formData.address.trim()) {
        updates.address = formData.address;
      }

      await updateEmployee(employee.uid, updates);
      if (formData.team !== employee.team || formData.role !== employee.role) {
        await assignEmployeeToTeam(employee.uid, formData.team);
      }

      toast.success("Employee updated successfully");
      onSuccess();
    } catch (error: any) {
      console.error("Error updating employee:", error);
      toast.error(error.message || "Failed to update employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full dark:bg-slate-800 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Edit Employee</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4 mt-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b dark:border-slate-700 pb-2">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="dark:text-white">
                  Email
                </Label>
                <Input
                  id="email"
                  value={employee.email}
                  disabled
                  className="bg-muted dark:bg-slate-900/50 dark:text-slate-400"
                />
                <p className="text-xs text-muted-foreground dark:text-slate-400">
                  Email cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="dark:text-white">
                  Full Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="dark:text-white">
                  Username *
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="empId" className="dark:text-white">
                  User ID *
                </Label>
                <Input
                  id="empId"
                  value={formData.empId}
                  onChange={(e) =>
                    setFormData({ ...formData, empId: e.target.value })
                  }
                  className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="designation" className="dark:text-white">
                  Designation *
                </Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(e) =>
                    setFormData({ ...formData, designation: e.target.value })
                  }
                  placeholder="Software Engineer"
                  className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  id="role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as StaffRole,
                    })
                  }
                >
                  <option value="employee">Employee</option>
                  <option value="team_lead">Team Lead</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team">Team *</Label>
                <Select
                  id="team"
                  value={formData.team}
                  onChange={(e) =>
                    setFormData({ ...formData, team: e.target.value })
                  }
                  required
                >
                  <option value="">Select a team</option>
                  {TEAMS.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Salary Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b dark:border-slate-700 pb-2">
              Salary Information
            </h3>

            <div className="space-y-2">
              <Label htmlFor="salary" className="dark:text-white">
                Monthly Salary ({currencySymbol}) *
              </Label>
              <Input
                id="salary"
                type="number"
                value={formData.monthlySalary}
                onChange={(e) =>
                  setFormData({ ...formData, monthlySalary: e.target.value })
                }
                min="0"
                step="1"
                className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Optional Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b dark:border-slate-700 pb-2">
              Additional Information (Optional)
            </h3>

            <div className="space-y-2">
              <Label htmlFor="cnic" className="dark:text-white">
                CNIC / ID Number
              </Label>
              <Input
                id="cnic"
                value={formData.cnic}
                onChange={(e) =>
                  setFormData({ ...formData, cnic: e.target.value })
                }
                placeholder="12345-1234567-1"
                className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="dark:text-white">
                Address
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Enter complete address..."
                className="resize-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="dark:hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
