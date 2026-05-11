import { ulid } from "ulid";

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
  async chargeAmount(orderId: string, amountCents: number): Promise<PaymentResult> {
    return {
      ok: true,
      chargeId: `sim_${ulid()}`,
      provider: this.name,
      amountCents,
    };
  }
  async refundCharge(chargeId: string, amountCents: number): Promise<RefundResult> {
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

class StripeTerminalProvider implements PaymentProvider {
  name = "stripe-terminal";
  async chargeAmount(orderId: string, amountCents: number, terminalId: string): Promise<PaymentResult> {
    // Wire up the real Stripe Terminal SDK here. We intentionally fail in dev
    // when STRIPE_SECRET_KEY is missing so accidental production traffic
    // hits a loud error rather than a silent simulation.
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        ok: false,
        chargeId: "",
        provider: this.name,
        amountCents,
        reason: "STRIPE_SECRET_KEY not set",
      };
    }
    return {
      ok: false,
      chargeId: "",
      provider: this.name,
      amountCents,
      reason: "Stripe Terminal adapter not implemented",
    };
  }
  async refundCharge(chargeId: string, amountCents: number): Promise<RefundResult> {
    return {
      ok: false,
      refundId: "",
      provider: this.name,
      amountCents,
      reason: "Stripe Terminal adapter not implemented",
    };
  }
  async getTerminalStatus(): Promise<TerminalStatus> {
    return "disconnected";
  }
}

class SquareProvider implements PaymentProvider {
  name = "square";
  async chargeAmount(orderId: string, amountCents: number): Promise<PaymentResult> {
    return {
      ok: false,
      chargeId: "",
      provider: this.name,
      amountCents,
      reason: "Square adapter not implemented",
    };
  }
  async refundCharge(chargeId: string, amountCents: number): Promise<RefundResult> {
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
