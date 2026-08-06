"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/frontend/components/ui/skeleton";

/**
 * Client-only entry points for the Leaflet map.
 *
 * Leaflet reads `window` while its module is still being evaluated, so it can
 * never run during server rendering. Everything imports the map through here,
 * where `ssr: false` keeps it off the server and a skeleton holds the layout
 * until the tiles arrive.
 */

const loading = (height: number | string) => (
  <Skeleton className="w-full rounded-xl" style={{ height }} />
);

export const ZoneMap = dynamic(
  () => import("./leaflet-map").then((m) => m.ZoneMap),
  { ssr: false, loading: () => loading(380) },
);

export const LocationPicker = dynamic(
  () => import("./leaflet-map").then((m) => m.LocationPicker),
  { ssr: false, loading: () => loading(300) },
);

export type { MapZone } from "./leaflet-map";
export { DEFAULT_CENTER } from "./constants";
