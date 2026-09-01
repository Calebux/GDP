/**
 * Downloads the curated font library (§18) as static TTFs.
 *
 *   npm run fonts:sync              # normal weights for every family
 *   npm run fonts:sync -- --italics # include italics where the family has them
 *   npm run fonts:sync -- Inter "Archivo Black"
 *
 * TTF (not woff2) because both resvg and fontkit read it directly, so the
 * measuring engine and the rendering engine share one file.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { FONT_CATALOGUE, familySlug, fileName } from "@gdp/fonts";

const UA = "Mozilla/5.0";
const ROOT = path.resolve(process.env.FONT_DIR ?? "./assets/fonts");

const args = process.argv.slice(2);
const withItalics = args.includes("--italics");
const only = args.filter((a) => !a.startsWith("--"));

interface Face {
  weight: number;
  italic: boolean;
  url: string;
}

function parseCss(css: string): Face[] {
  const faces: Face[] = [];
  for (const block of css.split("@font-face")) {
    const url = /src:\s*url\(([^)]+)\)/.exec(block)?.[1];
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
    const style = /font-style:\s*(\w+)/.exec(block)?.[1];
    if (!url || !weight) continue;
    faces.push({ weight: Number(weight), italic: style === "italic", url: url.trim() });
  }
  // Google returns one block per unicode-range subset; keep the first of each face.
  const seen = new Set<string>();
  return faces.filter((f) => {
    const key = `${f.weight}-${f.italic}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function sync(): Promise<void> {
  const families = FONT_CATALOGUE.filter(
    (f) => f.source === "google" && (only.length === 0 || only.includes(f.family)),
  );
  let downloaded = 0;
  let skipped = 0;

  for (const meta of families) {
    const google = (meta.googleFamily ?? meta.family).replace(/ /g, "+");
    const wantItalics = withItalics && meta.italics;
    const spec = wantItalics
      ? `ital,wght@${meta.weights.map((w) => `0,${w}`).join(";")};${meta.weights
          .map((w) => `1,${w}`)
          .join(";")}`
      : `wght@${meta.weights.join(";")}`;
    const single = meta.weights.length === 1 && !wantItalics;
    const url = `https://fonts.googleapis.com/css2?family=${google}${single ? "" : `:${spec}`}`;

    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      console.error(`  ✗ ${meta.family}: css request failed (${res.status})`);
      continue;
    }
    const faces = parseCss(await res.text());
    if (faces.length === 0) {
      console.error(`  ✗ ${meta.family}: no faces found`);
      continue;
    }

    const dir = path.join(ROOT, familySlug(meta.family));
    await mkdir(dir, { recursive: true });

    for (const face of faces) {
      const dest = path.join(dir, fileName(meta.family, face.weight, face.italic));
      if (await exists(dest)) {
        skipped += 1;
        continue;
      }
      const bin = await fetch(face.url, { headers: { "User-Agent": UA } });
      if (!bin.ok) {
        console.error(`  ✗ ${meta.family} ${face.weight}: download failed (${bin.status})`);
        continue;
      }
      await writeFile(dest, Buffer.from(await bin.arrayBuffer()));
      downloaded += 1;
    }
    console.log(`  ✓ ${meta.family} (${faces.length} faces)`);
  }

  console.log(`\nfonts → ${ROOT}\n  downloaded: ${downloaded}  already present: ${skipped}`);
}

sync().catch((error) => {
  console.error(error);
  process.exit(1);
});
