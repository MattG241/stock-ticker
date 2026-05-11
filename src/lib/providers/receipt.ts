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
  const lines = order.lines
    .map((l) => `  ${l.quantity} x ${l.drinkNameSnapshot}  ${formatAud(l.lineTotal)}`)
    .join("\n");
  return [
    "THE DRINK EXCHANGE",
    `Order #${order.orderNumber}`,
    new Date(order.createdAt).toLocaleString("en-AU", { timeZone: "Australia/Adelaide" }),
    "",
    lines,
    "",
    `Subtotal (inc GST): ${formatAud(order.total)}`,
    `GST included:      ${formatAud(order.gstAmount)}`,
    order.crashDiscount > 0
      ? `Crash discount: ${Math.round(order.crashDiscount * 100)}%`
      : "",
    `Payment: ${order.paymentMethod}`,
    "",
    "Trade Drinks. Not Stocks.",
  ]
    .filter(Boolean)
    .join("\n");
}
