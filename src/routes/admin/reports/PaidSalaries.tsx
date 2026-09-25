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
import { Button } from "../../../components/ui/button";
import { getSalaryPayments, getAllEmployees } from "../../../lib/firestore";
import { SalaryPayment, Employee } from "../../../types";
import { format } from "date-fns";
import { toast } from "sonner";
import { useSettings } from "../../../context/SettingsContext";
import { FileText, Download } from "lucide-react";

export const PaidSalaries: React.FC = () => {
  const { currencySymbol, salaryStartDay } = useSettings();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthNum, setSelectedMonthNum] = useState(
    new Date().getMonth() + 1
  );
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [employees, setEmployees] = useState<Map<string, Employee>>(new Map());

  // Calculate selectedMonth from year and month
  const selectedMonth = `${selectedYear}_${String(selectedMonthNum).padStart(
    2,
    "0"
  )}`;

  useEffect(() => {
    const currentDate = new Date();
    setSelectedYear(currentDate.getFullYear());
    setSelectedMonthNum(currentDate.getMonth() + 1);
  }, [salaryStartDay]);

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [paymentsData, employeesData] = await Promise.all([
        getSalaryPayments(selectedMonth),
        getAllEmployees(),
      ]);

      setPayments(paymentsData);

      const empMap = new Map<string, Employee>();
      employeesData.forEach((emp) => empMap.set(emp.uid, emp));
      setEmployees(empMap);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load payment records");
    } finally {
      setLoading(false);
    }
  };

  const generatePayslip = (payment: SalaryPayment) => {
    const employee = employees.get(payment.employeeUid);
    if (!employee) {
      toast.error("Employee not found");
      return;
    }

    const payslipContent = `
===========================================
              SALARY PAYSLIP
===========================================

Employee Name:    ${employee.name}
Employee ID:      ${employee.empId}
Email:            ${employee.email}

-------------------------------------------
Salary Month:     ${payment.salaryMonthKey}
Payment Date:     ${format(payment.paidAt.toDate(), "dd MMM yyyy")}

-------------------------------------------
PAYMENT DETAILS
-------------------------------------------
Amount Paid:      ${currencySymbol}${payment.amount.toLocaleString()}
Payment Status:   PAID

Notes:            ${payment.notes || "N/A"}

-------------------------------------------
This is a computer-generated payslip.
No signature required.
===========================================
    `.trim();

    const blob = new Blob([payslipContent], {
      type: "text/plain;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `payslip_${employee.empId}_${payment.salaryMonthKey}.txt`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Payslip downloaded");
  };

  const exportAllPayslips = () => {
    if (payments.length === 0) {
      toast.error("No payments to export");
      return;
    }

    const headers = [
      "Employee Name",
      "Emp ID",
      "Email",
      "Salary Month",
      "Payment Date",
      "Amount",
      "Notes",
    ];

    const csvContent = [
      headers.join(","),
      ...payments.map((p) => {
        const emp = employees.get(p.employeeUid);
        return [
          `"${emp?.name || "Unknown"}"`,
          emp?.empId || "N/A",
          emp?.email || "N/A",
          p.salaryMonthKey,
          format(p.paidAt.toDate(), "dd MMM yyyy"),
          p.amount,
          `"${p.notes || ""}"`,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `paid_salaries_${selectedMonth}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Export completed");
  };

  // Generate year options (last 5 years + current year)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = 0; i <= 5; i++) {
    yearOptions.push(currentYear - i);
  }

  // Month options
  const monthOptions = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Paid Salaries</h1>
          <p className="text-muted-foreground">
            View all paid salary records and generate payslips
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Select
              value={selectedYear.toString()}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-32 border rounded-md p-2"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
            <Select
              value={selectedMonthNum.toString()}
              onChange={(e) => setSelectedMonthNum(Number(e.target.value))}
              className="w-40 border rounded-md p-2"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={exportAllPayslips} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Total Paid This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {currencySymbol}
            {totalPaid.toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {payments.length} payment{payments.length !== 1 ? "s" : ""} made
          </p>
        </CardContent>
      </Card>

      {/* Payment Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Records ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Emp ID</TableHead>
                  <TableHead>Salary Month</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-8"
                    >
                      No payment records found for this month
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => {
                    const employee = employees.get(payment.employeeUid);
                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {employee?.name || "Unknown"}
                        </TableCell>
                        <TableCell>{employee?.empId || "N/A"}</TableCell>
                        <TableCell>{payment.salaryMonthKey}</TableCell>
                        <TableCell>
                          {format(
                            payment.paidAt.toDate(),
                            "dd MMM yyyy, hh:mm a"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {currencySymbol}
                          {payment.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.notes || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generatePayslip(payment)}
                            className="h-8"
                          >
                            <FileText className="mr-1 h-3 w-3" />
                            Payslip
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
