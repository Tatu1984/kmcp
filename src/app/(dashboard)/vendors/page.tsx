import type { Metadata } from "next";
import { VendorsView } from "@/frontend/components/features/vendors/vendors-view";

export const metadata: Metadata = { title: "Vendors" };

export default function VendorsPage() {
  return <VendorsView />;
}
