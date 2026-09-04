"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import type { Ward } from "@/shared/types/domain.types";

export function WardFormSheet({
  open,
  onOpenChange,
  ward,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ward?: Ward | null;
  onSaved?: (ward: { code: string; name: string }) => void | Promise<void>;
}) {
  const editing = Boolean(ward);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState(() => defaults(ward));

  // Reset while rendering when the sheet opens on a different ward — the
  // sanctioned React pattern for adjusting state to a prop change.
  const openKey = open ? (ward?.id ?? "new") : "closed";
  const [lastKey, setLastKey] = React.useState(openKey);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    setForm(defaults(ward));
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Ward code and name are both required");
      return;
    }
    setBusy(true);
    try {
      // The caller owns the write and reports success or failure — this sheet
      // only closes once the save has actually gone through.
      await onSaved?.({ code: form.code.trim(), name: form.name.trim() });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editing ? `Edit ${ward?.name}` : "Add a ward / division"}</SheetTitle>
          <SheetDescription>
            A ward is the civic division a zone&apos;s street belongs to. Zones and streets are
            scoped to it, so its code is printed on signage alongside the zone code.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="ward-code">Ward code</Label>
            <Input
              id="ward-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="W-45"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Printed on signage alongside the zone code.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ward-name">Ward name</Label>
            <Input
              id="ward-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Park Street"
            />
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {editing ? "Save changes" : "Add ward"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function defaults(ward?: Ward | null) {
  return {
    code: ward?.code ?? "",
    name: ward?.name ?? "",
  };
}
