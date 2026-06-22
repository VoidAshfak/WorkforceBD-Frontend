"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed, Maximize2 } from "lucide-react";

import { gsap } from "@/lib/gsap";
import { DHAKA_CENTER, shiftLatLng, type LngLat } from "@/lib/geo";
import { formatTaka } from "@/lib/format";
import { shiftEmoji } from "@/config/shiftTheme";
import type { Shift } from "@/types/shift";

// OpenFreeMap: fully free vector tiles + styles, no API key. "positron" is a
// clean, light base we tint toward the app's warm palette on load.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

type Props = {
  shifts: Shift[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/**
 * Interactive shift map. Each shift drops a brand pin (its pay) at its zone
 * position; tapping a pin selects it (parent opens the detail sheet). Includes
 * fit-to-shifts and locate-me controls. MapLibre is browser-only — load this via
 * `next/dynamic({ ssr: false })`.
 */
export default function ExploreMap({ shifts, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLElement }>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  // Latest onSelect without re-binding map listeners.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // --- create the map once ---
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DHAKA_CENTER,
      zoom: 12,
      attributionControl: { compact: true },
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    // Stable Map object (only mutated, never reassigned) — safe for cleanup.
    const markers = markersRef.current;

    map.on("load", () => {
      readyRef.current = true;
      tintStyle(map);
      syncMarkers();
      fitToShifts(false);
    });

    return () => {
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- rebuild markers when the shift set changes ---
  useEffect(() => {
    if (readyRef.current) {
      syncMarkers();
      fitToShifts(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts]);

  // --- reflect selection: restyle + fly + pop ---
  useEffect(() => {
    const map = mapRef.current;
    markersRef.current.forEach(({ el }, id) => {
      const active = id === selectedId;
      el.classList.toggle("is-selected", active);
      if (active) {
        gsap.fromTo(
          el,
          { scale: 0.6 },
          { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" },
        );
      }
    });
    if (map && selectedId) {
      const target = shifts.find((s) => s.id === selectedId);
      if (target) {
        map.flyTo({
          center: shiftLatLng(target),
          zoom: Math.max(map.getZoom(), 14),
          offset: [0, -110], // lift the pin above the bottom sheet
          duration: 700,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function syncMarkers() {
    const map = mapRef.current;
    if (!map) return;
    const next = new Set(shifts.map((s) => s.id));

    // Drop markers for shifts no longer present.
    markersRef.current.forEach(({ marker }, id) => {
      if (!next.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add markers for new shifts.
    for (const shift of shifts) {
      if (markersRef.current.has(shift.id)) continue;
      const el = buildPin(shift);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(shift.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(shiftLatLng(shift))
        .addTo(map);
      markersRef.current.set(shift.id, { marker, el });

      // Stagger-drop the pins in for a lively first paint.
      gsap.from(el, { y: -18, autoAlpha: 0, duration: 0.4, ease: "back.out(1.7)", delay: Math.random() * 0.25 });
    }
  }

  function fitToShifts(animate: boolean) {
    const map = mapRef.current;
    if (!map || shifts.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    shifts.forEach((s) => bounds.extend(shiftLatLng(s)));
    map.fitBounds(bounds, { padding: { top: 90, bottom: 200, left: 60, right: 60 }, maxZoom: 15, duration: animate ? 600 : 0 });
  }

  function locateMe() {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at: LngLat = [pos.coords.longitude, pos.coords.latitude];
        if (!userMarkerRef.current) {
          const dot = document.createElement("div");
          dot.className = "wf-user-dot";
          userMarkerRef.current = new maplibregl.Marker({ element: dot }).setLngLat(at).addTo(map);
        } else {
          userMarkerRef.current.setLngLat(at);
        }
        map.flyTo({ center: at, zoom: 14, duration: 700 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Fit-all sits top-right; locate-me lives bottom-right so it never
          collides with the floating filter pills up top. */}
      <div className="absolute right-3 top-3">
        <ControlButton label="Fit all shifts" onClick={() => fitToShifts(true)}>
          <Maximize2 size={18} />
        </ControlButton>
      </div>
      <div className="absolute bottom-24 right-3">
        <ControlButton label="My location" onClick={locateMe}>
          <LocateFixed size={18} />
        </ControlButton>
      </div>

      <PinStyles />
    </div>
  );
}

function ControlButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-md active:scale-95"
    >
      {children}
    </button>
  );
}

/** Builds the DOM element used as a MapLibre marker for a shift. */
function buildPin(shift: Shift): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "wf-pin";
  el.setAttribute("aria-label", `${shift.title} — ${formatTaka(shift.pay_amount)}`);
  el.innerHTML = `
    <span class="wf-pin-body">
      <span class="wf-pin-emoji">${shiftEmoji(shift)}</span>
      <span class="wf-pin-pay">${formatTaka(shift.pay_amount)}</span>
    </span>
    <span class="wf-pin-tail"></span>
  `;
  return el;
}

/**
 * Nudges the light positron base toward the app's warm palette so the map reads
 * as part of the product rather than a generic OSM tile.
 */
function tintStyle(map: maplibregl.Map) {
  const set = (layer: string, prop: string, value: string) => {
    if (map.getLayer(layer)) {
      try {
        map.setPaintProperty(layer, prop as never, value as never);
      } catch {
        /* layer prop mismatch across style versions — ignore */
      }
    }
  };
  set("background", "background-color", "#FBF8F0");
  set("water", "fill-color", "#CDE7F0");
  set("landcover", "fill-color", "#EFEAD9");
  set("park", "fill-color", "#DCEFD2");
}

/** CSS for the custom pins + user dot. */
function PinStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .wf-pin {
        cursor: pointer;
        background: transparent;
        border: 0;
        padding: 0;
        transform-origin: 50% 100%;
        will-change: transform;
      }
      .wf-pin-body {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px 5px 6px;
        border-radius: 999px;
        background: var(--color-brand, #ffdb5b);
        border: 2px solid #202020;
        box-shadow: 0 6px 14px -6px rgba(0, 0, 0, 0.55);
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
      }
      .wf-pin-emoji {
        font-size: 14px;
      }
      .wf-pin-pay {
        font-size: 13px;
        color: #202020;
      }
      .wf-pin-tail {
        position: absolute;
        left: 50%;
        bottom: -5px;
        width: 10px;
        height: 10px;
        background: var(--color-brand, #ffdb5b);
        border-right: 2px solid #202020;
        border-bottom: 2px solid #202020;
        transform: translateX(-50%) rotate(45deg);
      }
      .wf-pin.is-selected {
        z-index: 5;
      }
      .wf-pin.is-selected .wf-pin-body {
        background: #202020;
        border-color: #202020;
      }
      .wf-pin.is-selected .wf-pin-pay,
      .wf-pin.is-selected .wf-pin-emoji {
        color: #fff;
      }
      .wf-pin.is-selected .wf-pin-tail {
        background: #202020;
        border-color: #202020;
      }
      .wf-user-dot {
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: #1f98f9;
        border: 3px solid #fff;
        box-shadow: 0 0 0 4px rgba(31, 152, 249, 0.25);
      }
      .maplibregl-ctrl-attrib {
        font-size: 10px;
      }
    `,
      }}
    />
  );
}
