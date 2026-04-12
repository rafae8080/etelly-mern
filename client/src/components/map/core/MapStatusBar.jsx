import { useState } from "react";
import { useMapEvents } from "react-leaflet";

const MapStatusBar = () => {
  const [coords, setCoords] = useState({ lat: 12.88, lng: 121.77 });
  const [zoom, setZoom] = useState(6);

  useMapEvents({
    mousemove: (e) => setCoords({ lat: e.latlng.lat, lng: e.latlng.lng }),
    zoomend: (e) => setZoom(e.target.getZoom()),
  });

  return (
    <div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]
                 bg-slate-900/80 backdrop-blur border border-slate-700
                 rounded-full px-4 py-1.5 pointer-events-none select-none"
    >
      <span className="text-xs text-slate-400 font-mono">
        {coords.lat.toFixed(5)}°N &nbsp;|&nbsp; {coords.lng.toFixed(5)}°E
        &nbsp;|&nbsp; z{zoom}
      </span>
    </div>
  );
};

export default MapStatusBar;
