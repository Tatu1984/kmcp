import type { Metadata } from "next";
import { TariffsView } from "@/frontend/components/features/tariffs/tariffs-view";

export const metadata: Metadata = { title: "Tariffs" };

export default function TariffsPage() {
  return <TariffsView />;
}
