/**
 * Phase 1 proof (§53): brief + assets → structured composition → rendered poster,
 * with no image model anywhere in the pipeline.
 *
 *   npm run render:demo
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DesignConceptPlan } from "@gdp/design-schema";
import { canvasFor, composeDocument, type AssetRefInfo } from "@gdp/layout-engine";
import { renderDocument, type ResolvedAsset } from "@gdp/renderer";
import { evaluate } from "@gdp/qa";
import { syntheticLogo, syntheticPortrait, toDataUri } from "./demo-assets.js";

const OUT = path.resolve("out");

const plan: DesignConceptPlan = {
  conceptName: "Contemporary Ministry",
  rationale:
    "Editorial condensed headline with the speaker anchored right, restrained palette and one accent for the date.",
  archetype: "portrait-right-headline-left",
  background: { type: "gradient", from: "#101018", to: "#232438", angle: 160 },
  palette: {
    name: "Ink & Citrus",
    background: "#101018",
    surface: "#1b1c28",
    ink: "#f5f4f0",
    inkMuted: "#a8a7b4",
    accent: "#f2c14e",
    accentAlt: "#6f7bff",
  },
  typography: {
    headlineFont: "Archivo Black",
    supportFont: "Inter",
    headlineCase: "uppercase",
    headlineTracking: -0.025,
    headlineAlign: "left",
    scaleContrast: 3.1,
    density: "balanced",
  },
  dna: { energy: 0.78, minimalism: 0.55, contrast: 0.9, spacing: "balanced" },
  slots: [
    { role: "eyebrow", text: "Grace City Church", emphasis: 0.4, styleKey: "eyebrow", colorRole: "accent" },
    { role: "headline", text: "Supernatural Increase", emphasis: 0.95, styleKey: "headline", colorRole: "ink" },
    { role: "subheadline", text: "with Pastor Daniel", emphasis: 0.5, styleKey: "subheadline", colorRole: "inkMuted" },
    { role: "date", text: "SEP 13", emphasis: 0.7, styleKey: "date", colorRole: "accent" },
    { role: "time", text: "9:00 AM", emphasis: 0.5, styleKey: "time", colorRole: "ink" },
    { role: "location", text: "Lekki, Lagos", emphasis: 0.45, styleKey: "location", colorRole: "inkMuted" },
    { role: "subject", assetRef: "portrait_1", emphasis: 0.9, styleKey: "body", colorRole: "ink" },
    { role: "logo", assetRef: "logo_1", emphasis: 0.3, styleKey: "body", colorRole: "ink" },
    { role: "footer", text: "gracecity.church  ·  @gracecitylagos", emphasis: 0.2, styleKey: "footer", colorRole: "inkMuted" },
  ],
  decorations: [{ kind: "accent-bar", colorRole: "accent", intensity: 0.6 }],
  subjectTreatment: [],
};

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });

  const portrait = await syntheticPortrait();
  const logo = await syntheticLogo();
  const resolved: Record<string, ResolvedAsset> = {
    asset_portrait: { dataUri: toDataUri(portrait), width: 900, height: 1200 },
    asset_logo: { dataUri: toDataUri(logo), width: 400, height: 160 },
  };

  const assets: AssetRefInfo[] = [
    {
      id: "asset_portrait",
      ref: "portrait_1",
      kind: "portrait",
      width: 900,
      height: 1200,
      cutout: true,
      analysis: {
        orientation: "portrait",
        hasAlpha: true,
        facing: "left",
        faceCount: 1,
        eyeLevel: 0.26,
        dominantColors: ["#3d4a63", "#c98b63"],
        clothingColors: ["#1a2130"],
        sharpness: 0.8,
        brightness: 0.4,
        negativeSpace: [],
        notes: "",
      },
    },
    { id: "asset_logo", ref: "logo_1", kind: "logo", width: 400, height: 160 },
  ];

  const canvas = canvasFor("ig-portrait");
  const { doc, repairs } = composeDocument({ id: "des_demo", canvas, plan, assets });

  console.log(`composition: ${doc.meta.composition}`);
  console.log(`layers: ${doc.layers.length}`);
  for (const layer of doc.layers) {
    const extra = layer.type === "text" ? ` "${layer.content.slice(0, 28)}" ${Math.round(layer.fontSize)}px` : "";
    console.log(`  ${String(layer.zIndex).padStart(2)} ${layer.type.padEnd(7)} ${layer.slot.padEnd(16)}${extra}`);
  }
  if (repairs.length > 0) {
    console.log("\nrepairs:");
    for (const r of repairs) console.log(`  [${r.rule}] ${r.message}`);
  }

  const report = evaluate(doc, {
    assets: {
      asset_portrait: { width: 900, height: 1200, averageColor: "#2b3346", kind: "portrait" },
      asset_logo: { width: 400, height: 160, averageColor: "#ffffff", kind: "logo" },
    },
  });
  console.log(`\nVQS ${report.total}/100 — ${report.passed ? "PASS" : "REJECTED"} (threshold ${report.threshold})`);
  for (const c of report.components) {
    console.log(`  ${c.name.padEnd(15)} ${String(Math.round(c.score)).padStart(3)}  ×${c.weight}`);
  }
  for (const issue of report.issues) {
    console.log(`  ${issue.severity === "error" ? "✗" : "!"} [${issue.code}] ${issue.message}`);
  }

  const result = await renderDocument(doc, {
    format: "png",
    resolveAsset: async (id) => resolved[id] ?? null,
  });
  await writeFile(path.join(OUT, "demo.png"), result.buffer);
  await writeFile(path.join(OUT, "demo.svg"), result.svg);
  await writeFile(path.join(OUT, "demo.json"), JSON.stringify(doc, null, 2));
  console.log(`\nrendered ${result.width}×${result.height} in ${result.durationMs}ms → out/demo.png`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
