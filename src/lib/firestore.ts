import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  deleteField,
  query,
  where,
  orderBy,
  collectionGroup,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  Admin,
  Employee,
  AttendanceRecord,
  Holiday,
  SalaryReport,
  AttendanceStatus,
  PortalSettings,
  SalaryPayment,
  LeaveRequest,
  StaffRole,
} from "../types";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import {
  getSalaryMonthKey,
  calculateDeductions,
  calculateNetSalary,
  getLateStatus,
  calculateEarlyLeaveHours,
  calculateOvertimeHours,
  getSalaryMonthDates,
} from "./salary";
import { getAllSundaysInYear } from "./holidays";
import { verifyNetworkAccess } from "./ipRestriction";
import { TeamId, isTeamId } from "./teams";
import {
  checkInStatus,
  isValidUsername,
  lateMinutesAfterCutoff,
  normalizeUsername,
  workedMinutesBetween,
} from "./attendanceRules";

// ==================== ADMIN OPERATIONS ====================

export const addAdmin = async (uid: string, email: string, name: string) => {
  const adminData: Omit<Admin, "uid"> = {
    name,
    email,
    role: "admin",
    createdAt: serverTimestamp() as Timestamp,
  };

  await setDoc(doc(db, "admins", uid), adminData);
};

export const getAdmin = async (uid: string): Promise<Admin | null> => {
  const adminDoc = await getDoc(doc(db, "admins", uid));
  if (!adminDoc.exists()) return null;

  return { uid, ...adminDoc.data() } as Admin;
};

export const getAllAdmins = async (): Promise<Admin[]> => {
  const adminsSnapshot = await getDocs(collection(db, "admins"));
  return adminsSnapshot.docs.map(
    (doc) => ({ uid: doc.id, ...doc.data() } as Admin)
  );
};

// ==================== EMPLOYEE OPERATIONS ====================

const leadForTeam = (employees: Employee[], team: TeamId, exceptUid?: string) =>
  employees.find(
    (employee) =>
      employee.uid !== exceptUid &&
      employee.role === "team_lead" &&
      employee.team === team &&
      employee.isActive !== false
  );

export const assertUniqueIdentity = async (
  empId: string,
  username: string,
  exceptUid?: string
) => {
  const normalizedUsername = normalizeUsername(username);
  if (!isValidUsername(normalizedUsername)) {
    throw new Error("Username must be 3–32 characters: letters, numbers, dots, or underscores.");
  }

  const employees = await getAllEmployees();
  const idTaken = employees.some(
    (employee) =>
      employee.uid !== exceptUid &&
      employee.empId.trim().toLowerCase() === empId.trim().toLowerCase()
  );
  if (idTaken) throw new Error("That user ID is already assigned.");

  const usernameDoc = await getDoc(doc(db, "usernames", normalizedUsername));
  if (usernameDoc.exists() && usernameDoc.data().uid !== exceptUid) {
    throw new Error("That username is already taken.");
  }

  return normalizedUsername;
};

export const addEmployee = async (
  uid: string,
  email: string,
  name: string,
  empId: string,
  monthlySalary: number,
  createdBy: string,
  designation?: string,
  cnic?: string,
  address?: string,
  role: StaffRole = "employee",
  team?: string | null,
  username?: string
) => {
  if (!isTeamId(team)) throw new Error("Choose a team.");
  const normalizedUsername = await assertUniqueIdentity(empId, username || "", uid);
  const employees = await getAllEmployees();
  const lead = role === "team_lead" ? null : leadForTeam(employees, team);

  const employeeData: Omit<Employee, "uid"> = {
    name,
    email: email.trim().toLowerCase(),
    username: normalizedUsername,
    empId: empId.trim(),
    team,
    monthlySalary,
    createdBy,
    createdAt: serverTimestamp() as Timestamp,
    isActive: true,
    role,
    teamLeadUid: lead?.uid || null,
    ...(designation && { designation }),
    ...(cnic && { cnic }),
    ...(address && { address }),
  };

  await setDoc(doc(db, "employees", uid), employeeData);
  await setDoc(doc(db, "usernames", normalizedUsername), {
    email: employeeData.email,
    uid,
    empId: employeeData.empId,
  });
};

