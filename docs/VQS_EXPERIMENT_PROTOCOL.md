# Visual Quality Score (VQS) Calibration Protocol: Blind Designer Experiment

**Document Version:** 1.0  
**Status:** Ready for Execution (Pending Participant Recruitment)  
**Target Milestone:** Phase 5 / Phase 6 Research Validation  
**Owner:** GDP Research & Design Systems Engineering  

---

## 1. Executive Summary & Problem Statement

The automated Visual Quality Score (VQS) evaluates objective heuristic rules: font counts, contrast ratios, geometry boundaries, and layout collision. However, as established in **D-18**, automated technical checks can pass designs with high scores (90+) that professional graphic designers would consider aesthetically weak or commercially unviable (e.g. sparse layouts where only 5% of the canvas carries content).

This experiment calibrates the automated VQS against blind professional design judgment and consumer willingness to pay (WTP) to determine the correlation, precision, and false-positive rates of automated scoring.

---

## 2. Hypotheses

* **Primary Hypothesis ($H_1$):** VQS v1.1 total score has a statistically significant positive rank correlation (Spearman $\rho \ge 0.65, p < 0.01$) with blinded professional designer visual quality ratings (1–5 Likert scale).
* **Secondary Hypothesis ($H_2$):** VQS scores $\ge 85$ have a high positive predictive value ($\ge 80\%$) for commercial willingness to pay ($WTP > \$0$).
* **Null Hypothesis ($H_0$):** There is no significant correlation between automated VQS scores and blinded human designer ratings ($\rho < 0.30$ or $p \ge 0.05$).

---

## 3. Participant Inclusion Criteria & Recruitment

### Target Sample Size
* **Designs Sampled ($N$):** 50 distinct generated promo designs (spanning SMB promotions, retail sales, church/ministry events, and beauty/dining).
* **Rater Sample Size ($M$):** 10 qualified professional graphic designers / creative directors.
* **Observations per Design:** Each design evaluated by at least 5 independent raters.
* **Total Observations Target:** $50 \times 5 = 250$ blinded ratings.

### Inclusion Criteria for Raters
1. Minimum 2+ years of professional graphic design, art direction, or commercial marketing design experience.
2. Verified portfolio or active design role.
3. No prior exposure to GDP internal prompt templates, VQS algorithm internals, or archetype code.

---

## 4. Blinding Methodology & Experimental Controls

1. **Strict Double-Blinding:**
   * Raters access the research portal via unique, unguessable pseudonymous tokens (`/research/experiment/[token]`).
   * The rating interface displays **only** the rendered high-resolution design preview.
   * **Zero metadata** is exposed: no VQS scores, no style direction names, no prompt texts, no component grades, and no model names.
2. **Randomization:**
   * Presentation order of design samples is fully randomized per rater to eliminate sequence and fatigue bias.
3. **Idempotency & Integrity:**
   * Each token can submit each sample rating exactly once. Duplicate submissions are rejected.

---

## 5. Rating Rubric & Metrics

Raters score each design across five dimensions:

| Metric | Type | Scale | Description |
|---|---|---|---|
| **Visual Quality** | Ordinal | 1 (Poor) – 5 (Exceptional) | Overall aesthetic harmony, polish, and graphic craft. |
| **Professionalism** | Ordinal | 1 (Amateur) – 5 (Agency Grade) | Would this appear credible if published by an established business? |
| **Hierarchy & Clarity** | Ordinal | 1 (Chaotic) – 5 (Immediate) | Does the offer/headline read instantly without confusion? |
| **Likelihood to Use** | Ordinal | 1 (Never) – 5 (Definitely) | Likelihood the rater would publish or recommend this asset. |
| **Willingness to Pay (WTP)** | Categorical | $0, $1–$3, $3–$5, $5–$10, $10+ | Estimated commercial value of this promo pack asset. |
| **Qualitative Notes** | Text | Optional | Specific defects (e.g. dead space, bad kerning, weak contrast). |

---

## 6. Analysis Plan & Statistical Methods

The analysis script (`scripts/vqs-correlation-report.ts` and `/api/admin/experiments/[id]/report`) computes:

1. **Correlation Analysis:**
   * **Pearson Correlation Coefficient ($r$):** Linear relationship between VQS and average visual rating.
   * **Spearman Rank Correlation ($\rho$):** Monotonic rank relationship (robust to non-linear rating distributions).
2. **Predictive Performance:**
   * **Receiver Operating Characteristic (ROC) & AUC:** Ability of VQS to classify "Commercially Acceptable" (average human score $\ge 3.5$).
3. **Disagreement Analysis (False Positive / False Negative Matrix):**
   * **Type I (Algorithm False Positive):** High VQS ($\ge 85$), Low Human Score ($< 3.0$). Focus: why did the rule engine fail to catch the defect? (e.g. content density, clumsy font pairing).
   * **Type II (Algorithm False Negative):** Low VQS ($< 80$), High Human Score ($\ge 4.0$). Focus: which rule was overly punitive? (e.g. intentional tight margin, creative off-palette accent).
4. **Inter-Rater Reliability:**
   * Fleiss' kappa or Kendall's W across raters to measure rating consensus.

---

## 7. Outliers, Missing Data & Ethics

* **Incomplete Sessions:** Sessions where a rater evaluates fewer than 10 designs are flagged as incomplete and excluded from final correlation statistics.
* **Speed Outliers:** Ratings submitted in under 2.5 seconds are flagged for speed review and potential exclusion.
* **Privacy & Consent:** Raters explicitly consent to aggregated, anonymized analysis before rating. No private personal data is published.

---

## 8. Success Criteria & Next Actions

| Outcome | Criteria | Decision Consequence |
|---|---|---|
| **Success** | $\rho \ge 0.65$ and False Positive Rate $\le 15\%$ | VQS is validated as customer quality promise (D-01). Move to Phase 6 beta. |
| **Partial Calibration** | $0.45 \le \rho < 0.65$ | Retain VQS in advisory mode. Recalibrate component weights on human regression. |
| **Failure** | $\rho < 0.45$ or False Positive Rate $> 25\%$ | Recompose QA gate. Automated VQS cannot serve as a commercial guarantee. |
