"use client";

interface ScanLineProps {
  className?: string;
  /** Color of the scan glow */
  color?: string;
  /** Animation duration in seconds */
  duration?: number;
  /** Direction */
  direction?: "horizontal" | "vertical";
}

export function ScanLine({
  className = "",
  color = "rgba(95,141,175,0.6)",
  duration = 4,
  direction = "horizontal",
}: ScanLineProps) {
  return (
    <div
      className={`scan-line-host pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div
        className="scan-line"
        style={
          {
            "--scan-color": color,
            "--scan-duration": `${duration}s`,
            "--scan-direction": direction === "horizontal" ? "translateY" : "translateX",
          } as React.CSSProperties
        }
      />
    </div>
  );
}
