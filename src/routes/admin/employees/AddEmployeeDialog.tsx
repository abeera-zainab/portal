import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
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
import { addEmployee, getAllEmployees } from "../../../lib/firestore";
import { toast } from "sonner";
import { useSettings } from "../../../context/SettingsContext";
import { createAuthUser, getAuthErrorMessage } from "../../../lib/auth";
import { StaffRole } from "../../../types";
import { TEAMS, isTeamId } from "../../../lib/teams";

interface AddEmployeeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddEmployeeDialog: React.FC<AddEmployeeDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { currencySymbol } = useSettings();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    name: "",
    empId: "",
    team: "",
    designation: "",
    monthlySalary: "",
    cnic: "",
    address: "",
    role: "employee" as StaffRole,
  });

  useEffect(() => {
    if (open && !formData.empId) {
      generateEmployeeId();
    }
  }, [open]);

  const generateEmployeeId = async () => {
    try {
      const employees = await getAllEmployees();
      const empNumbers = employees
        .map((emp) => {
          const match = emp.empId.match(/EMP(\d+)/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter((num) => !isNaN(num));

      const nextNumber =
        empNumbers.length > 0 ? Math.max(...empNumbers) + 1 : 1;
      const newEmpId = `EMP${String(nextNumber).padStart(3, "0")}`;
      setFormData((prev) => ({ ...prev, empId: newEmpId }));
    } catch (error) {
      console.error("Error generating employee ID:", error);
      setFormData((prev) => ({ ...prev, empId: "EMP001" }));
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      username: "",
      password: "",
      name: "",
      empId: "",
      team: "",
      designation: "",
      monthlySalary: "",
      cnic: "",
      address: "",
      role: "employee",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (
      !formData.email ||
      !formData.username ||
      !formData.password ||
      !formData.name ||
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

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    const salary = parseFloat(formData.monthlySalary);
    if (isNaN(salary) || salary <= 0) {
      toast.error("Please enter a valid monthly salary");
      return;
    }

    try {
      setLoading(true);

      const uid = await createAuthUser(
        formData.email,
        formData.password,
        formData.name
      );

      await addEmployee(
        uid,
        formData.email,
        formData.name,
        formData.empId,
        salary,
        user.uid,
        formData.designation,
        formData.cnic || undefined,
        formData.address || undefined,
        formData.role,
        formData.team,
        formData.username
      );

      toast.success("Employee account created");
      resetForm();
      onSuccess();
    } catch (error: unknown) {
      console.error("Error adding employee:", error);
      toast.error(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-full dark:bg-slate-800 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Add New Employee</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 mt-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b dark:border-slate-700 pb-2">
              Login credentials
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      email: e.target.value.toLowerCase(),
                    })
                  }
                  placeholder="employee@pss.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="abeera.z"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Min. 6 characters"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b dark:border-slate-700 pb-2">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="empId">User ID *</Label>
                <Input
                  id="empId"
                  value={formData.empId}
                  onChange={(e) =>
                    setFormData({ ...formData, empId: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="designation">Designation *</Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(e) =>
                    setFormData({ ...formData, designation: e.target.value })
                  }
                  required
                />
              </div>
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
              <p className="text-xs text-muted-foreground">
                The team lead for that team is assigned automatically.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="salary">Monthly Salary ({currencySymbol}) *</Label>
            <Input
              id="salary"
              type="number"
              value={formData.monthlySalary}
              onChange={(e) =>
                setFormData({ ...formData, monthlySalary: e.target.value })
              }
              min="0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnic">CNIC / ID Number</Label>
            <Input
              id="cnic"
              value={formData.cnic}
              onChange={(e) =>
                setFormData({ ...formData, cnic: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
