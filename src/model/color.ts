/** `#rrggbb` → [r, g, b] in 0..1. */
export function hexToRgb01(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Color components (gray, RGB or CMYK) in 0..1 → `#rrggbb`. */
export function componentsToHex(c: number[] | undefined): string | null {
  if (!c || c.length === 0) return null;
  let rgb: number[];
  if (c.length === 1) rgb = [c[0], c[0], c[0]];
  else if (c.length === 3) rgb = c;
  else if (c.length === 4) {
    const [C, M, Y, K] = c;
    rgb = [(1 - C) * (1 - K), (1 - M) * (1 - K), (1 - Y) * (1 - K)];
  } else return null;
  return `#${rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Parse a default-appearance string like `/Helv 12 Tf 0 0 1 rg`. */
export function parseDA(da: string | undefined): { fontSize: number; textColor: string } {
  const out = { fontSize: 0, textColor: '#000000' };
  if (!da) return out;
  const tf = /([\d.]+)\s+Tf/.exec(da);
  if (tf) out.fontSize = Number(tf[1]) || 0;
  const rg = /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/.exec(da);
  const g = /([\d.]+)\s+g(?:\s|$)/.exec(da);
  const k = /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+k/.exec(da);
  if (rg) out.textColor = componentsToHex([Number(rg[1]), Number(rg[2]), Number(rg[3])])!;
  else if (k) out.textColor = componentsToHex([Number(k[1]), Number(k[2]), Number(k[3]), Number(k[4])])!;
  else if (g) out.textColor = componentsToHex([Number(g[1])])!;
  return out;
}