export const assignEmployeeToTeam = async (employeeUid: string, team: TeamId) => {
  const employees = await getAllEmployees();
  const employee = employees.find((item) => item.uid === employeeUid);
  if (!employee) throw new Error("Employee not found.");
  const lead =
    employee.role === "team_lead" ? null : leadForTeam(employees, team, employeeUid);

  await updateDoc(doc(db, "employees", employeeUid), {
    team,
    teamLeadUid: lead?.uid || null,
  });
};

export const syncEmployeeIdentity = async (
  uid: string,
  email: string,
  empId: string,
  username: string,
  previousUsername?: string
) => {
  const normalizedUsername = await assertUniqueIdentity(empId, username, uid);
  const previous = previousUsername ? normalizeUsername(previousUsername) : "";
  if (previous && previous !== normalizedUsername) {
    await deleteDoc(doc(db, "usernames", previous));
  }
  await setDoc(doc(db, "usernames", normalizedUsername), {
    email: email.trim().toLowerCase(),
    uid,
    empId: empId.trim(),
  });
  return normalizedUsername;
};

export const getTeamMembers = async (teamLeadUid: string): Promise<Employee[]> => {
  const lead = await getEmployee(teamLeadUid);
  const employees = await getAllEmployees();
  if (lead?.team) {
    return employees.filter(
      (employee) =>
        employee.uid !== teamLeadUid &&
        employee.team === lead.team &&
        employee.isActive !== false
    );
  }
  return employees.filter(
    (employee) => employee.teamLeadUid === teamLeadUid && employee.isActive !== false
  );
};

export const getTeamLeads = async (): Promise<Employee[]> => {
  const employees = await getAllEmployees();
  return employees.filter((e) => e.role === "team_lead" && e.isActive !== false);
};

export const toggleEmployeeStatus = async (uid: string, isActive: boolean) => {
  await updateDoc(doc(db, "employees", uid), { isActive });
};

export const updateEmployee = async (
  uid: string,
  updates: Partial<Omit<Employee, "uid" | "createdAt" | "createdBy">>
) => {
  await updateDoc(doc(db, "employees", uid), updates);
};

export const getEmployee = async (uid: string): Promise<Employee | null> => {
  const employeeDoc = await getDoc(doc(db, "employees", uid));
  if (!employeeDoc.exists()) return null;

  return { uid, ...employeeDoc.data() } as Employee;
};

export const getAllEmployees = async (): Promise<Employee[]> => {
  const employeesSnapshot = await getDocs(collection(db, "employees"));
  return employeesSnapshot.docs.map(
    (doc) => ({ uid: doc.id, ...doc.data() } as Employee)
  );
};

export const deleteEmployee = async (uid: string) => {
  await deleteDoc(doc(db, "employees", uid));
};

// ==================== SETTINGS OPERATIONS ====================

export const getPortalSettings = async (): Promise<PortalSettings | null> => {
  const settingsDoc = await getDoc(doc(db, "settings", "portal"));
  if (!settingsDoc.exists()) return null;
  return settingsDoc.data() as PortalSettings;
};

