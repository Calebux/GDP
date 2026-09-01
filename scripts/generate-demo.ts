/**
 * §42 + §70 — generate a pool of candidates, score them, show only the best.
 *
 *   npm run demo:generate
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DesignBrief } from "@gdp/design-schema";
import { canvasFor, type AssetRefInfo } from "@gdp/layout-engine";
import { generateConcepts } from "@gdp/planner";
import { renderDocument, type ResolvedAsset } from "@gdp/renderer";
import { syntheticLogo, syntheticPortrait, toDataUri } from "./demo-assets.js";

const OUT = path.resolve("out");

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });

  const brief = DesignBrief.parse({
    category: "church",
    subcategory: "sunday-service",
    eventTitle: "Supernatural Increase",
    seriesName: "",
    organisationName: "Grace City Church",
    date: "SEP 13",
    time: "9:00 AM",
    location: "Lekki, Lagos",
    people: [{ name: "Pastor Daniel", title: "" }],
    website: "gracecity.church",
    socials: "@gracecitylagos",
    styleDirection: process.argv[2] ?? "contemporary-ministry",
    format: "ig-portrait",
  });

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
        dominantColors: ["#3d4a63"],
        clothingColors: ["#1a2130"],
        sharpness: 0.8,
        brightness: 0.4,
        negativeSpace: [],
        notes: "",
      },
    },
    { id: "asset_logo", ref: "logo_1", kind: "logo", width: 400, height: 160 },
  ];

  const result = await generateConcepts({
    designId: "des_demo",
    brief,
    canvas: canvasFor(brief.format),
    assets,
    qaAssets: {
      asset_portrait: { width: 900, height: 1200, averageColor: "#2b3346", kind: "portrait" },
      asset_logo: { width: 400, height: 160, averageColor: "#ffffff", kind: "logo" },
    },
    seed: 42,
  });

  console.log(
    `direction=${result.direction}  planner=${result.usedModel ? "model" : "deterministic"}  ${result.considered.length} candidates in ${result.durationMs}ms\n`,
  );
  console.log("  VQS   pass  archetype                          concept");
  for (const candidate of result.considered) {
    console.log(
      `  ${String(candidate.report.total).padStart(5)}  ${candidate.report.passed ? " ✓  " : " ✗  "}  ${candidate.doc.meta.composition.padEnd(34)} ${candidate.plan.conceptName}`,
    );
    for (const issue of candidate.report.issues.slice(0, 2)) {
      console.log(`          ${issue.severity === "error" ? "✗" : "!"} ${issue.message}`);
    }
  }

  console.log(`\nshowing ${result.concepts.length} concepts:`);
  for (const [index, candidate] of result.concepts.entries()) {
    const render = await renderDocument(candidate.doc, {
      format: "png",
      resolveAsset: async (id) => resolved[id] ?? null,
    });
    const file = path.join(OUT, `concept-${index + 1}.png`);
    await writeFile(file, render.buffer);
    await writeFile(path.join(OUT, `concept-${index + 1}.json`), JSON.stringify(candidate.doc, null, 2));
    console.log(`  ${index + 1}. ${candidate.plan.conceptName} — VQS ${candidate.report.total} → ${file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
