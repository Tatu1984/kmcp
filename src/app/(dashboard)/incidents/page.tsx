import type { Metadata } from "next";
import { IncidentsView } from "@/frontend/components/features/incidents/incidents-view";

export const metadata: Metadata = { title: "Incidents" };

export default function IncidentsPage() {
  return <IncidentsView />;
}
