export type DrinkCategory =
  | "Cocktails"
  | "Beer"
  | "Wine"
  | "Spirits"
  | "Shots"
  | "Non-Alc";

export interface Drink {
  id: string;
  name: string;
  category: DrinkCategory;
  emoji: string;
  basePrice: number;
  currentPrice: number;
  costPrice: number;
  minPriceMultiplier: number;
  maxPriceMultiplier: number;
  isDynamic: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PricePoint {
  ts: number;
  price: number;
}

export interface CrashEvent {
  id: string;
  startedAt: string;
  endsAt: string;
  discountPercent: number;
  triggeredBy: string;
  triggeredVia: "manual" | "scheduled" | "social" | "event";
  totalOrdersDuringCrash: number;
  totalRevenueDuringCrash: number;
  cancelledEarly: boolean;
}

export interface OrderLine {
  id: string;
  orderId: string;
  drinkId: string;
  drinkNameSnapshot: string;
  basePriceSnapshot: number;
  pricePaid: number;
  marketPriceAtPurchase: number;
  quantity: number;
  lineTotal: number;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  shiftId: string;
  staffId: string;
  status: "open" | "paid" | "voided" | "refunded";
  subtotal: number;
  gstAmount: number;
  total: number;
  crashEventId: string | null;
  crashDiscount: number;
  paymentMethod: "card" | "cash" | "split";
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  refundedAt: string | null;
  refundAmount: number;
  notes: string | null;
  createdAt: string;
  lines: OrderLine[];
}

export interface Settings {
  decayRate: number;
  noiseLevel: number;
  volatility: number;
  minPriceMultiplier: number;
  maxPriceMultiplier: number;
  minMarginMultiplier: number;
  tickIntervalMs: number;
  gstRate: number;
  crashCooldownMs: number;
  perShiftMaxDiscount: number;
  tradingOpen: string;
  tradingClose: string;
}

export interface AuditEntry {
  id: string;
  ts: string;
  actor: string;
  action: string;
  detail: Record<string, unknown>;
}

export type RealtimeEvent =
  | { type: "price.tick"; payload: { drinkId: string; currentPrice: number; ts: number }[] }
  | { type: "price.update"; payload: { drinkId: string; currentPrice: number; ts: number }[] }
  | { type: "crash.started"; payload: CrashEvent }
  | { type: "crash.tick"; payload: { remainingSeconds: number } }
  | { type: "crash.ended"; payload: { crashEventId: string; cancelledEarly: boolean } }
  | { type: "order.placed"; payload: { id: string; orderNumber: number; total: number; lineCount: number; ts: string } }
  | { type: "drink.updated"; payload: Drink }
  | { type: "settings.updated"; payload: Settings };
