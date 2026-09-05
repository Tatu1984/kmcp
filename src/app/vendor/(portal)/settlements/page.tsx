import type { Metadata } from "next";
import { VendorSettlementsView } from "@/frontend/components/features/vendor-portal/vendor-settlements-view";

export const metadata: Metadata = { title: "Settlements" };

export default function VendorSettlementsPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settlements</h1>
        <p className="text-sm text-muted-foreground">
          What KMC owes you for each period of trading, and what has already been paid.
        </p>
      </div>
      <VendorSettlementsView />
    </>
  );
}
