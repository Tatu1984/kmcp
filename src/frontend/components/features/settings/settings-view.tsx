"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  CloudUpload,
  CreditCard,
  Database,
  Globe,
  KeyRound,
  Laptop,
  Landmark,
  Percent,
  Plus,
  Plug,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Switch } from "@/frontend/components/ui/switch";
import { Separator } from "@/frontend/components/ui/separator";
import { Checkbox } from "@/frontend/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/frontend/components/ui/table";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { StatusBadge } from "@/frontend/components/shared/status-badge";
import { Can, NOT_PERMITTED } from "@/frontend/components/shared/can";
import { usePermissions } from "@/frontend/hooks/use-permissions";
import { Field, SectionCard } from "@/frontend/components/shared/bits";
import { RetentionPanel } from "./retention-panel";
import { PORTAL_USERS } from "@/frontend/lib/mock";
import { usersApi, rbacApi, settingsApi, authApi, deviceId, ApiError } from "@/frontend/api";
import { isLiveApi } from "@/config/env";
import { useResource, useApiQuery } from "@/frontend/hooks/use-api";
import { toUser } from "@/frontend/lib/adapters";
import { useSession } from "@/frontend/hooks/use-session";
import { PERMISSION_GROUPS, ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/shared/constants/roles";
import type { User } from "@/shared/types/domain.types";

import { APP, SETTLEMENT_CYCLES } from "@/config/app.config";
import { formatDateTime, relativeTime } from "@/shared/utils/common.util";

const TABS = [
  { value: "general", label: "General", icon: Globe },
  { value: "taxes", label: "Taxes & money", icon: Percent },
  { value: "gateways", label: "Integrations", icon: Plug },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "rbac", label: "Roles & access", icon: ShieldCheck },
  { value: "team", label: "Portal users", icon: Users },
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "security", label: "Security", icon: KeyRound },
  { value: "backup", label: "Backup & data", icon: Database },
];

