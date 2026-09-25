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
