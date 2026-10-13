"use client";

import { useRef } from "react";

interface ConstellationProps {
  className?: string;
  /** Number of star points */
  points?: number;
  /** Line color */
  lineColor?: string;
  /** Dot color */
  dotColor?: string;
  /** Animate a pulsing dot */
  animated?: boolean;
}

export function Constellation({
  className = "",
  points = 12,
  lineColor = "rgba(189,148,96,0.35)",
  dotColor = "rgba(189,148,96,0.7)",
  animated = true,
}: ConstellationProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  /* Fixed seed-based point layout so it looks like a real star map, not random */
  const W = 240;
  const H = 160;
  const seedPoints = [
    [38, 22],
    [80, 14],
    [130, 40],
    [190, 18],
    [210, 70],
    [170, 110],
    [130, 140],
    [80, 120],
    [30, 95],
    [60, 60],
    [110, 85],
    [160, 60],
  ].slice(0, points) as [number, number][];

  /* Connect points that are "close enough" to form constellation lines */
  const edges: [number, number][] = [];
  const threshold = 85;
  for (let i = 0; i < seedPoints.length; i++) {
    for (let j = i + 1; j < seedPoints.length; j++) {
      const dx = seedPoints[i][0] - seedPoints[j][0];
      const dy = seedPoints[i][1] - seedPoints[j][1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold) edges.push([i, j]);
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <defs>
        {animated ? (
          <style>{`
            @media (prefers-reduced-motion: no-preference) {
              .const-line { stroke-dasharray: 200; stroke-dashoffset: 200; animation: draw-line 3s ease forwards; }
              .const-line:nth-child(2) { animation-delay: 0.3s; }
              .const-line:nth-child(3) { animation-delay: 0.6s; }
              .const-line:nth-child(4) { animation-delay: 0.9s; }
              .const-line:nth-child(5) { animation-delay: 1.1s; }
              @keyframes draw-line {
                to { stroke-dashoffset: 0; }
              }
              .const-pulse { animation: pulse-dot 2.4s ease-in-out infinite; }
              .const-pulse:nth-child(2n) { animation-delay: 1.2s; }
              @keyframes pulse-dot {
                0%, 100% { opacity: 0.7; r: 2; }
                50% { opacity: 1; r: 3; }
              }
            }
          `}</style>
        ) : null}
      </defs>

      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={seedPoints[a][0]}
          y1={seedPoints[a][1]}
          x2={seedPoints[b][0]}
          y2={seedPoints[b][1]}
          stroke={lineColor}
          strokeWidth="0.6"
          className={animated ? "const-line" : undefined}
        />
      ))}

      {seedPoints.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === 4 || i === 10 ? 3 : i % 3 === 0 ? 2.5 : 1.8}
          fill={dotColor}
          opacity={i % 5 === 0 ? 0.9 : 0.65}
          className={animated && (i === 4 || i === 10) ? "const-pulse" : undefined}
        />
      ))}
    </svg>
  );
}
