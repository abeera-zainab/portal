import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  User,
} from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db, getSecondaryAuth } from "./firebase";
import { Employee } from "../types";
import { isValidUsername, normalizeUsername } from "./attendanceRules";

export type UserRole = "admin" | "team_lead" | "employee" | null;

export const resolveLoginEmail = async (identifier: string): Promise<string> => {
  const value = identifier.trim();
  if (!value) throw new Error("Enter your username or email.");
  if (value.includes("@")) return value.toLowerCase();

  const username = normalizeUsername(value);
  if (!isValidUsername(username)) {
    throw new Error("Enter a valid username or email.");
  }

  const usernameDoc = await getDoc(doc(db, "usernames", username));
  const email = usernameDoc.exists() ? String(usernameDoc.data().email || "") : "";
  if (!email) throw new Error("No account found for that username.");
  return email.toLowerCase();
};

export const signInWithEmail = async (identifier: string, password: string) => {
  const email = await resolveLoginEmail(identifier);
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const sendResetPasswordEmail = async (identifier: string) => {
  const email = await resolveLoginEmail(identifier);
  await sendPasswordResetEmail(auth, email);
};

export const createAuthUser = async (
  email: string,
  password: string,
  displayName: string
): Promise<string> => {
  const secondaryAuth = getSecondaryAuth();
  const credential = await createUserWithEmailAndPassword(
    secondaryAuth,
    email.trim().toLowerCase(),
    password
  );
  await updateProfile(credential.user, { displayName });
  const uid = credential.user.uid;
  await signOut(secondaryAuth);
  return uid;
};

export const signOutUser = async () => {
  await signOut(auth);
};

const roleFromEmployee = (data: Partial<Employee> | undefined): UserRole => {
  if (data?.role === "team_lead") return "team_lead";
  return "employee";
};

export const checkUserRole = async (user: User): Promise<UserRole> => {
  if (!user || !user.email) return null;

  try {
    const adminDoc = await getDoc(doc(db, "admins", user.uid));
    if (adminDoc.exists()) return "admin";

    const employeeDoc = await getDoc(doc(db, "employees", user.uid));
    if (employeeDoc.exists()) {
      return roleFromEmployee(employeeDoc.data() as Employee);
    }

    const employeesRef = collection(db, "employees");
    const q = query(employeesRef, where("email", "==", user.email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return roleFromEmployee(querySnapshot.docs[0].data() as Employee);
    }

    const adminsRef = collection(db, "admins");
    const adminQ = query(adminsRef, where("email", "==", user.email));
    const adminSnapshot = await getDocs(adminQ);
    if (!adminSnapshot.empty) return "admin";

    return null;
  } catch (error) {
    console.error("Error checking user role:", error);
    return null;
  }
};

export const getAuthErrorMessage = (error: unknown): string => {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: string }).code)
      : "";

  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact an administrator.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect username, email, or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    default:
      return error instanceof Error ? error.message : "Something went wrong.";
  }
};
