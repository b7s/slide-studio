// Client-side color helper shared by the Inspector and the floating text
// toolbar so a computed color (rgb()/rgba()/named) is normalised to a #hex the
// same way everywhere — no duplicated conversion logic.

export function toHex(color) {
  if (!color) return "#000000";
  if (color.startsWith("#")) return color;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return "#000000";
  const hex = (n) => Number(n).toString(16).padStart(2, "0");
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

// Parse any colour (hex / rgb() / rgba()) into its RGB components.
export function toRgb(color) {
  if (!color) return { r: 0, g: 0, b: 0 };
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  const hex = color.startsWith("#") ? color.slice(1) : color;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return { r: 0, g: 0, b: 0 };
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

// Return a colour with the given alpha (0–1). Emits a plain `rgb(...)` when
// fully opaque so the serialized value stays clean.
export function withAlpha(color, alpha) {
  const { r, g, b } = toRgb(color);
  const a = Number(alpha);
  if (!Number.isFinite(a) || a >= 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Split a colour into its opaque form and its alpha (defaulting to 1).
export function splitColorAlpha(color) {
  const m = (color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (m) {
    return { rgb: `rgb(${m[1]}, ${m[2]}, ${m[3]})`, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
  }
  return { rgb: color || "#ffffff", alpha: 1 };
}
