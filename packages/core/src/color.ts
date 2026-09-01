export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function parseHex(hex: string): Rgb | null {
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  let body = m[1]!;
  if (body.length === 3) body = body.split("").map((c) => c + c).join("");
  const int = Number.parseInt(body.slice(0, 6), 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) → 1 (white). */
export function relativeLuminance(color: string | Rgb): number {
  const rgb = typeof color === "string" ? parseHex(color) : color;
  if (!rgb) return 0;
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** WCAG contrast ratio, 1 → 21. §21 readability checks depend on this. */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function isDark(color: string | Rgb): boolean {
  return relativeLuminance(color) < 0.35;
}

/** Pick whichever candidate reads best on `background`. */
export function bestContrast(background: string, candidates: string[]): string {
  let best = candidates[0] ?? "#ffffff";
  let bestRatio = -1;
  for (const c of candidates) {
    const ratio = contrastRatio(background, c);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = c;
    }
  }
  return best;
}

export function mix(a: string, b: string, amount: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const t = Math.min(1, Math.max(0, amount));
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export const darken = (hex: string, amount: number): string => mix(hex, "#000000", amount);
export const lighten = (hex: string, amount: number): string => mix(hex, "#ffffff", amount);

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

/** Warm/cool classification used by reference metadata (§10). */
export function temperature(hex: string): "warm" | "cool" | "neutral" {
  const rgb = parseHex(hex);
  if (!rgb) return "neutral";
  const { h, s } = rgbToHsl(rgb);
  if (s < 0.12) return "neutral";
  return h < 90 || h > 300 ? "warm" : "cool";
}
