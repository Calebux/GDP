import type {
  BackgroundPlan,
  Canvas,
  CompositionArchetype,
  DesignBrief,
  DesignConceptPlan,
  SlotPlan,
} from "@gdp/design-schema";
import { measureText } from "@gdp/fonts";
import { type StyleDirection, resolveDirection } from "@gdp/design-dna";

export interface AssetSummary {
  ref: string;
  kind: string;
  facing?: "left" | "right" | "front" | "unknown";
}

export interface HeuristicInput {
  brief: DesignBrief;
  assets: AssetSummary[];
  direction?: StyleDirection;
  count?: number;
  seed?: number;
  /** Lets the planner choose a typeface that actually fits the column. */
  canvas?: Canvas;
}

/** Roughly how much of the canvas width each archetype gives the headline. */
const COLUMN_FRACTION: Record<CompositionArchetype, number> = {
  "portrait-right-headline-left": 0.44,
  "portrait-left-headline-right": 0.44,
  "portrait-center-headline-above": 0.86,
  "portrait-center-headline-behind": 0.86,
  "headline-dominant-portrait-small": 0.86,
  "full-bleed-image-bottom-stack": 0.8,
  "split-diagonal": 0.42,
  "editorial-grid": 0.6,
  "stacked-center-minimal": 0.76,
  "two-person-split": 0.86,
  "three-speaker-row": 0.86,
  "typographic-poster": 0.86,
  "offer-block-center": 0.86,
  "banded-poster": 0.86,
};

/**
 * Pick the headline face that can actually set this headline at display size in
 * the column the archetype provides. A long word in a narrow column is exactly
 * why designers reach for a condensed face — the engine should reach for it too.
 */
function chooseHeadlineFont(
  fonts: string[],
  headline: string,
  archetype: CompositionArchetype,
  canvas: Canvas | undefined,
  uppercase: boolean,
): string {
  const first = fonts[0] ?? "Inter";
  if (!canvas || headline.length === 0) return first;

  const shortEdge = Math.min(canvas.width, canvas.height);
  const columnWidth = canvas.width * (COLUMN_FRACTION[archetype] ?? 0.6);
  const targetSize = shortEdge * 0.082;
  const text = uppercase ? headline.toUpperCase() : headline;
  const longest = text.split(/\s+/).reduce((a, b) => (a.length >= b.length ? a : b), "");

  let best = first;
  let bestWidth = Number.POSITIVE_INFINITY;
  for (const family of fonts) {
    const width = measureText(longest, { fontFamily: family, fontWeight: 800, fontSize: targetSize });
    if (width <= columnWidth) return family;
    if (width < bestWidth) {
      bestWidth = width;
      best = family;
    }
  }
  return best;
}

/** Deterministic PRNG so the same brief always yields the same candidate set. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Layout spacing and typographic density are related but not the same axis. */
const DENSITY_FOR_SPACING = {
  tight: "dense",
  balanced: "balanced",
  generous: "airy",
} as const;

const pretty = (archetype: string): string =>
  archetype.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The deterministic design planner. It produces genuinely different, valid
 * compositions from the curated directions — no model required. With an LLM
 * configured this becomes the fallback and the variant expander around the
 * model's chosen concepts.
 */
export function heuristicConcepts(input: HeuristicInput): DesignConceptPlan[] {
  const direction =
    input.direction ??
    resolveDirection({
      id: input.brief.styleDirection,
      feeling: input.brief.feeling,
      occasion: `${input.brief.eventTitle} ${input.brief.offer} ${input.brief.extraLines.join(" ")}`,
      businessType: input.brief.businessType,
      category: input.brief.category,
    });
  const count = input.count ?? 10;
  const rng = mulberry32(input.seed ?? hash(JSON.stringify(input.brief)));

  const portraits = input.assets.filter((a) => a.kind === "portrait" || a.kind === "photo");
  const logo = input.assets.find((a) => a.kind === "logo");
  const subjectCount = Math.min(3, portraits.length);

  const archetypes = viableArchetypes(direction, subjectCount);
  const concepts: DesignConceptPlan[] = [];

  for (let i = 0; i < count; i += 1) {
    const archetype = archetypes[i % archetypes.length]!;
    const palette = direction.palettes[Math.floor(rng() * direction.palettes.length)] ?? direction.palettes[0]!;
    // Rotate the preference order per candidate, then let fit decide.
    const rotation = Math.floor(rng() * direction.headlineFonts.length);
    const ordered = [...direction.headlineFonts.slice(rotation), ...direction.headlineFonts.slice(0, rotation)];
    const headlineFont = chooseHeadlineFont(
      ordered,
      extractOffer(input.brief).offer || input.brief.eventTitle,
      archetype,
      input.canvas,
      direction.typography.headlineCase === "uppercase",
    );
    const supportFont = direction.supportFonts[Math.floor(rng() * direction.supportFonts.length)] ?? direction.supportFonts[0]!;
    const decoration = direction.decorations[Math.floor(rng() * direction.decorations.length)] ?? "none";
    const treatment = direction.subjectTreatments[Math.floor(rng() * direction.subjectTreatments.length)] ?? [];

    concepts.push({
      conceptName: `${direction.name} · ${pretty(archetype)}`,
      rationale: rationaleFor(direction, archetype, input.brief),
      archetype,
      background: backgroundFor(direction, palette, input.assets, rng),
      palette,
      typography: {
        headlineFont,
        supportFont,
        headlineCase: direction.typography.headlineCase,
        headlineTracking: direction.typography.tracking,
        headlineAlign: alignFor(archetype),
        scaleContrast: direction.typography.scaleContrast * (0.9 + rng() * 0.25),
        density: DENSITY_FOR_SPACING[direction.dna.spacing],
      },
      dna: {
        energy: direction.dna.energy,
        minimalism: direction.dna.minimalism,
        contrast: direction.dna.contrast,
        spacing: direction.dna.spacing,
      },
      slots: slotsFor(input.brief, portraits, logo, archetype),
      decorations: decoration === "none" ? [] : [{ kind: decoration, colorRole: "accent", intensity: 0.4 + rng() * 0.4 }],
      subjectTreatment: treatment,
    });
  }

  return concepts;
}

