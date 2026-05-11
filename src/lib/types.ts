export type DrinkCategory =
  | "Cocktails"
  | "Beer"
  | "Wine"
  | "Spirits"
  | "Shots"
  | "Non-Alc";

export interface Drink {
  id: string;
  ticker: string;
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
  triggeredVia: "manual" | "scheduled" | "social" | "event" | "closing-bell";
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
  cashAdjustment: number;
  crashEventId: string | null;
  crashDiscount: number;
  paymentMethod: "card" | "cash" | "split";
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  refundedAt: string | null;
  refundAmount: number;
  notes: string | null;
  idCheck: boolean;
  idempotencyKey: string | null;
  paymentChargeId: string | null;
  cashTendered: number | null;
  tipAmount: number;
  discountAmount: number;
  discountReason: string | null;
  barAcked: boolean;
  barAckedAt: string | null;
  barAckedBy: string | null;
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

export type StaffRole = "staff" | "manager" | "admin" | "owner";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  pinHash: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

export interface RefusalEntry {
  id: string;
  ts: string;
  staffId: string;
  reason: "intoxication" | "id" | "behaviour" | "other";
  notes: string;
}

export interface Shift {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  zReport?: ZReport;
}

export interface ZReport {
  shiftId: string;
  openedAt: string;
  closedAt: string;
  orders: number;
  revenue: number;
  gst: number;
  subtotalExGst: number;
  cogsEstimate: number;
  drinkCounts: Record<string, { name: string; count: number; revenue: number }>;
  crashCount: number;
  crashRevenue: number;
  voids: number;
  refunds: number;
  paymentBreakdown: Record<string, { count: number; total: number }>;
}

export interface ScheduledCrash {
  id: string;
  fireAt: string;
  discountPercent: number;
  durationSeconds: number;
  label?: string;
  fired: boolean;
  cancelled: boolean;
}

export interface MarginAlert {
  drinkId: string;
  drinkName: string;
  enteredAt: string;
  floor: number;
}

export type RealtimeEvent =
  | { type: "price.tick"; payload: { drinkId: string; currentPrice: number; ts: number }[] }
  | { type: "price.update"; payload: { drinkId: string; currentPrice: number; ts: number }[] }
  | { type: "crash.started"; payload: CrashEvent }
  | { type: "crash.tick"; payload: { remainingSeconds: number } }
  | { type: "crash.ended"; payload: { crashEventId: string; cancelledEarly: boolean } }
  | { type: "order.placed"; payload: { id: string; orderNumber: number; total: number; lineCount: number; ts: string } }
  | { type: "order.updated"; payload: { id: string; barAcked: boolean; status: Order["status"] } }
  | { type: "drink.updated"; payload: Drink }
  | { type: "drink.deleted"; payload: { drinkId: string } }
  | { type: "settings.updated"; payload: Settings };
