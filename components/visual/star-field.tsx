"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  speed: number;
  twinklePhase: number;
  twinkleSpeed: number;
}

interface StarFieldProps {
  className?: string;
  starCount?: number;
  /** Speed multiplier. Default 1. */
  speed?: number;
  /** Whether stars slowly drift downward. */
  drift?: boolean;
}

export function StarField({
  className = "",
  starCount = 120,
  speed = 1,
  drift = true,
}: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];

    function resize() {
      if (!canvas) return;
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx!.scale(window.devicePixelRatio, window.devicePixelRatio);
      initStars();
    }

    function initStars() {
      stars = Array.from({ length: starCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.6 + 0.2,
        speed: (Math.random() * 0.08 + 0.02) * speed,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
      }));
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        if (!reducedMotion) {
          star.twinklePhase += star.twinkleSpeed;
          const twinkle = Math.sin(star.twinklePhase) * 0.25 + 0.75;

          if (drift) {
            star.y += star.speed;
            if (star.y > height + 4) {
              star.y = -4;
              star.x = Math.random() * width;
            }
          }

          ctx.globalAlpha = star.opacity * twinkle;
        } else {
          ctx.globalAlpha = star.opacity;
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    if (!reducedMotion) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      draw();
    }

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [starCount, speed, drift, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none block h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
}
