import type { Metadata } from "next";
import { ZonesView } from "@/frontend/components/features/zones/zones-view";

export const metadata: Metadata = { title: "Parking zones" };

export default function ZonesPage() {
  return <ZonesView />;
}
