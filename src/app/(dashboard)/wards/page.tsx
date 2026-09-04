import type { Metadata } from "next";
import { WardsView } from "@/frontend/components/features/wards/wards-view";

export const metadata: Metadata = { title: "Wards" };

export default function WardsPage() {
  return <WardsView />;
}
