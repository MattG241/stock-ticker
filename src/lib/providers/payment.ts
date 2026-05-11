import { ulid } from "ulid";
import Stripe from "stripe";

export type TerminalStatus = "connected" | "disconnected" | "busy";

export interface PaymentResult {
  ok: boolean;
  chargeId: string;
  provider: string;
  amountCents: number;
  raw?: unknown;
  reason?: string;
}

export interface RefundResult {
  ok: boolean;
  refundId: string;
  amountCents: number;
  provider: string;
  reason?: string;
}

export interface PaymentProvider {
  name: string;
  chargeAmount(orderId: string, amountCents: number, terminalId: string): Promise<PaymentResult>;
  refundCharge(chargeId: string, amountCents: number): Promise<RefundResult>;
  getTerminalStatus(terminalId: string): Promise<TerminalStatus>;
}

class SimulatedProvider implements PaymentProvider {
  name = "simulated";
  async chargeAmount(_orderId: string, amountCents: number): Promise<PaymentResult> {
    return {
      ok: true,
      chargeId: `sim_${ulid()}`,
      provider: this.name,
      amountCents,
    };
  }
  async refundCharge(_chargeId: string, amountCents: number): Promise<RefundResult> {
    return {
      ok: true,
      refundId: `simr_${ulid()}`,
      provider: this.name,
      amountCents,
    };
  }
  async getTerminalStatus(): Promise<TerminalStatus> {
    return "connected";
  }
}

let cachedStripe: Stripe | null = null;
function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cachedStripe) {
    cachedStripe = new Stripe(key);
  }
  return cachedStripe;
}

/**
 * Stripe Terminal flow:
 * 1. Create a PaymentIntent for the order amount with payment_method_types=['card_present']
 *    and capture_method='automatic'.
 * 2. Process the PaymentIntent on a registered Reader via stripe.terminal.readers.processPaymentIntent.
 * 3. Poll the Reader or wait for a webhook (stripe.terminal.reader.action.succeeded /
 *    .failed) - in practice, the Reader confirms the charge synchronously when the customer taps.
 *
 * The READER_ID env var should point at a registered Reader (BBPOS WisePOS E). For multi-bar
 * setups, pass `terminalId` per call.
 */
class StripeTerminalProvider implements PaymentProvider {
  name = "stripe-terminal";

  async chargeAmount(orderId: string, amountCents: number, terminalId: string): Promise<PaymentResult> {
    const stripe = stripeClient();
    if (!stripe) {
      return {
        ok: false,
        chargeId: "",
        provider: this.name,
        amountCents,
        reason: "STRIPE_SECRET_KEY not set",
      };
    }
    const readerId = terminalId === "default" ? process.env.STRIPE_TERMINAL_READER_ID : terminalId;
    if (!readerId) {
      return {
        ok: false,
        chargeId: "",
        provider: this.name,
        amountCents,
        reason: "STRIPE_TERMINAL_READER_ID not set",
      };
    }
    try {
      const intent = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency: "aud",
          payment_method_types: ["card_present"],
          capture_method: "automatic",
          metadata: { orderId },
        },
        { idempotencyKey: `order:${orderId}` },
      );
      await stripe.terminal.readers.processPaymentIntent(readerId, {
        payment_intent: intent.id,
      });
      // The reader confirms async via webhook. Optimistically return ok with
      // the PI id; caller may reconcile via /v1/payment_intents/{id} later.
      return {
        ok: true,
        chargeId: intent.id,
        provider: this.name,
        amountCents,
        raw: { paymentIntentId: intent.id, readerId },
      };
    } catch (err) {
      return {
        ok: false,
        chargeId: "",
        provider: this.name,
        amountCents,
        reason: err instanceof Error ? err.message : "Stripe error",
      };
    }
  }

  async refundCharge(chargeId: string, amountCents: number): Promise<RefundResult> {
    const stripe = stripeClient();
    if (!stripe) {
      return {
        ok: false,
        refundId: "",
        provider: this.name,
        amountCents,
        reason: "STRIPE_SECRET_KEY not set",
      };
    }
    try {
      const refund = await stripe.refunds.create({
        payment_intent: chargeId,
        amount: amountCents,
      });
      return {
        ok: true,
        refundId: refund.id,
        provider: this.name,
        amountCents,
      };
    } catch (err) {
      return {
        ok: false,
        refundId: "",
        provider: this.name,
        amountCents,
        reason: err instanceof Error ? err.message : "Stripe error",
      };
    }
  }

  async getTerminalStatus(terminalId: string): Promise<TerminalStatus> {
    const stripe = stripeClient();
    if (!stripe) return "disconnected";
    const readerId = terminalId === "default" ? process.env.STRIPE_TERMINAL_READER_ID : terminalId;
    if (!readerId) return "disconnected";
    try {
      const reader = await stripe.terminal.readers.retrieve(readerId);
      if ("deleted" in reader && reader.deleted) return "disconnected";
      return (reader as Stripe.Terminal.Reader).status === "online" ? "connected" : "disconnected";
    } catch {
      return "disconnected";
    }
  }
}

class SquareProvider implements PaymentProvider {
  name = "square";
  async chargeAmount(_orderId: string, amountCents: number): Promise<PaymentResult> {
    return {
      ok: false,
      chargeId: "",
      provider: this.name,
      amountCents,
      reason: "Square adapter not implemented",
    };
  }
  async refundCharge(_chargeId: string, amountCents: number): Promise<RefundResult> {
    return {
      ok: false,
      refundId: "",
      provider: this.name,
      amountCents,
      reason: "Square adapter not implemented",
    };
  }
  async getTerminalStatus(): Promise<TerminalStatus> {
    return "disconnected";
  }
}

export function getPaymentProvider(): PaymentProvider {
  switch (process.env.PAYMENT_PROVIDER) {
    case "stripe":
      return new StripeTerminalProvider();
    case "square":
      return new SquareProvider();
    default:
      return new SimulatedProvider();
  }
}
