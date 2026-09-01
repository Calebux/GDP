import type {
  BackgroundPlan,
  CompositionArchetype,
  DecorationPlan,
  ImageTreatment,
  PalettePlan,
} from "@gdp/design-schema";

/**
 * §51 — the MVP's curated visual directions. Each is a small design system:
 * palettes, type pairings, compositions and treatments that are known to work
 * together. This is where a real designer's taste is encoded.
 */
export interface StyleDirection {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  /** Which vertical this direction was designed for. */
  audience: "church" | "smb" | "any";
  /** Business types this suits, for direction matching. */
  businessTypes?: string[];
  palettes: PalettePlan[];
  headlineFonts: string[];
  supportFonts: string[];
  archetypes: CompositionArchetype[];
  backgrounds: BackgroundPlan["type"][];
  decorations: DecorationPlan["kind"][];
  subjectTreatments: ImageTreatment[][];
  dna: { energy: number; minimalism: number; contrast: number; spacing: "tight" | "balanced" | "generous" };
  typography: { headlineCase: "none" | "uppercase" | "capitalize"; tracking: number; scaleContrast: number };
}

export const STYLE_DIRECTIONS: StyleDirection[] = [
  {
    id: "contemporary-ministry",
    name: "Contemporary Ministry",
    description: "Editorial condensed headline, restrained palette, one confident accent.",
    keywords: ["contemporary", "modern", "church", "clean", "confident"],
    audience: "church",
    palettes: [
      { name: "Ink & Citrus", background: "#101018", surface: "#1b1c28", ink: "#f5f4f0", inkMuted: "#a8a7b4", accent: "#f2c14e", accentAlt: "#6f7bff" },
      { name: "Bone & Ink", background: "#f3f0e9", surface: "#e4dfd3", ink: "#15151a", inkMuted: "#5d5b57", accent: "#c2410c" },
    ],
    headlineFonts: ["Archivo Black", "Big Shoulders Display", "Bricolage Grotesque"],
    supportFonts: ["Inter", "DM Sans", "Manrope"],
    archetypes: ["portrait-right-headline-left", "portrait-left-headline-right", "editorial-grid"],
    backgrounds: ["gradient", "solid", "texture"],
    decorations: ["accent-bar", "none", "grid-lines"],
    subjectTreatments: [[], [{ type: "rim-light", color: "#f2c14e", intensity: 0.45, angle: 215 }]],
    dna: { energy: 0.7, minimalism: 0.55, contrast: 0.85, spacing: "balanced" },
    typography: { headlineCase: "uppercase", tracking: -0.025, scaleContrast: 3 },
  },
  {
    id: "youth-conference",
    name: "Youth Conference",
    description: "Loud condensed type, saturated colour, high energy and movement.",
    keywords: ["youth", "energetic", "loud", "young", "vibrant", "teen"],
    audience: "church",
    palettes: [
      { name: "Voltage", background: "#0d0d0d", surface: "#1a1a1a", ink: "#ffffff", inkMuted: "#b3b3b3", accent: "#d6ff00", accentAlt: "#ff3d81" },
      { name: "Sunburst", background: "#1b0f3b", surface: "#2b1a55", ink: "#fff8e7", inkMuted: "#c3b6e0", accent: "#ff7a1a", accentAlt: "#00e0c6" },
    ],
    headlineFonts: ["Anton", "Big Shoulders Display", "Bebas Neue"],
    supportFonts: ["Space Grotesk", "Barlow", "Inter"],
    archetypes: ["headline-dominant-portrait-small", "portrait-center-headline-behind", "split-diagonal"],
    backgrounds: ["gradient", "texture", "solid"],
    decorations: ["diagonal-slash", "dotted-field", "circle-badge"],
    subjectTreatments: [[{ type: "duotone", shadow: "#1b0f3b", highlight: "#d6ff00", strength: 0.85 }], []],
    dna: { energy: 0.95, minimalism: 0.25, contrast: 0.95, spacing: "tight" },
    typography: { headlineCase: "uppercase", tracking: -0.01, scaleContrast: 4 },
  },
  {
    id: "premium-editorial",
    name: "Premium Editorial",
    description: "Magazine restraint: high-contrast serif, generous white space, quiet palette.",
    keywords: ["premium", "editorial", "elegant", "magazine", "refined", "sophisticated"],
    audience: "church",
    palettes: [
      { name: "Paper & Ink", background: "#f6f4ef", surface: "#e8e4da", ink: "#141414", inkMuted: "#6b6862", accent: "#9a3412" },
      { name: "Charcoal Editorial", background: "#16161a", surface: "#22222a", ink: "#f4f2ed", inkMuted: "#9d9a94", accent: "#d4b483" },
    ],
    headlineFonts: ["Instrument Serif", "Playfair Display", "Cormorant Garamond"],
    supportFonts: ["DM Sans", "Inter", "Work Sans"],
    archetypes: ["editorial-grid", "portrait-right-headline-left", "stacked-center-minimal"],
    backgrounds: ["solid", "texture"],
    decorations: ["none", "grid-lines", "accent-bar"],
    subjectTreatments: [[{ type: "monochrome", strength: 0.9 }], []],
    dna: { energy: 0.4, minimalism: 0.8, contrast: 0.75, spacing: "generous" },
    typography: { headlineCase: "none", tracking: -0.015, scaleContrast: 3.4 },
  },
  {
    id: "powerful-revival",
    name: "Powerful Revival",
    description: "Weighty caps, deep shadow, urgency without shouting.",
    keywords: ["revival", "powerful", "bold", "prayer", "intense", "crusade"],
    audience: "church",
    palettes: [
      { name: "Ember", background: "#0a0708", surface: "#1a0f10", ink: "#f7f2ee", inkMuted: "#a9958e", accent: "#e63946", accentAlt: "#f4a261" },
      { name: "Deep Gold", background: "#0b0a06", surface: "#1c1810", ink: "#f8f4e6", inkMuted: "#b0a68a", accent: "#e9c46a" },
    ],
    headlineFonts: ["Big Shoulders Display", "Anton", "Archivo Black"],
    supportFonts: ["Barlow Condensed", "Inter", "Barlow"],
    archetypes: ["portrait-center-headline-behind", "portrait-right-headline-left", "full-bleed-image-bottom-stack"],
    backgrounds: ["gradient", "photo", "texture"],
    decorations: ["arc", "accent-bar", "none"],
    subjectTreatments: [
      [{ type: "rim-light", color: "#e9c46a", intensity: 0.6, angle: 200 }],
      [{ type: "duotone", shadow: "#0a0708", highlight: "#e63946", strength: 0.7 }],
    ],
    dna: { energy: 0.85, minimalism: 0.35, contrast: 0.95, spacing: "tight" },
    typography: { headlineCase: "uppercase", tracking: -0.02, scaleContrast: 3.6 },
  },
  {
    id: "clean-minimal",
    name: "Clean Minimal",
    description: "One typeface, huge margins, nothing that is not carrying meaning.",
    keywords: ["minimal", "clean", "simple", "quiet", "swiss"],
    audience: "church",
    palettes: [
      { name: "Off White", background: "#fbfbf9", surface: "#eeeeea", ink: "#111113", inkMuted: "#6f6f75", accent: "#2563eb" },
      { name: "Graphite", background: "#17181b", surface: "#232529", ink: "#f7f7f5", inkMuted: "#9a9ba1", accent: "#7dd3fc" },
    ],
    headlineFonts: ["Inter", "Manrope", "Archivo"],
    supportFonts: ["Inter", "Manrope"],
    archetypes: ["stacked-center-minimal", "editorial-grid", "portrait-left-headline-right"],
    backgrounds: ["solid"],
    decorations: ["none", "accent-bar"],
    subjectTreatments: [[], [{ type: "monochrome", strength: 1 }]],
    dna: { energy: 0.3, minimalism: 0.95, contrast: 0.7, spacing: "generous" },
    typography: { headlineCase: "none", tracking: -0.03, scaleContrast: 2.4 },
  },
  {
    id: "worship-night",
    name: "Worship Night",
    description: "Atmospheric gradients, soft glow, type that recedes into the light.",
    keywords: ["worship", "night", "atmospheric", "soft", "prayer", "encounter"],
    audience: "church",
    palettes: [
      { name: "Midnight Violet", background: "#0b0a1f", surface: "#171436", ink: "#f2efff", inkMuted: "#a9a3d0", accent: "#8b5cf6", accentAlt: "#38bdf8" },
      { name: "Deep Teal", background: "#04141a", surface: "#0b2731", ink: "#eafaff", inkMuted: "#8fb6c1", accent: "#22d3ee" },
    ],
    headlineFonts: ["Syne", "Sora", "Manrope"],
    supportFonts: ["Manrope", "Inter"],
    archetypes: ["full-bleed-image-bottom-stack", "portrait-center-headline-above", "stacked-center-minimal"],
    backgrounds: ["gradient", "texture", "photo"],
    decorations: ["arc", "none", "dotted-field"],
    subjectTreatments: [[{ type: "rim-light", color: "#8b5cf6", intensity: 0.55, angle: 250 }], []],
    dna: { energy: 0.45, minimalism: 0.7, contrast: 0.7, spacing: "generous" },
    typography: { headlineCase: "none", tracking: -0.02, scaleContrast: 2.8 },
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Full-bleed photography, deep scrim, small assured type at the base.",
    keywords: ["cinematic", "film", "dramatic", "photographic", "trailer"],
    audience: "church",
    palettes: [
      { name: "Noir", background: "#08090b", surface: "#131519", ink: "#f5f5f4", inkMuted: "#a1a1aa", accent: "#f97316" },
      { name: "Cold Steel", background: "#0b0f14", surface: "#161d26", ink: "#eef4f8", inkMuted: "#93a4b3", accent: "#60a5fa" },
    ],
    headlineFonts: ["Oswald", "Barlow Condensed", "Archivo"],
    supportFonts: ["Inter", "Barlow"],
    archetypes: ["full-bleed-image-bottom-stack", "portrait-center-headline-behind"],
    backgrounds: ["photo", "gradient"],
    decorations: ["none", "corner-brackets"],
    subjectTreatments: [[{ type: "monochrome", strength: 0.4 }], [{ type: "grain", amount: 0.18 }]],
    dna: { energy: 0.6, minimalism: 0.7, contrast: 0.9, spacing: "balanced" },
    typography: { headlineCase: "uppercase", tracking: 0.04, scaleContrast: 2.6 },
  },
  {
    id: "modern-african",
    name: "Modern African",
    description: "Earth and indigo, confident geometry, pattern used with discipline.",
    keywords: ["african", "lagos", "accra", "nairobi", "earth", "pattern", "heritage"],
    audience: "church",
    palettes: [
      { name: "Clay & Indigo", background: "#12131a", surface: "#1f2330", ink: "#fdf6ec", inkMuted: "#bda88f", accent: "#e07a35", accentAlt: "#2f5d9e" },
      { name: "Ochre Light", background: "#f7efe3", surface: "#ecdcc4", ink: "#1a1712", inkMuted: "#6a5a44", accent: "#a63d1c", accentAlt: "#2f5d9e" },
    ],
    headlineFonts: ["Archivo Black", "Anton", "Bricolage Grotesque"],
    supportFonts: ["Work Sans", "Inter", "Archivo"],
    archetypes: ["split-diagonal", "portrait-right-headline-left", "editorial-grid"],
    backgrounds: ["texture", "gradient", "solid"],
    decorations: ["dotted-field", "accent-bar", "grid-lines"],
    subjectTreatments: [[], [{ type: "duotone", shadow: "#12131a", highlight: "#e07a35", strength: 0.6 }]],
    dna: { energy: 0.75, minimalism: 0.45, contrast: 0.85, spacing: "balanced" },
    typography: { headlineCase: "uppercase", tracking: -0.02, scaleContrast: 3.2 },
  },
  {
    id: "corporate-ministry",
    name: "Corporate Ministry",
    description: "Structured grid, navy and slate, the tone of an annual conference.",
    keywords: ["corporate", "conference", "professional", "leadership", "summit"],
    audience: "church",
    palettes: [
      { name: "Navy Slate", background: "#0f172a", surface: "#1e293b", ink: "#f8fafc", inkMuted: "#94a3b8", accent: "#38bdf8" },
      { name: "Stone", background: "#f8fafc", surface: "#e2e8f0", ink: "#0f172a", inkMuted: "#475569", accent: "#0ea5e9" },
    ],
    headlineFonts: ["Sora", "Archivo", "Manrope"],
    supportFonts: ["Inter", "Work Sans"],
    archetypes: ["editorial-grid", "three-speaker-row", "portrait-left-headline-right"],
    backgrounds: ["solid", "gradient"],
    decorations: ["grid-lines", "accent-bar", "none"],
    subjectTreatments: [[], [{ type: "monochrome", strength: 0.5 }]],
    dna: { energy: 0.45, minimalism: 0.65, contrast: 0.8, spacing: "balanced" },
    typography: { headlineCase: "none", tracking: -0.02, scaleContrast: 2.6 },
  },
  {
    id: "bold-typography",
    name: "Bold Typography",
    description: "The type is the design. No portrait needed, nowhere to hide.",
    keywords: ["typographic", "type", "poster", "statement", "bold"],
    audience: "church",
    palettes: [
      { name: "Hazard", background: "#111111", surface: "#1c1c1c", ink: "#fafafa", inkMuted: "#a3a3a3", accent: "#facc15" },
      { name: "Ink on Cream", background: "#f5f1e8", surface: "#e6dfd0", ink: "#101010", inkMuted: "#5c584f", accent: "#dc2626" },
    ],
    headlineFonts: ["Anton", "Archivo Black", "Unbounded"],
    supportFonts: ["Archivo", "Inter"],
    archetypes: ["typographic-poster", "headline-dominant-portrait-small"],
    backgrounds: ["solid", "texture"],
    decorations: ["accent-bar", "grid-lines", "none"],
    subjectTreatments: [[]],
    dna: { energy: 0.85, minimalism: 0.6, contrast: 1, spacing: "tight" },
    typography: { headlineCase: "uppercase", tracking: -0.035, scaleContrast: 5 },
  },
  {
    id: "luxury-conference",
    name: "Luxury Conference",
    description: "Deep green and gold, serif headline, the feel of a gala invitation.",
    keywords: ["luxury", "gala", "banquet", "anniversary", "gold", "elegant"],
    audience: "church",
    palettes: [
      { name: "Emerald & Gold", background: "#08150f", surface: "#122a1e", ink: "#f7f3e8", inkMuted: "#b9b09a", accent: "#d4af37" },
      { name: "Merlot", background: "#1a0a12", surface: "#2c1220", ink: "#fdf5f0", inkMuted: "#c3a7ae", accent: "#e0c097" },
    ],
    headlineFonts: ["Playfair Display", "Cormorant Garamond", "Instrument Serif"],
    supportFonts: ["Manrope", "Inter", "DM Sans"],
    archetypes: ["portrait-right-headline-left", "stacked-center-minimal", "editorial-grid"],
    backgrounds: ["gradient", "texture", "solid"],
    decorations: ["arc", "corner-brackets", "accent-bar"],
    subjectTreatments: [[{ type: "rim-light", color: "#d4af37", intensity: 0.4, angle: 210 }], []],
    dna: { energy: 0.45, minimalism: 0.7, contrast: 0.8, spacing: "generous" },
    typography: { headlineCase: "none", tracking: -0.01, scaleContrast: 3 },
  },
  {
    id: "colourful-youth",
    name: "Colourful Youth",
    description: "Playful geometry and saturated pairs, still built on a strict grid.",
    keywords: ["colourful", "playful", "fun", "teens", "kids", "vacation bible school"],
    audience: "church",
    palettes: [
      { name: "Pop", background: "#160b2c", surface: "#26124a", ink: "#ffffff", inkMuted: "#cbb8f0", accent: "#ff5ca8", accentAlt: "#3ddc97" },
      { name: "Citrus Pop", background: "#0f2027", surface: "#16323c", ink: "#f7fff8", inkMuted: "#a6c8bd", accent: "#ffd166", accentAlt: "#ef476f" },
    ],
    headlineFonts: ["Unbounded", "Bricolage Grotesque", "Syne"],
    supportFonts: ["DM Sans", "Space Grotesk", "Manrope"],
    archetypes: ["two-person-split", "headline-dominant-portrait-small", "portrait-center-headline-above"],
    backgrounds: ["gradient", "texture"],
    decorations: ["circle-badge", "dotted-field", "diagonal-slash"],
    subjectTreatments: [[], [{ type: "duotone", shadow: "#160b2c", highlight: "#ff5ca8", strength: 0.5 }]],
    dna: { energy: 0.9, minimalism: 0.3, contrast: 0.85, spacing: "balanced" },
    typography: { headlineCase: "uppercase", tracking: -0.02, scaleContrast: 3.4 },
  },

  // ---------------------------------------------------------------- small business
  // Occasion-driven promotions: the offer is the message, the canvas is usually
  // carried by type because most of these briefs arrive with a logo at best.

  {
    id: "retail-sale",
    name: "Retail Sale",
    description: "The number is the design. Hard colour, hard type, nothing decorative.",
    keywords: ["sale", "discount", "percent", "off", "clearance", "retail", "shop"],
    audience: "smb",
    businessTypes: ["retail", "boutique", "shop", "store", "grocery"],
    palettes: [
      { name: "Red Alert", background: "#111111", surface: "#1d1d1d", ink: "#ffffff", inkMuted: "#a5a5a5", accent: "#e11d48", accentAlt: "#facc15" },
      { name: "Paper Sale", background: "#fffdf7", surface: "#f2ede1", ink: "#111111", inkMuted: "#5f5b52", accent: "#dc2626" },
    ],
    headlineFonts: ["Anton", "Archivo Black", "Big Shoulders Display"],
    supportFonts: ["Archivo", "Inter", "Barlow"],
    archetypes: ["offer-block-center", "banded-poster", "typographic-poster"],
    backgrounds: ["solid", "gradient"],
    decorations: ["accent-bar", "none", "diagonal-slash"],
    subjectTreatments: [[]],
    dna: { energy: 0.9, minimalism: 0.5, contrast: 1, spacing: "tight" },
    typography: { headlineCase: "uppercase", tracking: -0.035, scaleContrast: 4.5 },
  },
  {
    id: "beauty-premium",
    name: "Beauty Premium",
    description: "Salon calm: warm neutrals, a high-contrast serif, and a lot of air.",
    keywords: ["nail", "salon", "spa", "lash", "beauty", "hair", "elegant", "premium", "luxury"],
    audience: "smb",
    businessTypes: ["nail-salon", "spa", "hair-salon", "lashes", "aesthetics", "barber"],
    palettes: [
      { name: "Blush & Bone", background: "#f7f1ea", surface: "#ece0d4", ink: "#1c1613", inkMuted: "#7a6a5d", accent: "#b76e79" },
      { name: "Noir Gold", background: "#141110", surface: "#221d1a", ink: "#f8f3ec", inkMuted: "#b5a698", accent: "#c9a227" },
    ],
    headlineFonts: ["Instrument Serif", "Playfair Display", "Cormorant Garamond"],
    supportFonts: ["DM Sans", "Manrope", "Inter"],
    archetypes: ["stacked-center-minimal", "offer-block-center", "editorial-grid"],
    backgrounds: ["solid", "gradient", "texture"],
    decorations: ["none", "arc", "accent-bar"],
    subjectTreatments: [[], [{ type: "monochrome", strength: 0.6 }]],
    dna: { energy: 0.35, minimalism: 0.85, contrast: 0.7, spacing: "generous" },
    typography: { headlineCase: "none", tracking: -0.01, scaleContrast: 3.2 },
  },
  {
    id: "food-appetite",
    name: "Food & Appetite",
    description: "Warm, hungry colour and heavy type — reads from across a street.",
    keywords: ["food", "restaurant", "bbq", "pizza", "cafe", "truck", "kitchen", "menu", "loud"],
    audience: "smb",
    businessTypes: ["restaurant", "food-truck", "cafe", "bakery", "bar", "catering"],
    palettes: [
      { name: "Smoke & Ember", background: "#17110d", surface: "#2a1d14", ink: "#fff6e9", inkMuted: "#c3a689", accent: "#f4801f", accentAlt: "#e63a24" },
      { name: "Butter", background: "#fff4dc", surface: "#f6e3bd", ink: "#231708", inkMuted: "#7a6244", accent: "#c1350f" },
    ],
    headlineFonts: ["Archivo Black", "Anton", "Bricolage Grotesque"],
    supportFonts: ["Barlow", "Work Sans", "Inter"],
    archetypes: ["offer-block-center", "banded-poster", "full-bleed-image-bottom-stack"],
    backgrounds: ["gradient", "texture", "photo"],
    decorations: ["accent-bar", "circle-badge", "none"],
    subjectTreatments: [[], [{ type: "grain", amount: 0.12 }]],
    dna: { energy: 0.85, minimalism: 0.4, contrast: 0.9, spacing: "balanced" },
    typography: { headlineCase: "uppercase", tracking: -0.03, scaleContrast: 4 },
  },
  {
    id: "fitness-bold",
    name: "Fitness Bold",
    description: "Black, volt and condensed caps. Urgency without confetti.",
    keywords: ["gym", "fitness", "training", "bootcamp", "crossfit", "strong", "challenge"],
    audience: "smb",
    businessTypes: ["gym", "personal-trainer", "studio", "martial-arts", "yoga"],
    palettes: [
      { name: "Volt", background: "#0b0b0b", surface: "#181818", ink: "#ffffff", inkMuted: "#9c9c9c", accent: "#ccff00" },
      { name: "Steel", background: "#0f1418", surface: "#1b2329", ink: "#f2f7fa", inkMuted: "#93a3ad", accent: "#ff4d2e" },
    ],
    headlineFonts: ["Big Shoulders Display", "Anton", "Barlow Condensed"],
    supportFonts: ["Barlow Condensed", "Inter", "Archivo"],
    archetypes: ["offer-block-center", "banded-poster", "headline-dominant-portrait-small"],
    backgrounds: ["solid", "gradient", "texture"],
    decorations: ["diagonal-slash", "accent-bar", "grid-lines"],
    subjectTreatments: [[{ type: "duotone", shadow: "#0b0b0b", highlight: "#ccff00", strength: 0.8 }], []],
    dna: { energy: 1, minimalism: 0.45, contrast: 1, spacing: "tight" },
    typography: { headlineCase: "uppercase", tracking: 0.01, scaleContrast: 4.5 },
  },
  {
    id: "service-trust",
    name: "Trusted Trade",
    description: "Plain, sturdy and legible — the look of a business that turns up.",
    keywords: ["plumbing", "cleaning", "electrician", "repair", "service", "trust", "local", "reliable"],
    audience: "smb",
    businessTypes: ["plumber", "electrician", "cleaner", "landscaping", "auto-repair", "moving", "hvac"],
    palettes: [
      { name: "Workwear Navy", background: "#0e2138", surface: "#183351", ink: "#f6fafd", inkMuted: "#a3b8cc", accent: "#ffb703" },
      { name: "Clean White", background: "#ffffff", surface: "#eef2f6", ink: "#0e2138", inkMuted: "#5b7185", accent: "#0a7ea4" },
    ],
    headlineFonts: ["Archivo Black", "Sora", "Archivo"],
    supportFonts: ["Inter", "Work Sans", "Barlow"],
    archetypes: ["banded-poster", "offer-block-center", "editorial-grid"],
    backgrounds: ["solid", "gradient"],
    decorations: ["accent-bar", "none", "grid-lines"],
    subjectTreatments: [[]],
    dna: { energy: 0.5, minimalism: 0.6, contrast: 0.9, spacing: "balanced" },
    typography: { headlineCase: "uppercase", tracking: -0.02, scaleContrast: 3.4 },
  },
  {
    id: "grand-opening",
    name: "Grand Opening",
    description: "Celebratory without novelty type — colour does the shouting.",
    keywords: ["opening", "launch", "new", "now open", "celebration", "anniversary", "ribbon"],
    audience: "smb",
    businessTypes: ["retail", "restaurant", "salon", "gym", "clinic", "cafe"],
    palettes: [
      { name: "Confetti Navy", background: "#101c3d", surface: "#1b2b57", ink: "#fdfdff", inkMuted: "#a8b3d4", accent: "#ff5c7a", accentAlt: "#ffd166" },
      { name: "Fresh Mint", background: "#06322b", surface: "#0c4a3f", ink: "#f2fff9", inkMuted: "#9fc9bb", accent: "#ffd166" },
    ],
    headlineFonts: ["Bricolage Grotesque", "Unbounded", "Archivo Black"],
    supportFonts: ["DM Sans", "Manrope", "Inter"],
    archetypes: ["offer-block-center", "banded-poster", "stacked-center-minimal"],
    backgrounds: ["gradient", "texture", "solid"],
    decorations: ["circle-badge", "dotted-field", "accent-bar"],
    subjectTreatments: [[]],
    dna: { energy: 0.85, minimalism: 0.45, contrast: 0.85, spacing: "balanced" },
    typography: { headlineCase: "uppercase", tracking: -0.025, scaleContrast: 3.8 },
  },
  {
    id: "holiday-sale",
    name: "Holiday Sale",
    description: "Black Friday register: near-black ground, one electric accent.",
    keywords: ["black friday", "cyber monday", "holiday", "christmas", "boxing day", "deal", "doorbuster"],
    audience: "smb",
    businessTypes: ["retail", "ecommerce", "salon", "barber", "gym", "restaurant"],
    palettes: [
      { name: "Midnight Deal", background: "#050505", surface: "#121212", ink: "#ffffff", inkMuted: "#8f8f8f", accent: "#00e5a0", accentAlt: "#ff2e63" },
      { name: "Pine & Cream", background: "#0a1f18", surface: "#123528", ink: "#fbf7ee", inkMuted: "#a9bfb4", accent: "#e0b44a" },
    ],
    headlineFonts: ["Unbounded", "Anton", "Archivo Black"],
    supportFonts: ["Space Grotesk", "Inter", "Manrope"],
    archetypes: ["offer-block-center", "typographic-poster", "banded-poster"],
    backgrounds: ["solid", "gradient", "texture"],
    decorations: ["grid-lines", "accent-bar", "none"],
    subjectTreatments: [[]],
    dna: { energy: 0.9, minimalism: 0.6, contrast: 1, spacing: "balanced" },
    typography: { headlineCase: "uppercase", tracking: -0.03, scaleContrast: 4.2 },
  },
  {
    id: "modern-boutique",
    name: "Modern Boutique",
    description: "Quiet retail: soft ground, restrained serif, one small accent.",
    keywords: ["boutique", "lifestyle", "studio", "handmade", "soft", "calm", "minimal", "clean"],
    audience: "smb",
    businessTypes: ["boutique", "florist", "studio", "coffee", "wellness", "clinic"],
    palettes: [
      { name: "Oat", background: "#f6f3ee", surface: "#e8e2d8", ink: "#1a1a18", inkMuted: "#6d675e", accent: "#7c6a53" },
      { name: "Sage", background: "#eef1ea", surface: "#dfe5d9", ink: "#1b241c", inkMuted: "#6b7a6c", accent: "#3f6b52" },
    ],
    headlineFonts: ["Instrument Serif", "Bricolage Grotesque", "Playfair Display"],
    supportFonts: ["DM Sans", "Inter", "Manrope"],
    archetypes: ["stacked-center-minimal", "editorial-grid", "offer-block-center"],
    backgrounds: ["solid", "texture"],
    decorations: ["none", "accent-bar"],
    subjectTreatments: [[]],
    dna: { energy: 0.3, minimalism: 0.9, contrast: 0.65, spacing: "generous" },
    typography: { headlineCase: "none", tracking: -0.015, scaleContrast: 2.8 },
  },
];



