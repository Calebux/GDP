# Decision Record

Every entry here either **extends** the PRD or **deviates** from it. Section
references (§) point at `docs/PRD.md`. Decisions are append-only: supersede an
entry rather than editing it, so the reasoning stays auditable.

Last updated: 2026-09-01

---

## Product & pricing

### D-01 — We sell a finished promo pack, not access to software
**Status:** accepted (2026-09-01) — supersedes the subscription-first framing in §47.

The product starts with one question — *What are you promoting?* — and returns a
finished, done-for-you promo pack for a small one-time fee. The design engine is
underneath; the customer never has to know it exists.

**Why**
- It matches §59's own marketing instruction ("Professional church graphics in
  minutes", not "AI graphic-design generator") and §72's north star, but removes
  the editor from the critical path entirely.
- Buyers understand the unit. "A promo, everywhere" needs no explanation;
  "an AI design platform with credits" does.
- The engine is already outcome-shaped: `resizeCampaign()` (§28) recomposes one
  approved document into every format. The pack *is* the existing capability.

**Consequence**
- The brief (§5) collapses from a wizard to one question plus smart follow-ups.
- The editor (§22–§23) demotes from headline feature to detail-fixer (see D-04).
- The QA gate (§21, §66) becomes a customer-facing promise rather than an
  internal filter: we do not sell a design that scores below threshold.

---

### D-02 — Entry price $2.99 per pack, but bundles carry the economics
**Status:** accepted (2026-09-01) — refines §47/§48.

**The arithmetic that drives this**

| | Single pack | 5-pack bundle |
|---|---|---|
| Price | $2.99 | $9.99 |
| Payment fee (2.9% + $0.30) | $0.39 (**12.9%**) | $0.59 (**5.9%**) |
| Net | $2.60 | $9.40 |
| COGS (segmentation, render, storage) | $0.05–0.25 | $0.25–1.25 |

The fixed $0.30 per transaction — not the percentage — is what makes single-pack
pricing fragile. Bundles cut payment overhead by more than half.

**The hard constraint:** at $2.60 net, paid acquisition is impossible. A $1 CPC
converting at 5% implies ~$20 CAC against $2.60 revenue. **This model only works
on organic distribution or repeat purchase.** That is a design constraint on the
product, not a marketing problem to solve later (see D-05, D-16).

**Consequence**
- Bundles/credit wallet ship with checkout, not after it.
- Repeat purchase is the primary revenue mechanic. A church buying four packs a
  month is $12/mo — more than §47's Creator tier, with none of the subscription
  objection, and far better suited to markets where recurring card billing fails.

---

### D-03 — Free watermarked preview, pay to unlock the pack
**Status:** accepted (2026-09-01) — new.

The customer sees three finished concepts at preview resolution with a watermark
before paying. Payment unlocks full-resolution, unwatermarked files in every
format.

**Why** At $2.60 net, a single support ticket or refund destroys the margin on
several sales. Showing the actual result before payment removes almost all
refund pressure, and makes the §21 quality gate visible as value.

**Consequence** §43's "first-generation acceptance rate" becomes literally the
conversion metric: preview → purchase. It is now a revenue number, not a
research number.

---

### D-04 — Post-purchase editing is a detail-fixer, not a canvas
**Status:** accepted (2026-09-01) — narrows §22, §23.

After purchase the customer can change text, swap a photo, correct a date, and
ask for changes in words (§24). They cannot drag layers around a full editor.

- Text corrections are **free and unlimited**. A wrong date must never cost a
  support ticket.
- Regenerations are **limited** per pack, because they cost real compute.

**Why** A full Konva editor was the largest remaining build, and under D-01 it is
no longer the product. The layer model (§62) still supports one later — nothing
is thrown away, it is deferred (see D-15).

---

### D-05 — The exported design is the distribution channel
**Status:** accepted (2026-09-01) — new, and the biggest open risk.

Every pack includes a WhatsApp-status-sized asset. Previews are shareable by
link. The free tier carries a small tasteful credit; paid packs carry none.

**Why** D-02 rules out paid acquisition. Distribution has to come from the output
itself or the price point does not survive.

**Open question** This is unproven. It is the first thing beta must measure
(Phase 6), ahead of any further engine tuning.

---

### D-06 — Regional pricing from launch
**Status:** accepted (2026-09-01) — implements §47's "depending on region".

$2.99 is credible in Lagos, where a freelance flyer runs ₦5,000–20,000. In the
US/UK the same pack would clear $19, and $2.99 actively signals "cheap AI thing"
to a buyer who would have paid more.

