export function CardTitle({ children, className = '' }) {
  return (
    <h3
      className={`font-mono text-[11px] leading-tight font-medium tracking-[0.1em] text-[var(--ink-muted)] uppercase ${className}`.trim()}
    >
      {children}
    </h3>
  );
}
