import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Card,
  CardContent,
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
import { Skeleton } from "../../components/ui/skeleton";
import { getEmployeePayments } from "../../lib/firestore";
import { SalaryPayment } from "../../types";
import { format } from "date-fns";
import { useSettings } from "../../context/SettingsContext";
import { Badge } from "../../components/ui/badge";
import { CheckCircle } from "lucide-react";

export const EmployeeSalary: React.FC = () => {
  const { user } = useAuth();
  const { currencySymbol } = useSettings();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);

  useEffect(() => {
    if (user) {
      loadPayments();
    }
  }, [user]);

  const loadPayments = async () => {
    try {
      if (!user) return;
      setLoading(true);
      const data = await getEmployeePayments(user.uid);
      setPayments(data);
    } catch (error) {
      console.error("Error loading payments:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Salary History</h1>
        <p className="text-muted-foreground">
          View your salary payment history
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Records</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Date</TableHead>
                <TableHead>Salary Month</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No payment records found
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {format(payment.paidAt.toDate(), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.salaryMonthKey}
                    </TableCell>
                    <TableCell className="font-bold text-green-600">
                      {currencySymbol}
                      {payment.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Paid
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.notes || "-"}
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
