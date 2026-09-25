import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  format,
  isWithinInterval,
  isSunday,
  isValid,
} from "date-fns";

// Parse `yyyy-MM-dd` into a *local* Date to avoid timezone shifting issues
// (e.g. `new Date('2026-03-23')` can be treated as UTC by JS).
const parseLocalYyyyMmDd = (dateStr: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return new Date(dateStr);

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1; // 0-based
  const day = Number(match[3]);
  return new Date(year, monthIndex, day);
};

/**
 * Get the start and end of the current week (Monday to Sunday)
 */
export const getCurrentWeekRange = () => {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
  
  return { start, end };
};

/**
 * Check if a date is within the current week
 */
export const isInCurrentWeek = (date: Date | string): boolean => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (!isValid(dateObj)) return false;

  const { start, end } = getCurrentWeekRange();
  
  return isWithinInterval(dateObj, { start, end });
};

/**
 * Filter holidays that are in the current week (excluding Sundays)
 */
export const getCurrentWeekHolidays = <T extends { date: string; reason?: string }>(holidays: T[]): T[] => {
  if (!Array.isArray(holidays)) return [];

  const today = startOfDay(new Date());

  return holidays.filter((holiday) => {
    if (!holiday.date) return false;
    const holidayDate = parseLocalYyyyMmDd(holiday.date);
    
    // Check if valid date
    if (!holidayDate || !isValid(holidayDate)) return false;

    // Check if it's in current week
    if (!isInCurrentWeek(holidayDate)) {
      return false;
    }
    
    // Exclude Sundays
    if (isSunday(holidayDate)) {
      return false;
    }

    // "Upcoming" should not include past days within the current week.
    if (holidayDate < today) {
      return false;
    }
    
    return true;
  }).sort((a, b) => {
    const ad = parseLocalYyyyMmDd(a.date);
    const bd = parseLocalYyyyMmDd(b.date);
    if (!ad || !bd) return 0;
    return ad.getTime() - bd.getTime();
  });
};

/**
 * Format holiday for display
 */
export const formatHolidayDisplay = (holiday: { date: string; reason?: string }): string => {
  if (!holiday.date) return "Invalid Date";
  const date = new Date(holiday.date);
  if (!isValid(date)) return "Invalid Date";

  const dayName = format(date, "EEEE"); // e.g., "Monday"
  const dateStr = format(date, "MMM dd"); // e.g., "Dec 09"
  const reason = holiday.reason || "Holiday";
  
  return `${dayName}, ${dateStr} - ${reason}`;
};