export const updatePortalSettings = async (
  settings: Partial<PortalSettings>
) => {
  await setDoc(
    doc(db, "settings", "portal"),
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

// ==================== ATTENDANCE OPERATIONS ====================

export const markAttendance = async (
  employeeUid: string,
  status: AttendanceStatus,
  markedBy: string,
  leaveReason?: string,
  isEarlyOff: boolean = false,
  imageUrl?: string
) => {
  // Verify network access - only for Present and Early Off marking
  // Leave and Off can be marked from anywhere
  if (markedBy === "self" && (status === "present" || isEarlyOff)) {
    await verifyNetworkAccess();
  }

  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;
  const officeEndTime = settings?.officeEndTime || "18:00";

  const now = new Date();
  const dateStr = format(now, "yyyy-MM-dd");
  const salaryMonthKey = getSalaryMonthKey(now, startDay);

  const attendanceCollectionPath = `attendance_${salaryMonthKey}`;
  const dateDocPath = `${attendanceCollectionPath}/${dateStr}`;
  const recordPath = `${dateDocPath}/records/${employeeUid}`;

  // Check if already marked
  const existingRecord = await getDoc(doc(db, recordPath));

  if (isEarlyOff && existingRecord.exists()) {
    // Mark early off - update existing record
    const outTime = Timestamp.now();
    const earlyLeaveHours = calculateEarlyLeaveHours(
      outTime.toDate(),
      officeEndTime
    );
    const overtimeHours = calculateOvertimeHours(
      outTime.toDate(),
      officeEndTime
    );

    const existing = existingRecord.data() as AttendanceRecord;
    const inDate = existing.inTime?.toDate?.();
    const workedMinutes = inDate
      ? workedMinutesBetween(inDate, outTime.toDate())
      : undefined;

    const updates: any = {
      outTime,
      earlyLeaveHours,
      ...(workedMinutes !== undefined ? { workedMinutes } : {}),
      updatedAt: serverTimestamp(),
    };

    if (overtimeHours > 0) {
      updates.overtimeHours = overtimeHours;
      updates.overtimeStatus = "approved";
      updates.overtimeReason = null;
    } else {
      updates.overtimeHours = 0;
      updates.overtimeStatus = null;
      updates.overtimeReason = null;
    }

    if (imageUrl) {
      updates.imageUrl = imageUrl; // Update image if provided (e.g. for out time verification)
    }

    await updateDoc(doc(db, recordPath), updates);
    return;
  }

  if (existingRecord.exists() && !isEarlyOff) {
    throw new Error("Attendance already marked for today");
  }

  const inTime = Timestamp.now();
  const finalStatus: AttendanceStatus =
    status === "present" ? checkInStatus(inTime.toDate()) : status;

  const recordData: Record<string, any> = {
    status: finalStatus,
    markedBy,
    createdAt: serverTimestamp() as Timestamp,
  };

  if (imageUrl) {
    recordData.imageUrl = imageUrl;
  }

  if (status === "present" || finalStatus === "late" || finalStatus === "half-day") {
    recordData.inTime = inTime;
  }

  if (status === "leave" && leaveReason) {
    recordData.leaveReason = leaveReason;
  }

  if (finalStatus === "late") {
    recordData.lateMinutes = lateMinutesAfterCutoff(inTime.toDate());
  }

  await setDoc(doc(db, dateDocPath), { date: dateStr }, { merge: true });

  await setDoc(doc(db, recordPath), {
    ...recordData,
    employeeUid,
    date: dateStr,
  });

  return finalStatus;
};

const calculateLateMinutes = (
  time: Date,
  startTime: string = "10:00",
  bufferMinutes: number = 15
): number => {
  const hours = time.getHours();
  const minutes = time.getMinutes();

  const [startHour, startMinute] = startTime.split(":").map(Number);

  const thresholdMinutes = startHour * 60 + startMinute + bufferMinutes;
  const currentMinutes = hours * 60 + minutes;
  return Math.max(0, currentMinutes - thresholdMinutes);
};

export const getAttendanceForDate = async (
  dateStr: string,
  employeeUid?: string
): Promise<AttendanceRecord[]> => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const date = new Date(dateStr);
  const salaryMonthKey = getSalaryMonthKey(date, startDay);
  const recordsPath = `attendance_${salaryMonthKey}/${dateStr}/records`;

  if (employeeUid) {
    const recordDoc = await getDoc(doc(db, recordsPath, employeeUid));
    if (!recordDoc.exists()) return [];
    return [{ ...recordDoc.data() } as AttendanceRecord];
  }

  const recordsSnapshot = await getDocs(collection(db, recordsPath));
  return recordsSnapshot.docs.map((doc) => doc.data() as AttendanceRecord);
};

export const getEmployeeAttendanceHistory = async (
  employeeUid: string
): Promise<AttendanceRecord[]> => {
  const historyQuery = query(
    collectionGroup(db, "records"),
    where("employeeUid", "==", employeeUid)
  );
  const snapshot = await getDocs(historyQuery);
  return snapshot.docs
    .map((recordDoc) => recordDoc.data() as AttendanceRecord)
    .filter((record) => Boolean(record.date))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
};

export const getMonthlyAttendance = async (
  employeeUid: string,
  salaryMonthKey: string
): Promise<AttendanceRecord[]> => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const { start, end } = getSalaryMonthDates(salaryMonthKey, startDay);
  const days = eachDayOfInterval({ start, end });

  const promises = days.map(async (day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const recordPath = `attendance_${salaryMonthKey}/${dateStr}/records/${employeeUid}`;
    const recordDoc = await getDoc(doc(db, recordPath));

    if (recordDoc.exists()) {
      return recordDoc.data() as AttendanceRecord;
    }
    return null;
  });

  const results = await Promise.all(promises);
  return results.filter(
    (record): record is AttendanceRecord => record !== null
  );
};

