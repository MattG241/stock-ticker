const TZ = "Australia/Adelaide";

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatAdelaide(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatAdelaideDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function parseHM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map((n) => parseInt(n, 10));
  return { h: h ?? 0, m: m ?? 0 };
}

export function isWithinTradingHours(
  open: string,
  close: string,
  date: Date = new Date(),
): boolean {
  const localHour = parseInt(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(date),
    10,
  );
  const localMin = parseInt(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: TZ,
      minute: "2-digit",
    }).format(date),
    10,
  );
  const cur = localHour * 60 + localMin;
  const { h: oh, m: om } = parseHM(open);
  const { h: ch, m: cm } = parseHM(close);
  const o = oh * 60 + om;
  const c = ch * 60 + cm;
  if (o === c) return true;
  if (o < c) return cur >= o && cur < c;
  // Overnight window (e.g. 16:00 -> 02:00)
  return cur >= o || cur < c;
}
