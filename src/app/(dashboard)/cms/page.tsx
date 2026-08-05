import type { Metadata } from "next";
import { CmsView } from "@/frontend/components/features/cms/cms-view";

export const metadata: Metadata = { title: "Public content" };

export default function CmsPage() {
  return <CmsView />;
}
