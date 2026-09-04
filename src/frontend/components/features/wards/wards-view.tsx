"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { LandPlot, Map, Pencil, Plus, Route, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { PageHeader } from "@/frontend/components/shared/page-header";
import { StatCard } from "@/frontend/components/shared/stat-card";
import { DataTable } from "@/frontend/components/shared/data-table";
import { RowActions } from "@/frontend/components/shared/row-actions";
import { ConfirmDialog } from "@/frontend/components/shared/confirm-dialog";
import { Can } from "@/frontend/components/shared/can";
import { FadeStagger, FadeStaggerItem } from "@/frontend/components/reactbits";
import { WardFormSheet } from "./ward-form-sheet";
import { WARDS } from "@/frontend/lib/mock";
import { geographyApi, listAll } from "@/frontend/api";
import { useResource } from "@/frontend/hooks/use-api";
import { toWard } from "@/frontend/lib/adapters";
import { isLiveApi } from "@/config/env";
import type { Ward } from "@/shared/types/domain.types";

export function WardsView() {
  const {
    items: wards,
    isLoading,
    isRefreshing,
    emptyReason,
    apply,
    refresh,
  } = useResource<Ward>(
    ["wards", "list"],
    () => listAll((page, pageSize) => geographyApi.wards({ page, pageSize })).then((r) => r.map(toWard)),
    WARDS,
  );

  const [formOpen, setFormOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Ward | null>(null);

  const openCreate = () => {
    setSelected(null);
    setFormOpen(true);
  };
  const openEdit = (ward: Ward) => {
    setSelected(ward);
    setFormOpen(true);
  };
  const openDelete = (ward: Ward) => {
    setSelected(ward);
    setDeleteOpen(true);
  };

  const columns = React.useMemo<ColumnDef<Ward, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Ward",
        meta: "Ward",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "zoneCount",
        header: "Zones",
        meta: "Zones",
        cell: ({ row }) => (
          <span className="text-sm tabular text-muted-foreground">{row.original.zoneCount}</span>
        ),
      },
      {
        accessorKey: "streetCount",
        header: "Streets",
        meta: "Streets",
        cell: ({ row }) => (
          <span className="text-sm tabular text-muted-foreground">
            {row.original.streetCount ?? "—"}
          </span>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const ward = row.original;
          return (
            <div className="flex justify-end">
              <RowActions
                label={ward.code}
                actions={[
                  {
                    label: "Edit ward",
                    icon: Pencil,
                    permission: "zone.write",
                    onSelect: () => openEdit(ward),
                  },
                  {
                    label: "Delete ward",
                    icon: Trash2,
                    permission: "zone.write",
                    destructive: true,
                    separatorBefore: true,
                    onSelect: () => openDelete(ward),
                  },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [],
  );

  const totalZones = wards.reduce((sum, w) => sum + w.zoneCount, 0);
  const totalStreets = wards.reduce((sum, w) => sum + (w.streetCount ?? 0), 0);
  const emptyWards = wards.filter((w) => w.zoneCount === 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wards / divisions"
        description="The civic divisions a zone's street belongs to. A zone's ward decides which attendant can start a session there, so it has to exist before the zone does."
        actions={
          <Can permission="zone.write">
            <Button size="sm" className="h-9" onClick={openCreate}>
              <Plus className="size-4" /> New ward
            </Button>
          </Can>
        }
      />

      <FadeStagger className="grid gap-3 sm:grid-cols-3">
        <FadeStaggerItem>
          <StatCard label="Wards configured" numeric={wards.length} icon={Map} />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Zones covered"
            numeric={totalZones}
            icon={LandPlot}
            accent="info"
            hint="Across all wards"
          />
        </FadeStaggerItem>
        <FadeStaggerItem>
          <StatCard
            label="Streets mapped"
            numeric={totalStreets}
            icon={Route}
            accent={emptyWards > 0 ? "warning" : "primary"}
            hint={emptyWards > 0 ? `${emptyWards} wards have no zones yet` : "Every ward has a zone"}
          />
        </FadeStaggerItem>
      </FadeStagger>

      <DataTable
        data={wards}
        columns={columns}
        searchKeys={["code", "name"]}
        searchPlaceholder="Search by ward code or name…"
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
        isLoading={isLoading}
        emptyTitle={emptyReason ? "Nothing to show" : "No wards yet"}
        emptyDescription={
          emptyReason ?? "Add a ward before creating a zone — a zone's street has to belong to one."
        }
        emptyAction={
          <Can permission="zone.write">
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> New ward
            </Button>
          </Can>
        }
      />

      <WardFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        ward={selected}
        onSaved={(draft) =>
          apply(
            () =>
              selected
                ? geographyApi.updateWard(selected.id, draft)
                : geographyApi.createWard(draft),
            (list) =>
              selected
                ? list.map((w) => (w.id === selected.id ? { ...w, ...draft } : w))
                : [{ id: `wd_new_${list.length + 1}`, zoneCount: 0, ...draft }, ...list],
            { success: selected ? "Ward updated" : "Ward added", description: draft.name },
          )
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selected?.name}?`}
        destructive
        confirmLabel="Delete ward"
        description={
          <div className="space-y-2">
            <p>
              Deleting removes the ward from every ward picker, including the zone form. Zones and
              streets already assigned to it are not moved automatically.
            </p>
            {selected && selected.zoneCount > 0 && (
              <p className="font-medium text-destructive">
                {selected.zoneCount} zones are currently assigned to this ward. The API refuses to
                delete a ward that still has zones — reassign them first.
              </p>
            )}
          </div>
        }
        onConfirm={async () => {
          if (!selected) return;
          await apply(
            () => geographyApi.removeWard(selected.id),
            (list) => list.filter((w) => w.id !== selected.id),
            { success: "Ward deleted", description: selected.name },
          );
        }}
      />
    </div>
  );
}
