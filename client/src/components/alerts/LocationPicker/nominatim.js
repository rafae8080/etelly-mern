// ─── Nominatim helpers ─────────────────────────────────────────────────────────

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "AntipoloDRRS/1.0",
};

// Antipolo City bounding box (lon_min, lat_min, lon_max, lat_max)
const VIEWBOX = "121.08,14.52,121.26,14.70";

export async function geocode(query) {
  const params = new URLSearchParams({
    q: `${query}, Antipolo, Rizal`,
    format: "json",
    addressdetails: "1",
    limit: "6",
    countrycodes: "ph",
    bounded: "1",
    viewbox: VIEWBOX,
  });
  const res = await fetch(`${NOMINATIM}/search?${params}`, {
    headers: OSM_HEADERS,
  });
  return res.json();
}

export async function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({ lat, lon, format: "json" });
  const res = await fetch(`${NOMINATIM}/reverse?${params}`, {
    headers: OSM_HEADERS,
  });
  const data = await res.json();
  return data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
