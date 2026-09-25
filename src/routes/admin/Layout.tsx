import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import {
  LogOut,
  LayoutDashboard,
  Users,
  UserCog,
  Calendar,
  ClipboardList,
  FileText,
  CalendarOff,
  Sun,
  Settings,
  Menu,
  X,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "../../context/SettingsContext";
import { useTheme } from "../../context/ThemeContext";
import { ThemeToggle } from "../../components/ThemeToggle";

export const AdminLayout: React.FC = () => {
  const { signOut } = useAuth();
  const { settings, loading: loadingSettings } = useSettings();
  const { theme } = useTheme();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const navItems = [
    { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/employees", label: "Employees", icon: Users },
    { path: "/admin/admins", label: "Admins", icon: UserCog },
    { path: "/admin/attendance", label: "Attendance", icon: ClipboardList },
    { path: "/admin/leave", label: "Leave", icon: CalendarOff },
    { path: "/admin/calendar", label: "Calendar", icon: Calendar },
    { path: "/admin/holidays", label: "Holidays", icon: Sun },
    { path: "/admin/reports", label: "Salary Reports", icon: FileText },
    { path: "/admin/paid-salaries", label: "Paid Salaries", icon: FileText },
    { path: "/admin/overtime", label: "Overtime", icon: Clock },
    { path: "/admin/settings", label: "Settings", icon: Settings },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6">
        {loadingSettings ? (
          <div className="space-y-2">
            <div className="h-12 w-full bg-gray-200 dark:bg-gray-500 rounded animate-pulse" />
          </div>
        ) : logoUrl ? (
          <img
            src={logoUrl}
            alt="Portal Logo"
            className="h-12 w-auto mb-2 object-contain"
          />
        ) : (
          <h1 className="text-2xl font-bold text-primary dark:text-primary">
            Admin Portal
          </h1>
        )}
      </div>

      <nav className="px-3 space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Button
                variant={active ? "default" : "ghost"}
                className="w-full justify-start"
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2">
        <ThemeToggle />
        <Button onClick={handleSignOut} variant="outline" className="w-full">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col md:flex-row transition-colors">
      {/* Mobile Header */}
      <div className="md:hidden bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="font-bold text-lg text-primary dark:text-primary">
          Admin Portal
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-xl">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 min-h-screen sticky top-0 h-screen overflow-y-auto transition-colors">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
};
