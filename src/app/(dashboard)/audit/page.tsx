import type { Metadata } from "next";
import { AuditView } from "@/frontend/components/features/audit/audit-view";

export const metadata: Metadata = { title: "Audit trail" };

export default function AuditPage() {
  return <AuditView />;
}
