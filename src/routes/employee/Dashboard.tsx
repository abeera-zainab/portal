import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Skeleton } from "../../components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CheckCircle,
  LogOut,
  Coffee,
  Clock,
  Calendar,
  DollarSign,
  Timer,
  AlertTriangle,
  Wifi,
  WifiOff,
  PartyPopper,
} from "lucide-react";
import {
  markAttendance,
  getAttendanceForDate,
  getMonthlyAttendance,
  getMonthHolidays,
} from "../../lib/firestore";
import {
  getSalaryMonthKey,
  calculateDeductions,
  calculateNetSalary,
} from "../../lib/salary";
import { uploadAttendanceImage } from "../../lib/storage";
import {
  AttendanceRecord,
  Employee,
  AttendanceStats,
  Holiday,
} from "../../types";
import { useSettings } from "../../context/SettingsContext";
import {
  getUserIP,
  isOnAllowedNetwork,
  getAllowedIP,
} from "../../lib/ipRestriction";
import {
  getCurrentWeekHolidays,
  formatHolidayDisplay,
} from "../../lib/weekHolidays";
import { teamName } from "../../lib/teams";
import { formatWorkedMinutes, workedMinutesBetween } from "../../lib/attendanceRules";

const getSafeDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  if (typeof timestamp?.toDate === "function") {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "string") {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const formatTime = (timestamp: any) => {
  const date = getSafeDate(timestamp);
  return date ? format(date, "hh:mm a") : "-";
};

export const EmployeeDashboard: React.FC = () => {
  const { currencySymbol, salaryStartDay, enableCameraCapture } = useSettings();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [userIP, setUserIP] = useState<string>("");
  const [isAllowedNetwork, setIsAllowedNetwork] = useState<boolean>(false);
  const [checkingNetwork, setCheckingNetwork] = useState(true);
  const [weekHolidays, setWeekHolidays] = useState<Holiday[]>([]);
  const [now, setNow] = useState(() => new Date());

  // Camera Refs (Hidden)
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const employeeProfile = profile as Employee;

  useEffect(() => {
    checkNetwork();
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearInterval(timer);
      stopCamera();
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [user, salaryStartDay]);

  const checkNetwork = async () => {
    try {
      setCheckingNetwork(true);
      const ip = await getUserIP();
      setUserIP(ip);
      const allowed = await isOnAllowedNetwork();
      setIsAllowedNetwork(allowed);
    } catch (error) {
      console.error("Error checking network:", error);
      setIsAllowedNetwork(false);
    } finally {
      setCheckingNetwork(false);
    }
  };

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const today = format(new Date(), "yyyy-MM-dd");
      const salaryMonthKey = getSalaryMonthKey(new Date(), salaryStartDay);

      // Parallel Fetching
      const [todayRecords, monthlyRecords, monthlyHolidays] = await Promise.all(
        [
          getAttendanceForDate(today, user.uid),
          getMonthlyAttendance(user.uid, salaryMonthKey),
          getMonthHolidays(salaryMonthKey),
        ]
      );

      setTodayRecord(todayRecords[0] || null);

      // Get current week holidays (excluding Sundays)
      try {
        const currentWeekHolidays = getCurrentWeekHolidays(
          monthlyHolidays || []
        );
        setWeekHolidays(currentWeekHolidays);
      } catch (err) {
        console.error("Error processing holidays:", err);
        setWeekHolidays([]);
      }

      // Merge attendance records with holidays for Recent Activity
      const recordsMap = new Map<string, AttendanceRecord>();
      const todayDate = format(new Date(), "yyyy-MM-dd");

      // Add attendance records
      (monthlyRecords || []).forEach((record) => {
        if (record && record.date) {
          recordsMap.set(record.date, record);
        }
      });

      // Add holidays as attendance records with status "holiday" (only past holidays)
      (monthlyHolidays || []).forEach((holiday) => {
        if (holiday && holiday.date && !recordsMap.has(holiday.date)) {
          // Only add if holiday date is today or in the past
          if (holiday.date <= todayDate) {
            // Create a pseudo attendance record for the holiday
            recordsMap.set(holiday.date, {
              date: holiday.date,
              status: "holiday",
              employeeUid: user.uid,
              markedBy: "system",
              createdAt: new Date() as any,
            } as AttendanceRecord);
          }
        }
      });

      // Convert map to array, sort by date, and take last 10
      const sortedRecords = Array.from(recordsMap.values())
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .slice(0, 10);
      setRecentRecords(sortedRecords);

      // Calculate Stats
      let presentDays = 0;
      let leaveDays = 0;
      let offDays = 0;
      let lateDays = 0;
      let halfDayDays = 0;
      let earlyLeaveHours = 0;
      let overtimeHours = 0;

      const safeMonthlyRecords = Array.isArray(monthlyRecords)
        ? monthlyRecords
        : [];

      safeMonthlyRecords.forEach((record) => {
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
            lateDays++;
            presentDays++; // Late is still present
            break;
          case "half-day":
            halfDayDays++;
            presentDays++; // Half-day is still present
            break;
        }
        if (record.earlyLeaveHours) {
          earlyLeaveHours += record.earlyLeaveHours;
        }
        if (record.overtimeHours && record.overtimeStatus === "approved") {
          overtimeHours += record.overtimeHours;
        }
      });

      const deductions = calculateDeductions(
        employeeProfile?.monthlySalary || 0,
        offDays,
        lateDays,
        earlyLeaveHours,
        halfDayDays
      );

      const netSalary = calculateNetSalary(
        employeeProfile?.monthlySalary || 0,
        deductions.totalDeductions
      );

      setStats({
        presentDays,
        leaveDays,
        offDays,
        lateDays,
        halfDayDays,
        earlyLeaveHours,
        estimatedNetSalary: netSalary,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  };

  // Camera Functions
  const startCamera = async (): Promise<boolean> => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              resolve(true);
            };
          }
        });
        // Small delay to ensure camera adjusts light
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return true;
    } catch (err) {
      console.error("Error accessing camera:", err);
      return false;
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const captureImage = (): string | null => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.7); // Slightly lower quality for speed
      }
    }
    return null;
  };

  // Helper for timeout
  const timeoutPromise = (ms: number) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    );

  const captureAndMark = async (type: "present" | "early-off") => {
    if (!user) return;
    setMarking(true);

    let imageUrl: string | undefined;

    // 1. Attempt Camera Capture if Enabled
    if (enableCameraCapture) {
      try {
        const cameraStarted = await startCamera();
        if (cameraStarted) {
          const imageSrc = captureImage();
          stopCamera(); // Stop immediately after capture

          if (imageSrc) {
            try {
              // Race between upload and timeout (5 seconds)
              imageUrl = (await Promise.race([
                uploadAttendanceImage(user.uid, imageSrc),
                timeoutPromise(5000),
              ])) as string;
            } catch (uploadError) {
              console.error("Image upload failed or timed out:", uploadError);
              toast.error(
                "Image upload failed. Marking attendance without photo."
              );
              // Fail silently on upload error and proceed
            }
          }
        }
      } catch (cameraError) {
        console.error("Camera capture failed:", cameraError);
        // Fail silently on camera error
      } finally {
        stopCamera(); // Ensure camera is stopped
      }
    }

    // 2. Mark Attendance
    try {
      if (type === "present") {
        const status = await markAttendance(
          user.uid,
          "present",
          "self",
          undefined,
          false,
          imageUrl
        );
        toast.success(
          status === "late"
            ? "Checked in. This is marked late because it is after 9:30."
            : "Checked in successfully"
        );
      } else {
        await markAttendance(
          user.uid,
          "present",
          "self",
          undefined,
          true,
          imageUrl
        );
        toast.success("Checked out successfully");
      }
      await loadData();
    } catch (error: any) {
      console.error("Error marking attendance:", error);
      toast.error(error.message || "Failed to mark attendance");
    } finally {
      setMarking(false);
    }
  };

  const handleCheckIn = async () => {
    await captureAndMark("present");
  };

  const handleCheckOut = async () => {
    await captureAndMark("early-off");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      present: {
        className:
          "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 hover:bg-green-100/80 dark:hover:bg-green-900/70",
        label: "Present",
      },
      leave: {
        className:
          "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 hover:bg-blue-100/80 dark:hover:bg-blue-900/70",
        label: "Leave",
      },
      off: {
        className:
          "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 hover:bg-red-100/80 dark:hover:bg-red-900/70",
        label: "Off",
      },
      late: {
        className:
          "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/70",
        label: "Late",
      },
      "half-day": {
        className:
          "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 hover:bg-orange-100/80 dark:hover:bg-orange-900/70",
        label: "Half Day",
      },
      holiday: {
        className:
          "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 hover:bg-purple-100/80 dark:hover:bg-purple-900/70",
        label: "Holiday",
      },
    };
    const config = variants[status] || {
      className:
        "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400",
      label: status,
    };
    return (
      <Badge className={config.className} variant="secondary">
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const canCheckOut =
    todayRecord?.status === "present" ||
    todayRecord?.status === "late" ||
    todayRecord?.status === "half-day";
  const hasMarkedToday = !!todayRecord;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 pb-20">
      {/* Hidden Camera Elements */}
      <div className="hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-64 h-64 object-cover"
        />
        <canvas ref={canvasRef} />
      </div>

      {/* Holiday Alert - Current Week */}
      {weekHolidays.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <PartyPopper className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
              🎉 Upcoming Holidays This Week
            </h3>
            <div className="mt-2 space-y-1">
              {weekHolidays.map((holiday, index) => (
                <p
                  key={index}
                  className="text-sm text-purple-700 dark:text-purple-300"
                >
                  📅 {formatHolidayDisplay(holiday)}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Network Status Alert */}
      {!checkingNetwork && !isAllowedNetwork && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100">
              Not on Office WiFi
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              You must be connected to the office WiFi network (IP:{" "}
              {getAllowedIP()}) to check in or check out. Request leave from the
              Leave page from any network.
              <br />
              Your current IP: {userIP || "Unknown"}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {getGreeting()},{" "}
            <span className="text-primary">
              {employeeProfile?.name?.split(" ")[0] || "Employee"}
            </span>
          </h1>
          <p className="text-muted-foreground dark:text-slate-400 mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(new Date(), "EEEE, MMMM dd, yyyy")}
            {employeeProfile?.empId ? ` · User ID ${employeeProfile.empId}` : ""}
            {employeeProfile?.team ? ` · ${teamName(employeeProfile.team)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Network Status Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${checkingNetwork
                ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                : isAllowedNetwork
                  ? "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800"
              }`}
          >
            {checkingNetwork ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-gray-400 dark:border-gray-500 border-t-transparent animate-spin" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Checking...
                </span>
              </>
            ) : isAllowedNetwork ? (
              <>
                <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  Office WiFi
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-xs font-medium text-red-700 dark:text-red-400">
                  Not Connected
                </span>
              </>
            )}
          </div>

          {/* Salary Display */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border dark:border-slate-700 shadow-sm">
            <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary dark:text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground dark:text-slate-400 font-medium">
                Est. Net Salary
              </p>
              <p className="text-lg font-bold text-primary dark:text-primary leading-none">
                {currencySymbol}
                {stats?.estimatedNetSalary?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Action Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Card */}
        <Card className="lg:col-span-2 border-none shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-slate-800 dark:to-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Clock className="h-5 w-5 text-primary" />
              Today's Attendance
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              {hasMarkedToday
                ? `Status: ${todayRecord.status.toUpperCase()}`
                : "Check in when you start work. After 9:30 AM is marked late."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasMarkedToday ? (
              <div className="space-y-6">
                <Button
                  onClick={handleCheckIn}
                  disabled={marking || !isAllowedNetwork || checkingNetwork}
                  className="h-24 w-full flex flex-col gap-2 text-lg hover:scale-[1.01] transition-transform bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-8 w-8" />
                  Check In
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-100 dark:bg-green-900/30 rounded-full animate-ping opacity-20"></div>
                  <div className="h-24 w-24 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center relative z-10">
                    <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {todayRecord.status === "off"
                      ? "Today is your Off"
                      : todayRecord.status === "leave"
                        ? "On Leave Today"
                        : todayRecord.outTime
                          ? "You're all done for today!"
                          : "You're checked in!"}
                  </h3>
                  <p className="text-muted-foreground dark:text-slate-400">
                    {todayRecord.status === "off"
                      ? "Enjoy your day off! Come back tomorrow."
                      : todayRecord.status === "leave"
                        ? `Reason: ${todayRecord.leaveReason || "No reason provided"
                        }`
                        : todayRecord.outTime
                          ? `Out time marked at ${formatTime(todayRecord.outTime)}`
                          : `In time marked at ${formatTime(todayRecord.inTime)}`}
                  </p>
                  {todayRecord.inTime && (
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Time tracked:{" "}
                      {formatWorkedMinutes(
                        todayRecord.workedMinutes ??
                          workedMinutesBetween(
                            getSafeDate(todayRecord.inTime) || now,
                            getSafeDate(todayRecord.outTime) || now
                          )
                      )}
                    </p>
                  )}
                </div>

                {canCheckOut && !todayRecord.outTime && (
                  <Button
                    onClick={handleCheckOut}
                    disabled={marking || !isAllowedNetwork || checkingNetwork}
                    size="lg"
                    variant="outline"
                    className="w-full max-w-sm border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:text-orange-800 dark:hover:text-orange-300 hover:border-orange-300 dark:hover:border-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LogOut className="mr-2 h-5 w-5" />
                    Check Out
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Column */}
        <div className="space-y-6">
          <Card className="border-none shadow-md bg-white dark:bg-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg dark:text-white">
                Monthly Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-100 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-700 dark:text-green-400" />
                  </div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Present
                  </span>
                </div>
                <span className="text-xl font-bold text-green-700 dark:text-green-400">
                  {stats?.presentDays || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-100 dark:border-yellow-800">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-yellow-200 dark:bg-yellow-800 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
                  </div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Late
                  </span>
                </div>
                <span className="text-xl font-bold text-yellow-700 dark:text-yellow-400">
                  {stats?.lateDays || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center">
                    <Coffee className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                  </div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Leaves
                  </span>
                </div>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-400">
                  {stats?.leaveDays || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-100 dark:border-orange-800">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-orange-700 dark:text-orange-400" />
                  </div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Half Days
                  </span>
                </div>
                <span className="text-xl font-bold text-orange-700 dark:text-orange-400">
                  {stats?.halfDayDays || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-100 dark:border-orange-800">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center">
                    <Timer className="h-4 w-4 text-orange-700 dark:text-orange-400" />
                  </div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Early Leave
                  </span>
                </div>
                <span className="text-xl font-bold text-orange-700 dark:text-orange-400">
                  {stats?.earlyLeaveHours || 0}h
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity Table */}
      <Card className="border-none shadow-md overflow-hidden dark:bg-slate-800">
        <CardHeader className="bg-gray-50/50 dark:bg-slate-900/50 border-b dark:border-slate-700">
          <CardTitle className="dark:text-white">Recent Activity</CardTitle>
          <CardDescription className="dark:text-slate-400">
            Your last 10 attendance records
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent dark:border-slate-700">
                <TableHead className="w-[150px] dark:text-slate-300">
                  Date
                </TableHead>
                <TableHead className="dark:text-slate-300">Status</TableHead>
                <TableHead className="dark:text-slate-300">Check In</TableHead>
                <TableHead className="dark:text-slate-300">Check Out</TableHead>
                <TableHead className="text-right dark:text-slate-300">
                  Hours
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground dark:text-slate-400"
                  >
                    No recent records found
                  </TableCell>
                </TableRow>
              ) : (
                recentRecords.map((record) => {
                  // Calculate duration if both times exist
                  let duration = "-";
                  const inDate = getSafeDate(record.inTime);
                  const outDate = getSafeDate(record.outTime);

                  if (inDate && outDate) {
                    const diff = outDate.getTime() - inDate.getTime();
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const mins = Math.floor(
                      (diff % (1000 * 60 * 60)) / (1000 * 60)
                    );
                    duration = `${hours}h ${mins}m`;
                  }

                  return (
                    <TableRow
                      key={record.date}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-900/50 dark:border-slate-700"
                    >
                      <TableCell className="font-medium dark:text-white">
                        {format(new Date(record.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-muted-foreground dark:text-slate-400">
                        {formatTime(record.inTime)}
                      </TableCell>
                      <TableCell className="text-muted-foreground dark:text-slate-400">
                        {formatTime(record.outTime)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground dark:text-slate-400">
                        {duration}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
