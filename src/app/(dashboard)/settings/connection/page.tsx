import type { Metadata } from "next";
import { ConnectionCheck } from "@/frontend/components/features/settings/connection-check";

export const metadata: Metadata = { title: "API connection" };

export default function ConnectionPage() {
  return <ConnectionCheck />;
}
