"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Label } from "@/frontend/components/ui/label";
import { Input } from "@/frontend/components/ui/input";
import { Textarea } from "@/frontend/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/frontend/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { Alert, AlertDescription } from "@/frontend/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Zone, ZoneStatus } from "@/shared/types/domain.types";

const OPTIONS: { value: ZoneStatus; label: string; description: string }[] = [
  { value: "OPEN", label: "Open", description: "Accepting vehicles during working hours." },
  {
    value: "MAINTENANCE",
    label: "Maintenance closure",
    description: "Civil or utility work. Existing sessions run to completion.",
  },
  {
    value: "EVENT_CLOSURE",
    label: "Event closure",
    description: "Festival, procession or VIP movement. Citizens see the reason in the app.",
  },
  {
    value: "CLOSED",
    label: "Closed",
    description: "Withdrawn from service. No new sessions in this zone.",
  },
];

export function ZoneStatusDialog({
  open,
  onOpenChange,
  zone,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: Zone | null;
  onChanged?: (status: ZoneStatus, reason?: string, until?: string) => void;
}) {
  const [status, setStatus] = React.useState<ZoneStatus>("OPEN");
  const [reason, setReason] = React.useState("");
  const [until, setUntil] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const openKey = open ? (zone?.id ?? "none") : "closed";
  const [lastKey, setLastKey] = React.useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    if (zone) {
      setStatus(zone.status);
      setReason(zone.closureReason ?? "");
      setUntil(zone.closureUntil?.slice(0, 10) ?? "");
    }
  }

  const needsReason = status !== "OPEN";
  const canSave = !needsReason || reason.trim().length > 3;

  async function save() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    onOpenChange(false);
    onChanged?.(status, reason.trim() || undefined, until || undefined);
    toast.success(`${zone?.name} is now ${OPTIONS.find((o) => o.value === status)?.label.toLowerCase()}`, {
      description: needsReason ? reason : "Citizens can see this zone again in the app.",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change zone status</DialogTitle>
          <DialogDescription>
            {zone?.name} · {zone?.code}. The change takes effect immediately for every attendant and
            citizen app.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={status} onValueChange={(v) => setStatus(v as ZoneStatus)} className="gap-2">
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`status-${option.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                status === option.value ? "border-primary bg-primary/5" : "hover:bg-accent/40",
              )}
            >
              <RadioGroupItem value={option.value} id={`status-${option.value}`} className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>
            </label>
          ))}
        </RadioGroup>

        {needsReason && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="closure-reason">
                Reason shown to citizens <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="closure-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Road resurfacing by PWD until further notice"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closure-until">Reopens on (optional)</Label>
              <Input
                id="closure-until"
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </div>
          </div>
        )}

        {zone && zone.occupied > 0 && status !== "OPEN" && (
          <Alert className="border-amber-500/30 bg-amber-500/[0.06]">
            <AlertDescription>
              {zone.occupied} vehicles are currently parked here. They keep their sessions and will be
              charged normally — only new sessions are blocked.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave || busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Apply status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
