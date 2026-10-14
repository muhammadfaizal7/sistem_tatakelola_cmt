export type UserRole = "admin" | "manager" | "director" | "karyawan";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  unit: string;
};

type DemoAccount = AuthUser & { password: string };

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrator Sistem",
  manager: "Manager / Pengelola GCG",
  director: "Direktur",
  karyawan: "Karyawan",
};

export const demoAccounts: DemoAccount[] = [
  {
    id: "usr-director",
    name: "Budi Santoso",
    email: "director@comtelindo.co.id",
    password: "director123",
    role: "director",
    unit: "Direksi",
  },
  {
    id: "usr-admin",
    name: "Agus Riyanto",
    email: "admin@comtelindo.co.id",
    password: "admin123",
    role: "admin",
    unit: "GCG & Kepatuhan",
  },
  {
    id: "usr-manager",
    name: "Dina Maharani",
    email: "manager@comtelindo.co.id",
    password: "manager123",
    role: "manager",
    unit: "Procurement",
  },
  {
    id: "usr-karyawan",
    name: "Rudi Hartono",
    email: "karyawan@comtelindo.co.id",
    password: "karyawan123",
    role: "karyawan",
    unit: "Business Operations Support",
  },
];

const authStorageKey = "comtelindo-auth-user";

export function authenticate(email: string, password: string): AuthUser | null {
  const account = demoAccounts.find(
    (candidate) =>
      candidate.email.toLowerCase() === email.trim().toLowerCase() &&
      candidate.password === password,
  );

  if (!account) return null;
  const { password: _password, ...user } = account;
  return user;
}

export function readAuthUser(): AuthUser | null {
  const savedUser = window.localStorage.getItem(authStorageKey);
  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser) as AuthUser;
  } catch {
    window.localStorage.removeItem(authStorageKey);
    return null;
  }
}

export function writeAuthUser(user: AuthUser): void {
  window.localStorage.setItem(authStorageKey, JSON.stringify(user));
}

export function clearAuthUser(): void {
  window.localStorage.removeItem(authStorageKey);
}

export function canAccessWorkspace(role: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "director";
}

export function canApprove(role: UserRole): boolean {
  return canAccessWorkspace(role);
}

export function canManageDocuments(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canAdminister(role: UserRole): boolean {
  return role === "admin";
}
