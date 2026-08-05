import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

export function generateStaticParams() {
  return VENDORS.map((v) => ({ id: v.id }));
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = VENDORS.find((v) => v.id === id);
  if (!vendor) notFound();
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <VendorDetailView vendorId={vendor.id} />
    </Suspense>
  );
}
