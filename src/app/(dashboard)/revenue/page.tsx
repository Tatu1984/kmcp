import type { Metadata } from "next";
import { RevenueView } from "@/frontend/components/features/revenue/revenue-view";

export const metadata: Metadata = { title: "Revenue" };

export default function RevenuePage() {
  return <RevenueView />;
}