function viableArchetypes(direction: StyleDirection, subjects: number): CompositionArchetype[] {
  const all = new Set<CompositionArchetype>(direction.archetypes);
  if (subjects === 0) {
    all.add("typographic-poster");
    for (const a of [...all]) {
      if (a.includes("portrait") || a.includes("subject") || a === "two-person-split" || a === "three-speaker-row" || a === "full-bleed-image-bottom-stack") {
        all.delete(a);
      }
    }
    all.add("typographic-poster");
    all.add("stacked-center-minimal");
  } else if (subjects === 1) {
    all.delete("two-person-split");
    all.delete("three-speaker-row");
  } else if (subjects === 2) {
    all.add("two-person-split");
    all.delete("three-speaker-row");
  } else {
    all.add("three-speaker-row");
  }
  return [...all];
}

function alignFor(archetype: CompositionArchetype): "left" | "center" | "right" {
  if (archetype === "portrait-left-headline-right") return "right";
  if (
    archetype === "portrait-center-headline-above" ||
    archetype === "portrait-center-headline-behind" ||
    archetype === "stacked-center-minimal" ||
    archetype === "two-person-split" ||
    archetype === "three-speaker-row"
  ) {
    return "center";
  }
  return "left";
}

function backgroundFor(
  direction: StyleDirection,
  palette: StyleDirection["palettes"][number],
  assets: AssetSummary[],
  rng: () => number,
): BackgroundPlan {
  const photo = assets.find((a) => a.kind === "photo" && a.ref.startsWith("background"));
  const kinds = direction.backgrounds;
  const kind = kinds[Math.floor(rng() * kinds.length)] ?? "solid";

  if (kind === "photo" && photo) {
    return { type: "photo", assetRef: photo.ref, darken: 0.55, blur: 0 };
  }
  if (kind === "gradient") {
    return { type: "gradient", from: palette.background, to: palette.surface, angle: 140 + Math.floor(rng() * 60) };
  }
  if (kind === "texture") {
    const textures = ["grain", "grid", "mesh", "topography", "halftone"] as const;
    return {
      type: "texture",
      texture: textures[Math.floor(rng() * textures.length)] ?? "grain",
      color: palette.accent,
      baseColor: palette.background,
      intensity: 0.12 + rng() * 0.2,
    };
  }
  return { type: "solid", color: palette.background };
}

function rationaleFor(direction: StyleDirection, archetype: CompositionArchetype, brief: DesignBrief): string {
  const subject = brief.people[0]?.name;
  return [
    `${direction.description}`,
    `Composition: ${pretty(archetype).toLowerCase()}${subject ? `, anchored on ${subject}` : ""}.`,
    `Hierarchy leads with the event name, then date, then venue.`,
  ].join(" ");
}

const OFFER_LEAD =
  /^(\s*(?:up to\s+)?(?:\d{1,3}\s*%\s*off|\$\d+(?:\.\d{2})?(?:\s*(?:off|each|only))?|bogo|buy\s+\w+\s+get\s+\w+|free\s+\w+|half\s+price|\d+\s+for\s+\d+))\b/i;

/**
 * Find the promotion in whatever field the customer typed it into. A small
 * business writes "20% off all gel sets" wherever there is a box; the offer is
 * the message, so it must never be left in a field the layout ignores.
 */
