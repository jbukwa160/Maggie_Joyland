// Small hand-drawn style ornaments used across the shop.
type Props = { className?: string };

export function Bow({ className }: Props) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden="true" fill="currentColor">
      <path d="M30 18c-6-9-20-16-25-12s-1 20 9 20c6 0 12-4 16-8Z" opacity=".9" />
      <path d="M34 18c6-9 20-16 25-12s1 20-9 20c-6 0-12-4-16-8Z" opacity=".9" />
      <path d="M28 21c-3 5-7 12-10 17l7-1 7-10Zm8 0c3 5 7 12 10 17l-7-1-7-10Z" opacity=".75" />
      <ellipse cx="32" cy="19" rx="6" ry="6.5" />
    </svg>
  );
}

export function Heart({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.7 1.3 5.4 3.2 1.7-1.9 3.2-3.2 5.4-3.2 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21Z" />
    </svg>
  );
}

export function Sparkle({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 0c.8 6.4 2.6 9.9 12 12-9.4 2.1-11.2 5.6-12 12-.8-6.4-2.6-9.9-12-12 9.4-2.1 11.2-5.6 12-12Z" />
    </svg>
  );
}

export function Crown({ className }: Props) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden="true" fill="currentColor">
      <path d="M4 10l9 8 11-16 11 16 9-8-4 20H8L4 10Z" />
      <circle cx="4" cy="9" r="3" />
      <circle cx="24" cy="3" r="3" />
      <circle cx="44" cy="9" r="3" />
    </svg>
  );
}

export function ScallopDivider({ className, color = "var(--color-primary-200)" }: Props & { color?: string }) {
  return <div className={`scallop-edge ${className ?? ""}`} style={{ "--scallop-color": color } as React.CSSProperties} aria-hidden="true" />;
}
