"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrImage({ value, size = 180 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let stopped = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0D0D0D", light: "#F2E8D5" },
    })
      .then((url) => {
        if (!stopped) setSrc(url);
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [value, size]);
  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse rounded-sm bg-bg-elev"
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="receipt qr" width={size} height={size} className="rounded-sm" />;
}
