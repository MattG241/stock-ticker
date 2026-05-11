export function CornerFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Corner position="tl" />
      <Corner position="tr" />
      <Corner position="bl" />
      <Corner position="br" />
      {children}
    </div>
  );
}

function Corner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const placement: Record<typeof position, string> = {
    tl: "top-0 left-0",
    tr: "top-0 right-0 rotate-90",
    bl: "bottom-0 left-0 -rotate-90",
    br: "bottom-0 right-0 rotate-180",
  };
  return (
    <svg
      className={`absolute ${placement[position]} pointer-events-none`}
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden
    >
      <path d="M0 0 L22 0 M0 0 L0 22" stroke="rgba(197,163,82,0.65)" strokeWidth="1" />
      <circle cx="3" cy="3" r="1.2" fill="#C5A352" />
    </svg>
  );
}

export function BrassDivider({ withMark = false, width = "100%" }: { withMark?: boolean; width?: string | number }) {
  return (
    <div className="flex items-center gap-2" style={{ width }}>
      <div className="brand-divider flex-1" />
      {withMark && (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <circle cx="6" cy="6" r="2" fill="#C5A352" />
        </svg>
      )}
      <div className="brand-divider flex-1" />
    </div>
  );
}
