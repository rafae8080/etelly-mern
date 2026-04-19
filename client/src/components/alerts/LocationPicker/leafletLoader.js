// ─── Leaflet loader (singleton) ────────────────────────────────────────────────

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);

  if (!document.querySelector("#leaflet-css")) {
    const css = document.createElement("link");
    css.id = "leaflet-css";
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
  }

  return new Promise((resolve) => {
    if (document.querySelector("#leaflet-js")) {
      const wait = setInterval(() => {
        if (window.L) {
          clearInterval(wait);
          resolve(window.L);
        }
      }, 80);
      return;
    }
    const js = document.createElement("script");
    js.id = "leaflet-js";
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = () => resolve(window.L);
    document.head.appendChild(js);
  });
}
