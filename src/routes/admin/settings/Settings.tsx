import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs";
import {
  getPortalSettings,
  updatePortalSettings,
  recomputeMonthlyAttendanceStatus,
} from "../../../lib/firestore";
import { toast } from "sonner";
import {
  Save,
  User,
  Settings as SettingsIcon,
  Image,
  Shield,
  LogIn,
  Database,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { getDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { getSalaryMonthKey } from "../../../lib/salary";

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Portal Settings State
  const [currency, setCurrency] = useState("INR");
  const [lightLogoUrl, setLightLogoUrl] = useState("");
  const [darkLogoUrl, setDarkLogoUrl] = useState("");
  const [portalLightLogoUrl, setPortalLightLogoUrl] = useState("");
  const [portalDarkLogoUrl, setPortalDarkLogoUrl] = useState("");
  const [loginLightLogoUrl, setLoginLightLogoUrl] = useState("");
  const [loginDarkLogoUrl, setLoginDarkLogoUrl] = useState("");
  const [salaryStartDay, setSalaryStartDay] = useState(6);
  const [officeStartTime, setOfficeStartTime] = useState("10:00");
  const [officeEndTime, setOfficeEndTime] = useState("18:00");
  const [lateMarkAfterMinutes, setLateMarkAfterMinutes] = useState(15);
  const [enableCameraCapture, setEnableCameraCapture] = useState(false);

  // Admin Profile State
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [fixingAttendance, setFixingAttendance] = useState(false);

  useEffect(() => {
    loadSettings();
    if (user) {
      loadAdminProfile();
    }
  }, [user]);

  const loadAdminProfile = async () => {
    if (!user) return;

    // Set initial values from Auth user
    setAdminEmail(user.email || "");
    setAdminName(user.displayName || "");

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.name) setAdminName(data.name);
        // We don't overwrite email from Firestore as Auth email is source of truth
      }
    } catch (error) {
      console.error("Error loading admin profile:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await getPortalSettings();
      if (settings) {
        setCurrency(settings.currency || "INR");
        setLightLogoUrl(settings.lightLogoUrl || settings.logoUrl || "");
        setDarkLogoUrl(settings.darkLogoUrl || settings.logoUrl || "");
        setPortalLightLogoUrl(
          settings.portalLightLogoUrl ||
          settings.lightLogoUrl ||
          settings.logoUrl ||
          ""
        );
        setPortalDarkLogoUrl(
          settings.portalDarkLogoUrl ||
          settings.darkLogoUrl ||
          settings.logoUrl ||
          ""
        );
        setLoginLightLogoUrl(
          settings.loginLightLogoUrl ||
          settings.lightLogoUrl ||
          settings.logoUrl ||
          ""
        );
        setLoginDarkLogoUrl(
          settings.loginDarkLogoUrl ||
          settings.darkLogoUrl ||
          settings.logoUrl ||
          ""
        );
        setSalaryStartDay(settings.salaryStartDay || 6);
        setOfficeStartTime(settings.officeStartTime || "10:00");
        setOfficeEndTime(settings.officeEndTime || "18:00");
        setLateMarkAfterMinutes(settings.lateMarkAfterMinutes || 15);
        setEnableCameraCapture(settings.enableCameraCapture || false);
      }
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updatePortalSettings({
        currency,
        lightLogoUrl,
        darkLogoUrl,
        portalLightLogoUrl,
        portalDarkLogoUrl,
        loginLightLogoUrl,
        loginDarkLogoUrl,
        logoUrl: lightLogoUrl, // Fallback for backward compatibility
        salaryStartDay,
        officeStartTime,
        officeEndTime,
        lateMarkAfterMinutes,
        enableCameraCapture,
      });
      toast.success("Portal settings updated successfully");
      window.location.reload();
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      await setDoc(
        doc(db, "users", user.uid),
        {
          name: adminName,
          email: user.email,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleFixAttendance = async () => {
    if (!confirm("Are you sure you want to recompute attendance status for the current and previous months? This will update records based on the current 1-hour late rule.")) return;

    try {
      setFixingAttendance(true);

      // Fix for last 3 months to be safe
      const monthsToFix = [];
      for (let i = 0; i < 3; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        monthsToFix.push(getSalaryMonthKey(date, salaryStartDay));
      }

      let totalUpdated = 0;
      for (const monthKey of monthsToFix) {
        toast.info(`Fixing records for ${monthKey}...`);
        const count = await recomputeMonthlyAttendanceStatus(monthKey);
        totalUpdated += count;
      }

      toast.success(`Successfully updated ${totalUpdated} records across ${monthsToFix.length} months.`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to recompute attendance");
    } finally {
      setFixingAttendance(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage portal configuration and your profile
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="logos" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Logos
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Configuration</CardTitle>
              <CardDescription>
                Configure core system settings like currency, timings, and
                rules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency Symbol</Label>
                    <select
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="PKR">PKR (Rs)</option>
                      <option value="AED">AED (AED)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="salaryStartDay">
                      Salary Month Start Day
                    </Label>
                    <Input
                      id="salaryStartDay"
                      type="number"
                      min="1"
                      max="28"
                      value={salaryStartDay}
                      onChange={(e) =>
                        setSalaryStartDay(parseInt(e.target.value))
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Day of month when salary cycle begins (e.g., 6).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="officeStartTime">Office Start Time</Label>
                    <Input
                      id="officeStartTime"
                      type="time"
                      value={officeStartTime}
                      onChange={(e) => setOfficeStartTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="officeEndTime">Office End Time</Label>
                    <Input
                      id="officeEndTime"
                      type="time"
                      value={officeEndTime}
                      onChange={(e) => setOfficeEndTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lateMarkAfterMinutes">
                      Late Mark Buffer (Minutes)
                    </Label>
                    <Input
                      id="lateMarkAfterMinutes"
                      type="number"
                      min="0"
                      value={lateMarkAfterMinutes}
                      onChange={(e) =>
                        setLateMarkAfterMinutes(parseInt(e.target.value))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 border p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <input
                    type="checkbox"
                    id="enableCameraCapture"
                    checked={enableCameraCapture}
                    onChange={(e) => setEnableCameraCapture(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="enableCameraCapture"
                      className="text-base font-medium"
                    >
                      Enable Stealth Camera Capture
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Silently capture a photo when employees mark attendance.
                    </p>
                  </div>
                </div>

                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logos Tab */}
        <TabsContent value="logos">
          <Card>
            <CardHeader>
              <CardTitle>Branding & Logos</CardTitle>
              <CardDescription>
                Customize the look of your portal and login pages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Portal Logos (Dashboard)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="portalLightLogo">Light Mode Logo</Label>
                      <Input
                        id="portalLightLogo"
                        value={portalLightLogoUrl}
                        onChange={(e) => setPortalLightLogoUrl(e.target.value)}
                        placeholder="https://example.com/portal-logo-dark.png"
                      />
                      {portalLightLogoUrl && (
                        <div className="mt-2 p-4 border rounded-lg bg-white flex items-center justify-center h-24">
                          <img
                            src={portalLightLogoUrl}
                            alt="Preview"
                            className="h-full object-contain"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="portalDarkLogo">Dark Mode Logo</Label>
                      <Input
                        id="portalDarkLogo"
                        value={portalDarkLogoUrl}
                        onChange={(e) => setPortalDarkLogoUrl(e.target.value)}
                        placeholder="https://example.com/portal-logo-light.png"
                      />
                      {portalDarkLogoUrl && (
                        <div className="mt-2 p-4 border rounded-lg bg-slate-950 flex items-center justify-center h-24">
                          <img
                            src={portalDarkLogoUrl}
                            alt="Preview"
                            className="h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <LogIn className="h-4 w-4" /> Login Page Logos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="loginLightLogo">Light Mode Logo</Label>
                      <Input
                        id="loginLightLogo"
                        value={loginLightLogoUrl}
                        onChange={(e) => setLoginLightLogoUrl(e.target.value)}
                        placeholder="https://example.com/login-logo-dark.png"
                      />
                      {loginLightLogoUrl && (
                        <div className="mt-2 p-4 border rounded-lg bg-white flex items-center justify-center h-24">
                          <img
                            src={loginLightLogoUrl}
                            alt="Preview"
                            className="h-full object-contain"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="loginDarkLogo">Dark Mode Logo</Label>
                      <Input
                        id="loginDarkLogo"
                        value={loginDarkLogoUrl}
                        onChange={(e) => setLoginDarkLogoUrl(e.target.value)}
                        placeholder="https://example.com/login-logo-light.png"
                      />
                      {loginDarkLogoUrl && (
                        <div className="mt-2 p-4 border rounded-lg bg-slate-950 flex items-center justify-center h-24">
                          <img
                            src={loginDarkLogoUrl}
                            alt="Preview"
                            className="h-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Admin Profile</CardTitle>
              <CardDescription>
                Update your personal information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleUpdateProfile}
                className="space-y-4 max-w-md"
              >
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email Address</Label>
                  <Input
                    id="adminEmail"
                    value={adminEmail}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminName">Full Name</Label>
                  <Input
                    id="adminName"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Updating..." : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>System Maintenance</CardTitle>
              <CardDescription>
                Perform bulk operations and database cleanup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <h3 className="text-lg font-medium text-amber-900 dark:text-amber-100 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Correct Attendance Status
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                  This tool will scan all attendance records for the last 3 months and re-evaluate the status (Present/Late/Half-Day) based on the current office timings and the new 1-hour late rule. Use this after changing salary logic or office timings.
                </p>
                <Button
                  onClick={handleFixAttendance}
                  disabled={fixingAttendance}
                  variant="outline"
                  className="mt-4 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                >
                  {fixingAttendance ? "Processing..." : "Run Correction Now"}
                </Button>
              </div>

              <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" /> Database Info
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  All attendance records are partitioned by salary month (e.g. attendance_2025_12).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
