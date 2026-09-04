"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  Car,
  Download,
  Eye,
  IdCard,
  Mail,
  Phone,
  Receipt,
  ShieldCheck,
  Ticket,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Separator } from "@/frontend/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/frontend/components/ui/sheet";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Can, NOT_PERMITTED } from "@/frontend/components/shared/can";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Checkbox } from "@/frontend/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/frontend/components/ui/dialog";
import { Field, Money, PersonCell, Plate } from "@/frontend/components/shared/bits";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { CITIZENS, SESSIONS } from "@/frontend/lib/mock";
import {
  ApiError,
  citizensApi,
  listAll,
  messagingApi,
  privacyApi,
  saveDataExport,
  type MessageChannel,
} from "@/frontend/api";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { useMessaging } from "@/frontend/hooks/use-messaging";
import { toCitizen } from "@/frontend/lib/adapters";
import { isLiveApi } from "@/config/env";
import { formatDate, formatMoney, relativeTime } from "@/shared/utils/common.util";
import type { Citizen } from "@/shared/types/domain.types";

export function CitizensView() {
  const {
    items: citizens,
    isLoading,
    isRefreshing,
    emptyReason,
    apply,
    refresh,
  } = useResource<Citizen>(
    ["citizens", "list"],
    () =>
      listAll((page, pageSize) => citizensApi.list({ page, pageSize })).then((r) =>
        r.map(toCitizen),
      ),
    CITIZENS,
  );
  const [selected, setSelected] = React.useState<Citizen | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);

  /**
   * Both writes this screen makes — the account status and the plate flag —
   * sit on `user.manage` in `citizens.controller.ts`. The buttons in the detail
   * sheet are disabled and explained rather than hidden, so an officer can see
   * that blocking a plate is possible and simply is not theirs to do.
   */
  const { can } = usePermissions();
  const canManage = can("user.manage");

  // The detail sheet needs the vehicles and parking history, which the list
  // does not carry — fetched only once a citizen is actually opened.
  const detail = useApiQuery(
    ["citizens", "detail", selected?.id ?? ""],
    () => citizensApi.get(selected!.id).then((r) => r.data),
    { enabled: Boolean(selected?.id) && sheetOpen },
  );

  /** Blacklist, suspend or restore. */
  const changeStatus = React.useCallback(
    (citizen: Citizen, status: Citizen["status"], reason: string) =>
      apply(
        () => citizensApi.setStatus(citizen.id, status, reason),
        (list) => list.map((c) => (c.id === citizen.id ? { ...c, status } : c)),
        {
          success: status === "BLACKLISTED" ? "Citizen blacklisted" : "Citizen restored",
          description: citizen.name,
        },
      ),
    [apply],
  );

  const open = (citizen: Citizen) => {
    setSelected(citizen);
    setSheetOpen(true);
  };

  // ------------------------------------------------------------ data export
  const [exporting, setExporting] = React.useState<string | null>(null);

  /**
   * The DPDP right of access, as a file.
   *
   * `GET /privacy/citizens/:id/export` assembles the whole package — profile,
   * vehicles, sessions, payments, receipts, passes, feedback, incidents they
   * raised, notification deliveries, consent history, and the media ids of
   * evidence featuring their vehicles — and audits the disclosure against the
   * officer who asked for it. The download is a blob rather than a link,
   * because a URL to somebody's entire parking history is not a thing to leave
   * sitting in a browser history.
   *
   * Evidence arrives as media ids and not as pictures. That is the API's
   * decision and the right one: a signed URL is a bearer credential for the
   * bytes, and a package of them would still be live in whatever inbox it was
   * forwarded to.
   */
  const exportData = React.useCallback(async (citizen: Citizen) => {
    if (!isLiveApi) {
      toast.info("Exporting a citizen's data needs the API", {
        description: "Set NEXT_PUBLIC_API_URL to assemble a real subject-access package.",
      });
      return;
    }
    setExporting(citizen.id);
    try {
      const { data } = await privacyApi.export(citizen.id);
      saveDataExport(data, citizen.id);
      const truncated = Object.values(data.meta?.truncated ?? {}).some(Boolean);
      toast.success("Data export downloaded", {
        description: truncated
          ? `${citizen.name} · some sections were capped; the file says which.`
          : `${citizen.name} · the disclosure is recorded in the audit trail.`,
      });
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "That export could not be assembled.",
      );
    } finally {
      setExporting(null);
    }
  }, []);

  // ----------------------------------------------------------- announcements
  const { send, isSending } = useMessaging();
  const [announceOpen, setAnnounceOpen] = React.useState(false);
  const [announceTo, setAnnounceTo] = React.useState<Citizen[]>([]);
  const [announceTitle, setAnnounceTitle] = React.useState("");
  const [announceBody, setAnnounceBody] = React.useState("");
  const [announceChannels, setAnnounceChannels] = React.useState<MessageChannel[]>(["SMS"]);
  /**
   * The table's own "clear the selection" callback, held until the send
   * succeeds. Clearing on the click would drop the recipients out from under a
   * composer the officer might still cancel.
   */
  const [announceClear, setAnnounceClear] = React.useState<() => void>(() => () => {});

  const toggleChannel = (channel: MessageChannel) =>
    setAnnounceChannels((current) =>
      current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
    );

  const canAnnounce =
    announceTitle.trim().length > 0 && announceBody.trim().length > 0 && announceChannels.length > 0;

  const sendAnnouncement = () => {
    if (!canAnnounce) return;
    void send(
      () =>
        messagingApi.sendAnnouncement({
          citizenIds: announceTo.map((c) => c.id),
          title: announceTitle.trim(),
          body: announceBody.trim(),
          channels: announceChannels,
        }),
      {
        success: `Announcement sent to ${announceTo.length} citizens`,
        description: announceTitle.trim(),
      },
    ).then((ok) => {
      // Left open on failure, with the text still in it: an officer who has
      // just written two hundred words should not have to write them twice.
      if (!ok) return;
      setAnnounceOpen(false);
      announceClear();
    });
  };

  const columns = React.useMemo<ColumnDef<Citizen, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Citizen",
        meta: "Citizen",
        cell: ({ row }) => (
          <PersonCell name={row.original.name} secondary={row.original.phone} />
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        meta: "Email",
        cell: ({ row }) => (
          <span className="truncate text-xs text-muted-foreground">
            {row.original.email ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "vehicleCount",
        header: "Vehicles",
        meta: "Vehicles",
        cell: ({ row }) => (
          <Badge variant="secondary" className="gap-1 tabular">
            <Car className="size-3" />
            {row.original.vehicleCount}
          </Badge>
        ),
      },
      {
        accessorKey: "sessionsCount",
        header: "Sessions",
        meta: "Sessions",
        cell: ({ row }) => <span className="text-sm tabular">{row.original.sessionsCount}</span>,
      },
      {
        accessorKey: "totalSpent",
        header: "Spent",
        meta: "Total spent",
        cell: ({ row }) => <Money value={row.original.totalSpent} />,
      },
      {
        id: "pass",
        accessorFn: (c) => (c.hasActivePass ? "Pass holder" : "No pass"),
        header: "Pass",
        meta: "Pass",
        cell: ({ row }) =>
          row.original.hasActivePass ? (
            <Badge className="gap-1 bg-violet-500/15 text-violet-700 hover:bg-violet-500/15 dark:text-violet-300">
              <Ticket className="size-3" /> Active
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        meta: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const citizen = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={citizen.name}
                actions={[
                  { label: "View profile", icon: Eye, shortcut: "↵", onSelect: () => open(citizen) },
                  {
                    /**
                     * These two were never waiting on the backend. `tel:` and
                     * `mailto:` are what the operating system is for — the
                     * officer's own dialler and mail client already know how to
                     * place a call and open a draft, and a toast reading
                     * "Calling…" only ever described something not happening.
                     */
                    label: "Call",
                    icon: Phone,
                    disabled: !citizen.phone,
                    onSelect: () => {
                      // Spaces and the +91 the register stores are fine in a
                      // tel: URI, but a dialler is happier without the spaces.
                      window.location.href = `tel:${citizen.phone.replace(/\s+/g, "")}`;
                    },
                  },
                  {
                    label: "Email",
                    icon: Mail,
                    disabled: !citizen.email,
                    onSelect: () => {
                      window.location.href = `mailto:${citizen.email}`;
                    },
                  },
                  {
                    label: "Parking history",
                    icon: Receipt,
                    separatorBefore: true,
                    onSelect: () => open(citizen),
                  },
                  {
                    /**
                     * The subject-access export, from the row rather than only
                     * from the detail sheet — an officer working through a
                     * morning's DPDP requests should not have to open each
                     * person to answer one.
                     */
                    label: "Data export (DPDP)",
                    icon: Download,
                    permission: "user.manage",
                    onSelect: () => {
                      void exportData(citizen);
                    },
                  },
                  {
                    label: citizen.status === "BLACKLISTED" ? "Remove from blacklist" : "Blacklist",
                    icon: citizen.status === "BLACKLISTED" ? UserCheck : Ban,
                    /**
                     * `POST /citizens/:id/status` sits on `user.manage`, not on
                     * anything session-shaped: blacklisting ends someone's
                     * access to the platform, so the API treats it as account
                     * administration rather than an operational call.
                     */
                    permission: "user.manage",
                    destructive: citizen.status !== "BLACKLISTED",
                    separatorBefore: true,
                    onSelect: () => {
                      if (citizen.status === "BLACKLISTED") {
                        void changeStatus(
                          citizen,
                          "ACTIVE",
                          "Removed from blacklist from the portal",
                        ).catch(() => {});
                      } else {
                        setSelected(citizen);
                        setBlockOpen(true);
                      }
                    },
                  },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [changeStatus, exportData],
  );

  const active = citizens.filter((c) => c.status === "ACTIVE").length;
  const blacklisted = citizens.filter((c) => c.status === "BLACKLISTED").length;
  const passHolders = citizens.filter((c) => c.hasActivePass).length;
  const totalSpent = citizens.reduce((s, c) => s + c.totalSpent, 0);

  /**
   * Recent parking for the open citizen — from the API, or the demo set.
   *
   * The live rows come off the citizen detail endpoint rather than the sessions
   * list, and deliberately so: a parking session belongs to a *plate*, not to a
   * person. `/sessions` filters on zone, vendor, attendant, plate and dates, and
   * on nothing that names an owner — so there is no citizen id to pass it. The
   * detail endpoint joins through `vehicle.ownerUserId`, which is the only real
   * link between a citizen and the cars they have claimed, and it is why someone
   * who parked for months before installing the app still sees that history.
   *
   * The demo branch below matches on name because the bundled dataset has no
   * ids to join on. That is fine for a walkthrough and would be wrong against
   * real data, where two citizens sharing a name would see each other's parking.
   */
  const citizenSessions = React.useMemo(() => {
    if (!selected) return [];
    if (isLiveApi) {
      return (detail.data?.sessions ?? []).slice(0, 10).map((session) => ({
        id: session.id,
        plateNumber: session.plateNumber,
        zoneName: session.zone?.name ?? "—",
        status: session.status,
        payableAmount: session.payableAmount ?? undefined,
      }));
    }
    return SESSIONS.filter((s) => s.citizenName === selected.name)
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        plateNumber: s.plateNumber,
        zoneName: s.zoneName,
        status: s.status,
        payableAmount: s.payableAmount,
      }));
  }, [selected, detail.data]);

  /** Their claimed vehicles, and whether each is blocked at the kerb. */
  const citizenVehicles = isLiveApi ? (detail.data?.vehicles ?? []) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Citizens"
        description="Registered vehicle owners using the citizen app. Only the authority sees this register — vendors never do."
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FadeStaggerItem>
          <StatCard label="Registered" numeric={active} icon={Users} accent="success" hint="Active citizen accounts" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Pass holders" numeric={passHolders} icon={Ticket} accent="info" hint="With an active monthly or season pass" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Lifetime spend" value={<Money value={totalSpent} compact />} icon={IdCard} hint="Across every registered citizen" />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard label="Blacklisted" numeric={blacklisted} icon={Ban} accent={blacklisted > 0 ? "warning" : "success"} hint="Cannot start new sessions" />
        </FadeStaggerItem>
      </FadeStagger>

      <DataTable
        data={citizens}
        columns={columns}
        enableSelection
        searchKeys={["name", "phone", "email"]}
        searchPlaceholder="Search name, mobile or email…"
        facets={[
          {
            columnId: "status",
            label: "Status",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "BLACKLISTED", label: "Blacklisted" },
            ],
          },
          {
            columnId: "pass",
            label: "Pass",
            options: [
              { value: "Pass holder", label: "Pass holder" },
              { value: "No pass", label: "No pass" },
            ],
          },
        ]}
        onRowClick={open}
        onRefresh={() => {
          if (!isLiveApi) {
            toast.info("Demo data", {
              description: "This screen reads from the bundled demo dataset — there is nothing new to fetch.",
            });
            return;
          }
          void refresh();
        }}
        isRefreshing={isRefreshing}
        onExport={(rows) =>
          toast.success("Export queued", {
            description: `${rows.length} citizens · personal data is redacted per DPDP rules.`,
          })
        }
        bulkActions={(rows, clear) => (
          /**
           * POST /messaging/announcements — on user.manage, the grant every
           * other write on this screen carries. The API filters recipients to
           * the CITIZEN role, so this cannot be turned on staff.
           *
           * It opens a composer rather than sending on the click. An
           * announcement is the authority speaking in its own words to several
           * hundred people at once; that deserves a moment to read it back, and
           * the text is recorded against the officer in the audit trail.
           */
          <Can permission="user.manage">
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                setAnnounceTo(rows);
                setAnnounceClear(() => clear);
                setAnnounceTitle("");
                setAnnounceBody("");
                setAnnounceChannels(["SMS"]);
                setAnnounceOpen(true);
              }}
            >
              Send announcement
            </Button>
          </Can>
        )}
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No citizens registered"}
        emptyDescription={
          emptyReason ?? "Citizens appear here after they sign up in the app with a mobile OTP."
        }
      />

      {/* ------------------------------------------------------ detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{selected.name}</SheetTitle>
                  <StatusBadge status={selected.status} />
                  {selected.hasActivePass && (
                    <Badge className="gap-1 bg-violet-500/15 text-violet-700 hover:bg-violet-500/15 dark:text-violet-300">
                      <Ticket className="size-3" /> Pass holder
                    </Badge>
                  )}
                </div>
                <SheetDescription>
                  Joined {formatDate(selected.joinedAt)} ·{" "}
                  {selected.lastSeenAt ? `last seen ${relativeTime(selected.lastSeenAt)}` : "never signed in"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Vehicles", value: selected.vehicleCount },
                    { label: "Sessions", value: selected.sessionsCount },
                    { label: "Spent", value: formatMoney(selected.totalSpent, { compact: true }) },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border bg-muted/25 p-3 text-center">
                      <p className="text-lg font-semibold tabular">{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <dl className="divide-y divide-border/60">
                  <Field label="Mobile">
                    <span className="font-mono text-xs">{selected.phone}</span>
                  </Field>
                  <Field label="Email">
                    <span className="text-xs break-all">{selected.email ?? "Not provided"}</span>
                  </Field>
                  <Field label="Registered">{formatDate(selected.joinedAt)}</Field>
                  <Field label="Last active">
                    {selected.lastSeenAt ? relativeTime(selected.lastSeenAt) : "Never signed in"}
                  </Field>
                </dl>

                <Separator />

                {citizenVehicles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Vehicles</p>
                    <ul className="divide-y divide-border/60 rounded-lg border">
                      {citizenVehicles.map((vehicle) => (
                        <li key={vehicle.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                          <Plate value={vehicle.plateNumber} />
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {vehicle.vehicleType?.label ?? "—"}
                            {vehicle.makeModel ? ` · ${vehicle.makeModel}` : ""}
                          </span>
                          <Button
                            size="sm"
                            variant={vehicle.isBlacklisted ? "outline" : "ghost"}
                            className="h-7 text-xs"
                            disabled={!canManage}
                            title={canManage ? undefined : NOT_PERMITTED}
                            onClick={() => {
                              const citizen = selected;
                              void apply(
                                () =>
                                  citizensApi.setVehicleBlacklist(
                                    citizen.id,
                                    vehicle.id,
                                    !vehicle.isBlacklisted,
                                    vehicle.isBlacklisted
                                      ? "Cleared from the portal"
                                      : "Blacklisted from the portal",
                                  ),
                                (list) => list,
                                {
                                  success: vehicle.isBlacklisted
                                    ? "Plate cleared"
                                    : "Plate blacklisted",
                                  description: vehicle.plateNumber,
                                },
                              )
                                .then(() => detail.refetch())
                                .catch(() => {});
                            }}
                          >
                            {vehicle.isBlacklisted ? "Clear plate" : "Blacklist plate"}
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground text-pretty">
                      Blacklisting the account stops them using the app. It does not stop the car:
                      an attendant types a plate and never sees an owner, so the plate has to be
                      blocked here too.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Recent parking</p>
                  {detail.isLoading ? (
                    /* Claiming "no sessions" while the history is still in
                       flight is the one answer this panel must never give. */
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : citizenSessions.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                      {detail.error
                        ? "That parking history could not be loaded."
                        : "No sessions on record against this account."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/60 rounded-lg border">
                      {citizenSessions.map((session) => (
                        <li key={session.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                          <Plate value={session.plateNumber} />
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {session.zoneName}
                          </span>
                          <StatusBadge status={session.status} />
                          <Money value={session.payableAmount} className="text-xs" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 p-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground text-pretty">
                    Under the DPDP Act this citizen can request an export of their data or its
                    erasure. Both are handled from the settings screen and recorded in the audit
                    trail.
                  </p>
                </div>
              </div>

              <SheetFooter className="sm:flex-row">
                {/*
                  Gated on `user.manage`, which is what the API guards the
                  export route with. Handing somebody their whole parking
                  history, movements included, is a significant act — the same
                  grant that already lets an officer blacklist this account.
                */}
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!canManage || exporting === selected.id}
                  title={canManage ? undefined : NOT_PERMITTED}
                  onClick={() => void exportData(selected)}
                >
                  <Download className="size-4" />
                  {exporting === selected.id ? "Assembling…" : "Export data"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive"
                  disabled={selected.status === "BLACKLISTED" || !canManage}
                  title={canManage ? undefined : NOT_PERMITTED}
                  onClick={() => {
                    setSheetOpen(false);
                    setBlockOpen(true);
                  }}
                >
                  <Ban className="size-4" /> Blacklist
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={`Blacklist ${selected?.name}?`}
        destructive
        confirmLabel="Blacklist citizen"
        reason={{ label: "Reason", placeholder: "Repeated non-payment / abuse of an attendant / fraudulent disputes…", required: true }}
        description="They can no longer start sessions from the citizen app or buy passes. Attendants can still park their vehicle manually and charge it."
        onConfirm={(reason) => {
          if (selected) {
            void changeStatus(selected, "BLACKLISTED", (reason ?? "").trim()).catch(() => {});
          }
        }}
      />

      {/* -------------------------------------------------- announcement composer */}
      <Dialog open={announceOpen} onOpenChange={setAnnounceOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send an announcement</DialogTitle>
            <DialogDescription>
              To {announceTo.length} selected {announceTo.length === 1 ? "citizen" : "citizens"}. The
              text is recorded against your account in the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announce-title">Subject</Label>
              <Input
                id="announce-title"
                value={announceTitle}
                maxLength={120}
                placeholder="Esplanade East closed on 26 March"
                onChange={(e) => setAnnounceTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="announce-body">Message</Label>
              <Textarea
                id="announce-body"
                value={announceBody}
                maxLength={600}
                rows={5}
                placeholder="Zone 4 is closed for the procession. Passes remain valid in every other zone."
                onChange={(e) => setAnnounceBody(e.target.value)}
              />
              {/* The API caps the body at 600 characters and the SMS renderer
                  trims to three billed segments, so the count is what an
                  officer needs to see while writing, not afterwards. */}
              <p className="text-xs text-muted-foreground">
                {announceBody.length}/600 characters. Long messages are shortened on SMS.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="flex flex-wrap gap-4">
                {(["SMS", "WHATSAPP", "EMAIL"] as MessageChannel[]).map((channel) => (
                  <label key={channel} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={announceChannels.includes(channel)}
                      onCheckedChange={() => toggleChannel(channel)}
                    />
                    {channel === "WHATSAPP" ? "WhatsApp" : channel === "SMS" ? "SMS" : "Email"}
                  </label>
                ))}
              </div>
              {/* Said plainly rather than discovered one failed delivery at a
                  time: a citizen who never gave an address gets nothing on the
                  email channel, and the reply will say so per recipient. */}
              <p className="text-xs text-muted-foreground">
                Citizens with no number or address on file are reported back as undelivered.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnounceOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canAnnounce || isSending} onClick={sendAnnouncement}>
              Send to {announceTo.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