export function extractOffer(brief: DesignBrief): { offer: string; detail: string } {
  if (brief.offer) return { offer: brief.offer, detail: brief.offerDetail };

  const candidates = [brief.offerDetail, ...brief.extraLines, brief.callToAction].filter(
    (line): line is string => Boolean(line && line.trim().length > 0),
  );
  for (const line of candidates) {
    const match = OFFER_LEAD.exec(line);
    if (!match) continue;
    let lead = match[1]!.trim();
    let rest = line.slice(match[0].length).replace(/^[\s,:–-]+/, "").trim();
    // "Free brisket / sliders" reads as a mistake. A short trailing word belongs
    // to the offer, not to a line of its own.
    if (rest.length > 0 && !rest.includes(" ") && rest.length <= 10) {
      lead = `${lead} ${rest}`;
      rest = "";
    }
    return { offer: lead, detail: rest };
  }
  return { offer: "", detail: brief.offerDetail };
}

/** Content → slots. Nothing here is invented by a model (§33). */
function slotsFor(
  brief: DesignBrief,
  portraits: AssetSummary[],
  logo: AssetSummary | undefined,
  archetype: CompositionArchetype,
): SlotPlan[] {
  const slots: SlotPlan[] = [];
  const person = brief.people[0];
  const { offer, detail } = extractOffer(brief);

  if (offer) {
    // A promotion leads with the deal. The occasion is context, not the message.
    const eyebrow = brief.eventTitle || brief.seriesName || brief.organisationName;
    if (eyebrow) {
      slots.push({ role: "eyebrow", text: eyebrow, emphasis: 0.4, styleKey: "eyebrow", colorRole: "accent" });
    }
    slots.push({ role: "offer", text: offer, emphasis: 0.98, styleKey: "offer", colorRole: "ink" });
    if (detail) {
      slots.push({ role: "offer-detail", text: detail, emphasis: 0.5, styleKey: "offer-detail", colorRole: "inkMuted" });
    }
    if (brief.eventTitle && eyebrow !== brief.organisationName && brief.organisationName) {
      slots.push({
        role: "subheadline",
        text: brief.organisationName,
        emphasis: 0.45,
        styleKey: "subheadline",
        colorRole: "inkMuted",
      });
    }
    if (brief.promoCode) {
      slots.push({ role: "promo-code", text: `CODE ${brief.promoCode}`, emphasis: 0.5, styleKey: "promo-code", colorRole: "accent" });
    }
  } else {
    const eyebrow = brief.seriesName || brief.organisationName;
    if (eyebrow) {
      slots.push({ role: "eyebrow", text: eyebrow, emphasis: 0.35, styleKey: "eyebrow", colorRole: "accent" });
    }
    if (brief.eventTitle) {
      slots.push({ role: "headline", text: brief.eventTitle, emphasis: 0.95, styleKey: "headline", colorRole: "ink" });
    }
    for (const line of brief.extraLines.slice(0, 2)) {
      slots.push({ role: "body", text: line, emphasis: 0.4, styleKey: "body", colorRole: "inkMuted" });
    }
  }
  const hasSubheadline = slots.some((s) => s.role === "subheadline");
  if (person?.name && !hasSubheadline) {
    const label = person.title ? `${person.title} ${person.name}` : `with ${person.name}`;
    slots.push({ role: "subheadline", text: label, emphasis: 0.5, styleKey: "subheadline", colorRole: "inkMuted" });
  }
  if (brief.date) slots.push({ role: "date", text: brief.date, emphasis: 0.7, styleKey: "date", colorRole: "accent" });
  if (brief.time) slots.push({ role: "time", text: brief.time, emphasis: 0.5, styleKey: "time", colorRole: "ink" });
  if (brief.location) slots.push({ role: "location", text: brief.location, emphasis: 0.45, styleKey: "location", colorRole: "inkMuted" });
  if (brief.callToAction && brief.callToAction !== offer && !brief.callToAction.startsWith(offer)) {
    slots.push({ role: "cta", text: brief.callToAction, emphasis: 0.55, styleKey: "cta", colorRole: "accent" });
  }

  const maxSubjects = archetype === "three-speaker-row" ? 3 : archetype === "two-person-split" ? 2 : 1;
  portraits.slice(0, maxSubjects).forEach((asset, index) => {
    slots.push({
      role: index === 0 ? "subject" : "secondary-subject",
      assetRef: asset.ref,
      emphasis: 0.9 - index * 0.1,
      styleKey: "body",
      colorRole: "ink",
    });
  });

  if (logo) {
    slots.push({ role: "logo", assetRef: logo.ref, emphasis: 0.3, styleKey: "body", colorRole: "ink" });
  }

  const footer = [brief.website, brief.socials].filter(Boolean).join("  ·  ");
  if (footer) slots.push({ role: "footer", text: footer, emphasis: 0.2, styleKey: "footer", colorRole: "inkMuted" });

  return slots;
}
