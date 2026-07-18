// Turn an arbitrary label (filename, free text…) into a stable, filesystem/
// URL-safe slug used as the basis for slide item names. Lower-cases, strips
// accents, replaces every run of non-alphanumeric characters with a single
// dash, collapses repeats, trims edge dashes, and caps the length so names
// stay short in the Layers panel and as DOM attributes.
export function slugify(input, max = 40) {
  const value = (input ?? "").toString().trim().toLowerCase();
  if (!value) return "";

  const normalized = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip combining accents

  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.length > max ? slug.slice(0, max).replace(/-+$/, "") : slug;
}

// Reduce free text (e.g. a text box's content) to a short, safe summary slug:
// the first few words only. Returns "" when there is nothing meaningful.
export function summarizeText(text, words = 3, max = 40) {
  const cleaned = (text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, words)
    .join(" ");
  return slugify(cleaned, max);
}
