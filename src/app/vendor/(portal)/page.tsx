import type { Metadata } from "next";
import { VendorTodayView } from "@/frontend/components/features/vendor-portal/vendor-today-view";

export const metadata: Metadata = { title: "Today" };

export default function VendorTodayPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-sm text-muted-foreground">
          Your zones, your staff, your takings. Nobody else&rsquo;s.
        </p>
      </div>
      <VendorTodayView />
    </>
  );
}
