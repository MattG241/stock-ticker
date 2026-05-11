interface Props {
  size?: number;
  variant?: "horizontal" | "stacked" | "monogram";
  showRule?: boolean;
}

/**
 * Brand wordmark per §03 Logo System.
 * - THE and EXCHANGE in editorial serif (Playfair Display)
 * - DRINK in condensed display sans (Bebas Neue) with a candlestick I
 * - Brass-toned ivory text on dark
 */
export function Logo({ size = 24, variant = "horizontal", showRule = false }: Props) {
  if (variant === "monogram") {
    return (
      <span
        className="inline-flex items-baseline gap-1 text-ink"
        style={{ fontFamily: "Playfair Display, serif", fontSize: size, lineHeight: 1 }}
      >
        T<CandlestickI height={size * 0.75} />X
      </span>
    );
  }
  if (variant === "stacked") {
    return (
      <div className="inline-flex flex-col items-center gap-1.5 leading-none text-ink">
        <span
          className="serif font-medium tracking-[0.32em] text-ink-dim"
          style={{ fontSize: size * 0.4 }}
        >
          THE
        </span>
        <span
          className="font-display tracking-[0.04em]"
          style={{ fontSize: size * 1.4, lineHeight: 1 }}
        >
          DR<CandlestickI height={size * 1.3} />NK
        </span>
        <span
          className="serif font-medium tracking-[0.28em] text-ink"
          style={{ fontSize: size * 0.62 }}
        >
          EXCHANGE
        </span>
        {showRule && <BrassRule width={size * 4} />}
      </div>
    );
  }
  return (
    <div className="inline-flex items-baseline gap-2 leading-none">
      <span
        className="serif font-medium tracking-[0.32em] text-ink-dim"
        style={{ fontSize: size * 0.62 }}
      >
        THE
      </span>
      <span
        className="font-display tracking-[0.04em] text-ink"
        style={{ fontSize: size * 1.15, lineHeight: 1 }}
      >
        DR<CandlestickI height={size * 1.05} />NK
      </span>
      <span
        className="serif font-medium tracking-[0.28em] text-ink"
        style={{ fontSize: size * 0.8 }}
      >
        EXCHANGE
      </span>
    </div>
  );
}

function CandlestickI({ height }: { height: number }) {
  const w = Math.max(8, height * 0.34);
  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 12 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-[1px] inline-block"
      aria-hidden
    >
      <line x1="6" y1="1" x2="6" y2="27" stroke="#C5A352" strokeWidth="1" />
      <rect x="3" y="4" width="6" height="8" fill="#00B764" />
      <rect x="3" y="16" width="6" height="9" fill="#C0322F" />
    </svg>
  );
}

function BrassRule({ width = 120 }: { width?: number }) {
  return (
    <svg width={width} height="10" viewBox={`0 0 ${width} 10`} aria-hidden>
      <line x1="0" y1="5" x2={width} y2="5" stroke="rgba(197,163,82,0.55)" strokeWidth="0.6" />
      <circle cx={width / 2} cy="5" r="1.6" fill="#C5A352" />
      <circle cx={width / 2 - 10} cy="5" r="0.8" fill="#C5A352" />
      <circle cx={width / 2 + 10} cy="5" r="0.8" fill="#C5A352" />
    </svg>
  );
}

export function BrandTagline({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const fs = size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs";
  return (
    <span className={`${fs} serif italic tracking-[0.24em] text-brass`}>
      Trade Drinks. Not Stocks.
    </span>
  );
}
