import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Skeleton } from '../../../components/ui/skeleton';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { addHoliday, getMonthHolidays, deleteHoliday, markAllSundaysForYear } from '../../../lib/firestore';
import { useSettings } from '../../../context/SettingsContext';
import { getSalaryMonthKey, getSalaryMonthDates } from "../../../lib/salary";
import { Holiday } from '../../../types';
import { format, addMonths, subMonths, eachDayOfInterval, isSunday } from 'date-fns';
import { toast } from 'sonner';

export const HolidayManagement: React.FC = () => {
  const { salaryStartDay } = useSettings();
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadHolidays();
  }, [currentMonth, salaryStartDay]);

  const loadHolidays = async () => {
    try {
      setLoading(true);
      const salaryMonthKey = getSalaryMonthKey(currentMonth, salaryStartDay);
      const data = await getMonthHolidays(salaryMonthKey);
      setHolidays(data.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setAdding(true);
      await addHoliday(selectedDate, reason || undefined);
      toast.success('Holiday added successfully');
      setReason('');
      await loadHolidays();
    } catch (error) {
      toast.error('Failed to add holiday');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (date: string, reason?: string) => {
    if (reason === 'Sunday') {
      toast.error('Cannot delete auto-marked Sundays');
      return;
    }

    if (!confirm(`Delete holiday on ${format(new Date(date), 'MMM dd, yyyy')}?`)) return;

    try {
      await deleteHoliday(date);
      toast.success('Holiday deleted');
      await loadHolidays();
    } catch (error) {
      toast.error('Failed to delete holiday');
    }
  };

  const salaryMonthKey = getSalaryMonthKey(currentMonth, salaryStartDay);
  const { start: monthStart, end: monthEnd } = getSalaryMonthDates(salaryMonthKey, salaryStartDay);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Holiday Management</h1>
          <p className="text-muted-foreground">Mark and manage holidays</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-lg">
              {format(monthStart, 'MMM yyyy')} Salary Month
            </span>
            <div className="flex gap-2">
              <Button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} 
                variant="outline" 
                size="icon"
                disabled={loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} 
                variant="outline" 
                size="icon"
                disabled={loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">
            {format(monthStart, 'MMM d')} - {format(monthEnd, 'MMM d, yyyy')}
          </span>
          <span className="text-xs text-muted-foreground">
            (Settings: Start Day {salaryStartDay})
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Holiday</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddHoliday} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., National Holiday"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={adding} className="flex-1">
                <Plus className="mr-2 h-4 w-4" />
                {adding ? 'Adding...' : 'Add Holiday'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                disabled={adding}
                onClick={async () => {
                  const yearsToMark = Array.from(new Set([
                    monthStart.getFullYear(),
                    monthEnd.getFullYear()
                  ])).sort();
                  
                  const yearsStr = yearsToMark.join(' and ');
                  
                  if (!confirm(`Mark all Sundays in ${yearsStr} as holidays? This will also ensure Sundays in the current view are marked.`)) return;
                  
                  try {
                    setAdding(true);
                    
                    // 1. Explicitly mark Sundays in the current salary month range first
                    // This ensures the immediate view is correct even if the yearly batch fails or has issues
                    const currentRangeSundays = eachDayOfInterval({ start: monthStart, end: monthEnd })
                      .filter(day => isSunday(day))
                      .map(day => format(day, 'yyyy-MM-dd'));

                    for (const sunday of currentRangeSundays) {
                      const existing = holidays.find(h => h.date === sunday);
                      if (!existing) {
                         await addHoliday(sunday, 'Sunday');
                      }
                    }

                    // 2. Then mark for the full years
                    for (const year of yearsToMark) {
                      await markAllSundaysForYear(year);
                    }
                    
                    toast.success(`Sundays marked successfully`);
                    await loadHolidays();
                  } catch (error) {
                    console.error(error);
                    toast.error('Failed to mark Sundays');
                  } finally {
                    setAdding(false);
                  }
                }}
              >
                Mark Sundays ({Array.from(new Set([monthStart.getFullYear(), monthEnd.getFullYear()])).join('/')})
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holidays ({holidays.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No holidays found for this salary month
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map(holiday => (
                  <TableRow key={holiday.date}>
                    <TableCell className="font-medium">
                      {format(new Date(holiday.date), 'MMM dd, yyyy (EEEE)')}
                    </TableCell>
                    <TableCell>{holiday.reason || '-'}</TableCell>
                    <TableCell className="text-right">
                      {holiday.reason !== 'Sunday' && (
                        <Button
                          onClick={() => handleDelete(holiday.date, holiday.reason)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
