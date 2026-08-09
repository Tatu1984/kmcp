import type { Metadata } from "next";
import { ZONES } from "@/frontend/lib/mock";
import { ZoneDetailView } from "@/frontend/components/features/zones/zone-detail-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const zone = ZONES.find((z) => z.id === id);
  return { title: zone ? `${zone.code} · ${zone.name}` : "Zone" };
}

/**
 * Prerenders the demo zones so the walkthrough is instant offline.
 *
 * Live ids are not in this list and must still resolve, so nothing here checks
 * the id against the demo set — a real zone from the API would 404 before it
 * ever reached the view that knows how to fetch it.
 */
export function generateStaticParams() {
  return ZONES.map((z) => ({ id: z.id }));
}

export default async function ZoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ZoneDetailView zoneId={id} />;
}
