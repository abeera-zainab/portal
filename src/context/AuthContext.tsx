import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  signInWithEmail,
  signOutUser,
  checkUserRole,
  UserRole,
} from "../lib/auth";
import { getAdmin, getEmployee } from "../lib/firestore";
import { Admin, Employee } from "../types";

interface AuthContextType {
  user: User | null;
  role: UserRole;
  profile: Admin | Employee | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<Admin | Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userRole = await checkUserRole(firebaseUser);
          let userProfile: Admin | Employee | null = null;

          if (userRole === "admin") {
            userProfile = await getAdmin(firebaseUser.uid);
          } else if (userRole === "employee" || userRole === "team_lead") {
            const employeeProfile = await getEmployee(firebaseUser.uid);

            if (employeeProfile) {
              if (employeeProfile.isActive === false) {
                await signOutUser();
                setUser(null);
                setRole(null);
                setProfile(null);
                setLoading(false);
                return;
              }
              userProfile = employeeProfile;
            }
          }

          setUser(firebaseUser);
          setRole(userRole);
          setProfile(userProfile);
        } else {
          setUser(null);
          setRole(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("Error in auth state change:", error);
        setUser(null);
        setRole(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmail(email, password);
  };

  const signOut = async () => {
    await signOutUser();
    setUser(null);
    setRole(null);
    setProfile(null);
  };

  const value: AuthContextType = {
    user,
    role,
    profile,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
