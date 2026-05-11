import { WMSTileLayer } from "react-leaflet";

const PHIL_GEOPORTAL_WMS_URL =
  "https://geoserver.geoportal.gov.ph/geoserver/geoportal/wms";

// WMS tile overlay from Philippine Geoportal (MGB landslide susceptibility data)
export const LandslideHazardLayer = ({ visible }) => {
  if (!visible) return null;

  return (
    <WMSTileLayer
      url={PHIL_GEOPORTAL_WMS_URL}
      layers="landslide10ksusceptibility"
      format="image/png"
      transparent={true}
      opacity={0.4}
      version="1.1.1"
      attribution='&copy; <a href="https://geoportal.gov.ph">Philippine Geoportal / MGB</a>'
    />
  );
};