export const updateAttendance = async (
  dateStr: string,
  employeeUid: string,
  updates: Partial<AttendanceRecord>
) => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const date = new Date(dateStr);
  const salaryMonthKey = getSalaryMonthKey(date, startDay);
  const recordPath = `attendance_${salaryMonthKey}/${dateStr}/records/${employeeUid}`;

  await updateDoc(doc(db, recordPath), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteAttendance = async (
  dateStr: string,
  employeeUid: string
) => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const date = new Date(dateStr);
  const salaryMonthKey = getSalaryMonthKey(date, startDay);
  const recordPath = `attendance_${salaryMonthKey}/${dateStr}/records/${employeeUid}`;

  await deleteDoc(doc(db, recordPath));
};

export const adminUpsertAttendance = async (
  employeeUid: string,
  dateStr: string,
  data: {
    status?: AttendanceStatus;
    inTime?: Date | null;
    outTime?: Date | null;
    leaveReason?: string;
    mode: "attendance" | "leave" | "off";
  }
) => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;
  const officeStartTime = settings?.officeStartTime || "10:00";
  const officeEndTime = settings?.officeEndTime || "18:00";
  const lateBuffer = settings?.lateMarkAfterMinutes || 15;

  const date = new Date(dateStr);
  const salaryMonthKey = getSalaryMonthKey(date, startDay);

  const attendanceCollectionPath = `attendance_${salaryMonthKey}`;
  const dateDocPath = `${attendanceCollectionPath}/${dateStr}`;
  const recordPath = `${dateDocPath}/records/${employeeUid}`;

  // Check if record exists
  const existingRecordDoc = await getDoc(doc(db, recordPath));
  const exists = existingRecordDoc.exists();

  // Determine status based on mode and inputs
  let finalStatus: AttendanceStatus = "present"; // Default
  let lateMinutes = 0;
  let earlyLeaveHours = 0;

  if (data.mode === "leave") {
    finalStatus = "leave";
  } else if (data.mode === "off") {
    finalStatus = "off";
  } else {
    // Attendance mode
    if (data.inTime) {
      finalStatus = getLateStatus(data.inTime, officeStartTime, lateBuffer);
      if (finalStatus === "late" || finalStatus === "half-day") {
        lateMinutes = calculateLateMinutes(
          data.inTime,
          officeStartTime,
          lateBuffer
        );
      }
    } else {
      finalStatus = "present";
    }
  }

  if (data.outTime) {
    earlyLeaveHours = calculateEarlyLeaveHours(data.outTime, officeEndTime);
  }

  const recordData: any = {
    status: finalStatus,
    markedBy: "admin",
    updatedAt: serverTimestamp(),
  };

  if (!exists) {
    recordData.createdAt = serverTimestamp();
  }

  if (data.mode === "attendance") {
    if (data.inTime) recordData.inTime = Timestamp.fromDate(data.inTime);
    if (data.outTime) recordData.outTime = Timestamp.fromDate(data.outTime);

    // Cleanup leave fields
    recordData.leaveReason = deleteField();
  } else {
    if (data.leaveReason) recordData.leaveReason = data.leaveReason;

    // Cleanup attendance fields
    recordData.inTime = deleteField();
    recordData.outTime = deleteField();
    recordData.lateMinutes = deleteField();
    recordData.earlyLeaveHours = deleteField();
    recordData.overtimeHours = deleteField();
    recordData.overtimeStatus = deleteField();
    recordData.overtimeReason = deleteField();
  }

  if (finalStatus === "late" || finalStatus === "half-day") {
    recordData.lateMinutes = lateMinutes;
  } else if (data.mode === "attendance") {
    // If present (not late), remove lateMinutes
    recordData.lateMinutes = deleteField();
  }

  if (data.outTime && data.mode === "attendance") {
    recordData.earlyLeaveHours = earlyLeaveHours;

    // Calculate Overtime
    const overtimeHours = calculateOvertimeHours(data.outTime, officeEndTime);
    if (overtimeHours > 0) {
      recordData.overtimeHours = overtimeHours;
      recordData.overtimeStatus = "approved"; // Default approved
      recordData.overtimeReason = null;
    } else {
      recordData.overtimeHours = 0;
      recordData.overtimeStatus = deleteField();
      recordData.overtimeReason = deleteField();
    }
  } else if (data.mode === "attendance") {
    // If no outTime, remove related fields
    recordData.earlyLeaveHours = deleteField();
    recordData.overtimeHours = deleteField();
    recordData.overtimeStatus = deleteField();
    recordData.overtimeReason = deleteField();
  }

  // Ensure parent date document exists
  await setDoc(doc(db, dateDocPath), { date: dateStr }, { merge: true });

  // Use setDoc with merge to create or update
  await setDoc(
    doc(db, recordPath),
    {
      ...recordData,
      employeeUid,
      date: dateStr,
    },
    { merge: true }
  );
};

