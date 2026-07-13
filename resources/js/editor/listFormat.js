// Shared text-list formatting helpers reused by both the Inspector's inline
// rich-text editor and the slide editor engine's floating toolbar, so the
// list-toggle / tag-convert / unwrap DOM logic lives in exactly one place.

export function firstList(root) {
  return root.querySelector("ul, ol");
}

export function changeTag(node, tag) {
  const doc = node.ownerDocument;
  const next = doc.createElement(tag);
  while (node.firstChild) next.appendChild(node.firstChild);
  node.parentNode.replaceChild(next, node);
  return next;
}

export function unwrapList(list) {
  const parent = list.parentNode;
  while (list.firstChild) parent.insertBefore(list.firstChild, list);
  parent.removeChild(list);
}

export function detectListKindInline(el) {
  if (el.querySelector("ol")) return "ordered";
  const ul = el.querySelector("ul");
  if (ul) {
    const t = (ul.style.listStyleType || "disc").replace(/["']/g, "");
    return t === "circle" ? "circle" : t === "square" ? "square" : "disc";
  }
  return null;
}

// Toggle/convert the list inside `el` to `kind` (one of "ordered", "disc",
// "circle", "square", or null to clear). Pure DOM — the caller is responsible
// for persisting the change (history/sync to the slide). `document.execCommand`
// is used so the browser keeps the caret/selection anchored like a real editor.
export function applyListToElement(el, kind) {
  if (!el) return;
  const doc = el.ownerDocument;
  const ordered = kind === "ordered";
  const cur = detectListKindInline(el);
  if (kind === null || cur === kind) {
    if (cur !== null) el.querySelectorAll("ul, ol").forEach(unwrapList);
    return;
  }
  if (cur === null) {
    doc.execCommand(ordered ? "insertOrderedList" : "insertUnorderedList", false, null);
    if (!ordered) {
      const ul = firstList(el);
      if (ul) ul.style.listStyleType = kind;
    }
    return;
  }
  const list = firstList(el);
  if (!list) {
    doc.execCommand(ordered ? "insertOrderedList" : "insertUnorderedList", false, null);
  } else if (ordered && list.tagName === "UL") {
    changeTag(list, "OL");
  } else if (!ordered && list.tagName === "OL") {
    changeTag(list, "UL");
  }
  if (!ordered) {
    const ul = firstList(el);
    if (ul) ul.style.listStyleType = kind;
  }
}
