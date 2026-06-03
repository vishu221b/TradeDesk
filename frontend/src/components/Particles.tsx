import { useEffect, useRef } from "react";

interface Props {
  /** Number of particles. Scaled down automatically on small containers. */
  quantity?: number;
  /** Particle colour as an "r,g,b" triplet. */
  color?: string;
  /** Max particle radius in px. */
  maxSize?: number;
  /** Base drift speed. */
  speed?: number;
  className?: string;
}

/**
 * Lightweight, dependency-free particle field (Aceternity "sparkles" vibe).
 * Renders into a canvas that fills its positioned parent. Twinkling dots drift
 * slowly and bounce off the edges. Honours `prefers-reduced-motion` (no canvas
 * context in jsdom → no-ops safely in tests).
 */
export function Particles({
  quantity = 56,
  color = "139,92,246",
  maxSize = 2,
  speed = 0.25,
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // getContext throws (not returns null) under jsdom; guard so tests stay quiet.
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return; // unsupported environment

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let raf = 0;

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; tw: number };
    let dots: P[] = [];

    const seed = () => {
      const area = Math.max(1, width * height);
      const count = Math.max(12, Math.round((quantity * area) / (1280 * 720)));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        r: Math.random() * maxSize + 0.4,
        a: Math.random() * 0.5 + 0.2,
        tw: (Math.random() * 0.012 + 0.004) * (Math.random() < 0.5 ? -1 : 1),
      }));
    };

    const resize = () => {
      const parent = canvas.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of dots) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.a += p.tw;
        if (p.a > 0.85 || p.a < 0.12) p.tw *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${p.a})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${color},0.7)`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [quantity, color, maxSize, speed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
