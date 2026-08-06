"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Columns3,
  Download,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Badge } from "@/frontend/components/ui/badge";
import { Checkbox } from "@/frontend/components/ui/checkbox";
import { Separator } from "@/frontend/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/frontend/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";
import { EmptyState } from "./empty-state";
import { Skeleton } from "@/frontend/components/ui/skeleton";
import { PAGE_SIZES, DEFAULT_PAGE_SIZE } from "@/config/app.config";

export type FacetFilter = {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
};

export type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Column ids searched by the toolbar search box. */
  searchKeys?: (keyof T & string)[];
  searchPlaceholder?: string;
  facets?: FacetFilter[];
  /** Rendered to the right of the toolbar — page-level primary actions. */
  toolbarActions?: React.ReactNode;
  /** Rendered when rows are selected. Receives the selected rows. */
  bulkActions?: (rows: T[], clear: () => void) => React.ReactNode;
  onRowClick?: (row: T) => void;
  enableSelection?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  /** Shows placeholder rows instead of an empty state while the first load runs. */
  isLoading?: boolean;
  onExport?: (rows: T[]) => void;
  initialPageSize?: number;
  stickyHeader?: boolean;
  className?: string;
};

export function DataTable<T extends object>({
  data,
  columns,
  searchKeys,
  searchPlaceholder = "Search…",
  facets = [],
  toolbarActions,
  bulkActions,
  onRowClick,
  enableSelection = false,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Once there is data it will show up in this table.",
  emptyAction,
  isLoading = false,
  onExport,
  initialPageSize = DEFAULT_PAGE_SIZE,
  stickyHeader = true,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable");

  const allColumns = React.useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!enableSelection) return columns;
    const selectColumn: ColumnDef<T, unknown> = {
      id: "__select",
      size: 36,
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all rows on this page"
          className="translate-y-[1px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
          className="translate-y-[1px]"
        />
      ),
    };
    return [selectColumn, ...columns];
  }, [columns, enableSelection]);

  const globalFilterFn = React.useCallback(
    (row: { original: T }, _id: string, value: string) => {
      if (!value) return true;
      const needle = value.toLowerCase();
      const keys = searchKeys ?? (Object.keys(row.original) as (keyof T & string)[]);
      return keys.some((k) => {
        const cell = row.original[k];
        return cell != null && String(cell).toLowerCase().includes(needle);
      });
    },
    [searchKeys],
  );

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, columnFilters, columnVisibility, rowSelection, globalFilter },
    initialState: { pagination: { pageSize: initialPageSize } },
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalFilterFn as never,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const filteredRows = table.getFilteredRowModel().rows.map((r) => r.original);
  const isFiltered = columnFilters.length > 0 || globalFilter.length > 0;
  const clearSelection = () => setRowSelection({});

  return (
    <div className={cn("space-y-3", className)}>
      {/* ---------------------------------------------------------- toolbar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {searchKeys && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 pl-8"
              />
              {globalFilter && (
                <button
                  type="button"
                  onClick={() => setGlobalFilter("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {facets.map((facet) => (
            <FacetSelect
              key={facet.columnId}
              facet={facet}
              value={(table.getColumn(facet.columnId)?.getFilterValue() as string) ?? "__all"}
              onChange={(v) =>
                table.getColumn(facet.columnId)?.setFilterValue(v === "__all" ? undefined : v)
              }
            />
          ))}

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2"
              onClick={() => {
                setColumnFilters([]);
                setGlobalFilter("");
              }}
            >
              Reset <X className="ml-1 size-3.5" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onExport && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => onExport(filteredRows)}>
              <Download className="size-4" /> Export
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <SlidersHorizontal className="size-4" />
                <span className="sr-only sm:not-sr-only">View</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Row density</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={density === "comfortable"}
                onCheckedChange={() => setDensity("comfortable")}
              >
                Comfortable
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={density === "compact"}
                onCheckedChange={() => setDensity("compact")}
              >
                Compact
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <Columns3 className="size-3.5" /> Columns
              </DropdownMenuLabel>
              <div className="max-h-64 overflow-y-auto">
                {table
                  .getAllColumns()
                  .filter((c) => c.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(v) => column.toggleVisibility(!!v)}
                      className="capitalize"
                    >
                      {String(column.columnDef.meta ?? column.id).replace(/_/g, " ")}
                    </DropdownMenuCheckboxItem>
                  ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {toolbarActions}
        </div>
      </div>

      {/* --------------------------------------------------- bulk action bar */}
      {enableSelection && selectedRows.length > 0 && bulkActions && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <Badge variant="secondary" className="font-medium">
            {selectedRows.length} selected
          </Badge>
          <Separator orientation="vertical" className="h-4" />
          {bulkActions(selectedRows, clearSelection)}
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------------ table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className={cn(stickyHeader && "sticky top-0 z-10 bg-card")}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                        className="h-10 bg-muted/40 text-xs font-semibold tracking-wide whitespace-nowrap uppercase"
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {isLoading && table.getRowModel().rows.length === 0 ? (
                // Placeholder rows, not an empty state: "no zones" and "not
                // loaded yet" mean different things and must not look alike.
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                    {allColumns.map((column, c) => (
                      <TableCell key={`${column.id ?? c}`} className="py-3">
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={allColumns.length} className="h-64 p-0">
                    <EmptyState
                      icon={isFiltered ? Filter : undefined}
                      title={isFiltered ? "No matches" : emptyTitle}
                      description={
                        isFiltered
                          ? "No rows match the current search and filters."
                          : emptyDescription
                      }
                      action={
                        isFiltered ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setColumnFilters([]);
                              setGlobalFilter("");
                            }}
                          >
                            Clear filters
                          </Button>
                        ) : (
                          emptyAction
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(
                      "border-border/60 transition-colors",
                      onRowClick && "cursor-pointer",
                      density === "compact" ? "[&>td]:py-1.5" : "[&>td]:py-2.5",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="align-middle text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ------------------------------------------------------- pagination */}
      <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {enableSelection && selectedRows.length > 0 ? (
            <>
              <span className="font-medium text-foreground">{selectedRows.length}</span> of{" "}
              {filteredRows.length} row{filteredRows.length === 1 ? "" : "s"} selected
            </>
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-foreground">
                {table.getRowModel().rows.length}
              </span>{" "}
              of <span className="font-medium text-foreground">{filteredRows.length}</span>
              {filteredRows.length !== data.length && ` (filtered from ${data.length})`}
            </>
          )}
        </p>

        <div className="flex items-center gap-2">
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger size="sm" className="h-8 w-[104px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="px-1 text-xs whitespace-nowrap text-muted-foreground tabular">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacetSelect({
  facet,
  value,
  onChange,
}: {
  facet: FacetFilter;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="h-9 w-auto min-w-[9rem] gap-1.5">
        <Filter className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder={facet.label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">All {facet.label.toLowerCase()}</SelectItem>
        {facet.options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
