import {
  pgTable,
  text,
  numeric,
  boolean,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const drinks = pgTable("drinks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  emoji: text("emoji").notNull(),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  currentPrice: numeric("current_price", { precision: 10, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }).notNull(),
  minPriceMultiplier: numeric("min_price_multiplier", { precision: 6, scale: 3 }).notNull().default("0.5"),
  maxPriceMultiplier: numeric("max_price_multiplier", { precision: 6, scale: 3 }).notNull().default("2.5"),
  isDynamic: boolean("is_dynamic").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceHistory = pgTable("price_history", {
  id: text("id").primaryKey(),
  drinkId: text("drink_id").notNull().references(() => drinks.id),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
});

export const crashEvents = pgTable("crash_events", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 4, scale: 3 }).notNull(),
  triggeredBy: text("triggered_by").notNull(),
  triggeredVia: text("triggered_via").notNull(),
  totalOrdersDuringCrash: integer("total_orders_during_crash").notNull().default(0),
  totalRevenueDuringCrash: numeric("total_revenue_during_crash", { precision: 12, scale: 2 }).notNull().default("0"),
  cancelledEarly: boolean("cancelled_early").notNull().default(false),
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    pinHash: text("pin_hash").notNull(),
    role: text("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ emailIdx: uniqueIndex("users_email_idx").on(t.email) }),
);

export const shifts = pgTable("shifts", {
  id: text("id").primaryKey(),
  openedBy: text("opened_by").notNull(),
  closedBy: text("closed_by"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: integer("order_number").notNull(),
  shiftId: text("shift_id").notNull().references(() => shifts.id),
  staffId: text("staff_id").notNull(),
  status: text("status").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  gstAmount: numeric("gst_amount", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  crashEventId: text("crash_event_id"),
  crashDiscount: numeric("crash_discount", { precision: 4, scale: 3 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: text("void_reason"),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderLines = pgTable("order_lines", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  drinkId: text("drink_id").notNull().references(() => drinks.id),
  drinkNameSnapshot: text("drink_name_snapshot").notNull(),
  basePriceSnapshot: numeric("base_price_snapshot", { precision: 10, scale: 2 }).notNull(),
  pricePaid: numeric("price_paid", { precision: 10, scale: 2 }).notNull(),
  marketPriceAtPurchase: numeric("market_price_at_purchase", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: jsonb("detail").notNull(),
});
