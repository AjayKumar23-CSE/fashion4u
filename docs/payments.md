# Payments (Razorpay)

Online payment and cash on delivery both run through `POST /checkout/orders`.
The gateway sits behind the `PaymentGateway` interface in
`apps/api/src/payments/gateway.ts`, so swapping to Cashfree or PayU later means
writing one new implementation, not touching the order code.

## Turning it on

Test keys work the moment you sign up — no KYC, no live website.

1. Razorpay dashboard → switch to **Test mode** → Settings → API Keys →
   Generate Test Key.
2. Put them in `apps/api/.env`:

```bash
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
```

3. Restart the API. Until these are set, COD works normally and choosing
   online payment returns `PAYMENTS_NOT_CONFIGURED`.

The key id is deliberately sent to the browser — Razorpay's checkout needs it.
The secret never leaves the server.

## The webhook, and why it is the source of truth

The browser callback is a convenience: it makes the confirmation page appear
instantly. It is not proof of payment, because the customer can close the tab,
lose signal, or tamper with the request. **The webhook decides whether an order
is paid.**

Razorpay cannot reach `localhost`, so open a tunnel while developing:

```bash
cloudflared tunnel --url http://localhost:4000
```

Then in the dashboard → Settings → Webhooks → Add:

- URL: `https://<tunnel>/api/v1/webhooks/payment`
- Secret: anything you choose — put the same value in `.env` as
  `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`, `payment.failed`

Signatures are verified against the exact bytes received, which is why the API
is started with `rawBody: true` in `main.ts`. Parsing and re-serialising the
JSON would change the whitespace and every signature would fail.

## Test payments

| Method | Value |
|---|---|
| Card (domestic) | `5267 3181 8797 5449`, any future expiry, any CVV |
| OTP on the bank screen | `1111` |
| UPI success | `success@razorpay` |
| UPI failure | `failure@razorpay` |

No real money moves in test mode.

**Do not use `4111 1111 1111 1111`.** It is the generic Visa test number and
Razorpay treats it as an international card, so a new account rejects it with
"International cards are not supported". That is an account setting, not a
problem with the integration. Use the domestic Mastercard number above, or
enable international payments in the dashboard.

**Use a realistic mobile number** at checkout. Razorpay's own form rejects
obviously sequential numbers such as `9876543210` with "Please enter a valid
mobile number", which looks like a bug in the store but is not.

When both `contact` and `email` are prefilled, Razorpay skips its contact step
and opens straight on the payment methods. The checkout page already sends
both, so filling in the optional email field makes for a shorter checkout.

## How an order is made

```
POST /checkout/orders   recalculate the bag → reserve stock → create the order
                        → ask Razorpay for a gateway order
browser                 Razorpay checkout opens, customer pays
POST /checkout/verify   signature check, so the page can move on at once
POST /webhooks/payment  the real decision: mark paid, commit stock
```

Rules the code enforces:

- **The amount is never taken from the browser.** Totals are recomputed from
  the database in `PricingService` before the gateway order is created.
- **An `Idempotency-Key` header is required** on order creation. A retry with
  the same key returns the original order instead of charging twice.
- **Stock is held, not sold, while paying.** `variant.reserved` goes up when
  the order is created and converts to a real stock decrement only when payment
  is confirmed.
- **Unpaid orders expire.** `PaymentTimeoutService` runs every minute and
  releases anything still `PAYMENT_PENDING` after 15 minutes.
- **Marking paid is idempotent.** The browser callback and the webhook race
  each other; whichever arrives first wins and the second is a no-op.
- **COD has its own path.** No gateway is involved: the order is `PLACED`
  immediately, a COD fee is added, and orders above `cod_max_order_value` are
  refused.

## Money settings

Stored in the `setting` table as integer paise, editable later from admin (A-13):

| Key | Default |
|---|---|
| `shipping_fee` | ₹79 |
| `free_shipping_threshold` | ₹999 |
| `cod_fee` | ₹49 |
| `prepaid_discount_percent` | 5 |
| `cod_max_order_value` | ₹5,000 |

## Going live

1. Complete KYC (see the activation checklist in the dashboard).
2. Generate live keys and replace `rzp_test_…` with `rzp_live_…`.
3. Add a webhook for the production URL with its own secret.
4. Place one real low-value order of each type, prepaid and COD, then refund
   the prepaid one to confirm the whole loop.

## Not built yet

- Refunds through the gateway API (`Refund` model and `gateway.refund()` exist;
  nothing calls them yet)
- `refund.processed` webhook handling
- Customer OTP login, so orders are currently tied to a phone number rather
  than a signed-in account
- Per-user coupon usage limits, which need that login
- Payment reconciliation and the admin payments screen (A-11)