// ==================== HOLIDAY OPERATIONS ====================

export const addHoliday = async (dateStr: string, reason?: string) => {
  const holidayData: Record<string, any> = {
    createdAt: serverTimestamp() as Timestamp,
  };

  if (reason) {
    holidayData.reason = reason;
  }

  await setDoc(doc(db, "holidays", dateStr), {
    ...holidayData,
    date: dateStr,
  });
};

export const getHoliday = async (dateStr: string): Promise<Holiday | null> => {
  const holidayDoc = await getDoc(doc(db, "holidays", dateStr));
  if (!holidayDoc.exists()) return null;

  return holidayDoc.data() as Holiday;
};

export const getMonthHolidays = async (
  salaryMonthKey: string
): Promise<Holiday[]> => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const { start, end } = getSalaryMonthDates(salaryMonthKey, startDay);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const holidaysSnapshot = await getDocs(collection(db, "holidays"));
  const holidays = holidaysSnapshot.docs
    .map((doc) => doc.data() as Holiday)
    .filter((h) => h.date >= startStr && h.date <= endStr);

  return holidays;
};

export const deleteHoliday = async (dateStr: string) => {
  await deleteDoc(doc(db, "holidays", dateStr));
};

export const markAllSundaysForYear = async (year: number) => {
  const sundays = getAllSundaysInYear(year);

  const promises = sundays.map(async (sunday) => {
    const existing = await getHoliday(sunday);
    if (!existing) {
      await addHoliday(sunday, "Sunday");
    }
  });

  await Promise.all(promises);
};

