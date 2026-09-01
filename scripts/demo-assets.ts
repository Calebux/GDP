import sharp from "sharp";

/** Synthetic stand-ins so the engine can be exercised without real uploads. */
export async function syntheticPortrait(width = 900, height = 1200): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3d4a63"/><stop offset="1" stop-color="#1a2130"/>
    </linearGradient></defs>
    <g>
      <ellipse cx="${width / 2}" cy="${height * 0.26}" rx="${width * 0.19}" ry="${height * 0.17}" fill="#c98b63"/>
      <path d="M ${width * 0.16} ${height} C ${width * 0.2} ${height * 0.58}, ${width * 0.36} ${height * 0.45}, ${width / 2} ${height * 0.45}
               C ${width * 0.64} ${height * 0.45}, ${width * 0.8} ${height * 0.58}, ${width * 0.84} ${height} Z" fill="url(#g)"/>
      <rect x="${width * 0.46}" y="${height * 0.5}" width="${width * 0.08}" height="${height * 0.5}" fill="#e8e8ec"/>
    </g>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function syntheticLogo(width = 400, height = 160): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g fill="#ffffff">
      <circle cx="${height / 2}" cy="${height / 2}" r="${height * 0.34}" fill="none" stroke="#ffffff" stroke-width="${height * 0.08}"/>
      <rect x="${height * 0.46}" y="${height * 0.2}" width="${height * 0.08}" height="${height * 0.6}"/>
      <rect x="${height * 0.24}" y="${height * 0.42}" width="${height * 0.52}" height="${height * 0.08}"/>
      <text x="${height * 1.1}" y="${height * 0.62}" font-family="Inter" font-size="${height * 0.34}" font-weight="700" fill="#ffffff">GRACE CITY</text>
    </g>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export function toDataUri(buffer: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
