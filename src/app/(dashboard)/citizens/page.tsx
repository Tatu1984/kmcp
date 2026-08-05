import type { Metadata } from "next";
import { CitizensView } from "@/frontend/components/features/citizens/citizens-view";

export const metadata: Metadata = { title: "Citizens" };

export default function CitizensPage() {
  return <CitizensView />;
}
