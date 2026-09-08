"use client";

import * as React from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { LocationPicker } from "@/frontend/components/shared/map";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Switch } from "@/frontend/components/ui/switch";
import { Separator } from "@/frontend/components/ui/separator";
import { Badge } from "@/frontend/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { WARDS, VENDORS } from "@/frontend/lib/mock";
import { geographyApi, vendorsApi } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { isLiveApi } from "@/config/env";
import { VEHICLE_TYPE_LABELS } from "@/config/app.config";
import type { Zone, SlotType } from "@/shared/types/domain.types";
import { cn } from "@/lib/utils";

const VEHICLE_OPTIONS: SlotType[] = [
  "TWO_WHEELER",
  "THREE_WHEELER",
  "CAR",
  "EV",
  "COMMERCIAL",
  "BUS",
  "TRUCK",
  "VIP",
  "GOVERNMENT",
  "ACCESSIBLE",
];

export function ZoneFormSheet({
  open,
  onOpenChange,
  zone,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone?: Zone | null;
  onSaved?: (zone: Partial<Zone>) => void | Promise<void>;
}) {
  const editing = Boolean(zone);
  const [busy, setBusy] = React.useState(false);

  /**
   * Wards and vendors come from the API, never from the demo dataset.
   *
   * Both ids are sent straight to the server, and a demo id does not exist
   * there — which surfaced as an unexplained 422 on save, because the database
   * rejected the foreign key rather than the form rejecting the choice.
   */
  const wards = useApiQuery(["wards", "for-zone-form"], () =>
    geographyApi.wards({ pageSize: 100 }).then((r) => r.data),
  );
  const vendors = useApiQuery(["vendors", "for-zone-form"], () =>
    vendorsApi.list({ pageSize: 100, status: "APPROVED" }).then((r) => r.data),
  );

  const wardOptions = (wards.data ?? (isLiveApi ? [] : WARDS)).map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
  }));
  const vendorOptions = (
    vendors.data ?? (isLiveApi ? [] : VENDORS.filter((v) => v.status === "APPROVED"))
  ).map((v) => ({ id: v.id, orgName: v.orgName, commissionPct: Number(v.commissionPct ?? 0) }));
  const [form, setForm] = React.useState(() => defaults(zone));

  // Reset while rendering when the sheet opens on a different zone — the
  // sanctioned React pattern for adjusting state to a prop change.
  const openKey = open ? (zone?.id ?? "new") : "closed";
  const [lastKey, setLastKey] = React.useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    setForm(defaults(zone));
  }

  const toggleType = (type: SlotType) =>
    setForm((f) => ({
      ...f,
      allowedVehicleTypes: f.allowedVehicleTypes.includes(type)
        ? f.allowedVehicleTypes.filter((t) => t !== type)
        : [...f.allowedVehicleTypes, type],
    }));

  async function save() {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Zone name and code are both required");
      return;
    }
    if (form.allowedVehicleTypes.length === 0) {
      toast.error("Pick at least one vehicle type this zone accepts");
      return;
    }
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Place the zone on the map before saving");
      return;
    }

    setBusy(true);
    try {
      // The caller owns the write and reports success or failure — this sheet
      // only closes once the save has actually gone through.
      await onSaved?.({ ...form, center: { lat, lng } } as Partial<Zone>);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${zone?.name}` : "Create a parking zone"}</SheetTitle>
          <SheetDescription>
            A zone is a geo-fenced stretch of kerb. The boundary decides which attendant can start a
            session here, so draw it before you go live.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="basics" className="px-4">
          <TabsList className="w-full">
            <TabsTrigger value="basics" className="flex-1">
              Basics
            </TabsTrigger>
            <TabsTrigger value="capacity" className="flex-1">
              Capacity
            </TabsTrigger>
            <TabsTrigger value="geofence" className="flex-1">
              Geo-fence
            </TabsTrigger>
          </TabsList>

          {/* -------------------------------------------------------- basics */}
          <TabsContent value="basics" className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="zone-code">Zone code</Label>
                <Input
                  id="zone-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="PKS-05"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Printed on signage and receipts.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone-name">Zone name</Label>
                <Input
                  id="zone-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Park Street North"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="zone-ward">Ward / division</Label>
                <Select value={form.wardId} onValueChange={(v) => setForm({ ...form, wardId: v })}>
                  <SelectTrigger id="zone-ward" className="w-full">
                    <SelectValue placeholder="Select a ward" />
                  </SelectTrigger>
                  <SelectContent>
                    {wardOptions.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.code} · {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone-street">Street / road</Label>
                <Input
                  id="zone-street"
                  name="zone-street"
                  autoComplete="off"
                  value={form.streetName}
                  onChange={(e) => setForm({ ...form, streetName: e.target.value })}
                  placeholder="Park Street"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zone-vendor">Assigned vendor</Label>
              <Select
                value={form.vendorId ?? "__none"}
                onValueChange={(v) => setForm({ ...form, vendorId: v === "__none" ? undefined : v })}
              >
                <SelectTrigger id="zone-vendor" className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Unassigned</SelectItem>
                  {vendorOptions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.orgName} · {v.commissionPct}% commission
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only approved vendors can be assigned kerb.
              </p>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="zone-open">Opens at</Label>
                <Input
                  id="zone-open"
                  type="time"
                  value={form.openTime}
                  onChange={(e) => setForm({ ...form, openTime: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone-close">Closes at</Label>
                <Input
                  id="zone-close"
                  type="time"
                  value={form.closeTime}
                  onChange={(e) => setForm({ ...form, closeTime: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------ capacity */}
          <TabsContent value="capacity" className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="zone-capacity">Total bays</Label>
              <Input
                id="zone-capacity"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Sessions are refused once occupancy reaches this number.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Vehicle types accepted</Label>
              <div className="flex flex-wrap gap-1.5">
                {VEHICLE_OPTIONS.map((type) => {
                  const selected = form.allowedVehicleTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {VEHICLE_TYPE_LABELS[type]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.allowedVehicleTypes.length} selected. An attendant cannot start a session for a
                type that is not listed here.
              </p>
            </div>

            <Separator />

            <div className="space-y-3 rounded-lg border bg-muted/25 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="reserve-ev" className="text-sm">
                    Reserve EV bays
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Hold 10% of bays for electric vehicles.
                  </p>
                </div>
                <Switch
                  id="reserve-ev"
                  checked={form.reserveEv}
                  onCheckedChange={(v) => setForm({ ...form, reserveEv: v })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="reserve-accessible" className="text-sm">
                    Reserve accessible bays
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Hold 2 bays nearest the ramp for accessible parking.
                  </p>
                </div>
                <Switch
                  id="reserve-accessible"
                  checked={form.reserveAccessible}
                  onCheckedChange={(v) => setForm({ ...form, reserveAccessible: v })}
                />
              </div>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------ geofence */}
          <TabsContent value="geofence" className="mt-4 space-y-4">
            <LocationPicker
              value={
                Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng))
                  ? { lat: Number(form.lat), lng: Number(form.lng) }
                  : null
              }
              onChange={(point) =>
                setForm((f) => ({
                  ...f,
                  lat: point.lat.toFixed(6),
                  lng: point.lng.toFixed(6),
                }))
              }
              height={280}
            />
            <p className="text-xs text-muted-foreground">
              Click the map or drag the pin to place the kerb. The coordinates below stay in step,
              and can be typed directly when a survey has already fixed the point.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="zone-lat">Centre latitude</Label>
                <Input
                  id="zone-lat"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone-lng">Centre longitude</Label>
                <Input
                  id="zone-lng"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zone-notes">Operational notes</Label>
              <Textarea
                id="zone-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Loading bay on the north kerb is excluded from the boundary…"
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 p-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                Tip
              </Badge>
              <p className="text-xs text-muted-foreground">
                Keep the boundary tight to the marked bays. A loose polygon lets an attendant start
                sessions from the pavement opposite, and every one of those becomes a dispute.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <SheetFooter className="flex-row justify-between gap-2">
          {editing ? (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                onOpenChange(false);
                toast.error("Zone retirement requires Super Admin approval", {
                  description: "Raise it from the zone's ⋯ menu instead.",
                });
              }}
            >
              <Trash2 className="size-4" /> Retire
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {editing ? "Save changes" : "Create zone"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function defaults(zone?: Zone | null) {
  return {
    code: zone?.code ?? "",
    name: zone?.name ?? "",
    wardId: zone?.wardId ?? "",
    streetName: zone?.streetName ?? "",
    vendorId: zone?.vendorId,
    capacity: zone?.capacity ?? 60,
    allowedVehicleTypes: (zone?.allowedVehicleTypes ?? ["CAR", "TWO_WHEELER"]) as SlotType[],
    openTime: zone?.openTime ?? "06:00",
    closeTime: zone?.closeTime ?? "22:00",
    lat: String(zone?.center.lat ?? "22.572600"),
    lng: String(zone?.center.lng ?? "88.363900"),
    boundaryPoints: zone?.boundaryPoints ?? 6,
    reserveEv: true,
    reserveAccessible: true,
    notes: "",
  };
}
