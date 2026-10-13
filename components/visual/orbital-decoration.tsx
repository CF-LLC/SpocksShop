interface OrbitalDecorationProps {
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Color accent */
  accent?: "gold" | "blue" | "cream";
  /** Show the dotted orbit rings */
  rings?: number;
}

const SIZE = {
  sm: { vb: "0 0 80 80", cx: 40, cy: 40, radii: [22, 30] },
  md: { vb: "0 0 120 120", cx: 60, cy: 60, radii: [32, 46] },
  lg: { vb: "0 0 200 200", cx: 100, cy: 100, radii: [55, 78, 96] },
};

const ACCENT_COLOR = {
  gold: "rgba(189,148,96,0.5)",
  blue: "rgba(79,110,137,0.45)",
  cream: "rgba(220,205,178,0.55)",
};

export function OrbitalDecoration({
  className = "",
  size = "md",
  accent = "gold",
  rings = 2,
}: OrbitalDecorationProps) {
  const cfg = SIZE[size];
  const color = ACCENT_COLOR[accent];
  const usedRadii = cfg.radii.slice(0, rings);

  return (
    <svg
      viewBox={cfg.vb}
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .orb-dec-spin { animation: orb-dec-rotate 18s linear infinite; }
          .orb-dec-spin-rev { animation: orb-dec-rotate 28s linear infinite reverse; }
          @keyframes orb-dec-rotate {
            from { transform-origin: ${cfg.cx}px ${cfg.cy}px; transform: rotate(0deg); }
            to { transform-origin: ${cfg.cx}px ${cfg.cy}px; transform: rotate(360deg); }
          }
        }
      `}</style>

      {/* Center dot */}
      <circle cx={cfg.cx} cy={cfg.cy} r="2" fill={color} opacity="0.9" />

      {/* Cross */}
      <line x1={cfg.cx - 6} y1={cfg.cy} x2={cfg.cx + 6} y2={cfg.cy} stroke={color} strokeWidth="0.5" />
      <line x1={cfg.cx} y1={cfg.cy - 6} x2={cfg.cx} y2={cfg.cy + 6} stroke={color} strokeWidth="0.5" />

      {usedRadii.map((r, i) => (
        <g key={i} className={i % 2 === 0 ? "orb-dec-spin" : "orb-dec-spin-rev"}>
          <circle
            cx={cfg.cx}
            cy={cfg.cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={i === 0 ? "0.8" : "0.5"}
            strokeDasharray={i === 1 ? "3 5" : "none"}
          />
          {/* Traveling dot on orbit */}
          <circle
            cx={cfg.cx + r}
            cy={cfg.cy}
            r={i === 0 ? 2.5 : 1.5}
            fill={color}
            opacity="0.85"
          />
        </g>
      ))}
    </svg>
  );
}
