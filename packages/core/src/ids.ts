/** Prefixed, sortable-enough ids. Prefixes make logs and design JSON readable. */
export type IdPrefix =
  | "proj"
  | "des"
  | "ver"
  | "ast"
  | "ref"
  | "brand"
  | "gen"
  | "usr"
  | "org"
  | "layer"
  | "job"
  | "pack"
  | "pay"
  | "ord"
  | "evt"
  | "wal"
  | "ctx"
  | "shr"
  | "vqs"
  | "smpl"
  | "s"
  | "sec"
  | "r"
  | "rt"
  | "rating"
  | "wh"
  | "vis"
  | "photo"
  | (string & {});

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomSuffix(length = 10): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${randomSuffix()}`;
}

export function newUuid(): string {
  return globalThis.crypto.randomUUID();
}

/** Deterministic layer id: stable across regenerations of the same slot. */
export function layerId(slot: string, index = 0): string {
  return index === 0 ? slot : `${slot}_${index}`;
}
