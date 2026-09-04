"use client";

import * as React from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Separator } from "@/frontend/components/ui/separator";
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
import { Plate } from "@/frontend/components/shared/bits";
import { ZONES } from "@/frontend/lib/mock";
import { zonesApi } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { isLiveApi } from "@/config/env";
import type { IncidentType } from "@/shared/types/domain.types";

/** Exactly the body `POST /incidents` takes, minus the media ids. */
export interface IncidentDraft {
  type: IncidentType;
  description: string;
  sessionId?: string;
  zoneId?: string;
}

/** The session an incident is being raised against, when there is one. */
export interface IncidentSubject {
  id: string;
  code: string;
  plateNumber: string;
  zoneId: string;
  zoneName: string;
}

/**
 * The hint under each type is what stops a report being filed under "Other"
 * because the officer was not sure which one applied — and a queue of "Other"
 * is a queue nobody can triage.
 */
const TYPES: { value: IncidentType; label: string; hint: string }[] = [
  { value: "ILLEGAL_PARKING", label: "Illegal parking", hint: "Parked without a session, or outside a marked bay" },
  { value: "ACCIDENT", label: "Accident", hint: "Collision or injury inside the zone" },
  { value: "VEHICLE_DAMAGE", label: "Vehicle damage", hint: "Damage found on a parked vehicle" },
  { value: "PARKING_DISPUTE", label: "Parking dispute", hint: "The charge or the duration is contested" },
  { value: "WRONG_VEHICLE", label: "Wrong vehicle", hint: "The plate on the session is not the vehicle in the bay" },
  { value: "OTHER", label: "Other", hint: "Anything the categories above do not cover" },
];

/**
 * Raising an incident, from the incidents screen or from a session.
 *
 * The server needs a session or a zone — an incident nobody can locate is a
 * note, not a record — so with no session in hand the zone picker is required.
 * When a session *is* in hand its zone travels with it and the picker is not
 * shown at all: the incident belongs where the vehicle is.
 *
 * The caller owns the write, exactly as `ZoneFormSheet` does, so both callers
 * get their own list's `apply` — the live call, the refetch, the demo branch
 * and the toasts — rather than this sheet growing a second copy of it.
 */
export function IncidentFormSheet({
  open,
  onOpenChange,
  session,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills and locks the subject. Omit to raise one against a zone. */
  session?: IncidentSubject | null;
  onSubmit?: (draft: IncidentDraft) => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);

  // Zones come from the API, never the demo roster: the id is sent straight to
  // the server, where a demo id does not exist and the foreign key is what
  // refuses the save — with nothing on screen to say why.
  //
  // That is also all the zone scoping this picker needs. GET /zones filters to
  // the caller's allocation in the query, so a Zone Officer is offered exactly
  // the wards they may raise an incident in; filtering the result again against
  // `zoneIds` would be a second copy of the same rule, and the copy that goes
  // stale.
  const zones = useApiQuery(["zones", "for-incident-form"], () =>
    zonesApi.list({ pageSize: 100 }).then((r) => r.data),
  );
  const zoneOptions = (zones.data ?? (isLiveApi ? [] : ZONES)).map((z) => ({
    id: z.id,
    code: z.code,
    name: z.name,
  }));

  const [form, setForm] = React.useState(() => defaults(session));

  // Reset while rendering when the sheet opens on a different subject — the
  // same pattern the zone form uses for a prop-driven reset.
  const openKey = open ? (session?.id ?? "zone") : "closed";
  const [lastKey, setLastKey] = React.useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    setForm(defaults(session));
  }

  async function submit() {
    const description = form.description.trim();
    // The API asks for ten characters before it will record a report, and it is
    // right to: "damaged" is not something a complaint can be answered from.
    if (description.length < 10) {
      toast.error("Describe what happened", {
        description: "At least a sentence — this is the record the citizen is answered from.",
      });
      return;
    }
    if (!session && !form.zoneId) {
      toast.error("Pick the zone this happened in");
      return;
    }

    setBusy(true);
    try {
      // The caller owns the write and has already reported the failure, so a
      // rejection here only means one thing to this sheet: stay open, with what
      // was typed still in it.
      await onSubmit?.({
        type: form.type,
        description,
        ...(session ? { sessionId: session.id } : { zoneId: form.zoneId }),
      });
      onOpenChange(false);
    } catch {
      // Reported by the caller.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Report an incident</SheetTitle>
          <SheetDescription>
            Anything that needs someone to go and look: an obstruction, a collision, damage found on
            a parked vehicle, or a charge a citizen is contesting.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4">
          {session && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/25 p-3">
              <Plate value={session.plateNumber} />
              <div className="min-w-0">
                <p className="font-mono text-xs font-medium">{session.code}</p>
                <p className="truncate text-xs text-muted-foreground">{session.zoneName}</p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                Attached to this session
              </Badge>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="incident-type">What happened</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v as IncidentType }))}
            >
              <SelectTrigger id="incident-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {TYPES.find((t) => t.value === form.type)?.hint}
            </p>
          </div>

          {!session && (
            <div className="space-y-1.5">
              <Label htmlFor="incident-zone">Zone</Label>
              <Select
                value={form.zoneId}
                onValueChange={(v) => setForm((f) => ({ ...f, zoneId: v }))}
              >
                <SelectTrigger id="incident-zone" className="w-full">
                  <SelectValue placeholder="Where did this happen?" />
                </SelectTrigger>
                <SelectContent>
                  {zoneOptions.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.code} · {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                An incident needs a session or a zone, so whoever picks it up knows where to go.
              </p>
            </div>
          )}

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="incident-description">Description</Label>
            <Textarea
              id="incident-description"
              rows={5}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Silver hatchback blocking the ramp at the north end of the kerb. Two bays affected, driver not present…"
            />
            <p className="text-xs text-muted-foreground">
              Write it for the officer who will read it on a phone at the kerb. Your name and the
              time are recorded with it.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 p-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-pretty">
              Photographs are attached from the attendant&apos;s app, which captures them with a hash
              and a geotag at the kerb. A report raised from the portal starts without them.
            </p>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
            Report incident
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function defaults(session?: IncidentSubject | null) {
  return {
    // A session-attached report is most often a dispute about the charge; one
    // raised from the incidents screen is most often something on the kerb.
    type: (session ? "PARKING_DISPUTE" : "ILLEGAL_PARKING") as IncidentType,
    description: "",
    zoneId: session?.zoneId ?? "",
  };
}
