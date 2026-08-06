"use client";

import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { cn } from "@/lib/utils";
import { DEFAULT_CENTER } from "./constants";
import type { LatLng } from "@/shared/types/common.types";

/**
 * Leaflet with OpenStreetMap tiles. No API key, no per-view billing, and the
 * authority's zone boundaries stay on their own servers rather than being sent
 * to a commercial geocoder.
 *
 * Leaflet touches `window` at import time, so nothing here may be rendered on
 * the server — reach for these through `../map`, which loads them client-side.
 */

const TILES = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

export interface MapZone {
  id: string;
  code: string;
  name: string;
  center: LatLng;
  capacity?: number;
  occupied?: number;
  occupancyPct?: number;
  status?: string;
  boundary?: [number, number][] | null;
}

/**
 * Built from markup rather than an image so it inherits the theme and survives
 * bundling — Leaflet's default icon resolves its own asset URLs, which breaks
 * under every bundler that fingerprints filenames.
 */
function pinIcon(label: string, tone: "ok" | "busy" | "full" | "closed") {
  const fill = {
    ok: "#16a34a",
    busy: "#d97706",
    full: "#dc2626",
    closed: "#64748b",
  }[tone];

  return L.divIcon({
    className: "kmcp-pin",
    html: `
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:28px;height:28px;border-radius:9999px;
        background:${fill};color:#fff;
        border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);
        font:600 10px/1 ui-sans-serif,system-ui,sans-serif;
      ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function toneFor(zone: MapZone): "ok" | "busy" | "full" | "closed" {
  if (zone.status && zone.status !== "OPEN") return "closed";
  const pct =
    zone.occupancyPct ??
    (zone.capacity && zone.occupied !== undefined
      ? Math.round((zone.occupied / zone.capacity) * 100)
      : 0);
  if (pct >= 95) return "full";
  if (pct >= 70) return "busy";
  return "ok";
}

/** Keeps every marker in view without zooming absurdly far in on a single one. */
function FitToMarkers({ points }: { points: LatLng[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16);
      return;
    }
    map.fitBounds(
      L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])),
      { padding: [40, 40], maxZoom: 16 },
    );
  }, [map, points]);
  return null;
}

export function ZoneMap({
  zones,
  height = 380,
  className,
  onSelect,
}: {
  zones: MapZone[];
  height?: number | string;
  className?: string;
  onSelect?: (zone: MapZone) => void;
}) {
  const points = React.useMemo(() => zones.map((z) => z.center), [zones]);

  return (
    <div className={cn("overflow-hidden rounded-xl border", className)} style={{ height }}>
      <MapContainer
        center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILES.url} attribution={TILES.attribution} />
        <FitToMarkers points={points} />

        {zones.map((zone) => (
          <React.Fragment key={zone.id}>
            {zone.boundary && zone.boundary.length >= 3 && (
              <Polygon
                positions={zone.boundary}
                pathOptions={{ color: "#2563eb", weight: 2, fillOpacity: 0.08 }}
              />
            )}
            <Marker
              position={[zone.center.lat, zone.center.lng]}
              icon={pinIcon(String(zone.occupied ?? ""), toneFor(zone))}
              eventHandlers={onSelect ? { click: () => onSelect(zone) } : undefined}
            >
              <Popup>
                <div className="space-y-0.5">
                  <p className="font-medium">{zone.name}</p>
                  <p className="font-mono text-[11px] opacity-70">{zone.code}</p>
                  {zone.capacity !== undefined && (
                    <p className="text-xs">
                      {zone.occupied ?? 0} of {zone.capacity} occupied
                    </p>
                  )}
                  {zone.status && zone.status !== "OPEN" && (
                    <p className="text-xs font-medium text-red-600">{zone.status}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
}

function ClickToPlace({ onChange }: { onChange: (point: LatLng) => void }) {
  useMapEvents({
    click: (event) => onChange({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });
  return null;
}

/**
 * Point-and-drag location picker for the zone form. The kerb is a place on a
 * street, and typing coordinates by hand is how a zone ends up in the river.
 */
export function LocationPicker({
  value,
  onChange,
  height = 300,
  className,
}: {
  value?: LatLng | null;
  onChange: (point: LatLng) => void;
  height?: number | string;
  className?: string;
}) {
  const point = value ?? DEFAULT_CENTER;

  return (
    <div className={cn("overflow-hidden rounded-xl border", className)} style={{ height }}>
      <MapContainer
        center={[point.lat, point.lng]}
        zoom={value ? 17 : 13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILES.url} attribution={TILES.attribution} />
        <ClickToPlace onChange={onChange} />
        <Marker
          position={[point.lat, point.lng]}
          icon={pinIcon("", "ok")}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = event.target.getLatLng();
              onChange({ lat, lng });
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
