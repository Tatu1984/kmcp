"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Kbd } from "@/frontend/components/ui/kbd";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/frontend/components/ui/command";
import { NAV_GROUPS, QUICK_ACTIONS } from "@/frontend/lib/navigation";
import { ZONES, VENDORS, SESSIONS } from "@/frontend/lib/mock";
import { ROUTES } from "@/shared/constants/routes";
import { formatPlate } from "@/shared/utils/common.util";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 w-full justify-start gap-2 px-2.5 text-muted-foreground sm:w-64 lg:w-80"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate text-sm">Search zones, plates, vendors…</span>
        <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command palette"
        description="Jump to a page, look up a plate, or run an action."
      >
        <CommandInput placeholder="Type a page, plate number, zone code or vendor…" />
        <CommandList>
          <CommandEmpty>
            Nothing matched. Try a zone code like <span className="font-mono">PKS-01</span> or a
            plate like <span className="font-mono">WB02AB1234</span>.
          </CommandEmpty>

          <CommandGroup heading="Quick actions">
            {QUICK_ACTIONS.map((action) => (
              <CommandItem
                key={action.label}
                value={`${action.label} ${action.hint}`}
                onSelect={() => go(action.href)}
              >
                <action.icon className="size-4" />
                <span>{action.label}</span>
                <CommandShortcut>{action.hint}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {NAV_GROUPS.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${item.label} ${item.description} ${item.keywords?.join(" ") ?? ""}`}
                  onSelect={() => go(item.href)}
                >
                  <item.icon className="size-4" />
                  <div className="flex min-w-0 flex-col">
                    <span>{item.label}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          <CommandSeparator />

          <CommandGroup heading="Zones">
            {ZONES.slice(0, 8).map((zone) => (
              <CommandItem
                key={zone.id}
                value={`${zone.code} ${zone.name} ${zone.wardName} ${zone.streetName}`}
                onSelect={() => go(ROUTES.zone(zone.id))}
              >
                <span className="font-mono text-xs text-muted-foreground">{zone.code}</span>
                <span>{zone.name}</span>
                <CommandShortcut>
                  {zone.occupied}/{zone.capacity}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Active vehicles">
            {SESSIONS.filter((s) => s.status === "ACTIVE")
              .slice(0, 6)
              .map((session) => (
                <CommandItem
                  key={session.id}
                  value={`${session.plateNumber} ${session.code} ${session.zoneName}`}
                  onSelect={() => go(ROUTES.session(session.id))}
                >
                  <span className="font-mono text-xs">{formatPlate(session.plateNumber)}</span>
                  <span className="text-muted-foreground">{session.zoneName}</span>
                  <CommandShortcut>{session.code}</CommandShortcut>
                </CommandItem>
              ))}
          </CommandGroup>

          <CommandGroup heading="Vendors">
            {VENDORS.map((vendor) => (
              <CommandItem
                key={vendor.id}
                value={`${vendor.orgName} ${vendor.contactName}`}
                onSelect={() => go(ROUTES.vendor(vendor.id))}
              >
                <span>{vendor.orgName}</span>
                <CommandShortcut>{vendor.status}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="System">
            <CommandItem
              value="copy support diagnostics"
              onSelect={() => {
                setOpen(false);
                void navigator.clipboard.writeText("KMCP v1.0.0 · phase 1 · build local");
                toast.success("Diagnostics copied", { description: "Paste into a support ticket." });
              }}
            >
              Copy support diagnostics
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
