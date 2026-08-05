import type { Metadata } from "next";
import { ReportsView } from "@/frontend/components/features/reports/reports-view";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return <ReportsView />;
}
