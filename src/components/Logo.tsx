export function Logo({ size = 26 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <CandlestickMark height={size * 1.4} />
      <span
        className="leading-none tracking-[0.22em] text-ink"
        style={{ fontSize: size, fontFamily: "Bebas Neue, Inter, sans-serif" }}
      >
        THE DR
        <span className="inline-block translate-y-[1px]" aria-hidden>
          <CandlestickI height={size * 0.95} />
        </span>
        NK EXCHANGE
      </span>
    </div>
  );
}

function CandlestickMark({ height }: { height: number }) {
  const w = height * 0.6;
  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 24 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <line x1="6" y1="2" x2="6" y2="34" stroke="#4B5360" strokeWidth="1" />
      <rect x="2" y="6" width="8" height="10" fill="#22D48F" />
      <line x1="18" y1="0" x2="18" y2="34" stroke="#4B5360" strokeWidth="1" />
      <rect x="14" y="14" width="8" height="14" fill="#FF4757" />
    </svg>
  );
}

function CandlestickI({ height }: { height: number }) {
  const w = Math.max(8, height * 0.35);
  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 12 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-[1px] inline-block"
    >
      <line x1="6" y1="1" x2="6" y2="23" stroke="#8A93A0" strokeWidth="1" />
      <rect x="3" y="4" width="6" height="7" fill="#22D48F" />
      <rect x="3" y="13" width="6" height="7" fill="#FF4757" />
    </svg>
  );
}
