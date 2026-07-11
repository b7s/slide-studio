// Thin client for the versioned API. Endpoint URLs are resolved from Laravel
// named routes shared via Inertia (see resources/js/lib/routes.js) — no path
// is hardcoded here. Errors are surfaced as Error with a `code`.

import { route } from "./routes";

async function parseError(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchSlides(root = "deck") {
  const res = await fetch(route("slidesIndex", { query: { root } }));
  if (!res.ok) throw new Error("slides.fetch_failed");
  const data = await res.json();
  return (data.slides ?? []).map((s) => ({
    file: s.file,
    title: s.title,
    number: String(s.number),
    revision: s.revision ?? null,
    source_mode: s.source_mode,
  }));
}

export async function fetchSlideHtml(file) {
  const res = await fetch(route("slidesHtml", { query: { file } }));
  if (!res.ok) throw new Error("slides.html_failed");
  return await res.text();
}

export function slideHtmlUrl(file) {
  return route("slidesHtml", { query: { file } });
}

export async function saveSlide(file, { html, revision = null, overwrite = false }) {
  const res = await fetch(route("slideSave", { slide: file }), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ html, revision, overwrite }),
  });
  if (res.status === 409) {
    const err = new Error("conflict");
    err.code = 409;
    throw err;
  }
  if (!res.ok) {
    const err = new Error("save_failed");
    err.code = res.status;
    err.detail = await parseError(res);
    throw err;
  }
  return await res.json();
}

export async function duplicateSlide(file, { filename, title = null }) {
  const res = await fetch(route("slideDuplicate", { slide: file }), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ filename, title }),
  });
  if (!res.ok) throw new Error("duplicate_failed");
  return await res.json();
}

export async function reorderSlides(presentationId, order) {
  const res = await fetch(route("reorder"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ presentation_id: presentationId, order }),
  });
  if (!res.ok) throw new Error("reorder_failed");
  return await res.json();
}

export async function generateSlides(presentationSlug, { prompt, maxSlides = null }) {
  const res = await fetch(route("generate", { presentation: presentationSlug }), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(maxSlides ? { prompt, max_slides: maxSlides } : { prompt }),
  });
  if (!res.ok) {
    const err = new Error("generate_failed");
    err.code = res.status;
    err.detail = await parseError(res);
    throw err;
  }
  return await res.json();
}

export async function generationStatus(generationId) {
  const res = await fetch(route("generationShow", { generation: generationId }));
  if (!res.ok) throw new Error("generation_status_failed");
  return await res.json();
}

export async function fetchShares(presentationSlug) {
  const res = await fetch(route("sharesIndex", { presentation: presentationSlug }));
  if (!res.ok) throw new Error("shares_fetch_failed");
  return await res.json();
}

export async function updateShare(presentationSlug, userId, role) {
  const res = await fetch(route("sharesUpdate", { presentation: presentationSlug, user: userId }), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("share_update_failed");
  return await res.json();
}

export async function removeShare(presentationSlug, userId) {
  const res = await fetch(route("sharesDestroy", { presentation: presentationSlug, user: userId }), {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("share_remove_failed");
  return await res.json();
}

export async function searchUsers(query) {
  const res = await fetch(route("usersSearch", { query: { q: query } }));
  if (!res.ok) throw new Error("users_search_failed");
  return await res.json();
}
