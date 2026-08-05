import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZONES } from "@/frontend/lib/mock";
import { ZoneDetailView } from "@/frontend/components/features/zones/zone-detail-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const zone = ZONES.find((z) => z.id === id);
  return { title: zone ? `${zone.code} · ${zone.name}` : "Zone" };
}

export function generateStaticParams() {
  return ZONES.map((z) => ({ id: z.id }));
}

export default async function ZoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const zone = ZONES.find((z) => z.id === id);
  if (!zone) notFound();
  return <ZoneDetailView zoneId={zone.id} />;
}
