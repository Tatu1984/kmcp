import type { Metadata } from "next";
import { CamerasView } from "@/frontend/components/features/cameras/cameras-view";

export const metadata: Metadata = { title: "Cameras" };

export default function CamerasPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cameras</h1>
        <p className="text-sm text-muted-foreground">
          CCTV on the roads KMC prices parking along, and which of them are dark.
        </p>
      </div>
      <CamerasView />
    </>
  );
}
