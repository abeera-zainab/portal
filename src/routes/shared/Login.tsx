import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { ThemeToggle } from "../../components/ThemeToggle";
import { getAuthErrorMessage, sendResetPasswordEmail } from "../../lib/auth";

export const Login: React.FC = () => {
  const { user, role, signIn, loading } = useAuth();
  const { settings } = useSettings();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const logoUrl =
    theme === "dark"
      ? settings?.loginDarkLogoUrl ||
        settings?.darkLogoUrl ||
        settings?.logoUrl ||
        "/logo.png"
      : settings?.loginLightLogoUrl ||
        settings?.lightLogoUrl ||
        settings?.logoUrl ||
        "/logo.png";

  useEffect(() => {
    if (!user || loading) return;

    if (role === "admin") {
      navigate("/admin/dashboard", { replace: true });
    } else if (role === "employee" || role === "team_lead") {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/access-denied", { replace: true });
    }
  }, [user, role, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast.error("Enter your username or email and password.");
      return;
    }

    try {
      setSubmitting(true);
      await signIn(identifier, password);
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!identifier.trim()) {
      toast.error("Enter your username or email first.");
      return;
    }
    try {
      setResetting(true);
      await sendResetPasswordEmail(identifier);
      toast.success("Password reset email sent.");
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 shadow-lg">
            <img src={logoUrl} alt="PSS" className="h-10 w-10 object-contain" />
          </div>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full w-1/2 animate-[loading_1s_ease-in-out_infinite] rounded-full bg-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full bg-blue-100/50 dark:bg-blue-900/20 blur-3xl" />
      <div className="absolute -bottom-[10%] -right-[10%] h-[500px] w-[500px] rounded-full bg-indigo-100/50 dark:bg-indigo-900/20 blur-3xl" />

      <div className="z-10 w-full max-w-md animate-in fade-in zoom-in duration-500 slide-in-from-bottom-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white dark:bg-slate-900 shadow-xl ring-1 ring-slate-100 dark:ring-slate-800">
            <img
              src={logoUrl}
              alt="PSS Attendance Portal"
              className="h-12 w-12 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            PSS Attendance Portal
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Sign in with your username or email to check in and request leave
          </p>
        </div>

        <Card className="border-0 shadow-2xl shadow-blue-900/5 dark:shadow-none ring-1 ring-slate-200/50 dark:ring-slate-800 dark:bg-slate-900/50">
          <CardHeader className="space-y-1 pb-4 text-center">
            <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
              Staff login
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Employees, team leads, and admins use the same sign-in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Username or email</Label>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="username or name@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="h-11 w-full bg-blue-600 text-base font-medium hover:bg-blue-700"
                disabled={submitting}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {submitting ? "Signing in..." : "Sign in"}
              </Button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetting}
                className="w-full text-sm text-blue-600 hover:underline disabled:opacity-50"
              >
                {resetting ? "Sending reset email..." : "Forgot password?"}
              </button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          &copy; {new Date().getFullYear()} PSS. All rights reserved.
        </p>
      </div>
    </div>
  );
};
