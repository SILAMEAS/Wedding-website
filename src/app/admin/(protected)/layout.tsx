import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/server/policies/admin";

// Server-side gate for every page below. Actions and route handlers check again.
export default async function ProtectedLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
