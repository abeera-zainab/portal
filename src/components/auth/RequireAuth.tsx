import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { UserRole } from "../../lib/auth";
import { Skeleton } from "../ui/skeleton";

interface RequireAuthProps {
  children: React.ReactNode;
  roles: UserRole[];
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, roles }) => {
  const { user, role: userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!userRole || !roles.includes(userRole)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
};
