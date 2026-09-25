/** Check-in after 9:30 is late. 9:30:00 exactly is on time. */
export const LATE_CUTOFF_LABEL = "9:30 AM";

export const checkInStatus = (time: Date): "present" | "late" => {
  const cutoff = new Date(time);
  cutoff.setHours(9, 30, 0, 0);
  return time.getTime() > cutoff.getTime() ? "late" : "present";
};

export const lateMinutesAfterCutoff = (time: Date): number => {
  const cutoff = new Date(time);
  cutoff.setHours(9, 30, 0, 0);
  return Math.max(0, Math.round((time.getTime() - cutoff.getTime()) / 60000));
};

export const workedMinutesBetween = (start: Date, end: Date): number =>
  Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

export const formatWorkedMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
};

export const normalizeUsername = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, "");

export const isValidUsername = (value: string): boolean =>
  /^[a-z0-9._]{3,32}$/.test(normalizeUsername(value));
