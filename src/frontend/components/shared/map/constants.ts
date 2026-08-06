import type { LatLng } from "@/shared/types/common.types";

/**
 * Deliberately free of any Leaflet import. Anything re-exported from the map's
 * client entry point would pull Leaflet into the server bundle, and Leaflet
 * reads `window` as it loads.
 */

/** Kolkata Municipal Corporation, near Esplanade. */
export const DEFAULT_CENTER: LatLng = { lat: 22.5726, lng: 88.3639 };
