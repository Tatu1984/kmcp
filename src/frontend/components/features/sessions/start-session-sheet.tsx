"use client";

import * as React from "react";
import { CarFront, Loader2, Play, SquareParking, TriangleAlert } from "lucide-react";
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
import { ApiError, slotsApi, zonesApi, listAll } from "@/frontend/api";
import { describeApiError, useResource } from "@/frontend/hooks/use-api";
import { toSlot } from "@/frontend/lib/adapters";
import { OPEN_ZONES, SLOTS } from "@/frontend/lib/mock";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import { isLiveApi } from "@/config/env";
import { isValidPlate, normalisePlate } from "@/shared/utils/plate.util";
import type { Slot, SlotType } from "@/shared/types/domain.types";

export interface StartSessionDraft {
  zoneId: string;
  zoneName: string;
  /** The bay, when one was allocated. Optional — see the note on the chooser. */
  slotId?: string;
  slotCode?: string;
  plateNumber: string;
  vehicleType: SlotType;
  clientEventId: string;
}

/** The zone fields this form needs, from the API or from the demo roster. */
interface StartZone {
  id: string;
  code: string;
  name: string;
  allowedVehicleTypes: SlotType[];
}

/** No bay. A real choice, not an empty one — see the chooser's note. */
const NO_BAY = "__none";

/** Every open zone, with the vehicle types each one permits. */
function fetchOpenZones(): Promise<StartZone[]> {
  return listAll((page, pageSize) => zonesApi.list({ page, pageSize, status: "OPEN" })).then((r) =>
    r.map((z) => ({
      id: z.id,
      code: z.code,
      name: z.name,
      allowedVehicleTypes: z.allowedVehicleTypeIds,
    })),
  );
}

/**
 * Every bay in a zone, not only the free ones.
 *
 * The three answers this form has to tell apart are "this zone has no bays at
 * all", "it has none of this kind" and "they are all taken" — and a request
 * filtered to `status=AVAILABLE` can only distinguish the last from the other
 * two. A zone's bays are a short list, so asking for all of them is cheaper
 * than asking twice.
 */