export const calculateMonthlySalary = async (
  employeeUid: string,
  salaryMonthKey: string
): Promise<SalaryReport | null> => {
  const employee = await getEmployee(employeeUid);
  if (!employee) return null;

  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  const { start, end } = getSalaryMonthDates(salaryMonthKey, startDay);
  const allDays = eachDayOfInterval({ start, end });
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const [records, holidays] = await Promise.all([
    getMonthlyAttendance(employeeUid, salaryMonthKey),
    getMonthHolidays(salaryMonthKey),
  ]);

  const recordsMap = new Map(records.map((r) => [r.date, r]));
  const holidaysSet = new Set(holidays.map((h) => h.date));

  let presentDays = 0;
  let leaveDays = 0;
  let offDays = 0;
  let unmarkedDays = 0;
  let lateCount = 0;
  let halfDayCount = 0;
  let earlyLeaveHours = 0;

  allDays.forEach((day) => {
    const dateStr = format(day, "yyyy-MM-dd");

    // Skip future days
    if (dateStr > todayStr) return;

    const record = recordsMap.get(dateStr);
    const isHoliday = holidaysSet.has(dateStr);

    if (record) {
      switch (record.status) {
        case "present":
          presentDays++;
          break;
        case "leave":
          leaveDays++;
          break;
        case "off":
          offDays++;
          break;
        case "late":
          lateCount++;
          presentDays++; // Late is still present
          break;
        case "half-day":
          halfDayCount++;
          presentDays++; // Half-day is still present
          break;
      }

      if (record.earlyLeaveHours) {
        earlyLeaveHours += record.earlyLeaveHours;
      }
    } else {
      // No record found
      if (!isHoliday) {
        // Not a holiday, so it's unmarked/absent
        unmarkedDays++;
      }
    }
  });

  // Treat unmarked days as OFF days for deduction
  const totalOffDaysForDeduction = offDays + unmarkedDays;

  const deductions = calculateDeductions(
    employee.monthlySalary,
    totalOffDaysForDeduction,
    lateCount,
    earlyLeaveHours,
    halfDayCount
  );

  const netSalary = calculateNetSalary(
    employee.monthlySalary,
    deductions.totalDeductions
  );

  return {
    employeeUid,
    employeeName: employee.name,
    empId: employee.empId,
    monthlySalary: employee.monthlySalary,
    presentDays,
    leaveDays,
    offDays,
    unmarkedDays,
    holidayDays: holidays.length,
    lateCount,
    halfDayCount,
    earlyLeaveHours,
    offDeduction: deductions.offDeduction,
    lateDeduction: deductions.lateDeduction,
    halfDayDeduction: deductions.halfDayDeduction,
    earlyLeaveDeduction: deductions.earlyLeaveDeduction,
    totalDeductions: deductions.totalDeductions,
    netSalary,
  };
};

