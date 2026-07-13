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
