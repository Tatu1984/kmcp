import type { Metadata } from "next";
import { PaymentsView } from "@/frontend/components/features/payments/payments-view";

export const metadata: Metadata = { title: "Payments" };

export default function PaymentsPage() {
  return <PaymentsView />;
}
