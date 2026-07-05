"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Navigation } from "lucide-react";

import { googleMapsDirUrl, type LngLat } from "@/lib/geo";

// Same fully-free vector base the other maps use (no API key).
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

type Props = { lat: number; lng: number };

/**
 * Read-only map showing a single shift pin. Non-editable — used on the business
 * shift detail page. MapLibre is browser-only, so load via
 * `next/dynamic({ ssr: false })`.
 */
export default function ShiftLocationMap({ lat, lng }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const at: LngLat = [lng, lat];

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: at,
      zoom: 15,
      attributionControl: { compact: true },
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();

    const pin = document.createElement("div");
    pin.className = "wf-shift-pin";
    new maplibregl.Marker({ element: pin, anchor: "bottom" }).setLngLat(at).addTo(map);

    return () => map.remove();
    // Position is fixed for the map's lifetime; a coord change remounts via key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-48 overflow-hidden rounded-card border border-border">
      <div ref={containerRef} className="h-full w-full" />

      <a
        href={googleMapsDirUrl(at)}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-[13px] font-semibold text-ink shadow-md active:scale-95"
      >
        <Navigation size={15} /> Directions
      </a>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .wf-shift-pin {
          width: 20px;
          height: 20px;
          border-radius: 999px 999px 999px 0;
          background: var(--color-danger, #e5484d);
          border: 3px solid #fff;
          box-shadow: 0 4px 10px -3px rgba(0,0,0,0.5);
          transform: rotate(-45deg);
        }
      `,
        }}
      />
    </div>
  );
}
