"use client";

import * as React from "react";
import { toast } from "sonner";
import { Cctv, Trash2 } from "lucide-react";

import { Card } from "@/frontend/components/ui/card";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { EmptyState } from "@/frontend/components/shared/empty-state";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { isLiveApi } from "@/config/env";
import { ApiError } from "@/frontend/api/client";
import { camerasApi, type ApiCamera, type CameraStatus } from "@/frontend/api/endpoints/cameras.api";
import HlsPlayer from "./hls-player";
import { AddCameraDialog, RotateTokenButton } from "./add-camera-dialog";

const STATUS_TONE: Record<CameraStatus, { label: string; className: string }> = {
  ONLINE: { label: "Live", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  CONNECTING: { label: "Connecting", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  STOPPED: { label: "Stopped", className: "bg-muted text-muted-foreground" },
  OFFLINE: { label: "Offline", className: "bg-muted text-muted-foreground" },
};

export function CamerasView() {
  const query = useApiQuery<ApiCamera[]>(
    ["cameras"],
    async () => (await camerasApi.list()).data,
    // The picture is live; re-read status every few seconds.
    { refetchInterval: 5000 },
  );

  const cameras = query.data ?? [];

  const remove = async (cam: ApiCamera) => {
    if (!confirm(`Remove "${cam.name}"? This cannot be undone.`)) return;
    try {
      await camerasApi.remove(cam.id);
      toast.success("Camera removed");
      void query.refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove the camera");
    }
  };

  if (!isLiveApi) {
    return (
      <div className="p-6">
        <Header onCreated={() => {}} />
        <EmptyState
          icon={Cctv}
          title="Connect to the API to see cameras"
          description="Set NEXT_PUBLIC_API_URL to the backend to register cameras and watch live footage."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header onCreated={() => void query.refetch()} />

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={Cctv}
          title="Could not load cameras"
          description={query.error instanceof ApiError ? query.error.message : "Please try again."}
          action={<Button onClick={() => void query.refetch()}>Retry</Button>}
        />
      ) : cameras.length === 0 ? (
        <EmptyState
          icon={Cctv}
          title="No cameras yet"
          description="Register a camera to get an ingest URL and token for the Edge Agent."
          action={<AddCameraDialog onCreated={() => void query.refetch()} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cameras.map((cam) => (
            <CameraTile key={cam.id} camera={cam} onRemove={() => remove(cam)} onChanged={() => void query.refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ onCreated }: { onCreated: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">Cameras</h1>
        <p className="text-sm text-muted-foreground">Live CCTV pushed in from the Edge Agent.</p>
      </div>
      {isLiveApi && <AddCameraDialog onCreated={onCreated} />}
    </div>
  );
}

function CameraTile({
  camera,
  onRemove,
  onChanged,
}: {
  camera: ApiCamera;
  onRemove: () => void;
  onChanged: () => void;
}) {
  const tone = STATUS_TONE[camera.status];
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video w-full bg-black">
        <HlsPlayer src={camera.hlsUrl} active={camera.available} />
        <Badge className={`absolute left-2 top-2 border-0 ${tone.className}`}>{tone.label}</Badge>
      </div>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{camera.name}</p>
          {camera.group && <p className="truncate text-xs text-muted-foreground">{camera.group}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <RotateTokenButton id={camera.id} onRotated={onChanged} />
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove camera">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
