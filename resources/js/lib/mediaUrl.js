// Two-way rewriting between the media path that is persisted in slide HTML
// (a relative `media/...` path, so a zip export can resolve it against a
// sibling `media/` folder) and the absolute `/storage/media/...` URL the
// browser needs to actually render the image inside the editor.
//
// Stored HTML always uses the relative path. The editor rewrites to the
// absolute URL when injecting HTML into the DOM (load + undo/redo restore),
// and rewrites back to the relative path when serialising for save.
//
// IMPORTANT: the emitted `url(...)` value is always UNQUOTED. A quoted value
// such as `url("/storage/media/x.png")` is safe while it lives on a DOM
// element, but once it is serialised into an HTML `style="..."` attribute and
// re-parsed via `innerHTML` the inner `"` closes the attribute early and the
// remainder (the URL, `background-repeat`, …) is mis-parsed as bogus
// attributes. Unquoted `url(...)` contains no `"`, so it round-trips cleanly.

// Serialised HTML escapes the quotes inside `url("…")` as `&quot;` (and
// possibly `&#39;`/`&apos;`), so the matcher must treat those entities as
// quote characters — otherwise the entity leaks into the captured URL.
const Q = `(?:['"]|&quot;|&#39;|&apos;)`;
const RE = new RegExp(`url\\(\\s*${Q}?\\s*([^'"()&]+?)\\s*${Q}?\\s*\\)`, "g");

function normalizeToStorage(raw) {
  const p = raw.trim();
  // Full URL (http/https) pointing at a media folder → relative `media/…`.
  const full = p.match(/^https?:\/\/[^/]+\/(?:storage\/)?media\/(.+)$/);
  if (full) {
    return "media/" + full[1];
  }
  if (p.includes("/storage/media/")) {
    return "media/" + p.split("/storage/media/")[1];
  }
  if (p.startsWith("media/")) {
    return p;
  }
  // Anything else (external URL, data URI, …) is kept verbatim but will be
  // re-emitted unquoted so it can never break an HTML attribute.
  return p;
}

function normalizeToPreview(raw) {
  const p = raw.trim();
  // Already absolute (external host or data URI) — leave as-is.
  if (/^https?:\/\//.test(p) || p.startsWith("data:")) {
    return p;
  }
  if (p.includes("/storage/media/")) {
    return p;
  }
  if (p.startsWith("media/")) {
    return "/storage/media/" + p.slice("media/".length);
  }
  return p;
}

function rewrite(html, normalize) {
  if (typeof html !== "string") return html;
  return html.replace(RE, (match, raw) => {
    const stripped = raw.replace(/&quot;|&#39;|&apos;/g, "");
    if (stripped === "") return match;
    const next = normalize(stripped);
    return `url(${next})`;
  });
}

export function rewriteMediaUrlsToStorage(html) {
  return rewrite(html, normalizeToStorage);
}

export function rewriteMediaUrlsToPreview(html) {
  return rewrite(html, normalizeToPreview);
}
