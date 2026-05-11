import type { Order } from "../types";
import { formatAud } from "../money";

export interface ReceiptDestination {
  channel: "email" | "sms" | "print";
  to: string;
}

export interface ReceiptResult {
  ok: boolean;
  channel: ReceiptDestination["channel"];
  to: string;
  reason?: string;
}

export interface ReceiptProvider {
  name: string;
  send(order: Order, dest: ReceiptDestination): Promise<ReceiptResult>;
}

class ConsoleReceiptProvider implements ReceiptProvider {
  name = "console";
  async send(order: Order, dest: ReceiptDestination): Promise<ReceiptResult> {
    console.log("[receipt]", dest.channel, "->", dest.to, "order", order.orderNumber, formatAud(order.total));
    return { ok: true, channel: dest.channel, to: dest.to };
  }
}

class TwilioReceiptProvider implements ReceiptProvider {
  name = "twilio";
  async send(_order: Order, dest: ReceiptDestination): Promise<ReceiptResult> {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return {
        ok: false,
        channel: dest.channel,
        to: dest.to,
        reason: "Twilio credentials missing",
      };
    }
    return {
      ok: false,
      channel: dest.channel,
      to: dest.to,
      reason: "Twilio adapter not implemented",
    };
  }
}

class PostmarkReceiptProvider implements ReceiptProvider {
  name = "postmark";
  async send(_order: Order, dest: ReceiptDestination): Promise<ReceiptResult> {
    if (!process.env.POSTMARK_TOKEN) {
      return {
        ok: false,
        channel: dest.channel,
        to: dest.to,
        reason: "POSTMARK_TOKEN missing",
      };
    }
    return {
      ok: false,
      channel: dest.channel,
      to: dest.to,
      reason: "Postmark adapter not implemented",
    };
  }
}

export function getReceiptProvider(): ReceiptProvider {
  switch (process.env.RECEIPT_PROVIDER) {
    case "twilio":
      return new TwilioReceiptProvider();
    case "postmark":
      return new PostmarkReceiptProvider();
    default:
      return new ConsoleReceiptProvider();
  }
}

export function renderReceiptText(order: Order): string {
  const businessName = process.env.BUSINESS_NAME ?? "The Drink Exchange Pty Ltd";
  const abn = process.env.BUSINESS_ABN ?? "00 000 000 000";
  const address = process.env.BUSINESS_ADDRESS ?? "Adelaide, South Australia";
  const lines = order.lines
    .map((l) => `  ${l.quantity} x ${l.drinkNameSnapshot}  ${formatAud(l.lineTotal)}`)
    .join("\n");
  const exGst = (order.total - order.gstAmount).toFixed(2);
  const labelWidth = 18;
  const fmt = (label: string, value: string) =>
    `${label.padEnd(labelWidth)} ${value.padStart(10)}`;
  return [
    "THE DRINK EXCHANGE",
    "Tax Invoice",
    "",
    businessName,
    `ABN ${abn}`,
    address,
    "",
    `Order ${order.orderNumber.toString().padStart(4, "0")} - ${order.id}`,
    new Date(order.createdAt).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" }),
    `Shift ${order.shiftId}`,
    "",
    lines,
    "-----------------------------",
    fmt("Subtotal ex-GST", `$${exGst}`),
    fmt("GST 10%", `$${order.gstAmount.toFixed(2)}`),
    order.cashAdjustment !== 0 ? fmt("Cash 5c round", `$${order.cashAdjustment.toFixed(2)}`) : "",
    fmt("Total inc GST", `$${order.total.toFixed(2)}`),
    "",
    order.crashDiscount > 0
      ? `Market crash applied: ${Math.round(order.crashDiscount * 100)}% off dynamic drinks`
      : "",
    `Payment method: ${order.paymentMethod}`,
    order.paymentChargeId ? `Charge id: ${order.paymentChargeId}` : "",
    "",
    "Thank you. Drink responsibly.",
    "Trade Drinks. Not Stocks.",
  ]
    .filter(Boolean)
    .join("\n");
}