**Consequence** Price is a function of detected region from day one, and the
checkout layer must support Paystack/Flutterwave (bank transfer, USSD, mobile
money) alongside Stripe — card-plus-3DS friction on a $2.99 purchase is severe
in the beachhead market.

---

### D-07 — Beachhead stays church and ministry graphics
**Status:** accepted (2026-09-01) — keeps §3.

D-01's framing ("a small business owner with a promotion") is broader than §3's
church wedge. We keep the wedge and let the framing be the surface language.

**Why** §3's argument still holds and is *strengthened* by per-pack pricing:
churches design weekly, so the repeat purchase D-02 depends on is native to this
market. A general SMB with an occasional promo is a worse fit for a one-time fee,
not a better one. Expansion order from §3 is unchanged.

---

### D-17 — The beachhead is US small-business promotions, not churches
**Status:** accepted (2026-09-01) — **supersedes D-07.**

The customer is a small business owner with something to promote: a Valentine's
offer, a grand opening, a Black Friday deal. The occasion changes; the need does
not.

**Why** D-01's per-pack model needs a buyer who returns for a *new occasion*, and
US SMB promotions are the densest supply of those. §3's church argument was built
around weekly recurring design volume, which per-pack pricing also serves — but
the church vertical is a narrower wedge with a harder payment story in the US.

**What it cost, concretely** — measured, not estimated:

- **The offer was being dropped entirely.** A brief saying *"20% off all gel
  sets"* produced a poster headlined "Valentine's Special" with no discount on
  it anywhere. Church posters are *event-shaped* (title, date, time, venue);
  promotions are *offer-shaped* (the deal is the headline, the occasion is the
  eyebrow). Fixed by adding `offer`, `offer-detail` and `promo-code` slots at the
  top of the hierarchy, plus extraction that finds the offer in whichever field
  the customer typed it into.
- **All twelve style directions were church-shaped.** A food truck was routed to
  a youth-conference aesthetic. Added eight small-business directions and made
  matching audience-, business-type- and occasion-aware.
- **Every archetype assumed a photograph filled the lower half.** Most SMB briefs
  arrive with a logo at best. Added two photo-less archetypes and a rule that
  hands reserved photo space to the type when no photo arrives.

**Consequence** The church directions stay in the catalogue behind
`audience: "church"`. Nothing is deleted; the vertical is reachable again by
changing one field.

---

### D-18 — VQS is calibrated against defects, not against willingness to pay
**Status:** open problem (2026-09-01) — new.

The scorer passed two designs at 98.6 and 91.7 while itself printing *"only 5% of
the canvas carries content"*. It reliably catches broken output. It does not yet
predict whether anyone would pay for the result.

**Consequence** Until VQS correlates with human judgement, the quality gate is
not yet the guarantee D-01 claims it is. Calibration against blind designer
scoring is the gating task before any further engine tuning.

---

## Engine architecture

### D-08 — The model never emits coordinates
**Status:** accepted — extends §14, §63, §64.

The planner LLM returns a `DesignConceptPlan`: a composition archetype, palette,
type pairing, slot list with emphasis weights, and Design DNA. A deterministic
layout engine resolves that into pixel geometry.

**Why** §2's example has the model emitting `x`/`y` directly. That makes
off-canvas text, collisions and crushed hierarchy *detectable* by QA but not
*impossible*. Moving geometry into the engine makes an entire class of defects
unreachable, and makes §28's resize a re-solve rather than a re-generation.

**Consequence** `COMPOSITION_ARCHETYPES` (12 of them) is the contract between
intelligence and geometry. Adding a layout means adding an archetype, not
re-prompting.

---

### D-09 — Line breaking is measured once and baked into the document
**Status:** accepted — extends §17, §63.

`TextLayer.lines[]` stores the exact text, measured width and baseline of every
line, computed server-side from the real font file via fontkit.

**Why** The browser and the export renderer measuring text independently is how
"looked fine in the editor, broke on export" happens. One measurement, two
consumers.

**Consequence** Any change to text, size, tracking or box width must call
`relayout()`. That is enforced in `applyPatch`.

---

### D-10 — SVG + resvg + fontkit, not a headless browser
**Status:** accepted — chooses among §16/§60's options.

**Why** The same font files feed measurement and rasterisation, so measured width
equals painted width. Renders are deterministic and fast (~80ms for 1080×1350),
with no browser to keep alive per render. Chromium stays available as a later
escape hatch for effects resvg cannot do.

