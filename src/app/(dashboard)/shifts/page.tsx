import type { Metadata } from "next";
import { ShiftsView } from "@/frontend/components/features/shifts/shifts-view";

export const metadata: Metadata = { title: "Shifts" };

export default function ShiftsPage() {
  return <ShiftsView />;
}
