// The order code talks to this, never to Razorpay directly, so swapping to
// Cashfree or PayU later means one new implementation and no changes upstream.
export interface GatewayOrder {
  id: string;
  amount: number;
}

export interface GatewayRefund {
  id: string;
  status: string;
}

export interface PaymentGateway {
  readonly name: string;
  /** Public key the browser needs to open the hosted checkout. */
  publicKey(): string;
  createOrder(input: {
    amount: number;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<GatewayOrder>;
  /** Signature returned to the browser after a successful payment. */
  verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;
  /** Signature on a webhook request, computed over the raw request body. */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  refund(paymentId: string, amount: number): Promise<GatewayRefund>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
