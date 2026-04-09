// ─── HELPERS ─────────────────────────────────────────────────────

function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return { r: 0, g: 0, b: 0 };
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map(c => c+c).join("") : clean;
  if (full.length !== 6) return { r: 0, g: 0, b: 0 };
  const num = parseInt(full, 16);
  if (isNaN(num)) return { r: 0, g: 0, b: 0 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b]
    .map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, "0"))
    .join("");
}

function normalizeHex(str) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) return "#" + hex.split("").map(c=>c+c).join("").toLowerCase();
    if (hex.length === 6) return s.toLowerCase();
    if (hex.length === 8) return ("#" + hex.slice(0,6)).toLowerCase();
    return null;
  }
  const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return rgbToHex(+rgb[1], +rgb[2], +rgb[3]);
  return null;
}

function getLuminance({ r, g, b }) {
  const toL = v => { const s = v/255; return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4); };
  return 0.2126*toL(r) + 0.7152*toL(g) + 0.0722*toL(b);
}

function isDark(hex) {
  if (!hex || typeof hex !== "string") return false;
  return getLuminance(hexToRgb(hex)) < 0.35;
}

function isNearWhite(hex) {
  if (!hex || typeof hex !== "string") return false;
  const { r, g, b } = hexToRgb(hex);
  return (r + g + b) / 3 > 230;
}

function isNearBlack(hex) {
  if (!hex || typeof hex !== "string") return false;
  const { r, g, b } = hexToRgb(hex);
  return (r + g + b) / 3 < 20;
}

function isNearGray(hex) {
  if (!hex || typeof hex !== "string") return false;
  const { r, g, b } = hexToRgb(hex);
  const avg = (r + g + b) / 3;
  return Math.max(Math.abs(r-avg), Math.abs(g-avg), Math.abs(b-avg)) < 18;
}

function getSaturation(hex) {
  if (!hex || typeof hex !== "string") return 0;
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  return max === 0 ? 0 : (max - min) / max;
}

function colorDistance(hex1, hex2) {
  if (!hex1 || !hex2) return 999;
  const a = hexToRgb(hex1), b = hexToRgb(hex2);
  return Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2);
}

function dedupeColors(colors, threshold = 45) {
  const result = [];
  for (const c of colors) {
    if (c && typeof c === "string" && !result.some(r => colorDistance(r, c) < threshold)) {
      result.push(c);
    }
  }
  return result;
}

// ─── RESOLVE COLORS (main color brain) ───────────────────────────

export function resolveColors({ themeColor, brandElementColors, dominantColors, domStyles }) {
  const scores = {};

  const add = (hex, weight) => {
    const h = normalizeHex(hex);
    if (!h) return;
    if (h === "#000000" || h === "#ffffff") return;
    scores[h] = (scores[h] || 0) + weight;
  };

  if (themeColor) {
    add(themeColor, 1000);
    console.log("theme-color found:", themeColor);
  }

  for (const item of (brandElementColors || [])) {
    add(item.color, item.priority * 20);
  }

  for (let i = 0; i < (dominantColors || []).length; i++) {
    add(dominantColors[i], (dominantColors.length - i) * 15);
  }

  for (const s of (domStyles || [])) {
    try {
      const tag = (s.tagName || "").toLowerCase();
      const w = tag === "button" ? 30 : tag === "a" ? 20 : ["header","nav"].includes(tag) ? 15 : 1;
      add(s.backgroundColor, w * 2);
      add(s.color, w);
    } catch (_) {}
  }

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .filter(h => { const n = normalizeHex(h); return n && !isNearWhite(n) && !isNearBlack(n); });

  const brandColors = dedupeColors(
    ranked.filter(c => !isNearGray(c) && getSaturation(hexToRgb(c)) > 0.15),
    35
  );

  const allHex = Object.keys(scores);

  const backgrounds = allHex
    .filter(c => { const h = normalizeHex(c); return h && isNearWhite(h); })
    .map(c => normalizeHex(c));

  const darkTextColors = allHex
    .filter(c => { const h = normalizeHex(c); return h && isDark(h) && getSaturation(hexToRgb(h)) < 0.25; })
    .map(c => normalizeHex(c));

  const surfaceColors = allHex
    .filter(c => {
      const h = normalizeHex(c);
      if (!h) return false;
      const lum = getLuminance(hexToRgb(h));
      return lum > 0.4 && lum < 0.9 && isNearGray(h) && !isNearWhite(h);
    })
    .map(c => normalizeHex(c));

  const result = {
    primary:    brandColors[0]    || "#6366f1",
    secondary:  brandColors[1]    || brandColors[0] || "#8b5cf6",
    accent:     brandColors[2]    || brandColors[1] || "#f59e0b",
    background: backgrounds[0]    || "#ffffff",
    surface:    surfaceColors[0]  || backgrounds[1] || "#f8fafc",
    text:       darkTextColors[0] || "#111111",
    mutedText:  darkTextColors[1] || "#6b7a99",
  };

  console.log("Resolved colors:", result);
  return result;
}