function fetchZoneBays(zoneId: string): Promise<Slot[]> {
  return listAll((page, pageSize) => slotsApi.list({ zoneId, page, pageSize })).then((r) =>
    r.map(toSlot),
  );
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
  /**
   * Resolves when the session started and rejects when the server refused.
   *
   * The rejection is what lets this sheet keep the reason next to the field
   * that caused it and drop a bay the server would not accept, instead of the
   * officer reading a toast and pressing the same button again.
   */
  onStart: (draft: StartSessionDraft) => Promise<void>;
  busy?: boolean;
}) {
  /**
   * Open zones, from the API when there is one and from the demo roster when
   * there is not.
   *
   * This was a bare `useApiQuery`, which is disabled without a backend — so in
   * demo mode the zone list came back empty and the sheet reported "No zone is
   * open. A session can only start on an open kerb." The whole flow this screen
   * exists to demonstrate was unreachable in the mode it is demonstrated in.
   */
  const { items: zoneList, isLoading: zonesLoading } = useResource<StartZone>(
    ["zones", "session-start"],
    fetchOpenZones,
    OPEN_ZONES.map((z) => ({
      id: z.id,
      code: z.code,
      name: z.name,
      allowedVehicleTypes: z.allowedVehicleTypes,
    })),
  );

  const [zoneId, setZoneId] = React.useState("");
  const [plateNumber, setPlateNumber] = React.useState("");
  const [chosenType, setChosenType] = React.useState<SlotType>("CAR");
  const [chosenBayId, setChosenBayId] = React.useState(NO_BAY);
  const [rejection, setRejection] = React.useState<string | null>(null);
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

  const zone = zoneList.find((z) => z.id === zoneId) ?? zoneList[0];

  const plate = normalisePlate(plateNumber);
  const plateValid = isValidPlate(plate);

  const allowedTypes = (
    zone?.allowedVehicleTypes?.length ? zone.allowedVehicleTypes : Object.keys(VEHICLE_TYPE_LABELS)
  ) as SlotType[];

  /**
   * Derived rather than corrected in an effect: switching to a zone that does
   * not permit the currently selected vehicle type falls back to one it does,
   * instead of submitting a type the server will refuse with
   * VEHICLE_TYPE_NOT_ALLOWED.
   */
  const vehicleType = allowedTypes.includes(chosenType) ? chosenType : (allowedTypes[0] ?? chosenType);

  const { items: allBays, isLoading: baysLoading } = useResource<Slot>(
    ["slots", "session-start", zone?.id ?? "none"],
    () => fetchZoneBays(zone!.id),
    SLOTS,
    { enabled: Boolean(zone?.id) },
  );

  // Narrowed here as well as in the request: a no-op against the API, and the
  // whole of the filtering in demo mode, where the fixture is every zone's bays.
  const zoneBays = allBays.filter((bay) => bay.zoneId === zone?.id);
  const ofType = zoneBays.filter((bay) => bay.type === vehicleType);
  const eligible = ofType.filter((bay) => bay.status === "AVAILABLE");

  /**
   * The chosen bay, validated against what is currently on offer.
   *
   * Changing the zone or the vehicle type changes which bays are eligible, and
   * a stale selection must not survive that. Resolved at render rather than
   * reset from an effect, so there is no moment where the form holds a bay the
   * list no longer contains.
   */
  const bay = eligible.find((b) => b.id === chosenBayId);

  async function submit() {
    if (!zone || !plateValid) return;
    setRejection(null);
    try {
      await onStart({
        zoneId: zone.id,
        zoneName: zone.name,
        slotId: bay?.id,
        slotCode: bay?.code,
        plateNumber: plate,
        vehicleType,
        clientEventId: eventId,
      });
    } catch (error) {
      /**
       * The write path has already reported this as a toast. Keeping it here
       * too puts the reason beside the fields that caused it, which matters
       * most for the refusals that name one: a zone that closed while the form
       * was open, a plate already parked elsewhere, or a bay taken by another
       * attendant between this list being fetched and the button being pressed.
       *
       * A bay refusal shows the server's own sentence rather than the field
       * summary `describeApiError` builds. The API writes these for a person to
       * read — "Bay C07 is already occupied. Allocate a free bay." — whereas
       * the generic path would render the machine-readable half as "Slot Id:
       * bay C07 is OCCUPIED", which is the same fact and none of the advice.
       */
      const bayRefusal = isBayRejection(error);
      setRejection(
        bayRefusal && error instanceof ApiError ? error.message : describeApiError(error),
      );
      // A bay the server would not accept must not be re-sent by an officer
      // pressing the button again.
      if (bayRefusal) setChosenBayId(NO_BAY);
    }
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
            {zonesLoading ? (
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
            <Select value={vehicleType} onValueChange={(v) => setChosenType(v as SlotType)}>
              <SelectTrigger id="start-vehicle" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {VEHICLE_TYPE_LABELS[t] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Decides which rate card applies, and which bays can hold the vehicle. A two-wheeler
              and a car on the same kerb are priced differently.
            </p>
          </div>

          {/* ------------------------------------------------------------- bay */}
          <div className="space-y-1.5">
            <Label htmlFor="start-bay" className="flex items-center gap-1.5">
              <SquareParking className="size-3.5" /> Bay
              <span className="text-xs font-normal text-muted-foreground">optional</span>
            </Label>

            {!zone ? (
              <p className="text-sm text-muted-foreground">Choose a zone first.</p>
            ) : baysLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <>
                {/**
                 * Offered, never required.
                 *
                 * A zone can legitimately have no bays recorded against it —
                 * `slotId` is optional on `POST /sessions/start`, and plenty of
                 * zones are priced for a capacity well above the number of bays
                 * anybody has marked out. So this never blocks the form; when
                 * there is nothing to pick it says which of the three reasons
                 * applies and lets the session start against the zone.
                 *
                 * Only AVAILABLE bays of the selected type, in the chosen zone,
                 * are offered — the same three things the server now checks. So
                 * this filtering is not the guard, it is the courtesy: an
                 * officer is never shown a bay that would be refused. The
                 * server remains the decision, including the one case a list
                 * cannot prevent — another attendant claiming the bay between
                 * this list being fetched and the button being pressed, which
                 * it refuses through a conditional update rather than a read.
                 */}
                {zoneBays.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-pretty">
                    No numbered bays are recorded in {zone.name}. The session will be held against
                    the zone itself, which is normal for a kerb that has never been marked out.
                  </p>
                ) : ofType.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-pretty">
                    None of the {zoneBays.length} bays in {zone.name} is a{" "}
                    {VEHICLE_TYPE_LABELS[vehicleType] ?? vehicleType} bay. Start without one, or
                    pick a different vehicle type.
                  </p>
                ) : eligible.length === 0 ? (
                  <p className="text-sm text-amber-600 text-pretty dark:text-amber-400">
                    All {ofType.length} {VEHICLE_TYPE_LABELS[vehicleType] ?? vehicleType} bays in{" "}
                    {zone.name} are taken or out of service. The session can still start without a
                    bay.
                  </p>
                ) : (
                  <>
                    <Select value={bay?.id ?? NO_BAY} onValueChange={setChosenBayId}>
                      <SelectTrigger id="start-bay" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* A first-class option rather than a blank row: not
                            allocating a bay is a decision an officer makes on
                            purpose, and it has to look like one. */}
                        <SelectItem value={NO_BAY}>No specific bay</SelectItem>
                        {eligible.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.code} · {VEHICLE_TYPE_LABELS[b.type] ?? b.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {eligible.length} free {VEHICLE_TYPE_LABELS[vehicleType] ?? vehicleType}{" "}
                      {eligible.length === 1 ? "bay" : "bays"} of {ofType.length} in {zone.name}.
                      Allocating one is what puts the bay on the citizen&apos;s screen.
                    </p>
                  </>
                )}
              </>
            )}
          </div>

          {rejection && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.06] p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">The session did not start</p>
                <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{rejection}</p>
              </div>
            </div>
          )}

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
          <Button className="flex-1" onClick={() => void submit()} disabled={busy || !zone || !plateValid}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Start the meter
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Whether the server refused because of the bay.
 *
 * `POST /sessions/start` validates the bay it is given and refuses four ways:
 * a bay in another zone or of the wrong vehicle type (`VALIDATION_FAILED`), a
 * bay already occupied, reserved or out of service, and a bay claimed by
 * another attendant in the moment between this form reading the list and the
 * officer pressing the button (`DUPLICATE_RESOURCE`, from a conditional update
 * that only claims a bay still AVAILABLE).
 *
 * The codes are shared ones, so the code alone cannot identify a bay refusal —
 * but every one of them carries `details: [{ field: "slotId", … }]`, which can.
 * Matched on the field, plus a `SLOT_` prefix in case the catalogue later grows
 * codes of its own. Never on the message: `ApiError` says to branch on `code`
 * because messages are reworded freely, and the error catalogue says the same.
 */
function isBayRejection(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code.startsWith("SLOT_")) return true;
  return (error.details ?? []).some((d) => d.field === "slotId" || d.field === "slot");
}

/** Stable per-attempt id. Mirrors what a handset generates offline. */
function newEventId(): string {
  return `portal_${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;
}