export const DIRECTIONS_BY_ID = new Map(STYLE_DIRECTIONS.map((d) => [d.id, d]));

export interface DirectionQuery {
  /** Explicit direction id, if the customer picked one. */
  id?: string;
  /** Free text: "premium and elegant", "loud", "make it feel young". */
  feeling?: string;
  /** The occasion and the offer — "Black Friday", "Grand Opening", "20% off". */
  occasion?: string;
  /** "nail-salon", "food-truck", "gym"… */
  businessType?: string;
  category?: string;
}

function audienceFor(query: DirectionQuery): "church" | "smb" {
  const text = `${query.category ?? ""} ${query.businessType ?? ""}`.toLowerCase();
  return /church|ministry|worship|parish|gospel/.test(text) ? "church" : "smb";
}

/**
 * Match a brief to a curated direction (§5 "or describes the feeling").
 * Business type is the strongest signal, then explicit feeling words — a nail
 * salon should never land on a youth-conference aesthetic because both said
 * "energetic".
 */
export function matchDirection(query: DirectionQuery): StyleDirection {
  const audience = audienceFor(query);
  const pool = STYLE_DIRECTIONS.filter((d) => d.audience === audience || d.audience === "any");
  const text = `${query.feeling ?? ""} ${query.occasion ?? ""}`.toLowerCase();
  const businessType = (query.businessType ?? "").toLowerCase();

  let best = pool[0]!;
  let bestScore = -1;
  for (const direction of pool) {
    let score = 0;
    if (businessType && direction.businessTypes?.includes(businessType)) score += 8;
    if (businessType) {
      for (const type of direction.businessTypes ?? []) {
        if (businessType.includes(type) || type.includes(businessType)) score += 4;
      }
    }
    if (text.includes(direction.id.replace(/-/g, " "))) score += 6;
    if (text.includes(direction.name.toLowerCase())) score += 6;
    for (const keyword of direction.keywords) if (text.includes(keyword)) score += 3;
    // An explicit occasion ("Black Friday") outranks a vague mood word.
    const occasion = (query.occasion ?? "").toLowerCase();
    for (const keyword of direction.keywords) if (occasion.includes(keyword)) score += 4;
    if (score > bestScore) {
      bestScore = score;
      best = direction;
    }
  }
  return best;
}

export function resolveDirection(query: DirectionQuery): StyleDirection {
  if (query.id && DIRECTIONS_BY_ID.has(query.id)) return DIRECTIONS_BY_ID.get(query.id)!;
  return matchDirection(query);
}

/** Compact catalogue for planner prompts (§32 — cheap context). */
export function directionsDigest(audience: "church" | "smb" | "all" = "all"): string {
  return STYLE_DIRECTIONS.filter((d) => audience === "all" || d.audience === audience || d.audience === "any").map(
    (d) => `${d.id}: ${d.description} [archetypes: ${d.archetypes.join(", ")}; fonts: ${d.headlineFonts[0]}/${d.supportFonts[0]}]`,
  ).join("\n");
}
