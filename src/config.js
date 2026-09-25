const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export const API_BASE_URL = configuredApiUrl;
export const API = `${configuredApiUrl}/api`;

// Street basemap with no API key: CARTO's Voyager tiles (OpenStreetMap data on CARTO's CDN).
// OpenStreetMap's own tile servers block apps that send heavy traffic, so they are not used.
// Setting VITE_MAPTILER_KEY at build time switches the street map to MapTiler instead.
export const STREET_TILES = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
};

// Also keyless: Esri's World Street Map, from the same servers as the satellite view.
export const STREET_FALLBACK_TILES = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri",
};

/**
 * Switches a street layer to the Esri street map when its tiles will not load (the provider is
 * down or blocks this network), so the map is never left blank. A few failed tiles among good
 * ones are normal and do not trigger the switch.
 */
export function withStreetFallback(layer) {
  let loaded = 0;
  let failed = 0;
  const onError = () => {
    failed += 1;
    if (loaded || failed < 4) return;
    layer.off("tileerror", onError);
    layer._map?.attributionControl?.removeAttribution(layer.options.attribution).addAttribution(STREET_FALLBACK_TILES.attribution);
    layer.options.attribution = STREET_FALLBACK_TILES.attribution;
    layer.setUrl(STREET_FALLBACK_TILES.url);
  };
  layer.on("tileload", () => { loaded += 1; });
  layer.on("tileerror", onError);
  return layer;
}
