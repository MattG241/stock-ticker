"use client";
import { useMemo } from "react";
import { formatAud } from "@/lib/money";

interface Bucket {
  hour: string;
  revenue: number;
  orders: number;
}

export function RevenueChart({ buckets, height = 160 }: { buckets: Bucket[]; height?: number }) {
  const layout = useMemo(() => {
    const max = Math.max(1, ...buckets.map((b) => b.revenue));
    const w = 360;
    const padding = 28;
    const innerW = w - padding * 2;
    const barW = innerW / buckets.length;
    return { max, w, padding, barW, innerH: height - padding };
  }, [buckets, height]);

  return (
    <div>
      <svg width={layout.w} height={height} className="block">
        <line
          x1={layout.padding}
          x2={layout.w - layout.padding}
          y1={height - layout.padding}
          y2={height - layout.padding}
          stroke="#1A2027"
        />
        {buckets.map((b, i) => {
          const h = (b.revenue / layout.max) * layout.innerH;
          const x = layout.padding + i * layout.barW + 1;
          const y = height - layout.padding - h;
          return (
            <g key={b.hour}>
              <rect
                x={x}
                y={y}
                width={Math.max(2, layout.barW - 2)}
                height={Math.max(0, h)}
                fill={b.revenue > 0 ? "#22D48F" : "#1A2027"}
                rx={1}
              />
              {(i === 0 || i % 4 === 0) && (
                <text
                  x={x}
                  y={height - layout.padding + 14}
                  fontSize="9"
                  fill="#A1A1AA"
                  className="num"
                >
                  {b.hour}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-ink-dim">
        <span>Per-hour revenue</span>
        <span className="num">peak {formatAud(layout.max)}</span>
      </div>
    </div>
  );
}
