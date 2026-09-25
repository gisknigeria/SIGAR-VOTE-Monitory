import L from "leaflet";
import { STREET_TILES } from "./config.js";

// Shared by every street map, independent of old MapTiler deployment keys.
export function createStreetLayer(options = {}) {
  return L.tileLayer(STREET_TILES.url, {
    maxZoom: 19,
    maxNativeZoom: 19,
    ...options,
    attribution: STREET_TILES.attribution,
    referrerPolicy: "strict-origin-when-cross-origin",
  });
}