export const generateMonthlyReport = async (
  salaryMonthKey: string
): Promise<SalaryReport[]> => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;

  // 1. Get all employees
  const employees = await getAllEmployees();

  // 2. Get date range
  const { start, end } = getSalaryMonthDates(salaryMonthKey, startDay);
  const days = eachDayOfInterval({ start, end });
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // 3. Fetch Holidays for the month
  const holidays = await getMonthHolidays(salaryMonthKey);
  const holidaysSet = new Set(holidays.map((h) => h.date));

  // 4. Fetch Attendance for ALL days in parallel
  const attendancePromises = days.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return getAttendanceForDate(dateStr).then((records) => ({
      dateStr,
      records,
    }));
  });

  const dailyRecords = await Promise.all(attendancePromises);

  // 5. Aggregate data per employee
  const employeeStats = new Map<
    string,
    {
      presentDays: number;
      leaveDays: number;
      offDays: number;
      lateCount: number;
      halfDayCount: number;
      earlyLeaveHours: number;
      unmarkedDays: number;
    }
  >();

  // Initialize stats
  employees.forEach((emp) => {
    employeeStats.set(emp.uid, {
      presentDays: 0,
      leaveDays: 0,
      offDays: 0,
      lateCount: 0,
      halfDayCount: 0,
      earlyLeaveHours: 0,
      unmarkedDays: 0,
    });
  });

  // Process each day
  dailyRecords.forEach(({ dateStr, records }) => {
    // CRITICAL: Skip future dates for deduction calculation
    // If we are in the current month, we should NOT count absent/off for future days
    if (dateStr > todayStr) return;

    const isHoliday = holidaysSet.has(dateStr);

    // Create a set of employees who have a record for this day
    const recordedEmployeeIds = new Set<string>();

    records.forEach((record) => {
      recordedEmployeeIds.add(record.employeeUid);
      const stats = employeeStats.get(record.employeeUid);
      if (!stats) return;

      if (record.status === "present") {
        stats.presentDays++;
      } else if (record.status === "late") {
        stats.presentDays++;
        stats.lateCount++;
      } else if (record.status === "half-day") {
        stats.presentDays++;
        stats.halfDayCount++;
      } else if (record.status === "leave") {
        stats.leaveDays++;
      } else if (record.status === "off") {
        stats.offDays++;
      }

      if (record.earlyLeaveHours) {
        stats.earlyLeaveHours += record.earlyLeaveHours;
      }
    });

    // Check for absent/unmarked employees
    employees.forEach((emp) => {
      if (!recordedEmployeeIds.has(emp.uid)) {
        // No record
        if (!isHoliday) {
          const stats = employeeStats.get(emp.uid);
          if (stats) stats.unmarkedDays++;
        }
      }
    });
  });

  // 6. Calculate Final Report
  const reports: SalaryReport[] = employees.map((emp) => {
    const stats = employeeStats.get(emp.uid)!;

    // Treat unmarked days as OFF days for deduction
    const totalOffDaysForDeduction = stats.offDays + stats.unmarkedDays;

    const deductions = calculateDeductions(
      emp.monthlySalary,
      totalOffDaysForDeduction,
      stats.lateCount,
      stats.earlyLeaveHours,
      stats.halfDayCount
    );

    const netSalary = calculateNetSalary(
      emp.monthlySalary,
      deductions.totalDeductions
    );

    return {
      employeeUid: emp.uid,
      employeeName: emp.name,
      empId: emp.empId,
      monthlySalary: emp.monthlySalary,
      presentDays: stats.presentDays,
      leaveDays: stats.leaveDays,
      offDays: stats.offDays,
      unmarkedDays: stats.unmarkedDays,
      holidayDays: holidays.length,
      lateCount: stats.lateCount,
      halfDayCount: stats.halfDayCount,
      earlyLeaveHours: stats.earlyLeaveHours,
      offDeduction: deductions.offDeduction,
      lateDeduction: deductions.lateDeduction,
      halfDayDeduction: deductions.halfDayDeduction,
      earlyLeaveDeduction: deductions.earlyLeaveDeduction,
      totalDeductions: deductions.totalDeductions,
      netSalary,
    };
  });

  return reports;
};

// ==================== SALARY PAYMENT OPERATIONS ====================

export const addSalaryPayment = async (payment: Omit<SalaryPayment, 'id'>) => {
  const collectionRef = collection(db, 'salary_payments');
  await setDoc(doc(collectionRef), payment);
};

export const getSalaryPayments = async (salaryMonthKey: string): Promise<SalaryPayment[]> => {
  const q = query(
    collection(db, 'salary_payments'),
    where('salaryMonthKey', '==', salaryMonthKey)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryPayment));
};

