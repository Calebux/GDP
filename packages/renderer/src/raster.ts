import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import { RenderError, createLogger } from "@gdp/core";
import type { DesignDocument } from "@gdp/design-schema";
import { allFontFiles } from "@gdp/fonts";
import { documentToSvg, type SvgOptions } from "./svg.js";

const log = createLogger("renderer");

export type ExportFormat = "png" | "jpg" | "webp" | "pdf" | "svg";

export interface RenderOptions extends SvgOptions {
  format?: ExportFormat;
  /** Multiplier on the canvas size. 2 = retina, 4 = print. */
  scale?: number;
  quality?: number;
  /** Draw a watermark — free-tier exports (§47). */
  watermark?: string;
  background?: string;
}

export interface RenderResult {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  svg: string;
  durationMs: number;
}

function rasterise(svg: string, width: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round(width) },
    font: {
      fontFiles: allFontFiles(),
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
    // Text rendering quality matters more than speed here.
    textRendering: 2,
    shapeRendering: 2,
    imageRendering: 0,
  });
  return Buffer.from(resvg.render().asPng());
}

export async function renderDocument(
  doc: DesignDocument,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const started = Date.now();
  const format = options.format ?? "png";
  const scale = options.scale ?? 1;
  const width = Math.round(doc.canvas.width * scale);
  const height = Math.round(doc.canvas.height * scale);

  const svg = await documentToSvg(doc, options);
  if (format === "svg") {
    return {
      buffer: Buffer.from(svg, "utf8"),
      contentType: "image/svg+xml",
      width,
      height,
      svg,
      durationMs: Date.now() - started,
    };
  }

  let png: Buffer;
  try {
    png = rasterise(svg, width);
  } catch (error) {
    log.error("rasterisation failed", { error: String(error) });
    throw new RenderError("Could not rasterise the design", { cause: String(error) });
  }

  const withMark = options.watermark ? await applyWatermark(png, width, height, options.watermark) : png;

  switch (format) {
    case "png":
      return finish(withMark, "image/png", width, height, svg, started);
    case "jpg": {
      const buffer = await sharp(withMark)
        .flatten({ background: options.background ?? "#ffffff" })
        .jpeg({ quality: options.quality ?? 92, chromaSubsampling: "4:4:4" })
        .toBuffer();
      return finish(buffer, "image/jpeg", width, height, svg, started);
    }
    case "webp": {
      const buffer = await sharp(withMark).webp({ quality: options.quality ?? 92 }).toBuffer();
      return finish(buffer, "image/webp", width, height, svg, started);
    }
    case "pdf": {
      const buffer = await toPdf(withMark, doc, width, height);
      return finish(buffer, "application/pdf", width, height, svg, started);
    }
    default:
      throw new RenderError(`Unsupported export format: ${format}`);
  }
}

function finish(
  buffer: Buffer,
  contentType: string,
  width: number,
  height: number,
  svg: string,
  started: number,
): RenderResult {
  return { buffer, contentType, width, height, svg, durationMs: Date.now() - started };
}

async function applyWatermark(
  png: Buffer,
  width: number,
  height: number,
  text: string,
): Promise<Buffer> {
  const fontSize = Math.max(18, Math.round(width * 0.028));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g opacity="0.55"><rect x="${
    width - fontSize * text.length * 0.62 - fontSize
  }" y="${height - fontSize * 2.4}" width="${fontSize * text.length * 0.62 + fontSize * 0.6}" height="${
    fontSize * 1.6
  }" rx="${fontSize * 0.3}" fill="#000000" opacity="0.45"/><text x="${width - fontSize * 0.7}" y="${
    height - fontSize * 1.2
  }" font-family="Inter" font-size="${fontSize}" font-weight="600" fill="#ffffff" text-anchor="end">${text}</text></g></svg>`;
  const overlay = rasterise(svg, width);
  return sharp(png).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer();
}

/**
 * A print-ready PDF wrapping the rendered raster at the document's dpi.
 * Vector PDF export (real text objects) is a later upgrade — see docs/ROADMAP.md.
 */
async function toPdf(
  png: Buffer,
  doc: DesignDocument,
  width: number,
  height: number,
): Promise<Buffer> {
  const dpi = doc.canvas.dpi || 72;
  const ptWidth = (doc.canvas.width / dpi) * 72;
  const ptHeight = (doc.canvas.height / dpi) * 72;

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: [ptWidth, ptHeight], margin: 0, info: { Title: doc.meta.title } });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.image(png, 0, 0, { width: ptWidth, height: ptHeight });
    pdf.end();
    void width;
    void height;
  });
}
