import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SETTLEMENTS } from "@/frontend/lib/mock";
import { SettlementDetailView } from "@/frontend/components/features/settlements/settlement-detail-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const settlement = SETTLEMENTS.find((s) => s.id === id);
  return { title: settlement?.reference ?? "Settlement" };
}

export function generateStaticParams() {
  return SETTLEMENTS.map((s) => ({ id: s.id }));
}

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const settlement = SETTLEMENTS.find((s) => s.id === id);
  if (!settlement) notFound();
  return <SettlementDetailView settlementId={settlement.id} />;
}
