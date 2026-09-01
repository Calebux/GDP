export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function attrs(record: Record<string, string | number | undefined | null>): string {
  return Object.entries(record)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}="${typeof v === "number" ? round(v) : escapeXml(String(v))}"`)
    .join(" ");
}

export function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Deterministic id suffixes keep rendered SVG byte-identical across runs. */
export class DefsBuilder {
  private readonly parts: string[] = [];
  private counter = 0;

  add(markup: string): void {
    this.parts.push(markup);
  }

  nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}${this.counter}`;
  }

  toString(): string {
    return this.parts.length > 0 ? `<defs>${this.parts.join("")}</defs>` : "";
  }
}
