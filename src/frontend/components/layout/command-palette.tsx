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
import { QUICK_ACTIONS, visibleNavGroups } from "@/frontend/lib/navigation";
import { ZONES, VENDORS, SESSIONS } from "@/frontend/lib/mock";
import { sessionsApi, vendorsApi, zonesApi } from "@/frontend/api";
import { useApiQuery } from "@/frontend/hooks/use-api";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { isLiveApi } from "@/config/env";
import { ROUTES } from "@/shared/constants/routes";
import { formatPlate } from "@/shared/utils/common.util";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  /**
   * The palette is a second door onto the same rooms, so it is cut by the same
   * key as the sidebar. Nothing stands in while permissions resolve: the
   * palette opens on a deliberate keystroke, not on load, and by the time
   * anyone has pressed ⌘K the principal has long since arrived.
   */
  const permissions = usePermissions();
  const navGroups = React.useMemo(() => visibleNavGroups(permissions), [permissions]);
  const quickActions = QUICK_ACTIONS.filter((action) => permissions.can(action.permission));

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

  /**
   * The three record lists the palette can jump to, fetched only while it is
   * open. This component is mounted on every page of the portal, so fetching
   * on mount would mean three list calls per navigation for a search box most
   * visits never open.
   *
   * Each request asks for exactly as many rows as the group renders — the
   * palette has always shown a shortlist rather than the whole register, and
   * typing a code that is not on it is what the search page is for.
   */
  const zoneQuery = useApiQuery(
    ["zones", "command-palette"],
    () => zonesApi.list({ pageSize: 8 }).then((r) => r.data),
    { enabled: open && permissions.can("zone.read") },
  );
  const sessionQuery = useApiQuery(
    ["sessions", "command-palette"],
    () => sessionsApi.list({ status: "ACTIVE", pageSize: 6 }).then((r) => r.data),
    { enabled: open && permissions.can("session.read") },
  );
  const vendorQuery = useApiQuery(
    ["vendors", "command-palette"],
    () => vendorsApi.list({ pageSize: 8 }).then((r) => r.data),
    { enabled: open && permissions.can("vendor.read") },
  );

  /**
   * Live rows and demo rows name the same things differently — a zone's ward
   * is `wardName` in the demo set and `ward.name` from the API — so both are
   * flattened here and the groups below read one shape either way.
   */
  const zones = [...(zoneQuery.data ?? (isLiveApi ? [] : ZONES))].slice(0, 8).map((zone) => ({
    id: zone.id,
    code: zone.code,
    name: zone.name,
    wardName: "wardName" in zone ? zone.wardName : (zone.ward?.name ?? ""),
    streetName: "streetName" in zone ? zone.streetName : (zone.street?.name ?? ""),
    capacity: zone.capacity,
    occupied: zone.occupied,
  }));

  const activeSessions = [
    ...(sessionQuery.data ?? (isLiveApi ? [] : SESSIONS.filter((s) => s.status === "ACTIVE"))),
  ]
    .slice(0, 6)
    .map((session) => ({
      id: session.id,
      code: session.code,
      plateNumber: session.plateNumber,
      zoneName: "zoneName" in session ? session.zoneName : (session.zone?.name ?? "—"),
    }));

  const vendors = [...(vendorQuery.data ?? (isLiveApi ? [] : VENDORS))].map((vendor) => ({
    id: vendor.id,
    orgName: vendor.orgName,
    contactName: vendor.contactName,
    status: vendor.status,
  }));

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

          {quickActions.length > 0 && (
            <CommandGroup heading="Quick actions">
              {quickActions.map((action) => (
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
          )}

          <CommandSeparator />

          {navGroups.map((group) => (
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

          {/*
           * A register the account may not read is neither fetched above nor
           * rendered here. Left in, it would show an empty group — and empty
           * reads as "the city has no zones", not as "these are not yours".
           */}
          {permissions.can("zone.read") && (
            <CommandGroup heading="Zones">
              {zones.map((zone) => (
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
          )}

          {permissions.can("session.read") && (
            <CommandGroup heading="Active vehicles">
              {activeSessions.map((session) => (
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
          )}

          {permissions.can("vendor.read") && (
            <CommandGroup heading="Vendors">
              {vendors.map((vendor) => (
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
          )}

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
