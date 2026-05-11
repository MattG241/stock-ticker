"use client";
import { useMemo } from "react";
import type { PricePoint } from "@/lib/types";

interface Props {
  points: PricePoint[];
  basePrice: number;
  width?: number;
  height?: number;
  stroke?: string;
}

export function Sparkline({ points, basePrice, width = 120, height = 32 }: Props) {
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const prices = points.map((p) => p.price);
    const min = Math.min(...prices, basePrice);
    const max = Math.max(...prices, basePrice);
    const range = max - min || 1;
    const stepX = width / (points.length - 1);
    const baseY = height - ((basePrice - min) / range) * height;
    const d = points
      .map((p, i) => {
        const x = i * stepX;
        const y = height - ((p.price - min) / range) * height;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { d, baseY };
  }, [points, basePrice, width, height]);

  const last = points.at(-1)?.price ?? basePrice;
  const stroke = last >= basePrice ? "#10B981" : "#EF4444";

  return (
    <svg width={width} height={height} className="overflow-visible">
      {path && (
        <>
          <line
            x1={0}
            x2={width}
            y1={path.baseY}
            y2={path.baseY}
            stroke="#3F3F46"
            strokeDasharray="2 3"
            strokeWidth={1}
          />
          <path d={path.d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
