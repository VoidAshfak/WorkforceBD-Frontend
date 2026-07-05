"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed, MapPin, X } from "lucide-react";

import { currentLngLat, DHAKA_CENTER, type LngLat } from "@/lib/geo";

// Same fully-free vector base the explore map uses (no API key).
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

export type ShiftLatLng = { lat: number; lng: number };

type Props = {
  /** Current pin, or `null` to fall back to the business profile location. */
  value: ShiftLatLng | null;
  onChange: (v: ShiftLatLng | null) => void;
};

/**
 * Map location picker for a shift. A fixed pin floats at the map centre; the
 * user pans the map underneath it (or taps "my location") to place the pin. The
 * centre coordinate is reported to the parent as `{ lat, lng }`. Leaving it
 * unset (`null`) makes the backend fall back to the business profile's location.
 *
 * MapLibre is browser-only — load this via `next/dynamic({ ssr: false })`.
 */
export default function ShiftLocationPicker({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Latest onChange without re-binding map listeners.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- create the map once ---
  useEffect(() => {
    if (!containerRef.current) return;

    const start: LngLat = value ? [value.lng, value.lat] : DHAKA_CENTER;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: start,
      zoom: value ? 15 : 12,
      attributionControl: { compact: true },
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    // The pin is fixed at the centre — panning ends a placement.
    const emit = () => {
      const c = map.getCenter();
      onChangeRef.current({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) });
    };
    map.on("dragend", emit);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Init only — value/onChange changes must not recreate the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locateMe = async () => {
    const map = mapRef.current;
    if (!map) return;
    setError(null);
    setLocating(true);
    try {
      const at = await currentLngLat();
      map.flyTo({ center: at, zoom: 16, duration: 700 });
      onChangeRef.current({ lat: +at[1].toFixed(6), lng: +at[0].toFixed(6) });
    } catch (err) {
      setError((err as Error)?.message ?? "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  };

  const clear = () => {
    setError(null);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative h-64 overflow-hidden rounded-card border border-border">
        <div ref={containerRef} className="h-full w-full" />

        {/* Fixed centre pin — tip sits exactly on the map centre. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <MapPin size={34} className="text-danger drop-shadow-md" fill="currentColor" strokeWidth={1.5} />
        </div>
        {/* Ground dot under the pin for depth. */}
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40" />

        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          aria-label="Use my location"
          className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-md active:scale-95 disabled:opacity-60"
        >
          <LocateFixed size={18} className={locating ? "animate-pulse" : ""} />
        </button>
      </div>

      {error ? <p className="text-[12px] font-medium text-danger">{error}</p> : null}

      {value ? (
        <div className="flex items-center justify-between rounded-xl bg-black/[0.04] px-3 py-2 text-[13px]">
          <span className="flex items-center gap-1.5 font-medium text-ink">
            <MapPin size={14} className="text-danger" />
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-text-secondary active:scale-95"
          >
            <X size={13} /> Clear
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-text-tertiary">
          Pan the map to place the pin, or tap the locate button. Leave empty to use your business address.
        </p>
      )}
    </div>
  );
}
