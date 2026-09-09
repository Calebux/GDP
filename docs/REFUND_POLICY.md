# GDP Refund Policy & Dispute Runbook

## 1. Economic Context & Product Architecture

At an entry price point of **$2.99** (or regional local currency equivalent ~₦4,500), payment processing fees consume a fixed floor ($0.30 + 2.9% = ~$0.39 or 13.0% of gross on Stripe; 1.5% + ₦100 on Paystack). 

Furthermore, payment processors often charge non-refundable dispute fees ($15.00+ on Stripe, chargeback penalties on Paystack). Therefore, the GDP refund policy is architected to eliminate customer surprises before purchase while providing fair, automated resolution for genuine technical failures.

---

## 2. The Pre-Purchase Preview Guarantee (D-03)

Under **Decision D-03**, every customer receives:
1. **Three Complete Concepts**: Rendered with their actual text, brand colors, and photos.
2. **Full Visual Inspection**: The watermarked preview shows the exact typographic hierarchy, imagery, and layout before any payment is initiated.
3. **Outcome Approval**: Payment is only made to *unlock* the high-resolution, unwatermarked files across all 8 formats.

Because the customer sees the finished design before paying, subjective claims of "I don't like the design style" after downloading unwatermarked assets are not eligible for refunds.

---

## 3. Eligible Refund Scenarios

GDP honors refunds under the following verified conditions within **48 hours** of purchase:

| Trigger | Verification Criteria | Default Remedy |
| :--- | :--- | :--- |
| **Technical Packaging Failure** | ZIP export failed, download link returns 500/404, or ZIP archive contains corrupted/empty files that auto-repackaging cannot resolve within 1 hour. | Full refund to payment method OR 2 pack credits. |
| **Duplicate Billing** | Customer was charged twice for the same pack ID or single checkout session due to network timeout. | Immediate automated refund of the duplicate charge. |
| **Severe Rendering Discrepancy** | High-res unwatermarked render has missing text or visual layers that were present in the preview approved by the customer. | Free design re-render + 1 bonus credit OR full refund. |
| **VQS Engine Error** | Exported design suffered critical QA failure (> 50 pt composition penalty) that slipped through QA gate. | Full refund + credit grant. |

---

## 4. Ineligible Scenarios

- **Post-Download Remorse**: The customer downloaded all high-resolution unwatermarked PNG/PDF assets and subsequently requested a refund due to event cancellation or personal preference changes.
- **Customer Typos**: Misspellings, wrong dates, or incorrect venues entered by the customer in the brief. (These are corrected **free of charge** via D-04 Detail-Fixer without purchasing a new pack).
- **Requests Beyond 48 Hours**: Requests submitted after the 48-hour post-purchase inspection window.

---

## 5. Administrative Refund Endpoint

Admins and automated dispute handlers execute refunds via:

```http
POST /api/admin/orders/:id/refund
Headers:
  Authorization: Bearer <VISION_SERVICE_SECRET>
  Content-Type: application/json

Body:
{
  "reason": "packaging_failure",
  "comment": "ZIP generation corrupted due to disk IO error",
  "remedy": "refund_to_card"  // "refund_to_card" | "credit_wallet"
}
```

### Safety Flags
- `ENABLE_AUTO_REFUNDS=false` (default): All refund requests are queued for manual administrative review.
- When `ENABLE_AUTO_REFUNDS=true`: Qualified duplicate billing and verified download error reports are processed immediately via the originating gateway API.

---

## 6. Real-World Validation Boundary

> [!IMPORTANT]
> - **Code-Verified**: Order status updates to `refunded`, wallet transaction reversal, audit logging, and admin API endpoints are verified in test suites.
> - **Real-World Validation (Pending)**: Real gateway refund execution (issuing actual credit back to customer Mastercard/Visa or Nigerian bank account) requires live gateway API keys and production transactions.