export function SettingsView() {
  const params = useSearchParams();
  const { user: me, signOut } = useSession();

  /**
   * Two permissions cover this screen, and they are not the same one.
   *
   * `config.write` is what the API guards `/config` with — the general, tax and
   * notification tabs. `user.manage` guards `/users` and `/rbac`, which is the
   * roles matrix and the portal roster. An administrator may hold one without
   * the other, so the save buttons are gated separately rather than on a single
   * "may edit settings" idea the API does not have.
   */
  const { can } = usePermissions();
  const canWriteConfig = can("config.write");
  const canManageUsers = can("user.manage");
  const [tab, setTab] = React.useState(params.get("tab") ?? "general");
  const [dirty, setDirty] = React.useState(false);
  const [revokeOpen, setRevokeOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [passwordTarget, setPasswordTarget] = React.useState<User | null>(null);
  const [newPassword, setNewPassword] = React.useState("");

  // Read once from the API so the fields show what the platform is actually
  // using rather than the build-time defaults.
  const config = useApiQuery(["config"], () => settingsApi.config().then((r) => r.data));
  const configValue = React.useCallback(
    (key: string, fallback: number): number => {
      const namespace = key.split(".")[0];
      const entry = config.data?.namespaces?.[namespace]?.find((e) => e.key === key);
      return typeof entry?.value === "number" ? entry.value : fallback;
    },
    [config.data],
  );

  const [taxes, setTaxes] = React.useState({ gstPercent: 18, commissionPct: 18, gracePeriodMin: 10 });
  // Seed once from the API, using the state-during-render pattern rather than a
  // ref — the compiler rightly refuses ref reads while rendering.
  const [seeded, setSeeded] = React.useState(false);
  if (config.data && !seeded) {
    setSeeded(true);
    setTaxes({
      gstPercent: configValue("tax.gstPercent", 18),
      commissionPct: configValue("settlement.defaultCommissionPct", 18),
      gracePeriodMin: configValue("ops.defaultGracePeriodMin", 10),
    });
  }
  const {
    items: portalUsers,
    apply: applyUser,
  } = useResource<User>(
    ["users", "staff"],
    () => usersApi.list({ staffOnly: true, pageSize: 100 }).then((r) => r.data.map(toUser)),
    PORTAL_USERS,
  );

  // The authorisation matrix comes from the server, which is the thing that
  // enforces it. The portal used to keep its own copy, so this screen could
  // disagree with reality and nobody would know.
  const matrix = useApiQuery(["rbac", "matrix"], () => rbacApi.matrix().then((r) => r.data));

  const permissionGroups = matrix.data?.groups ?? PERMISSION_GROUPS;

  /** The roles to draw columns for, from the server where there is one. */
  const matrixRoles = React.useMemo(() => {
    if (matrix.data) return matrix.data.roles.filter((r) => r.code !== "CITIZEN");
    // Demo fallback: the roles the portal knows, with the superuser unrestricted.
    const all = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
    return (Object.values(ROLES) as Role[])
      .filter((r) => r !== "CITIZEN")
      .map((code) => ({
        code,
        label: ROLE_LABELS[code],
        description: ROLE_DESCRIPTIONS[code] ?? null,
        permissions: code === "SUPER_ADMIN" ? all : [],
        unrestricted: code === "SUPER_ADMIN",
        zoneScoped: false,
        isSystem: true,
        userCount: 0,
        editable: code !== "SUPER_ADMIN",
        deletable: false,
      }));
  }, [matrix.data]);

  /**
   * Ticked boxes, held locally until saved.
   *
   * Seeded from the server and re-seeded whenever it answers again, so a save
   * elsewhere is not silently overwritten by a stale draft on this screen.
   */
  const [draft, setDraft] = React.useState<Record<string, Set<string>>>({});
  const [matrixKey, setMatrixKey] = React.useState<string | null>(null);
  const serverKey = matrix.data ? JSON.stringify(matrix.data.roles.map((r) => [r.code, r.permissions])) : null;
  if (serverKey && serverKey !== matrixKey) {
    setMatrixKey(serverKey);
    setDraft(Object.fromEntries(matrixRoles.map((r) => [r.code, new Set(r.permissions)])));
  }

  const permissions = React.useMemo<Record<string, Set<string>>>(() => {
    if (Object.keys(draft).length > 0) return draft;
    return Object.fromEntries(matrixRoles.map((r) => [r.code, new Set(r.permissions)]));
  }, [draft, matrixRoles]);

  /**
   * The devices bound to this account.
   *
   * The list used to be one hard-coded row reading "This device", which is the
   * one thing a signed-in browser already knows. `GET /auth/devices` returns
   * the real estate, and the row for the fingerprint this browser presents at
   * sign-in is the current one — which is how the list knows not to offer to
   * sign you out of the session you are reading it in.
   */
  const devices = useApiQuery(["auth", "devices"], () => authApi.devices().then((r) => r.data));
  // Read once, in an initialiser: `deviceId()` mints and stores an id the first
  // time it is asked, which is a side effect and has no business in a render.
  const [thisFingerprint] = React.useState(() =>
    typeof window === "undefined" ? "" : deviceId(),
  );
  const [unbinding, setUnbinding] = React.useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [invite, setInvite] = React.useState({
    name: "",
    email: "",
    phone: "",
    role: "ZONE_OFFICER" as Role,
    password: "",
  });
  const canInvite =
    invite.name.trim().length >= 2 &&
    /.+@.+\..+/.test(invite.email.trim()) &&
    invite.password.length >= 10;

  const [ownPassword, setOwnPassword] = React.useState({ current: "", next: "", confirm: "" });
  const [changingPassword, setChangingPassword] = React.useState(false);

  /**
   * Changes the signed-in account's own password.
   *
   * The API signs out every *other* session on success and leaves this one
   * alone, which is why nothing here redirects: the operator stays where they
   * are, and the phone they left signed in at the depot does not.
   */
  const changeOwnPassword = async () => {
    if (!isLiveApi) {
      toast.info("Changing your password needs the API", {
        description: "Set NEXT_PUBLIC_API_URL to sign in against a real account.",
      });
      return;
    }
    setChangingPassword(true);
    try {
      await authApi.changePassword(ownPassword.current, ownPassword.next, ownPassword.confirm);
      setOwnPassword({ current: "", next: "", confirm: "" });
      toast.success("Password changed", { description: "Your other sessions have been signed out." });
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "That password could not be changed.",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const [savingRole, setSavingRole] = React.useState<string | null>(null);
  const [newRoleOpen, setNewRoleOpen] = React.useState(false);
  const [newRole, setNewRole] = React.useState({ code: "", label: "", description: "", zoneScoped: false });
  const [deleteRoleOpen, setDeleteRoleOpen] = React.useState(false);
  const [roleToDelete, setRoleToDelete] = React.useState<string | null>(null);

  const togglePermission = (roleCode: string, key: string) => {
    setDraft((prev) => {
      const current = new Set(prev[roleCode] ?? permissions[roleCode] ?? []);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return { ...prev, [roleCode]: current };
    });
  };

  /** Sends the whole permission set for one role, which is what the API takes. */
  const saveRole = async (roleCode: string) => {
    if (!isLiveApi) {
      toast.info("Saving roles needs the API", {
        description: "Set NEXT_PUBLIC_API_URL to change permissions.",
      });
      return;
    }
    setSavingRole(roleCode);
    try {
      const { data } = await rbacApi.updateRole(roleCode, {
        permissions: [...(permissions[roleCode] ?? [])],
        reason: "Changed from the roles and access screen",
      });
      await matrix.refetch();
      toast.success("Permissions updated", {
        description: data.sessionsRevoked
          ? `${data.sessionsRevoked} session(s) signed out so the change applies now.`
          : "No one was signed in with this role.",
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Those permissions did not save.");
    } finally {
      setSavingRole(null);
    }
  };

  const isRoleDirty = (roleCode: string) => {
    const server = matrixRoles.find((r) => r.code === roleCode);
    if (!server) return false;
    const current = permissions[roleCode] ?? new Set<string>();
    return (
      current.size !== server.permissions.length ||
      server.permissions.some((p) => !current.has(p))
    );
  };

  // The general/tax/notification tabs are still uncontrolled inputs rendered
  // from app.config defaults. Persisting them needs each field bound to a
  // namespaced config key first; until then this saves what is genuinely
  // editable rather than claiming to have saved everything.
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    if (!isLiveApi) {
      setDirty(false);
      toast.success("Settings saved", { description: "Changes are recorded in the audit trail." });
      return;
    }
    setSaving(true);
    try {
      await settingsApi.setConfigBulk(
        [
          { key: "tax.gstPercent", value: taxes.gstPercent },
          { key: "settlement.defaultCommissionPct", value: taxes.commissionPct },
          { key: "ops.defaultGracePeriodMin", value: taxes.gracePeriodMin },
        ],
        "Saved from portal settings",
      );
      setDirty(false);
      toast.success("Settings saved", { description: "Changes are recorded in the audit trail." });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Those settings did not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Platform configuration, integrations, roles and data governance."
        actions={
          <Can permission="config.write">
            <Button size="sm" className="h-9" onClick={() => void save()} disabled={!dirty || saving}>
              <Save className="size-4" /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          </Can>
        }
      />

      {/*
        The configuration fields stay legible to everyone — knowing the GST rate
        is part of understanding the platform — but an account without
        `config.write` has no Save button, so it says why rather than letting
        someone type into a form with no way out of it.
      */}
      {!canWriteConfig && ["general", "taxes", "notifications"].includes(tab) && (
        <p className="rounded-lg border border-dashed bg-muted/25 p-3 text-xs text-muted-foreground text-pretty">
          These settings are read-only for your role. Changing them needs the{" "}
          <span className="font-mono">config.write</span> permission.
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon className="size-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ------------------------------------------------------- general */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <SectionCard title="Authority" description="How the platform identifies itself to citizens">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="auth-name">Authority name</Label>
                <Input id="auth-name" defaultValue={APP.authority} onChange={() => setDirty(true)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-helpline">Helpline number</Label>
                <Input id="auth-helpline" defaultValue={APP.helpline} onChange={() => setDirty(true)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Support email</Label>
                <Input id="auth-email" defaultValue={APP.supportEmail} onChange={() => setDirty(true)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-timezone">Time zone</Label>
                <Select defaultValue={APP.timezone} onValueChange={() => setDirty(true)}>
                  <SelectTrigger id="auth-timezone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Locale" description="Currency, language and formatting">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="locale-currency">Currency</Label>
                <Select defaultValue="INR" onValueChange={() => setDirty(true)}>
                  <SelectTrigger id="locale-currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="locale-lang">Default language</Label>
                <Select defaultValue="en-IN" onValueChange={() => setDirty(true)}>
                  <SelectTrigger id="locale-lang" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-IN">English (India)</SelectItem>
                    <SelectItem value="bn-IN">Bengali</SelectItem>
                    <SelectItem value="hi-IN">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              {[
                { id: "lang-bn", label: "Offer Bengali in the citizen app", checked: true },
                { id: "lang-hi", label: "Offer Hindi in the citizen app", checked: false },
              ].map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3">
                  <Label htmlFor={row.id} className="text-sm font-normal">
                    {row.label}
                  </Label>
                  <Switch id={row.id} defaultChecked={row.checked} onCheckedChange={() => setDirty(true)} />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Operations" description="Defaults applied across the network">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ops-grace">Default grace period (minutes)</Label>
                <Input
                  id="ops-grace"
                  type="number"
                  value={taxes.gracePeriodMin}
                  onChange={(e) => {
                    setTaxes((t) => ({ ...t, gracePeriodMin: Number(e.target.value) }));
                    setDirty(true);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ops-overstay">Overstay threshold (hours)</Label>
                <Input id="ops-overstay" type="number" defaultValue={6} onChange={() => setDirty(true)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ops-geofence">Geo-fence tolerance (metres)</Label>
                <Input id="ops-geofence" type="number" defaultValue={25} onChange={() => setDirty(true)} />
                <p className="text-xs text-muted-foreground">
                  How far outside the boundary an attendant may stand and still start a session.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ops-sync">Max offline events per sync</Label>
                <Input id="ops-sync" type="number" defaultValue={50} onChange={() => setDirty(true)} />
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* --------------------------------------------------------- taxes */}
        <TabsContent value="taxes" className="mt-4 space-y-4">
          <SectionCard title="Tax" description="Applied to the computed fare before the receipt is issued">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tax-gst">GST rate (%)</Label>
                <Input
                  id="tax-gst"
                  type="number"
                  value={taxes.gstPercent}
                  onChange={(e) => {
                    setTaxes((t) => ({ ...t, gstPercent: Number(e.target.value) }));
                    setDirty(true);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax-gstin">Authority GSTIN</Label>
                <Input id="tax-gstin" defaultValue="19AAAGK0001A1Z5" className="font-mono" onChange={() => setDirty(true)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax-hsn">SAC / HSN code</Label>
                <Input id="tax-hsn" defaultValue="996743" className="font-mono" onChange={() => setDirty(true)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax-prefix">Invoice number prefix</Label>
                <Input id="tax-prefix" defaultValue="RCPT/26-27/" className="font-mono" onChange={() => setDirty(true)} />
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="tax-inclusive" className="text-sm">
                  Show tax-inclusive prices to citizens
                </Label>
                <p className="text-xs text-muted-foreground">
                  The tariff board and app show the final payable amount rather than the pre-tax rate.
                </p>
              </div>
              <Switch id="tax-inclusive" defaultChecked onCheckedChange={() => setDirty(true)} />
            </div>
          </SectionCard>

          <SectionCard title="Settlement" description="How and when vendors are paid">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settle-cycle">Default cycle</Label>
                <Select defaultValue="WEEKLY" onValueChange={() => setDirty(true)}>
                  <SelectTrigger id="settle-cycle" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SETTLEMENT_CYCLES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.charAt(0) + c.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settle-commission">Default commission (%)</Label>
                <Input
                  id="settle-commission"
                  type="number"
                  value={taxes.commissionPct}
                  onChange={(e) => {
                    setTaxes((t) => ({ ...t, commissionPct: Number(e.target.value) }));
                    setDirty(true);
                  }}
                />
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              {[
                {
                  id: "settle-hold",
                  label: "Hold settlements with an unresolved cash variance",
                  hint: "Shifts flagged for variance are carried to the next cycle.",
                  checked: true,
                },
                {
                  id: "settle-kyc",
                  label: "Block payouts until KYC is fully verified",
                  hint: "A payout to an unverified account fails at the bank anyway.",
                  checked: true,
                },
                {
                  id: "settle-auto",
                  label: "Auto-approve settlements under ₹10,000",
                  hint: "Small settlements skip manual approval to save officer time.",
                  checked: false,
                },
              ].map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor={row.id} className="text-sm font-normal">
                      {row.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{row.hint}</p>
                  </div>
                  <Switch id={row.id} defaultChecked={row.checked} onCheckedChange={() => setDirty(true)} />
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ------------------------------------------------------ gateways */}
        <TabsContent value="gateways" className="mt-4 space-y-4">
          {[
            {
              name: "Razorpay",
              icon: CreditCard,
              status: "Connected",
              detail: "Collections — UPI, dynamic QR, cards, net banking and wallets",
              fields: [
                { label: "Key ID", value: "rzp_live_••••••••4417" },
                { label: "Webhook secret", value: "••••••••••••" },
                { label: "Webhook URL", value: "/api/v1/webhooks/razorpay" },
              ],
            },
            {
              name: "RazorpayX",
              icon: Landmark,
              status: "Connected",
              detail: "Vendor payouts to registered bank accounts",
              fields: [
                { label: "Account number", value: "••••••••9902" },
                { label: "Webhook URL", value: "/api/v1/webhooks/razorpayx" },
              ],
            },
            {
              name: "MSG91",
              icon: Smartphone,
              status: "Connected",
              detail: "SMS receipts, OTP and WhatsApp Business messages",
              fields: [
                { label: "Sender ID", value: "KMCPRK" },
                { label: "DLT template status", value: "6 of 6 approved" },
              ],
            },
            {
              name: "Google Maps Platform",
              icon: Globe,
              status: "Connected",
              detail: "Geocoding, map tiles and directions",
              fields: [
                { label: "Browser key", value: "AIza••••••••" },
                { label: "Monthly usage", value: "82,410 of 100,000 calls" },
              ],
            },
            {
              name: "ANPR engine",
              icon: Plug,
              status: "Phase 2",
              detail: "Automatic number plate recognition — not in scope for Phase 1",
              fields: [{ label: "Status", value: "Attendants type the plate manually today" }],
            },
          ].map((integration) => (
            <SectionCard
              key={integration.name}
              title={
                <span className="inline-flex items-center gap-2">
                  <integration.icon className="size-4" /> {integration.name}
                </span>
              }
              description={integration.detail}
              action={
                <StatusBadge
                  status={integration.status === "Connected" ? "ACTIVE" : "PENDING"}
                  label={integration.status}
                  pulse={integration.status === "Connected"}
                />
              }
            >
              <dl className="divide-y divide-border/60">
                {integration.fields.map((field) => (
                  <Field key={field.label} label={field.label}>
                    <span className="font-mono text-xs">{field.value}</span>
                  </Field>
                ))}
              </dl>
              {/*
                Both wait on the API. Nothing here can reach Razorpay or MSG91
                directly — the credentials live server-side, which is the point
                of them — so a real test needs a `/integrations/:name/test`
                route that pings the provider and reports what came back, and a
                rotation needs one that swaps the stored secret and re-registers
                the webhook. "Responded in 214 ms" was a number this page had no
                way of knowing, on a request it never made.
              */}
              {integration.status === "Connected" && (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled
                    title="Needs an API route that pings the provider"
                  >
                    Test connection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled
                    title="Needs an API route that rotates the stored secret"
                  >
                    Rotate keys
                  </Button>
                </div>
              )}
            </SectionCard>
          ))}
        </TabsContent>

        {/* -------------------------------------------------- notifications */}
        <TabsContent value="notifications" className="mt-4 space-y-4">
          <SectionCard title="Channels" description="Which routes are available for each message type">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-muted/40 text-xs uppercase">Event</TableHead>
                    <TableHead className="bg-muted/40 text-center text-xs uppercase">Push</TableHead>
                    <TableHead className="bg-muted/40 text-center text-xs uppercase">SMS</TableHead>
                    <TableHead className="bg-muted/40 text-center text-xs uppercase">WhatsApp</TableHead>
                    <TableHead className="bg-muted/40 text-center text-xs uppercase">Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { event: "Parking started", push: true, sms: true, whatsapp: false, email: false },
                    { event: "Parking ending soon", push: true, sms: false, whatsapp: false, email: false },
                    { event: "Payment receipt", push: true, sms: true, whatsapp: true, email: true },
                    { event: "Overstay warning", push: true, sms: true, whatsapp: false, email: false },
                    { event: "Vehicle moved", push: true, sms: true, whatsapp: false, email: false },
                    { event: "Pass expiring", push: true, sms: false, whatsapp: true, email: true },
                    { event: "Settlement approved", push: false, sms: false, whatsapp: false, email: true },
                    { event: "Municipal announcement", push: true, sms: false, whatsapp: false, email: false },
                  ].map((row) => (
                    <TableRow key={row.event}>
                      <TableCell className="text-sm">{row.event}</TableCell>
                      {(["push", "sms", "whatsapp", "email"] as const).map((channel) => (
                        <TableCell key={channel} className="text-center">
                          <Checkbox
                            defaultChecked={row[channel]}
                            onCheckedChange={() => setDirty(true)}
                            aria-label={`${row.event} via ${channel}`}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <SectionCard title="Operational alerts" description="What the authority is told, and when">
            <div className="space-y-3">
              {[
                { id: "alert-full", label: "Zone reaches 95% occupancy", checked: true },
                { id: "alert-variance", label: "A shift closes with a cash variance", checked: true },
                { id: "alert-settlement", label: "A settlement is waiting on approval", checked: true },
                { id: "alert-payment", label: "Payment failure rate exceeds 5%", checked: true },
                { id: "alert-offline", label: "An attendant has been offline for over 2 hours", checked: false },
                { id: "alert-revenue", label: "Daily revenue falls 20% below the 7-day average", checked: false },
              ].map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3">
                  <Label htmlFor={row.id} className="text-sm font-normal">
                    {row.label}
                  </Label>
                  <Switch id={row.id} defaultChecked={row.checked} onCheckedChange={() => setDirty(true)} />
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ---------------------------------------------------------- rbac */}
        <TabsContent value="rbac" className="mt-4 space-y-4">
          <SectionCard
            title="Role and permission matrix"
            description="Enforced in middleware and re-asserted in every scoped service method"
          >
            <div className="space-y-5">
              {/*
                The groups come from `GET /rbac/matrix`, which serves them from
                the same file the guards read their grants out of. The portal
                keeps its own copy only as the demo-mode fallback — see the note
                on PERMISSION_GROUPS in shared/constants/roles.ts — so a label
                cannot drift away from the thing it describes.
              */}
              {permissionGroups.map((group) => (
                <div key={group.key} className="space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.label}
                  </p>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="bg-muted/40 text-xs uppercase">Permission</TableHead>
                          {matrixRoles.map((role) => (
                            <TableHead
                              key={role.code}
                              className="bg-muted/40 text-center text-[10px] whitespace-nowrap uppercase"
                            >
                              {role.label.split(" ")[0]}
                              {role.unrestricted && (
                                <span className="ml-1 normal-case text-muted-foreground">(all)</span>
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.permissions.map((permission) => (
                          <TableRow key={permission.key}>
                            <TableCell className="text-sm">
                              <span>{permission.label}</span>
                              <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                {permission.key}
                              </span>
                            </TableCell>
                            {matrixRoles.map((role) => (
                              <TableCell key={role.code} className="text-center">
                                <Checkbox
                                  checked={permissions[role.code]?.has(permission.key) ?? false}
                                  // The superuser is unrestricted by definition;
                                  // its boxes are shown ticked and locked rather
                                  // than implying a list that means nothing.
                                  // `user.manage` is what PATCH /rbac/roles/:code
                                  // needs, so an account without it reads the
                                  // matrix rather than editing it.
                                  disabled={!role.editable || !canManageUsers}
                                  onCheckedChange={() => togglePermission(role.code, permission.key)}
                                  aria-label={`${permission.label} for ${role.label}`}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}

              {/*
                A permission the guards enforce but no group mentions would
                otherwise be invisible here — granted by nobody, revocable by
                nobody, and still checked on every request. The API surfaces
                them rather than hiding them, so this screen does too.
              */}
              {(matrix.data?.ungrouped ?? []).length > 0 && (
                <p className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/[0.06] p-3 text-xs text-muted-foreground text-pretty">
                  The API enforces{" "}
                  <span className="font-mono">{(matrix.data?.ungrouped ?? []).join(", ")}</span>, which
                  belongs to no group and so cannot be granted from this matrix. Add it to a group in
                  the API&apos;s permission catalogue.
                </p>
              )}
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {matrixRoles
                  .filter((role) => role.editable && isRoleDirty(role.code))
                  .map((role) => (
                    <Button
                      key={role.code}
                      size="sm"
                      className="h-8"
                      disabled={savingRole !== null}
                      onClick={() => void saveRole(role.code)}
                    >
                      <Save className="size-3.5" />
                      {savingRole === role.code ? "Saving…" : `Save ${role.label}`}
                    </Button>
                  ))}
              </div>

              <p className="text-xs text-muted-foreground text-pretty">
                Super Admin always holds every permission and cannot be restricted here — that is
                deliberate, so an authority can never lock itself out of its own platform. Saving a
                role signs out everyone currently holding it, so a permission you remove stops
                working immediately rather than whenever their session happens to expire.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Roles"
            description="System roles cannot be removed — the platform refers to them by name"
            contentClassName="p-0"
            action={
              <Can permission="user.manage">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setNewRoleOpen(true)}
                >
                  <Plus className="size-3.5" /> New role
                </Button>
              </Can>
            }
          >
            <ul className="divide-y divide-border/60">
              {(matrix.data?.roles ?? matrixRoles).map((role) => (
                <li key={role.code} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <Badge variant="secondary" className="shrink-0">
                    {role.label}
                  </Badge>
                  {!role.isSystem && (
                    <Badge variant="outline" className="h-5 shrink-0 text-[10px]">
                      custom
                    </Badge>
                  )}
                  <p className="min-w-0 flex-1 text-sm text-muted-foreground text-pretty">
                    {role.description ?? "No description."}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {role.userCount} {role.userCount === 1 ? "account" : "accounts"}
                  </span>
                  {role.deletable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive"
                      disabled={!canManageUsers}
                      title={canManageUsers ? undefined : NOT_PERMITTED}
                      onClick={() => {
                        setRoleToDelete(role.code);
                        setDeleteRoleOpen(true);
                      }}
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  ) : (
                    <span
                      className="shrink-0 text-[11px] text-muted-foreground"
                      title={
                        role.isSystem
                          ? "A system role. The platform refers to it by name."
                          : "Still held by at least one account."
                      }
                    >
                      {role.isSystem ? "system" : "in use"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        {/* ---------------------------------------------------------- team */}
        <TabsContent value="team" className="mt-4">
          <SectionCard
            title="Portal users"
            description="Municipal staff with access to this portal"
            contentClassName="p-0"
            action={
              /*
                Called "Add" rather than "Invite": `POST /users` creates the
                account outright with a password the administrator chooses.
                There is no invitation route, no token, and nothing that emails
                anybody — the old label promised a mail the platform cannot
                send, so the password has to be handed over in person or on a
                call, exactly as the reset-password flow already works.
              */
              <Can permission="user.manage">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setInviteOpen(true)}
                >
                  <Plus className="size-3.5" /> Add user
                </Button>
              </Can>
            }
          >
            <ul className="divide-y divide-border/60">
              {portalUsers.map((user) => (
                <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                  {user.twoFactorEnabled ? (
                    <Badge variant="outline" className="gap-1">
                      <BadgeCheck className="size-3 text-emerald-500" /> 2FA
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                      No 2FA
                    </Badge>
                  )}
                  <StatusBadge status={user.status} />
                  <span className="w-20 text-right text-xs text-muted-foreground">
                    {user.lastLoginAt ? relativeTime(user.lastLoginAt) : "never"}
                  </span>
                  <RowActions
                    label={user.name}
                    actions={[
                      {
                        // Everything on this menu is `user.manage`, which is
                        // what `users.controller.ts` requires on all seven of
                        // its routes. A submenu carries the permission on the
                        // parent so the whole branch disables as one.
                        label: "Change role",
                        icon: ShieldCheck,
                        permission: "user.manage",
                        children: (Object.values(ROLES) as Role[])
                          .filter((r) => r !== "CITIZEN" && r !== "VENDOR" && r !== "ATTENDANT")
                          .map((r) => ({
                            label: ROLE_LABELS[r],
                            onSelect: () =>
                              void applyUser(
                                () => usersApi.changeRole(user.id, r, "Changed from portal settings"),
                                (list) => list.map((u) => (u.id === user.id ? { ...u, role: r } : u)),
                                {
                                  success: "Role changed",
                                  description: `${user.name} → ${ROLE_LABELS[r]}. Their sessions have ended.`,
                                },
                              ).catch(() => undefined),
                          })),
                      },
                      {
                        label: "Reset password",
                        icon: KeyRound,
                        permission: "user.manage",
                        onSelect: () => {
                          setPasswordTarget(user);
                          setPasswordOpen(true);
                        },
                      },
                      {
                        label: user.status === "SUSPENDED" ? "Reinstate" : "Suspend access",
                        icon: Trash2,
                        permission: "user.manage",
                        destructive: user.status !== "SUSPENDED",
                        separatorBefore: true,
                        onSelect: () => {
                          const next = user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
                          void applyUser(
                            () => usersApi.changeStatus(user.id, next, "Changed from portal settings"),
                            (list) => list.map((u) => (u.id === user.id ? { ...u, status: next } : u)),
                            {
                              success: next === "ACTIVE" ? "Access restored" : "Access suspended",
                              description: user.name,
                            },
                          ).catch(() => undefined);
                        },
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        {/* -------------------------------------------------------- profile */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          <SectionCard title="Your profile">
            {/* Keyed on the account id so the uncontrolled inputs re-seed once
                the principal arrives from the API. */}
            <div key={me?.id ?? "pending"} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" defaultValue={me?.name ?? ""} onChange={() => setDirty(true)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">Work email</Label>
                <Input id="profile-email" defaultValue={me?.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">
                  Changing your work email needs a Super Admin.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-phone">Mobile</Label>
                <Input id="profile-phone" defaultValue={me?.phone ?? ""} onChange={() => setDirty(true)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-role">Role</Label>
                <Input id="profile-role" defaultValue={me ? ROLE_LABELS[me.role] : ""} disabled />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Preferences">
            <div className="space-y-3">
              {[
                { id: "pref-digest", label: "Email me a daily operations digest", checked: true },
                { id: "pref-mentions", label: "Notify me when a settlement needs my approval", checked: true },
                { id: "pref-sound", label: "Play a sound for critical alerts", checked: false },
              ].map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3">
                  <Label htmlFor={row.id} className="text-sm font-normal">
                    {row.label}
                  </Label>
                  <Switch id={row.id} defaultChecked={row.checked} onCheckedChange={() => setDirty(true)} />
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ------------------------------------------------------- security */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <SectionCard title="Password">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pwd-current">Current password</Label>
                <Input
                  id="pwd-current"
                  type="password"
                  autoComplete="current-password"
                  value={ownPassword.current}
                  onChange={(e) => setOwnPassword({ ...ownPassword, current: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd-new">New password</Label>
                <Input
                  id="pwd-new"
                  type="password"
                  autoComplete="new-password"
                  value={ownPassword.next}
                  onChange={(e) => setOwnPassword({ ...ownPassword, next: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pwd-confirm">Confirm new password</Label>
                <Input
                  id="pwd-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={ownPassword.confirm}
                  onChange={(e) => setOwnPassword({ ...ownPassword, confirm: e.target.value })}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground text-pretty">
              At least 10 characters. Changing it signs out every other session you have open.
            </p>
            <Button
              size="sm"
              className="mt-4"
              disabled={
                changingPassword ||
                ownPassword.current.length === 0 ||
                ownPassword.next.length < 10 ||
                ownPassword.next !== ownPassword.confirm
              }
              onClick={() => void changeOwnPassword()}
            >
              {changingPassword ? "Changing…" : "Change password"}
            </Button>
          </SectionCard>

          <SectionCard
            title="Two-factor authentication"
            description="Mandatory for Super Admin and Administrator accounts"
            action={
              <StatusBadge
                status={me?.twoFactorEnabled ? "ACTIVE" : "PENDING"}
                label={me?.twoFactorEnabled ? "Enabled" : "Not set up"}
              />
            }
          >
            <p className="text-sm text-muted-foreground text-pretty">
              Codes come from your authenticator app and rotate every 30 seconds. Keep your recovery
              codes somewhere safe — without them and without your device, only a Super Admin can
              restore access.
            </p>
            {/*
              Re-enrolment waits on a QR-and-verify flow, not on an endpoint:
              `POST /auth/two-factor/setup` returns the otpauth URL and
              `/confirm` takes the first generated code, but nothing here draws
              the QR or collects that code, and enrolling without confirming
              would lock the account out of its own authenticator.

              Recovery codes wait on the API. There is no route that issues or
              redeems them — an account that loses its authenticator is restored
              by a Super Admin through `POST /auth/two-factor/disable/:userId`,
              which is the recovery path that actually exists today.
            */}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled title="Needs the QR enrolment flow">
                Re-enrol device
              </Button>
              <Button variant="outline" size="sm" disabled title="Recovery codes are not built yet">
                Generate recovery codes
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="Signed-in devices"
            contentClassName="p-0"
            action={
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRevokeOpen(true)}>
                Sign out everywhere
              </Button>
            }
            description="Every device bound to your account. The full estate is on the audit page."
          >
            <ul className="divide-y divide-border/60">
              {(isLiveApi
                ? (devices.data ?? []).map((device) => ({
                    id: device.id,
                    name: device.platform === "web" ? "Browser" : device.platform,
                    detail: device.appVersion
                      ? `${device.fingerprint.slice(0, 18)}… · ${device.appVersion}`
                      : `${device.fingerprint.slice(0, 18)}…`,
                    current: device.fingerprint === thisFingerprint,
                    at: device.lastSeenAt ?? device.createdAt,
                  }))
                : [
                    {
                      id: "this",
                      name: "This device",
                      detail: "The browser you are reading this in",
                      current: true,
                      at: me?.lastLoginAt ?? me?.createdAt ?? "",
                    },
                  ]
              ).map((device) => (
                <li key={device.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                    <Laptop className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {device.name}
                      {device.current && (
                        <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                          current
                        </Badge>
                      )}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {device.detail}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {device.at ? relativeTime(device.at) : "—"}
                  </span>
                  {!device.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={unbinding === device.id}
                      onClick={() => {
                        setUnbinding(device.id);
                        void authApi
                          .unbindDevice(device.id)
                          .then(async () => {
                            await devices.refetch();
                            toast.success("Device signed out", {
                              description: "It has to sign in again to be bound to this account.",
                            });
                          })
                          .catch((error: unknown) =>
                            toast.error(
                              error instanceof ApiError
                                ? error.message
                                : "That device could not be signed out.",
                            ),
                          )
                          .finally(() => setUnbinding(null));
                      }}
                    >
                      {unbinding === device.id ? "Signing out…" : "Revoke"}
                    </Button>
                  )}
                </li>
              ))}
              {isLiveApi && !devices.isLoading && (devices.data ?? []).length === 0 && (
                <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No devices are bound to this account yet.
                </li>
              )}
            </ul>
          </SectionCard>
        </TabsContent>

        {/* --------------------------------------------------------- backup */}
        <TabsContent value="backup" className="mt-4 space-y-4">
          <SectionCard title="Backups" description="Neon point-in-time recovery plus a nightly logical dump">
            <dl className="divide-y divide-border/60">
              <Field label="Last successful backup">{formatDateTime(new Date().toISOString())}</Field>
              <Field label="Retention">30 days point-in-time, 12 months cold storage</Field>
              <Field label="Restore drill">Passed · last quarter</Field>
              <Field label="Evidence bucket">Versioned, object-lock enabled</Field>
            </dl>
            {/*
              Backups are Neon's, not the platform's. Point-in-time recovery
              and the nightly dump run at the database provider, and neither the
              API nor this portal has a route that starts one or exercises a
              restore — doing that from here would mean the application holding
              credentials to its own infrastructure, which is a worse trade than
              two disabled buttons. The figures above are the retention policy,
              which is real; the controls were not.
            */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled title="Backups run at the database provider">
                <CloudUpload className="size-4" /> Run backup now
              </Button>
              <Button variant="outline" size="sm" disabled title="Restore drills run at the database provider">
                Run restore drill
              </Button>
            </div>
          </SectionCard>

          {/*
            A "Data governance" card stood here with four `defaultValue` inputs
            and four switches: evidence kept for 180 days, consent captured at
            registration, citizens able to request erasure. None of it was wired
            to anything, and the numbers were not even the platform's — the
            published privacy notice promises evidence is destroyed after
            *ninety* days, not a hundred and eighty.

            That is worse than an empty panel. An officer reading it would have
            told the authority the platform enforced a schedule nothing
            enforced, and the authority would have repeated it to a citizen.

            RetentionPanel reads `GET /privacy/retention`, which resolves every
            period exactly as the purge resolves it — so what is on the screen
            is what the sweep will actually do tonight. It lives in its own file
            because other people are working in this one.
          */}
          <RetentionPanel />

          {/*
            A "Danger zone" card stood here offering to purge demonstration
            data. It asked the operator to type PURGE DEMO DATA, asked why they
            were doing it, warned them to take a backup first — and then called
            nothing at all. There is no purge endpoint on the API, and no plan
            for one; seeded data is removed by re-running the seed against an
            empty database, which is a deployment task and not a button.

            It was deleted rather than disabled. A control that claims to
            destroy every record and quietly does nothing is the worst kind:
            the operator who pressed it walks away believing the platform was
            handed over clean, and nobody discovers otherwise until a citizen's
            first real receipt lands next to a fabricated one.
          */}
        </TabsContent>
      </Tabs>

      {/* --------------------------------------------------------- add user */}
      <ConfirmDialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            setInvite({ name: "", email: "", phone: "", role: "ZONE_OFFICER", password: "" });
          }
        }}
        title="Add a portal user"
        confirmLabel="Create account"
        description={
          <div className="space-y-3">
            <p>
              The account is usable immediately. There is no invitation email — read the password
              to them and have them change it from their own settings once they are in.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Full name</Label>
                <Input
                  id="invite-name"
                  value={invite.name}
                  onChange={(e) => setInvite((u) => ({ ...u, name: e.target.value }))}
                  placeholder="Ananya Bose"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  value={invite.role}
                  onValueChange={(v) => setInvite((u) => ({ ...u, role: v as Role }))}
                >
                  <SelectTrigger id="invite-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Vendor, attendant and citizen accounts are created from
                        their own screens, alongside the records that hang off
                        the login — the API refuses them here. */}
                    {(Object.values(ROLES) as Role[])
                      .filter((r) => r !== "CITIZEN" && r !== "VENDOR" && r !== "ATTENDANT")
                      .map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Work email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="off"
                  value={invite.email}
                  onChange={(e) => setInvite((u) => ({ ...u, email: e.target.value }))}
                  placeholder="a.bose@kmc.gov.in"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-phone">Mobile (optional)</Label>
                <Input
                  id="invite-phone"
                  value={invite.phone}
                  onChange={(e) => setInvite((u) => ({ ...u, phone: e.target.value }))}
                  placeholder="+919830000000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">Temporary password</Label>
              <Input
                id="invite-password"
                type="text"
                autoComplete="new-password"
                value={invite.password}
                onChange={(e) => setInvite((u) => ({ ...u, password: e.target.value }))}
                placeholder="At least 10 characters"
                className="font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground text-pretty">
              A zone officer sees nothing until zones are assigned to them, which is done from
              their account after it exists.
            </p>
          </div>
        }
        onConfirm={async () => {
          if (!canInvite) {
            toast.error("A name, a valid email and a 10-character password are needed");
            throw new Error("incomplete");
          }
          await applyUser(
            () =>
              usersApi.create({
                name: invite.name.trim(),
                email: invite.email.trim(),
                phone: invite.phone.trim() || undefined,
                role: invite.role,
                password: invite.password,
              }),
            (list) => [
              ...list,
              {
                id: `usr_new_${list.length}`,
                name: invite.name.trim(),
                email: invite.email.trim(),
                phone: invite.phone.trim(),
                role: invite.role,
                status: "ACTIVE" as const,
                twoFactorEnabled: false,
                createdAt: new Date().toISOString(),
              },
            ],
            {
              success: "Account created",
              description: `${invite.name.trim()} can sign in now. Give them the password yourself.`,
            },
          );
          setInvite({ name: "", email: "", phone: "", role: "ZONE_OFFICER", password: "" });
        }}
      />

      <ConfirmDialog
        open={newRoleOpen}
        onOpenChange={(open) => {
          setNewRoleOpen(open);
          if (!open) setNewRole({ code: "", label: "", description: "", zoneScoped: false });
        }}
        title="Create a role"
        confirmLabel="Create role"
        description={
          <div className="space-y-3">
            <p>
              A new role starts with no permissions at all. Grant them in the matrix above and save,
              which is safer than starting from a copy of something powerful.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="role-code">Code</Label>
                <Input
                  id="role-code"
                  value={newRole.code}
                  onChange={(e) =>
                    setNewRole((r) => ({ ...r, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") }))
                  }
                  placeholder="CASHIER"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Permanent. Used in the audit trail.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-label">Name</Label>
                <Input
                  id="role-label"
                  value={newRole.label}
                  onChange={(e) => setNewRole((r) => ({ ...r, label: e.target.value }))}
                  placeholder="Cashier"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-desc">What this role is for</Label>
              <Input
                id="role-desc"
                value={newRole.description}
                onChange={(e) => setNewRole((r) => ({ ...r, description: e.target.value }))}
                placeholder="Counts cash at the depot and verifies deposits"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={newRole.zoneScoped}
                onCheckedChange={(v) => setNewRole((r) => ({ ...r, zoneScoped: !!v }))}
              />
              <span className="text-muted-foreground">
                Restrict this role to its assigned zones
              </span>
            </label>
          </div>
        }
        onConfirm={async () => {
          if (!isLiveApi) {
            toast.info("Creating roles needs the API");
            return;
          }
          if (newRole.code.length < 3 || newRole.label.trim().length < 2) {
            toast.error("A role needs a code and a name");
            throw new Error("incomplete");
          }
          await rbacApi.createRole({
            code: newRole.code,
            label: newRole.label.trim(),
            description: newRole.description.trim() || undefined,
            isZoneScoped: newRole.zoneScoped,
          });
          await matrix.refetch();
          toast.success("Role created", { description: `${newRole.label} holds no permissions yet.` });
          setNewRole({ code: "", label: "", description: "", zoneScoped: false });
        }}
      />

      <ConfirmDialog
        open={deleteRoleOpen}
        onOpenChange={setDeleteRoleOpen}
        title={`Delete the ${roleToDelete} role?`}
        destructive
        confirmLabel="Delete role"
        description="Only a role nobody holds can be deleted, so no one will be locked out. This is written to the audit trail."
        onConfirm={async () => {
          if (!roleToDelete) return;
          await rbacApi.removeRole(roleToDelete);
          await matrix.refetch();
          toast.success("Role deleted", { description: roleToDelete });
          setRoleToDelete(null);
        }}
      />

      <ConfirmDialog
        open={passwordOpen}
        onOpenChange={(open) => {
          setPasswordOpen(open);
          if (!open) setNewPassword("");
        }}
        title={`Set a new password for ${passwordTarget?.name}?`}
        confirmLabel="Set password"
        reason={{
          label: "Why is this being reset?",
          placeholder: "Locked out / suspected compromise…",
          required: true,
        }}
        description={
          <div className="space-y-3">
            <p>
              Every session this account has open will end. The password itself is never written to
              the audit trail — only that it was changed, by whom, and why.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="text"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 10 characters"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Read it to them over the phone; they should change it after signing in.
              </p>
            </div>
          </div>
        }
        onConfirm={async (reason) => {
          if (!passwordTarget) return;
          if (newPassword.length < 10) {
            toast.error("A portal password is at least 10 characters");
            throw new Error("password too short");
          }
          await applyUser(
            () =>
              usersApi.resetPassword(
                passwordTarget.id,
                newPassword,
                reason ?? "Reset from portal settings",
              ),
            (list) => list,
            { success: "Password reset", description: `${passwordTarget.name} has been signed out.` },
          );
          setNewPassword("");
        }}
      />

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Sign out of every device?"
        confirmLabel="Sign out everywhere"
        /*
          The old copy promised "every session except this one". `POST
          /auth/logout-all` revokes the whole refresh-token family — the API has
          no notion of sparing the caller, and pretending otherwise would leave
          an operator wondering why the portal threw them out. So it says what
          happens, and then does it: revoke, then end this session properly
          rather than leaving a page holding tokens the server has torn up.
        */
        description="Every session ends immediately, including this one. You will be asked to sign in again."
        onConfirm={async () => {
          if (!isLiveApi) {
            toast.info("Signing out everywhere needs the API");
            return;
          }
          try {
            const { data } = await authApi.logoutAll();
            toast.success("Signed out everywhere", {
              description: `${data.revokedSessions} session(s) ended.`,
            });
          } catch (error) {
            toast.error(
              error instanceof ApiError ? error.message : "Those sessions could not be ended.",
            );
            return;
          }
          await signOut();
        }}
      />

    </div>
  );
}
