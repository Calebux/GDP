/**
 * §65 — the regression benchmark. Every eval brief is generated, its winning
 * concept resized across the whole pack, and every format scored and rendered
 * onto one contact sheet.
 *
 *   npm run eval                                   # → out/eval/latest/
 *   npm run eval -- --label before                 # name the run
 *   npm run eval -- --baseline out/eval/before     # print deltas against a run
 *   npm run eval -- --formats ig-portrait,story    # subset of formats
 *   npm run eval -- --strict                       # exit 1 on any error-level issue
 *
 * The scores are only as good as VQS (D-18) — the contact sheet is the part a
 * human should actually look at.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DesignBrief, FORMATS, type DesignDocument, type FormatId } from "@gdp/design-schema";
import { canvasFor, resizeCampaign, type AssetRefInfo } from "@gdp/layout-engine";
import { generateConcepts } from "@gdp/planner";
import { evaluate, layoutMetrics, type AssetFacts } from "@gdp/qa";
import { renderDocument, type ResolvedAsset } from "@gdp/renderer";
import { syntheticLogo, syntheticPortrait, toDataUri } from "./demo-assets.js";
import { EVAL_BRIEFS, type EvalBrief } from "./eval-briefs.js";

interface Row {
  brief: string;
  format: FormatId;
  direction: string;
  archetype: string;
  vqs: number;
  passed: boolean;
  errors: number;
  coverage: number;
  emptyBand: number;
  balanceH: number;
  balanceV: number;
  issues: string[];
  image?: string;
}

interface Summary {
  label: string;
  createdAt: string;
  rows: Row[];
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const PORTRAIT: AssetRefInfo = {
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
};
const LOGO: AssetRefInfo = { id: "asset_logo", ref: "logo_1", kind: "logo", width: 400, height: 160 };
const QA_ASSETS: Record<string, AssetFacts> = {
  asset_portrait: { width: 900, height: 1200, averageColor: "#2b3346", kind: "portrait" },
  asset_logo: { width: 400, height: 160, averageColor: "#ffffff", kind: "logo" },
};

function assetsFor(item: EvalBrief): AssetRefInfo[] {
  const out: AssetRefInfo[] = [];
  if (item.assets?.includes("portrait")) out.push(PORTRAIT);
  if (item.assets?.includes("logo")) out.push(LOGO);
  return out;
}

const round = (v: number, places = 3): number => Math.round(v * 10 ** places) / 10 ** places;

async function main(): Promise<void> {
  const label = arg("label") ?? "latest";
  const outDir = path.resolve("out/eval", label);
  const formats = (arg("formats")?.split(",") ?? Object.keys(FORMATS)) as FormatId[];
  const render = !flag("no-render");
  await mkdir(outDir, { recursive: true });

  const resolved: Record<string, ResolvedAsset> = {
    asset_portrait: { dataUri: toDataUri(await syntheticPortrait()), width: 900, height: 1200 },
    asset_logo: { dataUri: toDataUri(await syntheticLogo()), width: 400, height: 160 },
  };

  const started = Date.now();
  const rows: Row[] = [];

  for (const item of EVAL_BRIEFS) {
    const brief = DesignBrief.parse(item.brief);
    const assets = assetsFor(item);
    const qaAssets = Object.fromEntries(assets.map((a) => [a.id, QA_ASSETS[a.id]!]));

    // The pack is generated on the hero format, then recomposed for the rest —
    // exactly what a customer's pack goes through.
    const result = await generateConcepts({
      designId: `eval_${item.slug}`,
      brief,
      canvas: canvasFor("ig-portrait"),
      assets,
      qaAssets,
      seed: 7,
    });
    const best = result.concepts[0];
    if (!best) {
      console.log(`${item.slug}: no concept produced`);
      continue;
    }

    const docs: Record<string, DesignDocument> = {
      "ig-portrait": best.doc,
      ...resizeCampaign(best.doc, assets, formats.filter((f) => f !== "ig-portrait")),
    };

    for (const format of formats) {
      const doc = docs[format];
      if (!doc) continue;
      const report = evaluate(doc, { assets: qaAssets });
      const metrics = layoutMetrics(doc);
      const row: Row = {
        brief: item.slug,
        format,
        direction: result.direction,
        archetype: doc.meta.composition,
        vqs: report.total,
        passed: report.passed,
        errors: report.issues.filter((i) => i.severity === "error").length,
        coverage: round(metrics.coverage),
        emptyBand: round(metrics.emptyBand),
        balanceH: round(metrics.balanceH),
        balanceV: round(metrics.balanceV),
        issues: report.issues.map((i) => `${i.severity === "error" ? "✗" : "!"} ${i.message}`),
      };

      if (render) {
        // Contact-sheet resolution: ~540px on the long edge is plenty to judge.
        const scale = 540 / Math.max(doc.canvas.width, doc.canvas.height);
        const image = await renderDocument(doc, {
          format: "jpg",
          scale,
          quality: 82,
          resolveAsset: async (id) => resolved[id] ?? null,
        });
        row.image = `${item.slug}__${format}.jpg`;
        await writeFile(path.join(outDir, row.image), image.buffer);
      }
      rows.push(row);
    }
    const hero = rows.find((r) => r.brief === item.slug && r.format === "ig-portrait");
    console.log(
      `${item.slug.padEnd(18)} ${result.direction.padEnd(18)} ${best.doc.meta.composition.padEnd(30)} VQS ${hero?.vqs ?? "-"}`,
    );
  }

  const summary: Summary = { label, createdAt: new Date().toISOString(), rows };
  await writeFile(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  await writeFile(path.join(outDir, "index.html"), contactSheet(summary, formats));

  printAggregate(rows);
  const baselinePath = arg("baseline");
  if (baselinePath) await printDiff(rows, baselinePath);

  console.log(`\n${rows.length} designs in ${Date.now() - started}ms → ${path.join(outDir, "index.html")}`);
  if (flag("strict") && rows.some((r) => r.errors > 0)) process.exit(1);
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function printAggregate(rows: Row[]): void {
  console.log("\nformat           VQS   pass   coverage  emptyBand  errors");
  const byFormat = new Map<string, Row[]>();
  for (const row of rows) byFormat.set(row.format, [...(byFormat.get(row.format) ?? []), row]);
  for (const [format, group] of [...byFormat, ["ALL", rows] as const]) {
    console.log(
      `${format.padEnd(15)} ${mean(group.map((r) => r.vqs)).toFixed(1).padStart(5)}  ${`${group.filter((r) => r.passed).length}/${group.length}`.padStart(5)}   ${mean(group.map((r) => r.coverage)).toFixed(3).padStart(7)}   ${mean(group.map((r) => r.emptyBand)).toFixed(3).padStart(8)}  ${String(group.reduce((s, r) => s + r.errors, 0)).padStart(6)}`,
    );
  }
}

async function printDiff(rows: Row[], baselinePath: string): Promise<void> {
  const file = baselinePath.endsWith(".json") ? baselinePath : path.join(baselinePath, "summary.json");
  const baseline = JSON.parse(await readFile(file, "utf8")) as Summary;
  const key = (r: Row): string => `${r.brief}|${r.format}`;
  const before = new Map(baseline.rows.map((r) => [key(r), r]));

  const pairs = rows.flatMap((r) => {
    const b = before.get(key(r));
    return b ? [{ now: r, was: b }] : [];
  });
  const delta = (pick: (r: Row) => number): string => {
    const d = mean(pairs.map((p) => pick(p.now) - pick(p.was)));
    return `${d >= 0 ? "+" : ""}${d.toFixed(3)}`;
  };
  console.log(`\nvs ${baseline.label} (${pairs.length} matched designs)`);
  console.log(`  VQS ${delta((r) => r.vqs)}   coverage ${delta((r) => r.coverage)}   emptyBand ${delta((r) => r.emptyBand)}   errors ${delta((r) => r.errors)}`);

  const moved = pairs
    .map((p) => ({ ...p, d: p.now.vqs - p.was.vqs }))
    .filter((p) => Math.abs(p.d) >= 3 || p.now.errors !== p.was.errors)
    .sort((a, b) => a.d - b.d);
  for (const p of moved) {
    console.log(
      `  ${key(p.now).padEnd(34)} VQS ${p.was.vqs} → ${p.now.vqs}   errors ${p.was.errors} → ${p.now.errors}`,
    );
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function contactSheet(summary: Summary, formats: FormatId[]): string {
  const briefs = [...new Set(summary.rows.map((r) => r.brief))];
  const cell = (row: Row | undefined): string => {
    if (!row) return "<td></td>";
    const tone = row.errors > 0 ? "bad" : row.passed ? "ok" : "warn";
    return `<td><figure>${row.image ? `<img src="${row.image}" loading="lazy" alt="${escapeHtml(`${row.brief} ${row.format}`)}">` : ""}
<figcaption><b class="${tone}">${row.vqs}</b> cov ${row.coverage} · gap ${row.emptyBand}<br><small>${escapeHtml(row.archetype)}</small>
${row.issues.length ? `<ul>${row.issues.slice(0, 4).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : ""}</figcaption></figure></td>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>GDP eval — ${escapeHtml(summary.label)}</title>
<style>
body{font:13px/1.4 system-ui,sans-serif;margin:16px;background:#f4f4f2;color:#222}
table{border-collapse:collapse}td,th{vertical-align:top;padding:8px;border-bottom:1px solid #ddd;text-align:left}
th{position:sticky;top:0;background:#f4f4f2}img{max-width:260px;max-height:260px;display:block;box-shadow:0 1px 4px #0003}
figure{margin:0}figcaption{margin-top:6px;max-width:260px}ul{margin:4px 0 0;padding-left:16px;color:#666}
.ok{color:#18794e}.warn{color:#b26b00}.bad{color:#c62828}
</style></head><body>
<h1>Eval: ${escapeHtml(summary.label)}</h1><p>${escapeHtml(summary.createdAt)} · ${summary.rows.length} designs. <b class="ok">green</b> passed, <b class="warn">amber</b> below threshold, <b class="bad">red</b> has errors.</p>
<table><tr><th>brief</th>${formats.map((f) => `<th>${f}</th>`).join("")}</tr>
${briefs
  .map((b) => {
    const first = summary.rows.find((r) => r.brief === b);
    return `<tr><th>${escapeHtml(b)}<br><small>${escapeHtml(first?.direction ?? "")}</small></th>${formats
      .map((f) => cell(summary.rows.find((r) => r.brief === b && r.format === f)))
      .join("")}</tr>`;
  })
  .join("\n")}
</table></body></html>`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
