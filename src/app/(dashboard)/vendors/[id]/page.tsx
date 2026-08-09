import type { Metadata } from "next";
import { Suspense } from "react";
import { VENDORS } from "@/frontend/lib/mock";
import { VendorDetailView } from "@/frontend/components/features/vendors/vendor-detail-view";
import { Skeleton } from "@/frontend/components/ui/skeleton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const vendor = VENDORS.find((v) => v.id === id);
  return { title: vendor?.orgName ?? "Vendor" };
}

/** Prerenders the demo vendors. Live ids resolve on demand — see the zone page. */
export function generateStaticParams() {
  return VENDORS.map((v) => ({ id: v.id }));
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <VendorDetailView vendorId={id} />
    </Suspense>
  );
}
