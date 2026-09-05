import type { Metadata } from "next";
import { StaffPayView } from "@/frontend/components/features/vendor-portal/staff-pay-view";

export const metadata: Metadata = { title: "Staff & pay" };

export default function VendorStaffPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Staff &amp; pay</h1>
        <p className="text-sm text-muted-foreground">
          What you have paid your attendants. Visible to you and to nobody else — not KMC,
          not an auditor, not the attendant.
        </p>
      </div>
      <StaffPayView />
    </>
  );
}