export const getEmployeePayments = async (employeeUid: string): Promise<SalaryPayment[]> => {
  const q = query(
    collection(db, 'salary_payments'),
    where('employeeUid', '==', employeeUid),
    orderBy('paidAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryPayment));
};

// ==================== MAINTENANCE OPERATIONS ====================

export const recomputeMonthlyAttendanceStatus = async (salaryMonthKey: string) => {
  const settings = await getPortalSettings();
  const officeStartTime = settings?.officeStartTime || "10:00";
  const lateBuffer = settings?.lateMarkAfterMinutes || 15;
  const startDay = settings?.salaryStartDay || 6;

  const { start, end } = getSalaryMonthDates(salaryMonthKey, startDay);
  const days = eachDayOfInterval({ start, end });

  let updatedCount = 0;

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    const recordsPath = `attendance_${salaryMonthKey}/${dateStr}/records`;
    const recordsSnapshot = await getDocs(collection(db, recordsPath));

    for (const recordDoc of recordsSnapshot.docs) {
      const data = recordDoc.data() as AttendanceRecord;
      if (data.inTime && (data.status === 'present' || data.status === 'late' || data.status === 'half-day')) {
        const newStatus = getLateStatus(data.inTime.toDate(), officeStartTime, lateBuffer);
        if (newStatus !== data.status) {
          await updateDoc(recordDoc.ref, {
            status: newStatus,
            updatedAt: serverTimestamp()
          });
          updatedCount++;
        }
      }
    }
  }
  return updatedCount;
};

// ==================== LEAVE REQUEST OPERATIONS ====================

export const createLeaveRequest = async (payload: {
  employeeUid: string;
  employeeName: string;
  empId?: string;
  team?: string | null;
  fromDate: string;
  toDate: string;
  reason: string;
  teamLeadUid?: string | null;
}) => {
  const ref = doc(collection(db, "leave_requests"));
  await setDoc(ref, {
    ...payload,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getLeaveRequestsForEmployee = async (
  employeeUid: string
): Promise<LeaveRequest[]> => {
  const q = query(
    collection(db, "leave_requests"),
    where("employeeUid", "==", employeeUid)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as LeaveRequest))
    .sort((a, b) => (b.fromDate || "").localeCompare(a.fromDate || ""));
};

export const getPendingLeaveRequests = async (
  teamLeadUid?: string
): Promise<LeaveRequest[]> => {
  const q = query(collection(db, "leave_requests"), where("status", "==", "pending"));
  const snapshot = await getDocs(q);
  const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as LeaveRequest));
  if (!teamLeadUid) return requests;

  const lead = await getEmployee(teamLeadUid);
  return requests.filter(
    (request) =>
      request.teamLeadUid === teamLeadUid ||
      (lead?.team && request.team === lead.team)
  );
};

export const getAllLeaveRequests = async (): Promise<LeaveRequest[]> => {
  const snapshot = await getDocs(collection(db, "leave_requests"));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as LeaveRequest))
    .sort((a, b) => (b.fromDate || "").localeCompare(a.fromDate || ""));
};

export const markLeaveOnDate = async (
  employeeUid: string,
  dateStr: string,
  leaveReason: string,
  markedBy: string
) => {
  const settings = await getPortalSettings();
  const startDay = settings?.salaryStartDay || 6;
  const date = parseISO(dateStr);
  const salaryMonthKey = getSalaryMonthKey(date, startDay);
  const attendanceCollectionPath = `attendance_${salaryMonthKey}`;
  const dateDocPath = `${attendanceCollectionPath}/${dateStr}`;
  const recordPath = `${dateDocPath}/records/${employeeUid}`;

  const existingRecord = await getDoc(doc(db, recordPath));
  if (existingRecord.exists()) {
    const current = existingRecord.data() as AttendanceRecord;
    if (current.status === "present" || current.status === "late" || current.status === "half-day") {
      return;
    }
  }

  await setDoc(doc(db, dateDocPath), { date: dateStr }, { merge: true });
  await setDoc(doc(db, recordPath), {
    employeeUid,
    date: dateStr,
    status: "leave",
    leaveReason,
    markedBy,
    createdAt: serverTimestamp(),
  });
};

export const reviewLeaveRequest = async (
  requestId: string,
  decision: "approved" | "rejected",
  reviewerUid: string,
  reviewerName: string,
  reviewNote?: string
) => {
  const requestRef = doc(db, "leave_requests", requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) {
    throw new Error("Leave request not found");
  }

  const request = { id: requestSnap.id, ...requestSnap.data() } as LeaveRequest;
  if (request.status !== "pending") {
    throw new Error("This request has already been reviewed");
  }

  if (decision === "rejected" && !reviewNote?.trim()) {
    throw new Error("A rejection reason is required.");
  }

  if (decision === "approved") {
    const start = parseISO(request.fromDate);
    const end = parseISO(request.toDate);
    const days = eachDayOfInterval({ start, end });
    for (const day of days) {
      await markLeaveOnDate(
        request.employeeUid,
        format(day, "yyyy-MM-dd"),
        request.reason,
        reviewerUid
      );
    }
  }

  await updateDoc(requestRef, {
    status: decision,
    reviewedBy: reviewerUid,
    reviewedByName: reviewerName,
    reviewedAt: serverTimestamp(),
    reviewNote: decision === "rejected" ? reviewNote?.trim() || "" : "",
  });
};