**Consequence** PDF export is currently a 300dpi raster wrapped in a PDF page.
Vector PDF with real text objects is a Phase-5 upgrade.

---

### D-11 — Provider-agnostic LLM gateway; the deterministic planner is first-class
**Status:** accepted — deviates from §30's "start with GPT-5 mini".

One `structured()` call routes by *task* (`brief`/`planner`/`critic`/`editor`)
across Anthropic and OpenAI, with per-task model env vars. Below it sits a
complete rule-based planner built on the curated style directions.

**Why**
- §30 asks us to *benchmark* a model. That should be a config change, not a
  rewrite, and §31 already calls for routing.
- The deterministic planner means the product runs with zero API keys, tests are
  free and reproducible, and a provider outage degrades quality instead of
  causing an outage. It also doubles as the candidate expander for D-12.

**Consequence** Default `LLM_PROVIDER=mock`. Quality with a model configured is
strictly better, never structurally different — the model chooses among the same
validated options the engine already enforces.

---

### D-12 — Generate-many / rank-few from day one
**Status:** accepted — pulls §42 forward from "later".

Every generation composes ~10 candidates, scores each with VQS, de-duplicates by
Design DNA distance, and shows the top 3.

**Why** §42 treats this as a future upgrade, but it is nearly free once the
engine is deterministic — composing a candidate is milliseconds, not a model
call. It is also the mechanism that fixes archetype/content mismatches: when a
long headline will not set well beside a portrait, a different archetype simply
wins the ranking.

---

### D-13 — Design intelligence lives in the engine, not only in the prompt
**Status:** accepted — extends §8, §17.

Two examples now in code:
- **Subject↔headline negotiation.** When the headline's longest word cannot set
  at an acceptable size beside the portrait, the engine slides the subject
  outward (bleeding up to 18% off-canvas) and shrinks it before it will let the
  headline be crushed.
- **Fit-aware typeface choice.** A long word in a narrow column selects a
  condensed face from the direction's palette — the same move a designer makes.

**Why** These are decisions a prompt cannot reliably make, because they depend on
measured widths that only exist after layout.

---

### D-14 — Asset integrity is enforced by the renderer, not requested of the model
**Status:** accepted — implements §1.2, §1.3, §33.

Logo and subject layers carry `immutable: true`. Treatments on an immutable logo
are a QA **error** (−45), not a warning. Background removal never regenerates
pixels; treatments are deterministic SVG filter pipelines over the user's own
photograph. Procedural `TextureLayer`s replace generated background imagery for
the default path (§34's generative option remains available for atmospheres).

---

## Infrastructure

### D-15 — Source-only workspace packages, no inter-package build step
**Status:** accepted.

Packages export `src/index.ts` directly; Next transpiles them; scripts run under
`tsx`. There is no `dist/` to regenerate before typechecking.

---

### D-16 — Local-first infrastructure with explicit degradation
**Status:** accepted — refines §35, §60.

Postgres + pgvector run locally (no Docker on the target machine); storage
defaults to the filesystem with an S3/R2 driver behind the same interface; the
queue is optional; auth sits behind an adapter with a dev provider so Clerk or
Supabase can drop in later.

**Why** Every external dependency is optional so the design engine can be
developed, tested and demoed with no cloud account. Features degrade explicitly
rather than crashing.

---

## Deferred, with the reason

| Deferred | Why it is safe to defer |
|---|---|
| Full canvas editor (§22–§23) | D-04. The layer model already supports it. |
| Designer marketplace (§45) | Needs supply and demand that do not exist yet. |
| Fine-tuning (§40) | §40 says so. RAG + DNA + structured generation first. |
| Vector PDF export | D-10. Raster-in-PDF is adequate for social-first packs. |
| Multi-user brand kits, approval workflows (§47 Organisation) | No org buyers yet. |
| Ranking model trained on preferences (§42) | Needs the preference data Phase 6 collects. |

---

## Open questions

1. **Does the distribution loop work?** (D-05.) Everything else in the pricing
   model depends on it. Measure in Phase 6 before tuning the engine further.
2. **What exactly is "a pack"?** Format list is settled by `FORMATS`; whether it
   also includes caption copy is not.
3. **Refund policy at $2.99.** A no-questions refund is cheaper than a support
   thread, but invites abuse on a digital good delivered instantly.
4. **Background-removal cost at volume.** Self-hosted `rembg` on CPU is cheap but
   needs a box; a hosted API at $0.02–0.20/image is a meaningful share of COGS.
