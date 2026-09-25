import { format, subMonths } from 'date-fns';

/**
 * Salary month runs from 6th of current month to 5th of next month
 * Example: Dec 6, 2025 - Jan 5, 2026 = attendance_2025_12
 */

export const getSalaryMonthKey = (date: Date = new Date(), startDay: number = 6): string => {
  const day = date.getDate();
  // const month = date.getMonth();
  // const year = date.getFullYear();

  // If date is before startDay, use previous month
  if (day < startDay) {
    const prevMonth = subMonths(date, 1);
    return format(prevMonth, 'yyyy_MM');
  }

  return format(date, 'yyyy_MM');
};

export const getSalaryMonthDates = (salaryMonthKey: string, startDay: number = 6): { start: Date; end: Date } => {
  // salaryMonthKey format: YYYY_MM
  const [year, month] = salaryMonthKey.split('_').map(Number);

  const start = new Date(year, month - 1, startDay); // startDay of the month
  const end = new Date(year, month, startDay - 1); // (startDay - 1) of next month

  return { start, end };
};

export const isLate = (time: Date, startTime: string = "10:00", bufferMinutes: number = 15): boolean => {
  const [startHour, startMinute] = startTime.split(':').map(Number);

  // Calculate late threshold time
  const thresholdTime = new Date(time);
  thresholdTime.setHours(startHour, startMinute + bufferMinutes, 0, 0);

  // Compare
  return time > thresholdTime;
};

export const getLateStatus = (
  time: Date,
  startTime: string = "10:00",
  bufferMinutes: number = 15
): 'present' | 'late' | 'half-day' => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const officeStartTime = new Date(time);
  officeStartTime.setHours(startHour, startMinute, 0, 0);

  const diffMs = time.getTime() - officeStartTime.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  if (diffMinutes >= 60) {
    return 'half-day';
  } else if (diffMinutes > bufferMinutes) {
    return 'late';
  } else {
    return 'present';
  }
};

export const calculateEarlyLeaveHours = (outTime: Date, endTime: string = "18:00"): number => {
  const [endHour, endMinute] = endTime.split(':').map(Number);

  // Create end time date object for today
  const officeEndTime = new Date(outTime);
  officeEndTime.setHours(endHour, endMinute, 0, 0);

  if (outTime >= officeEndTime) {
    return 0; // Not early
  }

  const diffMs = officeEndTime.getTime() - outTime.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  // Logic:
  // < 15 mins -> 0
  // 15-44 mins -> 0.5
  // 45-74 mins -> 1.0
  // Formula: Math.round(minutes / 30) / 2

  return Math.round(diffMinutes / 30) / 2;
};

export const calculateOvertimeHours = (outTime: Date, endTime: string = "18:00"): number => {
  const [endHour, endMinute] = endTime.split(':').map(Number);

  // Create end time date object for today
  const officeEndTime = new Date(outTime);
  officeEndTime.setHours(endHour, endMinute, 0, 0);

  if (outTime <= officeEndTime) {
    return 0; // No overtime
  }

  const diffMs = outTime.getTime() - officeEndTime.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  // Logic:
  // < 15 mins -> 0
  // 15-44 mins -> 0.5
  // 45-74 mins -> 1.0
  // Formula: Math.round(minutes / 30) / 2

  return Math.round(diffMinutes / 30) / 2;
};

export interface DeductionCalculation {
  offDeduction: number;
  lateDeduction: number;
  halfDayDeduction: number;
  earlyLeaveDeduction: number;
  totalDeductions: number;
}

export const calculateDeductions = (
  monthlySalary: number,
  offDays: number,
  lateCount: number,
  earlyLeaveHours: number,
  halfDayCount: number = 0
): DeductionCalculation => {
  const perDaySalary = monthlySalary / 30;
  const perHourSalary = perDaySalary / 8;

  // Off deduction: 1.2 × per day salary
  const offDeduction = offDays * perDaySalary * 1.2;

  // Late deduction: Every 3 lates = half-day deduction
  const lateDeductionDays = Math.floor(lateCount / 3);
  const lateDeduction = lateDeductionDays * (perDaySalary / 2);

  // Half day deduction: 1 half-day mark = half-day deduction
  const halfDayDeduction = halfDayCount * (perDaySalary / 2);

  // Early leave deduction: per hour salary × hours
  const earlyLeaveDeduction = earlyLeaveHours * perHourSalary;

  const totalDeductions = offDeduction + lateDeduction + halfDayDeduction + earlyLeaveDeduction;

  return {
    offDeduction: Math.round(offDeduction * 100) / 100,
    lateDeduction: Math.round(lateDeduction * 100) / 100,
    halfDayDeduction: Math.round(halfDayDeduction * 100) / 100,
    earlyLeaveDeduction: Math.round(earlyLeaveDeduction * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
  };
};

export const calculateNetSalary = (
  monthlySalary: number,
  totalDeductions: number
): number => {
  return Math.round((monthlySalary - totalDeductions) * 100) / 100;
};
