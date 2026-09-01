/**
 * Reality check: run mediocre US small-business promo briefs through the engine
 * exactly as it stands today. No retargeting, no new directions — the point is
 * to see the honest gap.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DesignBrief } from "@gdp/design-schema";
import { canvasFor } from "@gdp/layout-engine";
import { generateConcepts } from "@gdp/planner";
import { renderDocument } from "@gdp/renderer";

const OUT = path.resolve("out/smb");

const BRIEFS = [
  {
    slug: "nail-salon",
    brief: {
      category: "smb",
      subcategory: "promotion",
      organisationName: "Lux Nail Bar",
      eventTitle: "Valentine's Special",
      seriesName: "",
      date: "FEB 1–14",
      time: "",
      location: "Downtown Austin",
      businessType: "nail-salon",
      callToAction: "Book Now",
      extraLines: ["20% off all gel sets"],
      website: "luxnailbar.com",
      socials: "@luxnailbar",
      feeling: "premium and elegant",
    },
  },
  {
    slug: "food-truck",
    brief: {
      category: "smb",
      subcategory: "promotion",
      organisationName: "Smoke & Salt BBQ",
      eventTitle: "Grand Opening",
      date: "SAT MAR 8",
      time: "11AM – 8PM",
      location: "412 Congress Ave",
      businessType: "food-truck",
      callToAction: "Free brisket sliders",
      website: "smokeandsalt.co",
      socials: "@smokeandsaltbbq",
      feeling: "bold and loud",
    },
  },
  {
    slug: "barber",
    brief: {
      category: "smb",
      subcategory: "promotion",
      organisationName: "Sharp Cuts",
      eventTitle: "Black Friday",
      date: "NOV 28",
      time: "",
      location: "",
      businessType: "barber",
      callToAction: "$15 cuts all day",
      website: "",
      socials: "@sharpcutsatx",
      feeling: "clean minimal",
    },
  },
];

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  for (const item of BRIEFS) {
    const brief = DesignBrief.parse(item.brief);
    const result = await generateConcepts({
      designId: `probe_${item.slug}`,
      brief,
      canvas: canvasFor("ig-portrait"),
      assets: [],
      seed: 7,
    });
    const best = result.concepts[0];
    if (!best) {
      console.log(`${item.slug}: NO CONCEPT PASSED`);
      continue;
    }
    const render = await renderDocument(best.doc, { format: "png" });
    await writeFile(path.join(OUT, `${item.slug}.png`), render.buffer);
    console.log(
      `${item.slug.padEnd(12)} dir=${result.direction.padEnd(22)} arch=${best.doc.meta.composition.padEnd(26)} VQS ${best.report.total}`,
    );
    for (const issue of best.report.issues.slice(0, 3)) {
      console.log(`             ${issue.severity === "error" ? "✗" : "!"} ${issue.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
