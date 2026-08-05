import type { Metadata } from "next";
import { AttendantsView } from "@/frontend/components/features/attendants/attendants-view";

export const metadata: Metadata = { title: "Attendants" };

export default function AttendantsPage() {
  return <AttendantsView />;
}
