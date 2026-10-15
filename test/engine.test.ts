import { describe, it, expect } from "vitest";
import { DesignBrief, FORMATS, contentBox, isText, type DesignDocument, type FormatId } from "@gdp/design-schema";
import { canvasFor, resizeCampaign, type AssetRefInfo } from "@gdp/layout-engine";
import { briefText, generateConcepts } from "@gdp/planner";
import { evaluate, layoutMetrics } from "@gdp/qa";
import { EVAL_BRIEFS, type EvalBrief } from "../scripts/eval-briefs.js";

const PORTRAIT: AssetRefInfo = {
  id: "asset_portrait",
  ref: "portrait_1",
  kind: "portrait",
  width: 900,
  height: 1200,
  cutout: true,
};
const LOGO: AssetRefInfo = { id: "asset_logo", ref: "logo_1", kind: "logo", width: 400, height: 160 };
const QA_ASSETS = {
  asset_portrait: { width: 900, height: 1200, averageColor: "#2b3346" },
  asset_logo: { width: 400, height: 160, averageColor: "#ffffff" },
};

function assetsFor(item: EvalBrief): AssetRefInfo[] {
  return [
    ...(item.assets?.includes("portrait") ? [PORTRAIT] : []),
    ...(item.assets?.includes("logo") ? [LOGO] : []),
  ];
}

async function hero(slug: string): Promise<{ doc: DesignDocument; assets: AssetRefInfo[] }> {
  const item = EVAL_BRIEFS.find((b) => b.slug === slug)!;
  const assets = assetsFor(item);
  const result = await generateConcepts({
    brief: DesignBrief.parse(item.brief),
    canvas: canvasFor("ig-portrait"),
    assets,
    seed: 7,
  });
  return { doc: result.concepts[0]!.doc, assets };
}

const dominant = (doc: DesignDocument) =>
  doc.layers.filter(isText).find((l) => l.slot === "offer") ?? doc.layers.filter(isText).find((l) => l.slot === "headline");

describe("planner brief", () => {
  it("shows the model the offer, its detail, the promo code and the business type", () => {
    const text = briefText(
      DesignBrief.parse({
        organisationName: "Urban Style Boutique",
        offer: "30% OFF STOREWIDE",
        offerDetail: "This weekend only",
        promoCode: "FLASH30",
        businessType: "boutique",
      }),
    );
    expect(text).toContain("offer: 30% OFF STOREWIDE");
    expect(text).toContain("offer detail: This weekend only");
    expect(text).toContain("promo code: FLASH30");
    expect(text).toContain("business type: boutique");
  });

  it("defaults a brief to a small-business promotion, not a church service", () => {
    const brief = DesignBrief.parse({});
    expect(brief.category).toBe("smb");
    expect(brief.subcategory).toBe("promotion");
  });
});

describe("resizeCampaign", () => {
  const formats = Object.keys(FORMATS).filter((f) => f !== "ig-portrait") as FormatId[];

  it("keeps the photo and logo in every format", async () => {
    const { doc, assets } = await hero("spa-photo");
    for (const [format, resized] of Object.entries(resizeCampaign(doc, assets, formats))) {
      const slots = resized.layers.filter((l) => l.type === "image").map((l) => l.slot);
      expect(slots, format).toContain("subject");
      expect(slots, format).toContain("logo");
    }
  });

  it("keeps them even when the caller passes no asset facts", async () => {
    // apps/web's packaging service resizes with an empty asset list.
    const { doc } = await hero("spa-photo");
    for (const [format, resized] of Object.entries(resizeCampaign(doc, [], formats))) {
      const slots = resized.layers.filter((l) => l.type === "image").map((l) => l.slot);
      expect(slots, format).toContain("subject");
      expect(slots, format).toContain("logo");
    }
  });

  it("keeps the offer's display face and its dominance", async () => {
    const { doc, assets } = await hero("spa-photo");
    const face = dominant(doc)!.fontFamily;
    for (const [format, resized] of Object.entries(resizeCampaign(doc, assets, formats))) {
      expect(dominant(resized)?.fontFamily, format).toBe(face);
      const codes = evaluate(resized, { assets: QA_ASSETS }).issues.map((i) => i.code);
      expect(codes, format).not.toContain("weak-hierarchy");
    }
  });

  it("keeps the decorations the concept was planned with", async () => {
    const { doc, assets } = await hero("nail-salon");
    const planned = doc.meta.plan?.decorations.length ?? 0;
    const resized = resizeCampaign(doc, assets, ["ig-square"])["ig-square"]!;
    expect(resized.meta.plan?.decorations.length ?? 0).toBe(planned);
  });
});

describe("layout", () => {
  it("sets inline detail rows on a shared baseline", async () => {
    const { doc } = await hero("nail-salon");
    const date = doc.layers.filter(isText).find((l) => l.slot === "date")!;
    const location = doc.layers.filter(isText).find((l) => l.slot === "location")!;
    expect(date.fontSize).not.toBe(location.fontSize);
    // Only meaningful when they share a row.
    if (Math.abs(date.y - location.y) < date.height) {
      const baseline = (l: typeof date) => l.y + l.lines[0]!.baseline;
      expect(Math.abs(baseline(date) - baseline(location))).toBeLessThanOrEqual(1);
    }
  });

  it("sits the footer on the bottom margin", async () => {
    const { doc } = await hero("nail-salon");
    const footer = doc.layers.find((l) => l.slot === "footer")!;
    const box = contentBox(doc.canvas);
    expect(box.y + box.height - (footer.y + footer.height)).toBeLessThanOrEqual(2);
  });

  it("does not leave a quarter of a type-only poster empty", async () => {
    for (const slug of ["nail-salon", "food-truck", "barber", "boutique-code"]) {
      const { doc } = await hero(slug);
      expect(layoutMetrics(doc).emptyBand, slug).toBeLessThan(0.25);
    }
  });
});

describe("quality score", () => {
  it("does not call a full-width column lopsided", async () => {
    const { doc } = await hero("boutique-code");
    expect(layoutMetrics(doc).balanceH).toBeLessThan(0.5);
  });

  // The eval set as a regression gate: every brief, every pack format, no
  // error-level defects. `npm run eval` is the visual half of this.
  it.each(EVAL_BRIEFS.map((b) => [b.slug, b] as const))("%s ships a clean pack", async (_slug, item) => {
    const { doc, assets } = await hero(item.slug);
    const qa = Object.fromEntries(assets.map((a) => [a.id, QA_ASSETS[a.id as keyof typeof QA_ASSETS]]));
    const formats = Object.keys(FORMATS).filter((f) => f !== "ig-portrait") as FormatId[];
    const docs = { "ig-portrait": doc, ...resizeCampaign(doc, assets, formats) };
    for (const [format, d] of Object.entries(docs)) {
      const errors = evaluate(d, { assets: qa }).issues.filter((i) => i.severity === "error");
      expect(errors.map((e) => e.message), format).toEqual([]);
    }
  });
});
