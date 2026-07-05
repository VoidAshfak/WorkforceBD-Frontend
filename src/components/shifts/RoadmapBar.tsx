import type { Roadmap, RoadmapStep } from "@/types/shift";

/**
 * Status-journey bar driven by a backend `roadmap`. Steps snake left→right then
 * wrap and reverse (boustrophedon), joined by a continuous line that curves at
 * each row turn — so long journeys stay on-screen instead of overflowing.
 * Reached segments/nodes fill green, the current step highlights (brand, or red
 * when cancelled), upcoming steps stay muted. Rendered as a single responsive
 * SVG (scales to its container width).
 */
export default function RoadmapBar({ roadmap }: { roadmap: Roadmap }) {
  const steps = roadmap.steps ?? [];
  const n = steps.length;
  if (!n) return null;

  const cols = Math.min(n, 4);
  const rows = Math.ceil(n / cols);
  const maxLines = Math.min(2, Math.max(...steps.map((s) => s.label.trim().split(/\s+/).length)));

  const VW = 320;
  const colW = VW / cols;
  const topY = 18;
  const rowH = 40 + maxLines * 10;
  const VH = topY + (rows - 1) * rowH + 18 + maxLines * 10 + 4;
  const R = 9;

  // Centre of the node at index `i` on the snaking grid.
  const at = (i: number) => {
    const r = Math.floor(i / cols);
    const p = i % cols;
    const col = r % 2 === 0 ? p : cols - 1 - p;
    return { x: colW * col + colW / 2, y: topY + r * rowH, col };
  };

  const GREEN = "var(--color-emerald)";
  const GREY = "rgba(0,0,0,0.12)";

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" role="img" aria-label="Shift status">
      {/* Connectors (drawn under the nodes) */}
      {steps.slice(0, -1).map((_, i) => {
        const a = at(i);
        const b = at(i + 1);
        const reached = steps[i + 1].reached;
        const stroke = reached ? GREEN : GREY;
        const sameRow = a.y === b.y;
        let d: string;
        if (sameRow) {
          d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
        } else {
          // Row turn: bulge outward toward the near edge, then drop to the next row.
          const dir = a.col === cols - 1 ? 1 : -1;
          const bulge = Math.min(colW / 2 - 6, 26) * dir;
          d = `M ${a.x} ${a.y} C ${a.x + bulge} ${a.y + rowH * 0.42}, ${a.x + bulge} ${a.y + rowH * 0.58}, ${b.x} ${b.y}`;
        }
        return (
          <path key={i} d={d} fill="none" style={{ stroke }} strokeWidth={3} strokeLinecap="round" />
        );
      })}

      {/* Nodes + labels */}
      {steps.map((s, i) => {
        const { x, y } = at(i);
        const cancelled = roadmap.is_cancelled && s.current;
        return (
          <g key={s.key}>
            <Node x={x} y={y} r={R} step={s} cancelled={cancelled} />
            <Label
              x={x}
              y={y + R + 9}
              label={s.label}
              maxLines={maxLines}
              tone={
                cancelled
                  ? "var(--color-danger)"
                  : s.current
                    ? "var(--color-ink)"
                    : s.reached
                      ? "var(--color-text-secondary)"
                      : "var(--color-text-tertiary)"
              }
            />
          </g>
        );
      })}
    </svg>
  );
}

function Node({
  x,
  y,
  r,
  step,
  cancelled,
}: {
  x: number;
  y: number;
  r: number;
  step: RoadmapStep;
  cancelled: boolean;
}) {
  if (cancelled) {
    return (
      <>
        <circle cx={x} cy={y} r={r} style={{ fill: "var(--color-danger)" }} />
        <path
          d={`M ${x - 3.2} ${y - 3.2} L ${x + 3.2} ${y + 3.2} M ${x - 3.2} ${y + 3.2} L ${x + 3.2} ${y - 3.2}`}
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </>
    );
  }
  if (step.current) {
    return (
      <>
        <circle cx={x} cy={y} r={r + 3.5} style={{ fill: "var(--color-brand)", opacity: 0.28 }} />
        <circle cx={x} cy={y} r={r} style={{ fill: "var(--color-brand)" }} />
        <circle cx={x} cy={y} r={3} style={{ fill: "var(--color-ink)" }} />
      </>
    );
  }
  if (step.reached) {
    return (
      <>
        <circle cx={x} cy={y} r={r} style={{ fill: "var(--color-emerald)" }} />
        <polyline
          points={`${x - 3.6},${y + 0.2} ${x - 1},${y + 2.7} ${x + 3.8},${y - 2.9}`}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    );
  }
  return (
    <>
      <circle cx={x} cy={y} r={r} style={{ fill: "var(--color-surface)", stroke: "rgba(0,0,0,0.16)" }} strokeWidth={1.5} />
      <circle cx={x} cy={y} r={2} style={{ fill: "rgba(0,0,0,0.2)" }} />
    </>
  );
}

function Label({
  x,
  y,
  label,
  maxLines,
  tone,
}: {
  x: number;
  y: number;
  label: string;
  maxLines: number;
  tone: string;
}) {
  // Stack up to `maxLines` word-lines; overflow words fold into the last line.
  const words = label.trim().split(/\s+/);
  const lines = maxLines <= 1 ? [label] : foldWords(words, maxLines);
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      style={{ fill: tone, fontSize: 9, fontWeight: 700 }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 10}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** Groups words into at most `maxLines` lines (extras append to the last). */
function foldWords(words: string[], maxLines: number): string[] {
  if (words.length <= maxLines) return words;
  const lines = words.slice(0, maxLines - 1);
  lines.push(words.slice(maxLines - 1).join(" "));
  return lines;
}