// ─── TYPOGRAPHY ───────────────────────────────────────────────────

export function extractTypography(rawStyles) {
  const fontFreq = {}, sizeFreq = {};

  for (const s of rawStyles) {
    try {
      if (s.fontFamily && typeof s.fontFamily === "string") {
        const f = s.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
        if (f && f !== "inherit" && f !== "initial") {
          const tag = (s.tagName || "").toLowerCase();
          const w = ["h1","h2","h3","h4","button","a"].includes(tag) ? 5 : 1;
          fontFreq[f] = (fontFreq[f] || 0) + w;
        }
      }
      if (s.fontSize && typeof s.fontSize === "string") {
        const px = parseFloat(s.fontSize);
        if (!isNaN(px) && px > 8 && px < 100) sizeFreq[px] = (sizeFreq[px] || 0) + 1;
      }
    } catch (_) {}
  }

  const fonts = Object.entries(fontFreq).sort((a,b) => b[1]-a[1]).map(([f]) => f);
  const bodySizes = Object.keys(sizeFreq).map(Number).filter(s => s >= 12 && s <= 20).sort((a,b) => a-b);
  const baseSize = bodySizes[Math.floor(bodySizes.length / 2)] || 16;
  const bodyFont = fonts[0] || "system-ui, sans-serif";
  const headingFont = fonts[1] ? `${fonts[1]}, ${bodyFont}` : bodyFont;

  return {
    headingFont, bodyFont,
    baseSize: `${baseSize}px`,
    scale: { h1: "3rem", h2: "2.25rem", h3: "1.75rem", body: "1rem", caption: "0.875rem" },
    lineHeights: { heading: 1.2, body: 1.5 },
  };
}

// ─── SPACING ──────────────────────────────────────────────────────

export function extractSpacing(rawStyles) {
  const values = [];
  for (const s of rawStyles) {
    try {
      for (const prop of ["paddingTop","paddingLeft","marginTop","marginLeft"]) {
        if (s[prop] && typeof s[prop] === "string") {
          const v = parseFloat(s[prop]);
          if (!isNaN(v) && v > 0 && v < 200) values.push(v);
        }
      }
    } catch (_) {}
  }
  const sorted = [...new Set(values)].sort((a,b) => a-b);
  const unit = sorted.find(v => v >= 2 && v <= 8) || 4;
  return { unit, scale: [0, 1, 2, 3, 4, 6, 8] };
}

// ─── RADII ────────────────────────────────────────────────────────

export function extractRadii(rawStyles) {
  const radii = rawStyles
    .filter(s => ["button","input","a"].includes((s.tagName||"").toLowerCase()))
    .map(s => { if (!s.borderRadius || typeof s.borderRadius !== "string") return NaN; return parseFloat(s.borderRadius); })
    .filter(v => !isNaN(v) && v >= 0)
    .sort((a,b) => a-b);

  const mid = radii[Math.floor(radii.length / 2)] || 8;
  return { none: "0px", sm: `${Math.round(mid*0.5)}px`, md: `${Math.round(mid)}px`, lg: `${Math.round(mid*2)}px` };
}

// ─── SHADOWS ──────────────────────────────────────────────────────

export function extractShadows(rawStyles) {
  const shadows = rawStyles
    .map(s => s.boxShadow)
    .filter(s => s && typeof s === "string" && s !== "none" && s.trim() !== "");
  return {
    sm: shadows[0] || "0 1px 2px rgba(0,0,0,0.08)",
    md: shadows[1] || shadows[0] || "0 4px 8px rgba(0,0,0,0.12)",
  };
}