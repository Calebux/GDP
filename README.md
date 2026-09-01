# GDP

Professional graphic design without looking AI-generated.

One question in — *What are you promoting?* — a finished promo pack out: the same
promotion composed for every format a small business actually posts to.

## The idea

A design is **a document, not an image**. An image is one possible export of that
document. Everything follows from that:

- Text stays real text, set with real font metrics, until the moment of export —
  so it never warps, misspells or breaks mid-word.
- Uploaded photographs and logos are reproduced exactly. Faces are never
  regenerated; logos are never redrawn.
- The AI decides *intent* — composition, hierarchy, palette, type pairing. A
  deterministic engine decides *pixels*. Off-canvas text and collisions are
  structurally impossible rather than something a checker hopes to catch.
- Every design is scored before anyone sees it. Below the bar, it is recomposed,
  not shipped. The customer is never the QA department.

## Quick start

```bash
npm install
npm run fonts:sync          # downloads the licensed font library (~99 TTFs)
npm run demo:generate       # 10 candidates → scored → top 3 rendered to out/
npm run render:demo         # single poster, brief → composition → PNG
```

No API keys required. A deterministic planner built on curated style directions
runs the whole pipeline; configuring an LLM raises quality, it is not a
dependency.

## Architecture

```
brief ─┬─ asset analysis ─┐
       └─ brief analysis ─┴─ reference retrieval ─ Design DNA
                                                        │
                                                   design planner
                                                        │
                                            structured design document
                                                        │
                                                  quality gate ── fail ─┐
                                                        │ pass          │
                                                   render engine    recompose
                                                        │
                                             pack: every format, exported
```

| Package | Role |
|---|---|
| `@gdp/core` | env, ids, geometry, WCAG colour maths |
| `@gdp/design-schema` | DesignDocument v1.0, the LLM contract, patch ops, guardrails |
| `@gdp/fonts` | licensed catalogue, fontkit measurement, substitution |
| `@gdp/typography` | wrapping, balancing, shrink-to-fit, optical hierarchy |
| `@gdp/layout-engine` | 12 composition archetypes, geometry solver, recompose |
| `@gdp/renderer` | SVG → resvg → PNG/JPG/WebP/PDF |
| `@gdp/qa` | Visual Quality Score, candidate ranking |
| `@gdp/design-dna` | DNA compute/distance, curated style directions |
| `@gdp/planner` | model routing, deterministic planner, generate + rank, NL editing |
| `@gdp/storage` `@gdp/db` | filesystem/S3 drivers, Postgres + pgvector |

## Docs

- `docs/PRD.md` — the product requirements this is built from
- `docs/DECISIONS.md` — every decision that extends or deviates from the PRD
- `docs/ROADMAP.md` — phases, with what "done" means for each

## Commands

```bash
npm run dev            # dashboard on :3000
npm run typecheck      # whole workspace
npm test               # vitest
npm run fonts:sync     # refresh the font library
npm run db:migrate     # Postgres + pgvector
```
