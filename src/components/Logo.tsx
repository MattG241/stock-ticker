export function Logo({ size = 28 }: { size?: number }) {
  const fs = size;
  return (
    <div className="flex items-center gap-2" style={{ fontFamily: "Bebas Neue, Inter, sans-serif" }}>
      <span
        className="tracking-[0.18em] leading-none"
        style={{ fontSize: fs }}
      >
        THE DR
        <span className="inline-block translate-y-[1px]" aria-hidden>
          <CandlestickI height={fs * 0.95} />
        </span>
        NK EXCHANGE
      </span>
    </div>
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
      <line x1="6" y1="1" x2="6" y2="23" stroke="#A1A1AA" strokeWidth="1" />
      <rect x="3" y="4" width="6" height="7" fill="#10B981" />
      <rect x="3" y="13" width="6" height="7" fill="#EF4444" />
    </svg>
  );
}
