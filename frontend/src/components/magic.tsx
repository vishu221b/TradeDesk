import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionTemplate, useMotionValue } from "framer-motion";

/**
 * MagicCard — a surface with a cursor-following radial spotlight (Magic UI /
 * Aceternity style). `rgb` is a "r,g,b" triplet for the glow tint.
 */
export function MagicCard({
  children,
  className = "",
  rgb = "124,58,237",
  onClick,
  radius = 220,
}: {
  children: ReactNode;
  className?: string;
  rgb?: string;
  onClick?: () => void;
  radius?: number;
}) {
  const mx = useMotionValue(-radius);
  const my = useMotionValue(-radius);
  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${mx}px ${my}px, rgba(${rgb},0.14), transparent 72%)`;

  return (
    <div
      onClick={onClick}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        mx.set(-radius);
        my.set(-radius);
      }}
      className={`group relative overflow-hidden ${className}`}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/**
 * NumberTicker — animated count-up. `format` renders the in-flight number.
 */
export function NumberTicker({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 0.9,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return <>{format(display)}</>;
}
