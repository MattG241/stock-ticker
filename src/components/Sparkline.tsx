"use client";
import { useMemo } from "react";
import type { PricePoint } from "@/lib/types";

interface Props {
  points: PricePoint[];
  basePrice: number;
  width?: number;
  height?: number;
  showRange?: boolean;
}

export function Sparkline({ points, basePrice, width = 120, height = 32, showRange = true }: Props) {
  const layout = useMemo(() => {
    if (points.length < 2) return null;
    const prices = points.map((p) => p.price);
    const lo = Math.min(...prices, basePrice);
    const hi = Math.max(...prices, basePrice);
    const range = hi - lo || 1;
    const stepX = width / (points.length - 1);
    const baseY = height - ((basePrice - lo) / range) * height;
    const path = points
      .map((p, i) => {
        const x = i * stepX;
        const y = height - ((p.price - lo) / range) * height;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const last = points.at(-1)!;
    const lastY = height - ((last.price - lo) / range) * height;
    const lastX = (points.length - 1) * stepX;
    return { path, baseY, lo, hi, lastX, lastY };
  }, [points, basePrice, width, height]);

  const last = points.at(-1)?.price ?? basePrice;
  const stroke = last >= basePrice ? "#00B764" : "#C0322F";

  if (!layout) {
    return <svg width={width} height={height} className="overflow-visible" />;
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <line
        x1={0}
        x2={width}
        y1={layout.baseY}
        y2={layout.baseY}
        stroke="#3A2F1B"
        strokeDasharray="1 3"
        strokeWidth={1}
      />
      <path d={layout.path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={layout.lastX} cy={layout.lastY} r={2} fill={stroke} />
      {showRange && (
        <g className="num" fontSize="8" fill="#5C5340">
          <text x={0} y={9} textAnchor="start">{layout.hi.toFixed(2)}</text>
          <text x={0} y={height - 1} textAnchor="start">{layout.lo.toFixed(2)}</text>
        </g>
      )}
    </svg>
  );
}
