import type { Metadata } from "next";
import { CamerasView } from "@/frontend/components/features/cameras/cameras-view";

export const metadata: Metadata = { title: "Cameras" };

// Administrators only. The dashboard RouteGuard hides this from non-admins via
// the role-gated nav entry, and every /cameras API route is @Roles-restricted.
export default function CamerasPage() {
  return <CamerasView />;
}
