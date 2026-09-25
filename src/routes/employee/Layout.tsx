import React from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { LogOut, LayoutDashboard, CalendarOff, Users, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "../../components/ThemeToggle";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";

export const EmployeeLayout: React.FC = () => {
  const { signOut, role } = useAuth();
  const { settings, loading: loadingSettings } = useSettings();
  const { theme } = useTheme();
  const location = useLocation();

  const logoUrl =
    theme === "dark"
      ? settings?.portalDarkLogoUrl ||
        settings?.darkLogoUrl ||
        settings?.logoUrl
      : settings?.portalLightLogoUrl ||
        settings?.lightLogoUrl ||
        settings?.logoUrl;

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-50 shadow-sm transition-colors">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              {loadingSettings ? (
                <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ) : logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Portal Logo"
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <h1 className="text-2xl font-bold text-primary dark:text-primary tracking-tight">
                  PSS Portal
                </h1>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 border-red-100 dark:border-red-900"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm transition-colors">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            <Link to="/dashboard">
              <Button
                variant="ghost"
                className={`rounded-none border-b-2 px-6 py-6 h-auto text-base font-medium transition-colors ${
                  isActive("/dashboard")
                    ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                    : "border-transparent text-muted-foreground dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <LayoutDashboard className="mr-2 h-5 w-5" />
                Dashboard
              </Button>
            </Link>
            <Link to="/leave">
              <Button
                variant="ghost"
                className={`rounded-none border-b-2 px-6 py-6 h-auto text-base font-medium transition-colors ${
                  isActive("/leave")
                    ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                    : "border-transparent text-muted-foreground dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <CalendarOff className="mr-2 h-5 w-5" />
                Leave
              </Button>
            </Link>
            {role === "team_lead" && (
              <>
                <Link to="/team/leave">
                  <Button
                    variant="ghost"
                    className={`rounded-none border-b-2 px-6 py-6 h-auto text-base font-medium transition-colors ${
                      isActive("/team/leave")
                        ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                        : "border-transparent text-muted-foreground dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <ClipboardList className="mr-2 h-5 w-5" />
                    Team Leave
                  </Button>
                </Link>
                <Link to="/team/attendance">
                  <Button
                    variant="ghost"
                    className={`rounded-none border-b-2 px-6 py-6 h-auto text-base font-medium transition-colors ${
                      isActive("/team/attendance")
                        ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                        : "border-transparent text-muted-foreground dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <Users className="mr-2 h-5 w-5" />
                    Team
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
