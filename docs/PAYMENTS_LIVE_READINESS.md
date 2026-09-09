# GDP Live Payment Readiness & Operational Runbook (D-06)

This document establishes the operational checklist, security requirements, and verification protocols for operating live payment gateways across Stripe, Paystack, and Flutterwave.

---

## 1. Gateway Support Matrix

| Provider | Supported Region / Currency | Channels | Webhook Signature Header | Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **Stripe** | Global / USD, GBP, EUR | Card, Apple Pay, Google Pay | `stripe-signature` | `stripe.webhooks.constructEvent` |
| **Paystack** | Nigeria & West Africa / NGN | Card, Bank, USSD, Bank Transfer | `x-paystack-signature` | HMAC-SHA512 with `crypto.timingSafeEqual` |
| **Flutterwave** | Pan-Africa / NGN, KES, GHS, USD | Card, USSD, Bank Transfer, M-Pesa | `verif-hash` | Timing-safe secret token comparison |
| **Dev Mock** | Local development only | Mock Instant Checkout | `x-signature` | Blocked in production unless `DEV_PAYMENT_OVERRIDE=true` |

---

## 2. Environment Variables & Secret Configuration

To enable live processing, set the following environment variables in your deployment environment:

```env
# Master Safety Switch (Must be explicitly true to enable live transactions)
ENABLE_LIVE_PAYMENTS=true

# Development Override (MUST be false in production)
DEV_PAYMENT_OVERRIDE=false

# Active Provider Routing ('stripe', 'paystack', 'flutterwave', or 'dev')
PAYMENT_PROVIDER=stripe

# Public Application URL (Used for callback and redirect URLs)
APP_URL=https://app.gdp.design

# Stripe Credentials
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Paystack Credentials
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_WEBHOOK_SECRET=...

# Flutterwave Credentials
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-...
FLUTTERWAVE_WEBHOOK_SECRET=...
```

> [!WARNING]
> By default, `ENABLE_LIVE_PAYMENTS=false`. If set to `false`, all payment requests route safely through `DevPaymentProvider`. `DevPaymentProvider` will throw a runtime error in production if `DEV_PAYMENT_OVERRIDE` is not set to `true`.

---

## 3. Webhook Endpoints & Delivery Idempotency

### Webhook Endpoints
- **Stripe**: `POST https://app.gdp.design/api/webhooks/stripe`
- **Paystack**: `POST https://app.gdp.design/api/webhooks/paystack`
- **Flutterwave**: `POST https://app.gdp.design/api/webhooks/flutterwave`
- **Multiplexer**: `POST https://app.gdp.design/api/webhooks/payment`

### Idempotency Guarantee
Every incoming webhook extracts a unique event identifier (`eventId`) and records it in PostgreSQL `processed_webhooks` table via `packRepository.recordProcessedWebhook()`. 
If a webhook is re-delivered by a provider due to network latency, GDP checks:
1. `processed_webhooks` table for identical `eventId`.
2. `orders` table status (`order.status === "paid"`).
If either condition is met, GDP immediately returns HTTP 200 `{ received: true, duplicate: true }` without double-granting credits or re-triggering packaging.

### Timing-Safe Signature Verification
Both Paystack (HMAC-SHA512) and Flutterwave (`verif-hash`) employ constant-time buffer comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks on secret keys.

---

## 4. Reconciliation Procedures & Auto-Healing

If a customer pays but closes their browser before the redirect, or if a webhook fails to deliver:

### CLI Audit & Reconcile
```bash
# Audit discrepancies (dry run)
npx tsx scripts/payments-reconcile.ts

# Auto-heal pending orders verified as paid on provider
npx tsx scripts/payments-reconcile.ts --auto-heal
```

### Admin API Endpoint
```http
POST /api/admin/payments/reconcile?autoHeal=true
Headers:
  Authorization: Bearer <VISION_SERVICE_SECRET>
```

The reconciliation runner:
1. Identifies all orders with status `pending`.
2. Calls the provider's active verification endpoint (`verifyPayment`).
3. If the provider confirms payment, updates order status to `paid`, grants wallet credits, consumes 1 credit for the pack, and queues async high-res ZIP packaging.
4. Logs discrepancies in audit reports.

---

## 5. Live Production Deployment Checklist

- [ ] Webhook URLs configured in provider developer dashboards:
  - Stripe Dashboard -> Webhooks -> Add endpoint -> `https://<domain>/api/webhooks/stripe` (Events: `checkout.session.completed`)
  - Paystack Dashboard -> Settings -> Preferences -> Webhook URL -> `https://<domain>/api/webhooks/paystack`
  - Flutterwave Dashboard -> Settings -> Webhooks -> URL -> `https://<domain>/api/webhooks/flutterwave`, Secret Hash set.
- [ ] Database migration `0000_fluffy_thing.sql` applied to production PostgreSQL database.
- [ ] Safety switch `ENABLE_LIVE_PAYMENTS=true` set in production environment variables.
- [ ] Verify `DEV_PAYMENT_OVERRIDE=false` in production.
- [ ] Run test transaction using live gateway test cards/test bank accounts.
- [ ] Schedule nightly cron job to run `scripts/payments-reconcile.ts --auto-heal`.

---

## 6. Real-World Validation Boundary

> [!IMPORTANT]
> - **Code-Verified**: Timing-safe HMAC validation, idempotency checks, automated reconciliation, and gateway fallback logic are verified in unit tests.
> - **Real-World Validation (Pending)**: Real money transactions across Nigerian bank USSD transfers, Paystack 3D-Secure cards, and live Stripe card processing require live API keys and real bank authorization. Do not claim real-world payment verification until live financial statements and settled gateway balances are confirmed.
