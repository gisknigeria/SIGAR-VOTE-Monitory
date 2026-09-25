const configuredApiUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export const API_BASE_URL = configuredApiUrl;
export const API = `${configuredApiUrl}/api`;

// Keyless tiles for interactive viewing; no bulk or offline downloads.
// https://operations.osmfoundation.org/policies/tiles/
export const STREET_TILES = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
