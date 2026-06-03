interface Props {
  className?: string;
  /** Tone down opacity for use behind dense content. */
  subtle?: boolean;
}

/**
 * Soft, drifting aurora blobs rendered with blurred gradients — a pure-CSS,
 * dependency-free backdrop. Sits behind content (absolute, non-interactive)
 * and is far more vivid in dark mode. Honours `prefers-reduced-motion` via the
 * `.animate-aurora` reduced-motion rule in index.css.
 */
export function Aurora({ className = "", subtle = false }: Props) {
  const o = subtle ? "opacity-50" : "opacity-90";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${o} ${className}`}
    >
      <div className="absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-accent/30 blur-3xl motion-safe:animate-aurora dark:bg-accent/40" />
      <div className="absolute right-[-4rem] top-8 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl motion-safe:animate-aurora [animation-delay:-7s] dark:bg-fuchsia-500/30" />
      <div className="absolute bottom-[-3rem] left-1/3 h-80 w-80 rounded-full bg-cyan-glow/20 blur-3xl motion-safe:animate-aurora [animation-delay:-13s] dark:bg-cyan-glow/25" />
      <div className="absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-gold/20 blur-3xl motion-safe:animate-aurora [animation-delay:-4s] dark:bg-gold/25" />
    </div>
  );
}
