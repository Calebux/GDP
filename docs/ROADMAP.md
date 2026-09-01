# Roadmap

Re-cut around **D-01** (`docs/DECISIONS.md`): we sell a finished promo pack, not
access to software. That reorders the PRD's phases — commerce and the pack
pipeline move ahead of the editor, the curator tool and retrieval, because the
thing being sold is the *outcome*, and the outcome already renders.

Last updated: 2026-09-01

**What moved and why**

| PRD order | New order | Reason |
|---|---|---|
| Editor (§55) before NL edits | Detail-fixer after commerce | D-04 — the editor is no longer the product |
| Reference library (§54) before beta | After commerce | The deterministic planner already clears the quality gate; references raise the ceiling, they do not unblock revenue |
| Payments last (§59) | Phase 2 | Nothing about D-02's economics is verifiable without real transactions |
| Quality gate as Phase 5 (§57) | Already shipped | It is the product promise (D-01), not a late filter |

---

## Phase 0 — Engine proof ✅ complete

The §70 hypothesis: *can structured composition beat generated imagery without
generating the final image?* Answered yes, end to end.

- `@gdp/core`, `@gdp/design-schema` — DesignDocument v1.0, the LLM-facing
  DesignPlan, patch ops, guardrails (§62, §63, §64)
- `@gdp/fonts` — 20-family licensed catalogue, 99 static TTFs, fontkit
  measurement, substitution (§18)
- `@gdp/typography` — wrap / balance / shrink, no mid-word breaks, optical
  hierarchy (§17)
- `@gdp/layout-engine` — 12 composition archetypes, subject↔headline
  negotiation, decorations, resize/recompose (§10, §28)
- `@gdp/renderer` — SVG → resvg → PNG/JPG/WebP/PDF, treatments, procedural
  textures, watermark (§16)
- `@gdp/qa` — Visual Quality Score on §66's weights, candidate ranking (§21, §66)
- `@gdp/design-dna` — DNA compute/distance, 12 curated style directions (§13, §51)
- `@gdp/planner` — task-routed LLM gateway, deterministic planner, generate+rank,
  natural-language edit → patch → apply (§29, §31, §42, §56)
- `@gdp/storage`, `@gdp/db` — filesystem/S3 drivers, Postgres schema with
  pgvector (§35, §36)

**Verified:** 10 candidates composed, scored and ranked in ~230ms; top concept
renders 1080×1350 in ~80ms with zero repairs and VQS 100.

---

## Phase 1 — The pack pipeline

**Goal:** one question in, a complete promo pack out. No account, no payment yet.

- One-question entry (*What are you promoting?*) with smart follow-ups, replacing
  the §5 wizard — missing fields are asked for only when they change the design
- Upload path for photo + logo, with a Node fallback cutout so Phase 4 is not a
  blocker
- `POST /api/packs` — brief → `generateConcepts()` → three watermarked previews
- Pack assembly: approved document → `resizeCampaign()` across IG portrait /
  square / story / WhatsApp status / Facebook / X / YouTube thumbnail / A5 print,
  zipped with a manifest (§28)
- Persist to Postgres: projects, designs, versions, generations, events
- Mobile-first (§49) — the whole flow is thumb-sized by default, not adapted later

**Done when:** a stranger on a phone can go from one sentence to a downloadable
watermarked pack without help, in under 90 seconds.

---

## Phase 2 — Commerce

**Goal:** prove D-02's economics with real money.

- Preview → unlock flow (D-03): watermarked previews free, payment unlocks
  full-resolution unwatermarked files
- Stripe + Paystack/Flutterwave, including bank transfer, USSD and mobile money
  (D-06) — card+3DS friction on $2.99 is severe in the beachhead market
- Bundles / credit wallet (D-02) — 5-pack pricing cuts payment overhead from
  12.9% to 5.9%
- Region-detected pricing (D-06)
- Credit ledger wired to generation, so cost per pack is measurable per customer
- Instrument the funnel: preview → purchase is now the headline metric (§43, D-03)

**Done when:** 25 real packs sold, and blended payment fee + COGS per pack is a
number we can put in a spreadsheet.

---

## Phase 3 — Detail fixer

**Goal:** wrong dates never generate support tickets (D-04).

- Post-purchase corrections: edit text, swap photo, change colour direction
- Natural-language changes on the same surface (§24, §25) — `interpretEdit` and
  `applyPatch` already exist; this is UI plus a re-render
- Free unlimited text corrections; regenerations metered
- Version history with restore (§26) — the schema already stores every version

**Done when:** correcting a typo and re-downloading the pack takes under 15
seconds and costs the customer nothing.

---

## Phase 4 — Real assets

**Goal:** cutouts good enough that nobody notices them.

- `services/vision` (FastAPI): background removal preserving hair, glasses,
  fingers and loose fabric (§7)
- Asset analysis: face/subject boxes, eye level, facing direction, dominant and
  clothing colours, sharpness, negative space (§8) — the layout engine already
  consumes `facing` and `eyeLevel`
- Cutout review UI: erase / restore / feather (§7)
- Resolution warnings surfaced before purchase, not after (§21)
- Decide self-hosted `rembg` vs hosted API on measured COGS (open question 4)

**Done when:** 20 real church photographs cut out cleanly with no manual repair.

---

## Phase 5 — Design intelligence

**Goal:** raise the ceiling now that the floor is paid for.

- `@gdp/retrieval`: embeddings + pgvector similarity search over Design DNA (§12)
- Curator/annotation tool with AI-suggested tags and human approval (§38, §39)
- Seed 300 human-reviewed references, then 1,000 (§37) — quality over quantity
- The §65 benchmark: 100 briefs regenerated every release, scored by designers,
  so model and algorithm changes cannot silently lower quality
- The §70 blind experiment: "would you let a paying client publish this?"
- Vector PDF export with real text objects (D-10)

**Done when:** the benchmark shows retrieval-informed concepts beating the
deterministic planner on designer scoring, with the delta written down.

---

## Phase 6 — Distribution and beta

**Goal:** answer the open question the whole price point rests on (D-05).

- Shareable preview links; WhatsApp-status asset in every pack; free-tier credit
- 20 churches, 10 designers, 20 social-media managers on real work (§58)
- Measure what they export, edit and reject — not whether they like the idea
- Track: preview→purchase, repeat purchase rate, packs per customer per month,
  organic share rate

**Done when:** a cohort's repeat purchase covers acquisition without paid spend,
or we know it does not and repricing starts.

---

## Phase 7 — Paid launch

- Launch language: *"Your promo, everywhere, in two minutes."* Never "AI graphic
  design generator" (§59)
- Expansion beyond the church wedge in §3's order (events → birthdays → weddings
  → restaurants → SMEs)
- Personal style memory per organisation (§46) once enough approved designs exist
- Ranking model trained on collected preference data (§41, §42)

---

## Explicitly not on this roadmap

Full canvas editor, designer marketplace, fine-tuning, multi-user brand kits and
approval workflows. Reasons in `docs/DECISIONS.md` § *Deferred, with the reason*.
