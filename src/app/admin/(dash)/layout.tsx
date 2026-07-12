import AdminShell from "@/components/admin/AdminShell";

/**
 * Every screen in this group sits behind the admin session guard. `/admin/login`
 * is deliberately outside it — it's the only reachable admin route without a
 * session.
 */
export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
