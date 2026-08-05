import type { Metadata } from "next";
import { PassesView } from "@/frontend/components/features/passes/passes-view";

export const metadata: Metadata = { title: "Passes" };

export default function PassesPage() {
  return <PassesView />;
}
