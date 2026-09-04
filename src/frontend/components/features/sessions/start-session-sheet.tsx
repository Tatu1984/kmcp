"use client";

import * as React from "react";
import { CarFront, Loader2, Play } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import { zonesApi, listAll } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import { isLiveApi } from "@/config/env";
import { isValidPlate, normalisePlate } from "@/shared/utils/plate.util";
import type { SlotType } from "@/shared/types/domain.types";

export interface StartSessionDraft {
  zoneId: string;
  zoneName: string;
  plateNumber: string;
  vehicleType: SlotType;
  clientEventId: string;
}

/**
 * Starts a parking session from the portal.
 *
 * In the field this is the attendant's job and the vendor application's screen —
 * the plate is photographed, the handset supplies its coordinates, and the
 * server checks both against the zone's geo-fence. This is the same call
 * without the camera: an officer opening a session at a desk, which the API has
 * always allowed and the portal has never offered.
 *
 * It matters for two reasons beyond convenience. It is the only way to show the
 * meter running end to end before the mobile applications exist, and it is what
 * an officer needs when a handset has failed at the kerb and a vehicle is
 * already parked.
 *
 * `clientEventId` is generated here and kept for the life of the sheet, so a
 * double submission or a retry on a slow connection resolves to one session and
 * one fare rather than two — the same guarantee the offline queue relies on.
 */
export function StartSessionSheet({
  open,
  onOpenChange,
  onStart,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (draft: StartSessionDraft) => void;
  busy?: boolean;
}) {
  const zones = useApiQuery(["zones", "session-start"], () =>
    listAll((page, pageSize) => zonesApi.list({ page, pageSize, status: "OPEN" })),
  );

  const [zoneId, setZoneId] = React.useState("");
  const [plateNumber, setPlateNumber] = React.useState("");
  const [vehicleType, setVehicleType] = React.useState<SlotType>("CAR");
  /**
   * One id for the life of this sheet, generated in the state initialiser.
   *
   * The parent remounts the sheet on each opening (see its `key`), so "the life
   * of this sheet" is "this attempt" — which is exactly the scope an
   * idempotency key wants. Generating it in an effect instead would be a
   * synchronous setState the React Compiler refuses, and generating it during
   * render would be an impure call it also refuses; the initialiser is the one
   * place a random value legitimately belongs.
   */
  const [eventId] = React.useState(newEventId);

  const zoneList = zones.data ?? [];
  const zone = zoneList.find((z) => z.id === zoneId) ?? zoneList[0];

  const plate = normalisePlate(plateNumber);
  const plateValid = isValidPlate(plate);

  const vehicleTypes = (
    zone?.allowedVehicleTypeIds?.length
      ? zone.allowedVehicleTypeIds
      : Object.keys(VEHICLE_TYPE_LABELS)
  ) as SlotType[];

  function submit() {
    if (!zone || !plateValid) return;
    onStart({
      zoneId: zone.id,
      zoneName: zone.name,
      plateNumber: plate,
      vehicleType,
      clientEventId: eventId,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CarFront className="size-4" /> Start a parking session
          </SheetTitle>
          <SheetDescription className="text-pretty">
            The meter starts the moment this is submitted. The fare is not decided here — the
            server prices it against the published rate card when the session ends.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4">
          <div className="space-y-1.5">
            <Label htmlFor="start-zone">Zone</Label>
            {zones.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : zoneList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No zone is open. A session can only start on an open kerb.
              </p>
            ) : (
              <Select value={zone?.id ?? ""} onValueChange={setZoneId}>
                <SelectTrigger id="start-zone" className="w-full">
                  <SelectValue placeholder="Choose a zone" />
                </SelectTrigger>
                <SelectContent>
                  {zoneList.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.code} · {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="start-plate">Registration number</Label>
            <Input
              id="start-plate"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="WB02AB1234"
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-wider uppercase"
            />
            <p className="text-xs text-muted-foreground">
              {/* The same rule the API applies, so a typo is caught here rather
                  than coming back as a validation error after submission.
                  Phase 1 has no ANPR: the typed number is the record and the
                  photograph is the evidence. */}
              {plateNumber.length > 0 && !plateValid
                ? "Not a recognisable Indian registration number."
                : "Typed, not read by camera. Number-plate recognition arrives in Phase 2."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="start-vehicle">Vehicle type</Label>
            <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as SlotType)}>
              <SelectTrigger id="start-vehicle" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vehicleTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {VEHICLE_TYPE_LABELS[t] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Decides which rate card applies. A two-wheeler and a car on the same kerb are priced
              differently.
            </p>
          </div>

          {isLiveApi && (
            <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 font-mono text-[11px] break-all text-muted-foreground">
              Event id {eventId}
            </p>
          )}
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={submit} disabled={busy || !zone || !plateValid}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Start the meter
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Stable per-attempt id. Mirrors what a handset generates offline. */
function newEventId(): string {
  return `portal_${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;
}
