// Slide editor engine. Operates on a Shadow DOM root that hosts the slide
// HTML. The shadow root provides CSS isolation (slide styles do not leak into
// the editor chrome) while staying inside the same document, so React-based
// context menus, drag overlays and keyboard shortcuts all work natively — no
// iframe bridging needed.
//
// Owns selection, drag/resize, inline text editing, style/command
// application, undo/redo history and a small clipboard. React supplies
// callbacks for html / selection / edit-mode / context-menu changes;
// commands are invoked from the Toolbar and Inspector.

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

// Highlight accent used for the hover (dashed) and selection (solid) outlines.
// Hardcoded because the slide engine runs inside a Shadow DOM, where the
// `:root` CSS variables (e.g. --highlight) are not available. Mirrors
// --highlight in resources/css/app.css.
const HIGHLIGHT = "#2f6df6";

// Icon catalog. The path data + tag references live in a single generated
// file (`icons.config.js`) sourced from the installed `lucide-react` package
// via `scripts/icons.mjs`. Do not hand-edit icon paths inside this file — to
// change the catalog, update the ICONS whitelist in `scripts/icons.mjs`
// (or bump `lucide-react` in `package.json`) and re-run `npm run icons`.
import {ICON_CATALOG} from "./icons.config";
import {applyListToElement} from "./listFormat";
import {rewriteMediaUrlsToPreview, rewriteMediaUrlsToStorage} from "../lib/mediaUrl";

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function boxOf(el) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}

// Serialise only the slide *content* (the `.slide` root's inner HTML), never
// the whole shadow root. The shadow root also hosts the injected base <style>
// and the transient selection overlay — those must never be persisted into the
// Serialise only the slide *content* (the `.slide` root's inner HTML), never
// the whole shadow root. The shadow root also hosts the injected base <style>
// and the transient selection overlay — those must never be persisted into the
// saved slide HTML, otherwise reloading would nest content inside the <style>
// and re-embed the overlay.
function parseBox(el) {
  const cs = getComputedStyle(el);
  return {
    x: num(el.style.left) || num(cs.left),
    y: num(el.style.top) || num(cs.top),
    w: num(el.style.width) || el.offsetWidth,
    h: num(el.style.height) || el.offsetHeight,
  };
}

export function createSlideEditor({ root, stage, onChange, onSelection, onEditingChange, onTextEditingChange, onContextMenu }) {
  // `selected` is the *primary* element (last clicked) — kept for Inspector
  // compatibility. `selectedSet` is the full multi-selection (array, ordered by
  // click order). Ctrl/Cmd+click toggles membership; a plain click replaces it.
  let selected = null;
  let selectedSet = [];
  let editing = false;
  let textEditing = false;
  // Remembers the cursor each box had before we forced the I-beam during a
  // text-edit session, so it can be fully restored on exit (and never leaked
  // into the saved HTML).
  const editPrevCursor = new WeakMap();
  let overlay = null;
  let selectionLayer = null;
  let hoverLayer = null;
  let history = [];
  let histIndex = -1;
  let clipboard = null;
  let drag = null;
  let resize = null;

  const stageEl = stage; // scrollable container for auto-scroll during drag

  // Auto-scroll the stage when pointer is near edges during drag/resize
  function autoScrollStage(clientX, clientY) {
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const margin = 60; // px from edge to start scrolling
    const speed = 24;  // px per frame

    // Horizontal
    if (clientX - rect.left < margin) {
      stageEl.scrollLeft = Math.max(0, stageEl.scrollLeft - speed);
    } else if (rect.right - clientX < margin) {
      stageEl.scrollLeft += speed;
    }
    // Vertical
    if (clientY - rect.top < margin) {
      stageEl.scrollTop = Math.max(0, stageEl.scrollTop - speed);
    } else if (rect.bottom - clientY < margin) {
      stageEl.scrollTop += speed;
    }
  }

  const slideRoot = () =>
    root.querySelector("[data-slide], .slide, .slide-root") || root.firstElementChild || root;

  // The slide content lives inside an open Shadow DOM root (see SlideCanvas).
  // Its text selection must be read/modified through the shadow root's own
  // Selection — `window.getSelection()` can reject ranges whose boundary nodes
  // live in a shadow tree (throwing on addRange), which would abort colour/list
  // commands. Fall back to window when the shadow root has no getSelection.
  function getSelection() {
    if (root && typeof root.getSelection === "function") return root.getSelection();
    return typeof window !== "undefined" ? window.getSelection() : null;
  }

  // Serialise only the slide content (the `.slide` root's inner HTML),
  // never the whole shadow root. The shadow root also hosts the injected
  // base <style> and the transient selection overlay — those must never be
  // persisted into the saved slide HTML.
  // A box whose `style` attribute was ever serialised with an unescaped quote
  // (or another corruption) parses back with bogus attributes such as
  // `https:`, `slide-studio.testmedia`, `019f.webp");`. They are fragments of
  // a URL/style value that leaked out when the `"` closed the attribute early.
  // Strip any attribute whose name is not a plausible real attribute: it either
  // carries a character illegal in attribute names, or it looks like a URL
  // fragment (TLD / media extension / protocol). The engine's own attributes
  // (`data-slide-*`, `data-slide-icon`, `style`, `class`, `contenteditable`,
  // `xmlns`) are all unaffected.
  const INVALID_ATTR =
    /[:;"'=<>\s)]|:\/\/|\.(test|com|net|org|webp|png|jpe?g|gif|svg)/i;
  function sanitizeAttributes(root) {
    root.querySelectorAll("*").forEach((el) => {
      for (const name of [...el.getAttributeNames()]) {
        if (INVALID_ATTR.test(name)) {
          el.removeAttribute(name);
        }
      }
    });
  }

  function snapshot() {
    // Never persist editor-only chrome. A box can be left with
    // `contenteditable="true"` (during text edit, after a command, or right
    // after insert) and a hover outline may still be applied; saving those
    // would make the box reload as editable (with a focus/selection border) or
    // outlined. Strip them from a clone so the stored HTML is clean.
    clearHoverOutlines();
    // Also drop the transient I-beam cursor we force during text editing,
    // restoring the box's original cursor while we snapshot.
    let editCursor = null;
    if (textEditing && selected && editPrevCursor.has(selected)) {
      editCursor = selected.style.cursor;
      selected.style.cursor = editPrevCursor.get(selected);
    }
    const clone = slideRoot().cloneNode(true);
    clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    sanitizeAttributes(clone);
    if (editCursor !== null) selected.style.cursor = editCursor;
    return rewriteMediaUrlsToStorage(clone.innerHTML);
  }

  function pushHistory() {
    const snap = snapshot();
    if (history[histIndex] === snap) return;
    history = history.slice(0, histIndex + 1);
    history.push(snap);
    if (history.length > 60) history.shift();
    histIndex = history.length - 1;
    emit();
  }

  function emit() {
    onChange(snapshot());
  }

  function selectionInfo() {
    if (!selected) {
      onSelection(null);
      return;
    }
    const box = boxOf(selected);
    const path = (() => {
      const segs = [];
      let n = selected;
      while (n && n !== slideRoot()) {
        segs.push(n.tagName.toLowerCase());
        n = n.parentElement;
      }
      return segs.reverse().join(" > ");
    })();
    onSelection({
      tag: selected.tagName.toLowerCase(),
      path,
      isGroup: !!(selected.getAttribute && selected.getAttribute("data-slide-group")),
      multi: selectedSet.filter((el) => el.isConnected).length > 1,
      count: selectedSet.filter((el) => el.isConnected).length,
      text: (selected.textContent || "").trim().slice(0, 60),
      box,
      styles: {
        left: selected.style.left,
        top: selected.style.top,
        width: selected.style.width,
        height: selected.style.height,
        fontSize: selected.style.fontSize,
        fontFamily: selected.style.fontFamily,
        lineHeight: selected.style.lineHeight,
        letterSpacing: selected.style.letterSpacing,
        opacity: selected.style.opacity,
        color: selected.style.color,
        backgroundColor: selected.style.backgroundColor,
        background: selected.style.background,
        backgroundImage: selected.style.backgroundImage,
        backgroundSize: selected.style.backgroundSize,
        backgroundRepeat: selected.style.backgroundRepeat,
        backgroundPosition: selected.style.backgroundPosition,
        borderRadius: selected.style.borderRadius,
        borderWidth: selected.style.borderWidth,
        borderStyle: selected.style.borderStyle,
        borderColor: selected.style.borderColor,
        boxShadow: selected.style.boxShadow,
        display: selected.style.display,
        flexDirection: selected.style.flexDirection,
        justifyContent: selected.style.justifyContent,
        alignItems: selected.style.alignItems,
        textAlign: selected.style.textAlign,
        padding: selected.style.padding,
      },
      icon: findIcon(),
      editableText: isTextEditable(selected),
      table: tableInfo(),
      list: (() => {
        // Reflect the list *under the caret*, not merely whether the selected box
        // contains a list somewhere. This keeps the List button in sync with where
        // the user is typing and lets it clear when the caret leaves the list.
        const ss = typeof window !== "undefined" ? window.getSelection() : null;
        let n = ss && ss.anchorNode;
        if (n && n.nodeType === 3) n = n.parentNode;
        while (n && n !== box) {
          if (n.tagName === "UL" || n.tagName === "OL") {
            return {
              tag: n.tagName.toLowerCase(),
              style: (n.style.listStyleType || (n.tagName === "OL" ? "decimal" : "disc")).replace(/["']/g, ""),
            };
          }
          n = n.parentNode;
        }
        return null;
      })(),
    });
  }

  function isTextEditable(el) {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    // Includes common inline formatting tags (b/i/strong/em/u/...) so a box
    // whose text is wrapped in those tags is still treated as an editable text
    // box (and the floating toolbar works on it).
    return [
      "p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "li", "a", "div",
      "td", "th", "button", "b", "i", "strong", "em", "u", "small", "code",
      "mark", "label", "blockquote", "pre",
    ].includes(tag);
  }

  function isCell(el) {
    return !!el && ["td", "th"].includes(el.tagName.toLowerCase());
  }

  function tableOf(cell) {
    return cell ? cell.closest("table") : null;
  }

  function cellCoords(cell) {
    const tr = cell.parentElement;
    const rowIndex = Array.from(tr.parentElement.children).indexOf(tr);
    const colIndex = Array.from(tr.children).indexOf(cell);
    return { rowIndex, colIndex };
  }

  function tableDims(table) {
    const rows = Array.from(table.querySelectorAll("tr"));
    const rowCount = rows.length;
    const colCount = rows.reduce((max, r) => Math.max(max, r.children.length), 0);
    return { rowCount, colCount };
  }

  // Table metadata surfaced to the Inspector when a cell is selected: the
  // cell's coordinates plus the table dimensions, and the live row height /
  // column width of the currently selected cell.
  function tableInfo() {
    const cell = isCell(selected) ? selected : null;
    if (!cell || !cell.isConnected) return { isCell: false };
    const table = tableOf(cell);
    if (!table) return { isCell: false };
    const { rowIndex, colIndex } = cellCoords(cell);
    const { rowCount, colCount } = tableDims(table);
    const cs = getComputedStyle(cell);
    return {
      isCell: true,
      rowIndex,
      colIndex,
      rowCount,
      colCount,
      rowHeight: cell.parentElement.style.height || cs.height,
      colWidth: cell.style.width || cs.width,
    };
  }

  // Pick a selection color that contrasts with the element's effective
  // background: walk up from the element to find the first opaque background
  // (element → .slide → host navy), compute its luminance, then choose black
  // or white so the outline/handles stay readable on any slide — light or
  // dark, plain or image-filled.
  function contrastColor(el) {
    let node = el;
    while (node && node.nodeType === 1 && node !== root) {
      const bg = getComputedStyle(node).backgroundColor;
      const m = bg && bg.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
        const [r, g, b, a = 1] = parts;
        if (a > 0.15) {
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          return lum > 0.55 ? "#111111" : "#ffffff";
        }
      }
      if (node === slideRoot()) break;
      node = node.parentElement;
    }
    return "#ffffff"; // the slide frame is navy by default
  }

  function buildOverlay() {
    const ov = document.createElement("div");
    ov.setAttribute("data-slide-overlay", "1");
    ov.style.position = "absolute";
    ov.style.pointerEvents = "none";
    ov.style.zIndex = "2147483646";
    ov.style.boxSizing = "border-box";
    HANDLES.forEach((pos) => {
      const h = document.createElement("div");
      h.setAttribute("data-slide-handle", pos);
      h.style.position = "absolute";
      h.style.width = "10px";
      h.style.height = "10px";
      h.style.border = `1.5px solid ${HIGHLIGHT}`;
      h.style.borderRadius = "2px";
      h.style.pointerEvents = "auto";
      h.style.cursor = cursorFor(pos);
      ov.appendChild(h);
    });
    root.appendChild(ov);
    return ov;
  }

  // Secondary selection frames: one light outline per *additional* selected
  // element (everything except the primary), drawn in a dedicated layer so they
  // never persist into the saved HTML and never steal pointer events.
  function buildSelectionLayer() {
    const layer = document.createElement("div");
    layer.setAttribute("data-slide-selection-layer", "1");
    layer.style.position = "absolute";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "2147483645";
    root.appendChild(layer);
    return layer;
  }

  // Apply a highlight outline + matching handle fill so the primary selection
  // reads consistently in the editor accent colour.
  function updateOverlayColor() {
    if (!overlay || !selected) return;
    overlay.style.border = `2px solid ${HIGHLIGHT}`;
    overlay.querySelectorAll("[data-slide-handle]").forEach((handle) => {
      handle.style.background = HIGHLIGHT;
      handle.style.borderColor = "#ffffff";
    });
  }

  function cursorFor(pos) {
    const map = {
      nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize",
      e: "ew-resize", se: "nwse-resize", s: "ns-resize",
      sw: "nesw-resize", w: "ew-resize",
    };
    return map[pos] || "default";
  }

  // Convert a viewport rect into the overlay's local (unscaled) coordinate space.
  function localRectOf(rect) {
    const host = root.host ?? root;
    const sr = host.getBoundingClientRect();
    const scale = sr.width > 0 ? sr.width / Math.max(1, host.offsetWidth) : 1;
    return {
      x: (rect.left - sr.left) / scale,
      y: (rect.top - sr.top) / scale,
      w: rect.width / scale,
      h: rect.height / scale,
    };
  }

  // Frame every selected element except the primary. Secondary frames use a
  // lighter 1.5px accent so the primary (with handles) stays the clear focus.
  function positionSelectionLayer() {
    if (!selectionLayer) return;
    selectionLayer.innerHTML = "";
    const others = selectedSet.filter((el) => el !== selected && el.isConnected);
    others.forEach((el) => {
      const { x, y, w, h } = localRectOf(el.getBoundingClientRect());
      const frame = document.createElement("div");
      frame.style.position = "absolute";
      frame.style.boxSizing = "border-box";
      frame.style.pointerEvents = "none";
      frame.style.border = `1.5px solid ${HIGHLIGHT}`;
      frame.style.borderRadius = "3px";
      frame.style.left = `${x}px`;
      frame.style.top = `${y}px`;
      frame.style.width = `${w}px`;
      frame.style.height = `${h}px`;
      selectionLayer.appendChild(frame);
    });
  }

  function positionOverlay() {
    if (!overlay || !selected) {
      positionSelectionLayer();
      return;
    }
    const r = selected.getBoundingClientRect();
    const { x, y, w, h } = localRectOf(r);
    overlay.style.left = `${x}px`;
    overlay.style.top = `${y}px`;
    overlay.style.width = `${w}px`;
    overlay.style.height = `${h}px`;
    const handles = overlay.querySelectorAll("[data-slide-handle]");
    handles.forEach((handle) => {
      const pos = handle.getAttribute("data-slide-handle");
      const [hx, hy] = handleXY(pos, w, h);
      handle.style.left = `${hx - 5}px`;
      handle.style.top = `${hy - 5}px`;
    });
    positionSelectionLayer();
    if (onTextEditingChange) updateToolbar();
  }

  function handleXY(pos, w, h) {
    const midX = w / 2;
    const midY = h / 2;
    if (pos === "nw") return [0, 0];
    if (pos === "n") return [midX, 0];
    if (pos === "ne") return [w, 0];
    if (pos === "e") return [w, midY];
    if (pos === "se") return [w, h];
    if (pos === "s") return [midX, h];
    if (pos === "sw") return [0, h];
    return [0, midY];
  }

  // The floating text toolbar is visible whenever a text box is selected while
  // in edit mode, OR while an explicit text-edit session is active (F2 / double
  // click). It is positioned from the selected element's viewport rect and
  // re-emitted on box movement so it stays glued.
  function textRect() {
    if (!selected) return null;
    const r = selected.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  // The floating quickbar shows only while a box is in an explicit text-edit
  // session (double-click / F2) — never merely on selection. Single-click just
  // selects + moves the box; double-click dives into editing.
  function toolbarVisible() {
    return textEditing;
  }

  function updateToolbar() {
    const visible = toolbarVisible();
    if (onTextEditingChange) onTextEditingChange(visible, visible ? textRect() : null);
  }

  // Collapse the caret to the end of an element's text so the user can keep
  // typing after entering edit mode (rather than at the start or a selected word).
  function placeCaretAtEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // The floating toolbar lives in the light DOM and Radix portals its popovers
  // to <body>, so opening one steals focus from the edited box and drops the
  // in-box text selection. We snapshot the Range on the trigger's mousedown and
  // restore it just before applying a command, so colours/lists target the
  // originally selected text rather than collapsing to a caret.
  let savedRange = null;

  function saveSelection() {
    const sel = getSelection();
    if (!sel || !sel.rangeCount || !selected) return;
    const r = sel.getRangeAt(0);
    if (selected.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
  }

  function restoreSelection() {
    const sel = getSelection();
    if (savedRange && sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      } catch {
        // Ranges in a shadow tree may be rejected by some engines; the colour
        // command then falls back to the whole box.
      }
    }
  }

  // Enter per-box text editing (double-click / F2). Makes the box contenteditable
  // and drops the caret at the end of its text so the user can keep typing.
  function beginTextEdit() {
    const box = topEditable(selected) || selected;
    if (!box || !isTextEditable(box)) return;
    // Promote the selection to the containing box (if we were on a nested leaf)
    // so the overlay and floating toolbar target the whole box.
    if (box !== selected) select(box);
    textEditing = true;
    if (!editing) selected.setAttribute("contenteditable", "true");
    // Show the I-beam cursor while editing text (a draggable box may carry
    // cursor:move); remember the original so we can restore it on exit.
    if (selected.style.cursor !== "text") {
      editPrevCursor.set(selected, selected.style.cursor || "");
      selected.style.cursor = "text";
    }
    placeCaretAtEnd(selected);
    updateToolbar();
    positionOverlay();
  }

  function exitTextEdit() {
    if (!textEditing) return;
    textEditing = false;
    if (selected && !editing) selected.setAttribute("contenteditable", "false");
    // Restore the original cursor (e.g. move) we overrode with the I-beam.
    if (selected && editPrevCursor.has(selected)) {
      selected.style.cursor = editPrevCursor.get(selected);
      editPrevCursor.delete(selected);
    }
    updateToolbar();
  }

  // Select an element. Pass `{ additive: true }` (Ctrl/Cmd+click) to toggle the
  // element in/out of the multi-selection instead of replacing it. The primary
  // `selected` is always the last-clicked element so Inspector commands keep
  // targeting a single, predictable box.
  function select(el, { additive = false } = {}) {
    if (!el || el === root || el === slideRoot() || el.getAttribute("data-slide-overlay") !== null) {
      clearSelection();
      return;
    }
    // Switching to a different element drops any explicit text-edit session so
    // the floating toolbar hides instead of sticking to the wrong box.
    if (selected && selected !== el && textEditing) exitTextEdit();

    if (additive) {
      const i = selectedSet.indexOf(el);
      if (i >= 0) {
        selectedSet.splice(i, 1);
        if (selected === el) selected = selectedSet[selectedSet.length - 1] || null;
      } else {
        selectedSet.push(el);
        selected = el;
      }
    } else {
      selectedSet = [el];
      selected = el;
    }

    clearHoverOutlines();
    if (overlay) overlay.style.display = "block";
    else overlay = buildOverlay();
    if (!selectionLayer) selectionLayer = buildSelectionLayer();
    updateOverlayColor();
    // In edit mode every box is directly editable: the toolbar shows on
    // selection and the box becomes contenteditable + focused for direct typing.
    if (editing && selected) setEditable(true);
    positionOverlay();
    selectionInfo();
    updateToolbar();
  }

  function setMultiSelected(els) {
    const clean = els.filter((e) => e && e.isConnected && e !== root && e !== slideRoot());
    if (clean.length === 0) {
      clearSelection();
      return;
    }
    selectedSet = clean;
    selected = clean[clean.length - 1];
    clearHoverOutlines();
    if (overlay) overlay.style.display = "block";
    else overlay = buildOverlay();
    if (!selectionLayer) selectionLayer = buildSelectionLayer();
    updateOverlayColor();
    if (editing) setEditable(true);
    positionOverlay();
    selectionInfo();
    updateToolbar();
  }

  function getSelectionSet() {
    return selectedSet.filter((el) => el.isConnected);
  }

  function clearSelection() {
    if (selected && editing) setEditable(false);
    if (textEditing) exitTextEdit();
    selected = null;
    selectedSet = [];
    clearHoverOutlines();
    if (overlay) overlay.style.display = "none";
    if (selectionLayer) selectionLayer.innerHTML = "";
    onSelection(null);
    updateToolbar();
  }

  function setEditable(on) {
    if (!selected || !isTextEditable(selected)) return;
    selected.setAttribute("contenteditable", on ? "true" : "false");
    if (on) selected.focus();
  }

  function setEditing(on) {
    editing = on;
    onEditingChange(on);
    if (selected) setEditable(on);
    updateToolbar();
  }

  // ---- pointer interactions (drag + resize) ----
  // Begin dragging the current selection. `user-select:none` is a *transient*
  // interaction style — we remember the previous inline value so it can be
  // restored on pointer-up and never leaks into the saved HTML.
  function beginDrag(e) {
    // When multiple boxes are selected, drag them all together by the same delta.
    // Each member keeps its own relative position so the group geometry is
    // preserved. A box without explicit left/top is not draggable on its own.
    const members = getSelectionSet().filter((el) => el.style.left || el.style.top || (el.style.position && el.style.position !== "static"));
    const targets = members.length ? members : (selected ? [selected] : []);
    if (targets.length === 0) return;
    const sel = window.getSelection && window.getSelection();
    if (sel) sel.removeAllRanges();
    const group = targets.map((el) => {
      const cs = getComputedStyle(el);
      return {
        el,
        prevUserSelect: el.style.userSelect,
        baseX: num(el.style.left) || num(cs.left) || 0,
        baseY: num(el.style.top) || num(cs.top) || 0,
      };
    });
    group.forEach((m) => { m.el.style.userSelect = "none"; });
    const cs = getComputedStyle(selected);
    drag = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: num(selected.style.left) || num(cs.left) || 0,
      baseY: num(selected.style.top) || num(cs.top) || 0,
      moved: false,
      prevUserSelect: selected.style.userSelect,
      group,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  // While pressing on a contenteditable, focused box we cannot tell a caret
  // placement (click) from a move (drag) until the pointer actually moves. We
  // arm a pending-drag watcher and only *prevent* text selection once movement
  // crosses a small threshold — a plain click still drops the caret so the user
  // can edit, but a drag grabs the box and moves it instead of selecting text.
  let pending = null;

  function onPendingMove(e) {
    if (!pending) return;
    const dx = e.clientX - pending.startX;
    const dy = e.clientY - pending.startY;
    if (Math.hypot(dx, dy) > 4) {
      const p = pending;
      pending = null;
      window.removeEventListener("pointermove", onPendingMove);
      window.removeEventListener("pointerup", onPendingUp);
      const sel = window.getSelection && window.getSelection();
      if (sel) sel.removeAllRanges();
      e.preventDefault();
      beginDrag(e);
    }
  }

  function onPendingUp() {
    pending = null;
    window.removeEventListener("pointermove", onPendingMove);
    window.removeEventListener("pointerup", onPendingUp);
  }

  function onPointerDown(e) {
    const handle = e.target.getAttribute && e.target.getAttribute("data-slide-handle");
    if (handle) {
      e.preventDefault();
      resize = {
        pos: handle,
        startX: e.clientX,
        startY: e.clientY,
        box: parseBox(selected),
        moved: false,
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      return;
    }
    // While a box is in an explicit text-edit session, clicks inside it must
    // only place the caret — never start a drag (which would move the box).
    if (selected && textEditing && (e.target === selected || (selected.contains && selected.contains(e.target)))) {
      return;
    }
    if (selected && (e.target === selected || (selected.contains && selected.contains(e.target)))) {
      // If the element is already in text-edit mode and focused, a click should
      // still drop the caret (so the user can edit text), but a drag must move
      // the box rather than select text. Defer the decision to pointer movement.
      if (selected.getAttribute("contenteditable") === "true" && document.activeElement === selected) {
        pending = { startX: e.clientX, startY: e.clientY };
        window.addEventListener("pointermove", onPendingMove);
        window.addEventListener("pointerup", onPendingUp);
        return;
      }
      e.preventDefault();
      beginDrag(e);
      return;
    }
    if (e.target === overlay) {
      e.preventDefault();
      beginDrag(e);
    }
  }

  function onPointerMove(e) {
    if (resize) {
      resize.moved = true;
      const dx = e.clientX - resize.startX;
      const dy = e.clientY - resize.startY;
      const { pos, box } = resize;
      let { x, y, w, h } = box;
      if (pos.includes("e")) w = box.w + dx;
      if (pos.includes("s")) h = box.h + dy;
      if (pos.includes("w")) { w = box.w - dx; x = box.x + dx; }
      if (pos.includes("n")) { h = box.h - dy; y = box.y + dy; }
      applyBox({ x, y, w: Math.max(8, w), h: Math.max(8, h) });

      // Auto-scroll stage when resizing near edges
      autoScrollStage(e.clientX, e.clientY);
    } else if (drag) {
      drag.moved = true;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      drag.group.forEach((m) => {
        const nx = m.baseX + dx;
        const ny = m.baseY + dy;
        m.el.style.left = `${nx}px`;
        m.el.style.top = `${ny}px`;
        m.el.style.position = m.el.style.position || "absolute";
      });

      // Auto-scroll stage when dragging near edges
      autoScrollStage(e.clientX, e.clientY);
    }
    positionOverlay();
  }

  function onPointerUp() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    // Restore the transient drag-time `user-select` so it is never persisted.
    if (drag) {
      drag.group.forEach((m) => {
        if (m.prevUserSelect) m.el.style.userSelect = m.prevUserSelect;
        else m.el.style.removeProperty("user-select");
      });
    }
    // A click without any pointer movement is a *selection*, not an edit — it
    // must not push history or emit a change (which would flag the slide dirty
    // and trigger an autosave of unchanged content).
    const changed = (drag && drag.moved) || (resize && resize.moved);
    drag = null;
    resize = null;
    if (changed && selected) {
      pushHistory();
      emit();
      selectionInfo();
    }
  }

  // ---- commands ----
  function applyBox({ x, y, w, h }) {
    if (x !== undefined) { selected.style.left = `${x}px`; selected.style.position = selected.style.position || "absolute"; }
    if (y !== undefined) { selected.style.top = `${y}px`; selected.style.position = selected.style.position || "absolute"; }
    if (w !== undefined) selected.style.width = `${w}px`;
    if (h !== undefined) selected.style.height = `${h}px`;
    // Keep an icon's stored size in sync with its (resized) box so the Inspector
    // and findIcon() report the true glyph size. The SVG fills the box via CSS.
    if ((w !== undefined || h !== undefined) && selected.querySelector('[data-slide-icon="1"]')) {
      const iconSvg = selected.querySelector('[data-slide-icon="1"]');
      if (w !== undefined) iconSvg.setAttribute("width", String(Math.round(w)));
      if (h !== undefined) iconSvg.setAttribute("height", String(Math.round(h)));
    }
  }

  function setStyle(prop, value) {
    if (!selected) return;
    if (value === "" || value === null || value === undefined) {
      selected.style.removeProperty(prop);
    } else {
      selected.style[prop] = value;
    }
    positionOverlay();
    selectionInfo();
    emit();
  }

  // Background longhands that belong to the `background` shorthand. When the
  // shorthand is being set we must not re-clear these afterwards (see below).
  const BG_LONGHANDS = [
    "backgroundColor", "backgroundImage", "backgroundRepeat", "backgroundSize",
    "backgroundPosition", "backgroundAttachment", "backgroundOrigin", "backgroundClip",
  ];

  function setStyles(obj) {
    if (!selected) return;
    const hasBackgroundShorthand = !!obj.background;
    if (hasBackgroundShorthand) {
      // Setting the `background` shorthand is silently rejected by the browser
      // when the element already carries explicit `background-*` longhands —
      // e.g. legacy corrupted `background-attachment/origin/clip: initial` left
      // over from an earlier bug. Clear every background longhand FIRST so the
      // shorthand applies; otherwise a gradient is dropped without error.
      BG_LONGHANDS.forEach((k) =>
        selected.style.removeProperty(k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()))
      );
    }
    Object.entries(obj).forEach(([k, v]) => {
      if (hasBackgroundShorthand && BG_LONGHANDS.includes(k)) {
        // The shorthand already reset every sub-property, so these clears are
        // redundant — and removing `background-image` *after* setting the
        // shorthand would wipe the gradient it just created. Skip them.
        return;
      }
      if (v === "" || v === null || v === undefined) {
        selected.style.removeProperty(k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()));
      } else {
        selected.style[k] = v;
      }
    });
    positionOverlay();
    selectionInfo();
    emit();
  }

  function applyTextCommand(cmd) {
    if (!selected || !isTextEditable(selected)) return;
    // Make the element editable + focused so the selection lives inside it,
    // then run the command. This works whether or not global edit mode is on,
    // so the Inspector's bold/italic/list buttons affect the live text.
    selected.setAttribute("contenteditable", "true");
    selected.focus();
    document.execCommand(cmd, false, null);
    pushHistory();
    selectionInfo();
    positionOverlay();
    emit();
  }

  function remove() {
    const els = getSelectionSet();
    if (els.length === 0) return;
    els.forEach((el) => el.remove());
    selected = null;
    selectedSet = [];
    if (overlay) overlay.style.display = "none";
    if (selectionLayer) selectionLayer.innerHTML = "";
    onSelection(null);
    updateToolbar();
    pushHistory();
    emit();
  }

  // Apply a text colour to the current selection (or, when nothing is selected
  // but the box is active, to the whole box). Mirrors PowerPoint's behaviour.
  function setTextColor(color) {
    if (!selected || !isTextEditable(selected)) return;
    selected.setAttribute("contenteditable", "true");
    selected.focus();
    // Restore the snapshot AFTER focusing so the in-box selection is active when
    // execCommand runs; focusing a box collapses any pre-existing range.
    restoreSelection();
    const sel = getSelection();
    const hasSel = sel && !sel.isCollapsed && selected.contains(sel.anchorNode);
    if (hasSel) {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("foreColor", false, color);
    } else {
      selected.style.color = color;
    }
    pushHistory();
    selectionInfo();
    positionOverlay();
    emit();
  }

  // Toggle/convert the box's list to `kind` (see listFormat.applyListToElement).
  function applyList(kind) {
    if (!selected || !isTextEditable(selected)) return;
    selected.setAttribute("contenteditable", "true");
    selected.focus();
    applyListToElement(selected, kind);
    pushHistory();
    selectionInfo();
    positionOverlay();
    emit();
  }

  function zStep(dir) {
    if (!selected) return;
    const cur = num(selected.style.zIndex) || 0;
    selected.style.zIndex = String(cur + (dir > 0 ? 1 : -1));
    pushHistory();
    emit();
  }

  // Group the current selection (one or many top-level boxes) into a single
  // `data-slide-group` wrapper. Each child keeps its on-slide pixel position:
  // the wrapper is sized/placed to bound the boxes, and every child is
  // re-positioned *relative to the wrapper* by the same offset, so nothing
  // visually moves. If a single box is already a group it is left as-is.
  function group() {
    const boxes = getSelectionSet()
      .map((el) => topBox(el))
      .filter((el) => el && el.parentElement === slideRoot());
    // De-dupe (two nested clicks could resolve to the same top box).
    const unique = [...new Set(boxes)];
    if (unique.length < 2) return;

    // Compute the bounding box of every top-level box in slide coordinates.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    unique.forEach((el) => {
      const b = parseBox(el);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    });

    const wrap = document.createElement("div");
    wrap.setAttribute("data-slide-group", "1");
    wrap.style.position = "absolute";
    wrap.style.left = `${Math.round(minX)}px`;
    wrap.style.top = `${Math.round(minY)}px`;
    wrap.style.width = `${Math.round(maxX - minX)}px`;
    wrap.style.height = `${Math.round(maxY - minY)}px`;
    wrap.style.cursor = "move";
    wrap.style.zIndex = "1";
    wrap.style.outline = "none";

    // Insert the wrapper before the first box, then move every box inside,
    // offsetting its coordinates to the wrapper origin.
    const first = unique[0];
    first.parentNode.insertBefore(wrap, first);
    unique.forEach((el) => {
      const b = parseBox(el);
      el.style.left = `${Math.round(b.x - minX)}px`;
      el.style.top = `${Math.round(b.y - minY)}px`;
      wrap.appendChild(el);
    });

    setMultiSelected([wrap]);
    pushHistory();
    emit();
  }

  // Ungroup the current selection. Every selected group is unwrapped in place:
  // its children are re-parented to the slide root and their coordinates are
  // restored to absolute slide space (group origin + local offset), so position
  // and size are preserved exactly. When a box that is not a group is selected,
  // nothing happens.
  function ungroup() {
    const groups = getSelectionSet().filter((el) => el.getAttribute && el.getAttribute("data-slide-group"));
    if (groups.length === 0) return;
    const root = slideRoot();
    const released = [];
    groups.forEach((g) => {
      if (!g.isConnected) return;
      const gx = num(g.style.left) || 0;
      const gy = num(g.style.top) || 0;
      const parent = g.parentNode;
      while (g.firstChild) {
        const child = g.firstChild;
        g.removeChild(child);
        if (child.nodeType === 1) {
          const cx = num(child.style.left) || 0;
          const cy = num(child.style.top) || 0;
          child.style.left = `${Math.round(cx + gx)}px`;
          child.style.top = `${Math.round(cy + gy)}px`;
          child.style.position = child.style.position || "absolute";
        }
        parent.insertBefore(child, g);
        if (child.nodeType === 1) released.push(child);
      }
      parent.removeChild(g);
    });
    if (released.length) setMultiSelected(released);
    else clearSelection();
    pushHistory();
    emit();
  }

  function clearFormatting() {
    if (!selected) return;
    selected.removeAttribute("style");
    pushHistory();
    selectionInfo();
    emit();
  }

  function setText(text) {
    if (!selected) return;
    // innerText preserves line breaks as <br>/<div> in contenteditable;
    // textContent collapses them into space.
    selected.innerText = text;
    pushHistory();
    selectionInfo();
    positionOverlay();
    emit();
  }

  // Replace the selected element's inner content with the provided HTML while
  // preserving semantic structure (lists, line breaks, inline runs). This is
  // what a contenteditable Inspector uses to round-trip formatting changes
  // back to the slide. The caller is responsible for stripping styles that
  // would break the on-slide rendering (positioning, sizing, color tokens
  // baked into the slide's `*` selectors).
  function setHtml(html) {
    if (!selected) return;
    selected.innerHTML = html;
    clearHoverOutlines();
    pushHistory();
    selectionInfo();
    positionOverlay();
    emit();
  }

  function getHtml() {
    if (!selected) return "";
    return selected.innerHTML || "";
  }

  // ---- icon decoration ----
  // The current icon (if any) is the first `<svg data-slide-icon="1">` child of
  // the selected element. The catalog is keyed by name → path data; the SVG we
  // materialise uses an inline `<path>` with `currentColor`, so the icon
  // inherits the element's color and stays sizeable via inline width/height.
  function findIcon() {
    if (!selected) return null;
    const svg = selected.querySelector('[data-slide-icon="1"]');
    if (!(svg instanceof Element)) return null;
    const name = svg.getAttribute("data-icon-name") || "";
    const w = parseFloat(svg.getAttribute("width")) || svg.clientWidth || 24;
    const h = parseFloat(svg.getAttribute("height")) || svg.clientHeight || 24;
    return { name, size: Math.round(w) };
  }

  function ensureIconCleared() {
    if (!selected) return;
    selected.querySelectorAll('[data-slide-icon="1"]').forEach((n) => n.remove());
  }

  function buildIconSvg(name) {
    const entry = ICON_CATALOG[name];
    if (!entry || !selected) return;
    const size = Math.round(parseBox(selected).w) || findIcon()?.size || 24;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-slide-icon", "1");
    svg.setAttribute("data-icon-name", name);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.style.display = "block";
    // Fill the wrapper box so the icon scales with it on resize.
    svg.style.width = "100%";
    svg.style.height = "100%";

    // The catalog entries from scripts/icons.mjs come in two forms:
    //   single-path/circle → { tag, attrs: {...} }
    //   multi-segment     → { entries: [{tag, attrs}, ...] }
    // Walk both uniformly.
    const segments = entry.entries ?? [{ tag: entry.tag, attrs: entry.attrs }];
    for (const seg of segments) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", seg.tag);
      for (const [k, v] of Object.entries(seg.attrs)) {
        if (k === "key") continue; // lucide's HOC key, irrelevant at runtime
        el.setAttribute(k, String(v));
      }
      svg.appendChild(el);
    }
    selected.insertBefore(svg, selected.firstChild);
  }

  function setIcon(name) {
    if (!selected) return;
    ensureIconCleared();
    if (name) buildIconSvg(name);
    pushHistory();
    selectionInfo();
    emit();
  }

  function removeIcon() {
    if (!selected) return;
    if (!findIcon()) return;
    ensureIconCleared();
    pushHistory();
    selectionInfo();
    emit();
  }

  function setIconSize(px) {
    if (!selected || !findIcon()) return;
    const v = Math.max(8, Math.min(512, Number(px) || 24));
    // Resize the wrapper box; the icon SVG fills it, so the glyph scales too.
    applyBox({ w: v, h: v });
    pushHistory();
    selectionInfo();
    emit();
  }

  function copy() {
    if (!selected) return;
    clipboard = selected.outerHTML;
  }

  function cut() {
    copy();
    remove();
  }

  function paste() {
    if (!clipboard) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = clipboard;
    const node = tmp.firstElementChild;
    if (!node) return;
    (selected || slideRoot()).appendChild(node);
    pushHistory();
    emit();
  }

  function duplicate() {
    if (!selected) return;
    // Always duplicate the *top-level box* under the slide root, never a nested
    // child that happened to be the click target (e.g. a table cell), so the
    // copy is a faithful clone of the whole box with all its content.
    const box = topBox(selected);
    const clone = box.cloneNode(true);
    // Nudge the copy a little so it doesn't land exactly on top of the original
    // (which would make the duplicate look like it did nothing).
    const offset = 16;
    const left = Math.min(1600 - 1, Math.max(0, (num(box.style.left) || 0) + offset));
    const top = Math.min(900 - 1, Math.max(0, (num(box.style.top) || 0) + offset));
    clone.style.left = `${left}px`;
    clone.style.top = `${top}px`;
    box.parentNode.insertBefore(clone, box.nextSibling);
    select(clone);
    pushHistory();
    emit();
  }

  // ---- table operations (only meaningful on a selected <td>/<th>) ----
  function afterTableChange() {
    pushHistory();
    selectionInfo();
    emit();
  }

  function insertRow(after) {
    const cell = isCell(selected) ? selected : null;
    if (!cell) return;
    const tr = cell.parentElement;
    if (!tr) return;
    const newTr = document.createElement("tr");
    for (let i = 0; i < tr.children.length; i += 1) {
      const td = document.createElement("td");
      td.textContent = "";
      newTr.appendChild(td);
    }
    tr.parentNode.insertBefore(newTr, after ? tr.nextSibling : tr);
    afterTableChange();
  }

  function deleteRow() {
    const cell = isCell(selected) ? selected : null;
    if (!cell) return;
    const tr = cell.parentElement;
    const tbody = tr.parentElement;
    if (!tbody || tbody.children.length <= 1) return;
    tbody.removeChild(tr);
    if (!cell.isConnected) {
      clearSelection();
      afterTableChange();
      return;
    }
    afterTableChange();
  }

  function insertColumn(after) {
    const cell = isCell(selected) ? selected : null;
    if (!cell) return;
    const { colIndex } = cellCoords(cell);
    const rows = Array.from(tableOf(cell).querySelectorAll("tr"));
    rows.forEach((tr) => {
      const ref = tr.children[colIndex];
      if (!ref) return;
      const td = document.createElement("td");
      td.textContent = "";
      tr.insertBefore(td, after ? ref.nextSibling : ref);
    });
    afterTableChange();
  }

  function deleteColumn() {
    const cell = isCell(selected) ? selected : null;
    if (!cell) return;
    const { colIndex } = cellCoords(cell);
    const table = tableOf(cell);
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length === 0 || rows[0].children.length <= 1) return;
    rows.forEach((tr) => {
      if (tr.children[colIndex]) tr.removeChild(tr.children[colIndex]);
    });
    if (!cell.isConnected) {
      clearSelection();
      afterTableChange();
      return;
    }
    afterTableChange();
  }

  function moveRow(dir) {
    const cell = isCell(selected) ? selected : null;
    if (!cell) return;
    const tr = cell.parentElement;
    const swap = dir > 0 ? tr.nextElementSibling : tr.previousElementSibling;
    if (!swap) return;
    if (dir > 0) tr.parentNode.insertBefore(tr, swap.nextSibling);
    else tr.parentNode.insertBefore(swap, tr);
    afterTableChange();
  }

  function moveColumn(dir) {
    const cell = isCell(selected) ? selected : null;
    if (!cell) return;
    const { colIndex } = cellCoords(cell);
    const swapIndex = colIndex + dir;
    const table = tableOf(cell);
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length === 0 || swapIndex < 0 || swapIndex >= rows[0].children.length) return;
    rows.forEach((tr) => {
      const a = tr.children[colIndex];
      const b = tr.children[swapIndex];
      if (!a || !b) return;
      if (dir > 0) tr.insertBefore(a, b.nextSibling);
      else tr.insertBefore(b, a);
    });
    afterTableChange();
  }

  function setRowHeight(px) {
    const cell = isCell(selected) ? selected : null;
    if (!cell) return;
    const tr = cell.parentElement;
    if (px === "" || px === null || px === undefined) tr.style.removeProperty("height");
    else tr.style.height = `${Math.max(1, Number(px) || 0)}px`;
    afterTableChange();
  }

  function setColumnWidth(px) {
    const cell = isCell(selected) ? selected : null;
    if (!cell) return;
    if (px === "" || px === null || px === undefined) cell.style.removeProperty("width");
    else cell.style.width = `${Math.max(1, Number(px) || 0)}px`;
    afterTableChange();
  }

  function insertText() {
    const root = slideRoot();
    if (!root.style.position || root.style.position === "static") {
      root.style.position = "relative";
    }
    const w = 440;
    const h = 12;
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = `${Math.round((1600 - w) / 2)}px`;
    el.style.top = `${Math.round((900 - h) / 2)}px`;
    el.style.width = `${w}px`;
    el.style.minHeight = `${h}px`;
    el.style.padding = "24px";
    el.style.cursor = "move";
    el.style.zIndex = "1";
    el.style.outline = "none";
    el.setAttribute("contenteditable", "true");
    root.appendChild(el);
    select(el);
    el.focus();
    pushHistory();
    emit();
  }

  /** Insert a new absolutely-positioned icon element on the slide. */
  function insertIcon(name) {
    const root = slideRoot();
    if (!root.style.position || root.style.position === "static") {
      root.style.position = "relative";
    }
    const entry = ICON_CATALOG[name];
    if (!entry) return;
    const segments = entry.entries ?? [{ tag: entry.tag, attrs: entry.attrs }];
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "96");
    svg.setAttribute("height", "96");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.5");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("data-slide-icon", "1");
    svg.setAttribute("data-icon-name", name);
    svg.style.display = "block";
    // Fill the wrapper box so the icon scales with it on resize (both grow and
    // shrink) instead of keeping a fixed pixel size.
    svg.style.width = "100%";
    svg.style.height = "100%";
    for (const seg of segments) {
      const el2 = document.createElementNS("http://www.w3.org/2000/svg", seg.tag);
      for (const [k, v] of Object.entries(seg.attrs)) {
        if (k === "key") continue;
        el2.setAttribute(k, String(v));
      }
      svg.appendChild(el2);
    }
    const w = 96;
    const h = 96;
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = `${Math.round((1600 - w) / 2)}px`;
    el.style.top = `${Math.round((900 - h) / 2)}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.cursor = "move";
    el.style.zIndex = "1";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.appendChild(svg);
    root.appendChild(el);
    select(el);
    pushHistory();
    emit();
  }

  /** Insert a new absolutely-positioned table element on the slide. */
  function insertTable(rows, cols) {
    const root = slideRoot();
    if (!root.style.position || root.style.position === "static") {
      root.style.position = "relative";
    }
    const rowCount = Math.max(1, Math.min(20, rows | 0));
    const colCount = Math.max(1, Math.min(20, cols | 0));
    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.tableLayout = "fixed";
    for (let r = 0; r < rowCount; r += 1) {
      const tr = document.createElement("tr");
      tr.style.height = "56px";
      for (let c = 0; c < colCount; c += 1) {
        const td = document.createElement("td");
        td.style.border = "1px solid #cbd5e1";
        td.style.padding = "8px 12px";
        td.textContent = "";
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    const w = Math.min(640, 1600 - 80);
    const h = 56 * rowCount + 4;
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = `${Math.round((1600 - w) / 2)}px`;
    el.style.top = `${Math.round((900 - h) / 2)}px`;
    el.style.width = `${w}px`;
    el.style.minHeight = `${h}px`;
    el.style.cursor = "move";
    el.style.zIndex = "1";
    el.style.outline = "none";
    el.style.border = "1px solid #e2e8f0";
    el.appendChild(table);
    root.appendChild(el);
    select(el);
    pushHistory();
    emit();
  }

  /** Insert a new absolutely-positioned image box (picture fill) on the slide. */
  function insertImageBox(asset) {
    if (!asset || !asset.url) return;
    const root = slideRoot();
    if (!root.style.position || root.style.position === "static") {
      root.style.position = "relative";
    }
    const w = 480;
    const h = 270;
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = `${Math.round((1600 - w) / 2)}px`;
    el.style.top = `${Math.round((900 - h) / 2)}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.cursor = "move";
    el.style.zIndex = "1";
    el.style.outline = "none";
    el.style.backgroundImage = `url("${asset.url}")`;
    el.style.backgroundRepeat = "no-repeat";
    el.style.backgroundSize = "contain";
    el.style.backgroundPosition = "center";
    root.appendChild(el);
    select(el);
    pushHistory();
    emit();
  }

  function nudge(dx, dy) {
    const els = getSelectionSet();
    if (els.length === 0) return;
    els.forEach((el) => {
      const b = parseBox(el);
      el.style.left = `${Math.round(b.x + dx)}px`;
      el.style.top = `${Math.round(b.y + dy)}px`;
      el.style.position = el.style.position || "absolute";
    });
    positionOverlay();
    pushHistory();
    emit();
  }

  function undo() {
    if (histIndex <= 0) return;
    histIndex -= 1;
    restore();
  }

  function redo() {
    if (histIndex >= history.length - 1) return;
    histIndex += 1;
    restore();
  }

  function restore() {
    slideRoot().innerHTML = rewriteMediaUrlsToPreview(history[histIndex]);
    selected = null;
    selectedSet = [];
    if (overlay) overlay.style.display = "none";
    if (selectionLayer) selectionLayer.innerHTML = "";
    onSelection(null);
    updateToolbar();
    emit();
  }

  // ---- document-level listeners ----
  // Resolve the inner box to select when descending into a group: the topmost
  // positioned/editable element between the clicked target and the group
  // wrapper (inclusive of the group itself). Clicking inside a group therefore
  // selects the child box the user aimed at, never the whole slide.
  function innerBox(el, limit) {
    let n = el;
    while (n && n !== limit) {
      if (isPositioned(n) || isTextEditable(n)) return n;
      n = n.parentElement;
    }
    return limit;
  }

  // Is `el` (or one of its ancestors) a member of the current multi-selection?
  function isWithinSelectedGroup(el) {
    return getSelectionSet().some((g) => g.getAttribute && g.getAttribute("data-slide-group") && g.contains(el));
  }

  function onDocClick(e) {
    if (e.target === overlay) return;
    if (e.target.getAttribute && e.target.getAttribute("data-slide-handle")) return;
    const additive = e.ctrlKey || e.metaKey;

    // Ctrl/Cmd+click inside a currently-selected group descends into it: select
    // the inner child box (additively) instead of re-selecting the whole group.
    // The child keeps its own position/size; colour/font simply inherit from the
    // parent via the normal CSS cascade (no mutation needed).
    if (additive && isWithinSelectedGroup(e.target)) {
      const group = getSelectionSet().find((g) => g.getAttribute && g.getAttribute("data-slide-group") && g.contains(e.target));
      const target = innerBox(e.target, group);
      select(target, { additive: true });
      return;
    }

    // Select the whole box, not a nested child, so the overlay frames the box
    // and text editing targets it (not a tiny inner leaf).
    select(topEditable(e.target) || e.target, { additive });
  }

  // Double-click a text element to dive straight into editing it — the floating
  // text toolbar then appears above the box.
  function onDocDblClick(e) {
    let target = topEditable(e.target) || e.target;
    // If we're already editing this box, let the browser's native double-click
    // select the word so the user can style it (bold/italic/color). Don't
    // hijack it with a caret-at-end reset, which would wipe the selection.
    if (textEditing && selected && (target === selected || (selected.contains && selected.contains(target)))) {
      return;
    }
    // On a small box the second click of a double-click can land on a resize
    // handle (or inside the already-selected box); in both cases we should edit
    // the currently selected box rather than bail out or start a resize.
    if (
      selected &&
      isTextEditable(selected) &&
      ((target.getAttribute && target.getAttribute("data-slide-handle") !== null) ||
        target === selected ||
        (selected.contains && selected.contains(target)))
    ) {
      target = selected;
    }
    if (!isTextEditable(target)) return;
    // Stop the browser's native "select the word" default — otherwise it
    // overrides our caret-at-end placement and the box isn't ready to type
    // until the user clicks once more.
    e.preventDefault();
    if (target !== selected) select(target);
    beginTextEdit();
  }

  function handleContextMenu(e) {
    e.preventDefault();
    const target = e.target;
    // Right-clicking must NOT blow away an existing multi-selection: if the
    // clicked element is already part of the selection, keep the whole set and
    // just promote it to primary so the context menu (group/duplicate/…) acts on
    // the whole selection. Otherwise fall back to a single selection.
    if (target && target !== root && target !== slideRoot() && getSelectionSet().includes(target)) {
      selected = target;
      updateOverlayColor();
      positionOverlay();
      selectionInfo();
    } else {
      select(target);
    }
    if (onContextMenu) {
      onContextMenu(e.clientX, e.clientY, !!selected);
    }
  }

  function onDocInput() {
    if (!selected) return;
    const editable = editing || selected.getAttribute("contenteditable") === "true";
    if (editable) {
      selectionInfo();
      positionOverlay();
      emit();
    }
  }

  function onDocBlur(e) {
    if (!selected) return;
    // Clicking the floating text toolbar blurs the box, but the toolbar keeps
    // the box focused via mousedown preventDefault. Guard anyway: if focus
    // jumped to the toolbar, keep the edit session alive so its buttons still
    // apply to the box instead of hiding the toolbar.
    if (e && e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("[data-text-toolbar]")) {
      return;
    }
    const editable = editing || selected.getAttribute("contenteditable") === "true";
    if (editable) {
      pushHistory();
      // Leaving the box ends an explicit text-edit session: hide the floating
      // toolbar AND drop contenteditable (unless we're in global edit mode,
      // where boxes stay editable). Without this the box would keep
      // contenteditable="true" after losing focus.
      if (textEditing && !editing) exitTextEdit();
    }
  }

  function onScrollOrResize() {
    positionOverlay();
  }

  // Walk up to the outermost element directly under the slide root — i.e. the
  // top-level "box"/group that contains the given node. Used for the hover
  // indicator so the parent container is also outlined as selectable.
  function topBox(el) {
    let n = el;
    while (n && n.parentElement && n.parentElement !== slideRoot()) {
      n = n.parentElement;
    }
    return n;
  }

  // A "box" is positioned on the slide via explicit inline left/top styles.
  // Wrapper divs inside a box are not, so they shouldn't be promoted to edit
  // targets on their own.
  function isPositioned(el) {
    if (!el || !el.style) return false;
    return el.style.left !== "" && el.style.top !== "";
  }

  // Resolve the node to edit: walk up from a (possibly nested) element to the
  // nearest editable box. We stop at table cells (they edit locally) and at the
  // nearest positioned box (so group children stay local and we don't promote a
  // click on nested text up to the whole slide). Falls back to the top-level box
  // directly under the slide root. Fixes the case where double-clicking nested
  // HTML (e.g. <div><div><span>text</span></div></div>) left only the tiny inner
  // leaf editable with no active caret.
  function topEditable(el) {
    if (!el || el === slideRoot()) return null;
    let n = el;
    while (n && n !== slideRoot()) {
      if (isCell(n)) return n;
      const parent = n.parentElement;
      if (!parent || parent === slideRoot()) return n;
      if (isPositioned(n)) return n;
      n = parent;
    }
    return n;
  }

  // ---- hover indicator: dotted outline on the element under the cursor AND on
  // its top-level parent box, so the user can see every selectable item. ----
  // The indicator is drawn in a dedicated overlay layer — never as an inline
  // style on the slide element — so transient chrome can never leak into the
  // snapshot and get saved as real content.
  let hoverLeaf = null;
  let hoverBox = null;

  function buildHoverLayer() {
    const layer = document.createElement("div");
    layer.setAttribute("data-slide-hover", "1");
    layer.style.position = "absolute";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "2147483645";
    ["leaf", "box"].forEach((kind) => {
      const el = document.createElement("div");
      el.setAttribute(`data-slide-hover-${kind}`, "1");
      el.style.position = "absolute";
      el.style.boxSizing = "border-box";
      el.style.pointerEvents = "none";
      el.style.borderRadius = "3px";
      el.style.display = "none";
      layer.appendChild(el);
    });
    root.appendChild(layer);
    return layer;
  }

  function positionHover(target, el) {
    if (!target || target === selected) return;
    el.style.border = `2px dashed ${HIGHLIGHT}`;
    const r = target.getBoundingClientRect();
    const host = root.host ?? root;
    const sr = host.getBoundingClientRect();
    const scale = sr.width > 0 ? sr.width / Math.max(1, host.offsetWidth) : 1;
    el.style.left = `${(r.left - sr.left) / scale}px`;
    el.style.top = `${(r.top - sr.top) / scale}px`;
    el.style.width = `${r.width / scale}px`;
    el.style.height = `${r.height / scale}px`;
    el.style.display = "block";
  }

  function clearHoverOutlines() {
    hoverLeaf = null;
    hoverBox = null;
    if (!hoverLayer) return;
    hoverLayer.querySelectorAll("[data-slide-hover-leaf], [data-slide-hover-box]").forEach((el) => {
      el.style.display = "none";
    });
  }

  function onPointerMoveHover(e) {
    if (drag || resize) return;
    const t = e.target;
    if (
      !t ||
      t === root ||
      t === slideRoot() ||
      (t.getAttribute && (t.getAttribute("data-slide-overlay") || t.getAttribute("data-slide-hover")))
    ) {
      clearHoverOutlines();
      return;
    }
    const sr = slideRoot();
    if (!sr || !sr.contains(t)) {
      clearHoverOutlines();
      return;
    }
    const box = topBox(t);
    if (t === hoverLeaf && box === hoverBox) return; // no change since last move
    clearHoverOutlines();
    if (!hoverLayer) hoverLayer = buildHoverLayer();
    positionHover(t, hoverLayer.querySelector("[data-slide-hover-leaf]"));
    positionHover(box, hoverLayer.querySelector("[data-slide-hover-box]"));
    hoverLeaf = t;
    hoverBox = box;
  }

  // Clear the selection only when the user clicks the slide stage itself
  // (the scrollable canvas area), not when interacting with the editor chrome
  // (Inspector inputs, toolbar, panels). Otherwise editing the selected
  // element from the Inspector — e.g. typing in the text area — would drop
  // the selection the moment the field is focused, so commands no-op.
  function onWindowPointerDown(e) {
    if (!selected) return;
    const path = e.composedPath();
    if (path.includes(root.host) || path.includes(overlay)) return;
    // Clicks on the floating text toolbar (rendered in the light DOM, inside the
    // stage) must not clear the selection — otherwise the toolbar vanishes and
    // its buttons no-op. The toolbar already keeps the box focused via
    // mousedown preventDefault, so we only need to skip the stage-clear here.
    if (path.some((n) => n instanceof Element && n.hasAttribute("data-text-toolbar"))) return;
    const onStage = path.some(
      (n) => n instanceof Element && n.hasAttribute("data-stage")
    );
    if (onStage) clearSelection();
  }

  root.addEventListener("click", onDocClick, true);
  root.addEventListener("dblclick", onDocDblClick, true);
  root.addEventListener("pointerdown", onPointerDown, true);
  root.addEventListener("contextmenu", handleContextMenu, true);
  root.addEventListener("input", onDocInput, true);
  root.addEventListener("blur", onDocBlur, true);
  root.addEventListener("pointermove", onPointerMoveHover, true);
  root.addEventListener("pointerleave", clearHoverOutlines, true);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize, true);
  window.addEventListener("pointerdown", onWindowPointerDown);
  if (overlay) positionOverlay();

  function destroy() {
    root.removeEventListener("click", onDocClick, true);
    root.removeEventListener("dblclick", onDocDblClick, true);
    root.removeEventListener("pointerdown", onPointerDown, true);
    root.removeEventListener("contextmenu", handleContextMenu, true);
    root.removeEventListener("input", onDocInput, true);
    root.removeEventListener("blur", onDocBlur, true);
    root.removeEventListener("pointermove", onPointerMoveHover, true);
    root.removeEventListener("pointerleave", clearHoverOutlines, true);
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize, true);
    window.removeEventListener("pointerdown", onWindowPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointermove", onPendingMove);
    window.removeEventListener("pointerup", onPendingUp);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (selectionLayer && selectionLayer.parentNode) selectionLayer.parentNode.removeChild(selectionLayer);
    if (hoverLayer && hoverLayer.parentNode) hoverLayer.parentNode.removeChild(hoverLayer);
  }

  return {
    select,
    clearSelection,
    setEditing,
    beginTextEdit,
    exitTextEdit,
    setStyle,
    setStyles,
    applyTextCommand,
    setTextColor,
    saveSelection,
    restoreSelection,
    applyList,
    nudge,
    remove,
    bringForward: () => zStep(1),
    sendBackward: () => zStep(-1),
    group,
    ungroup,
    clearFormatting,
    insertText,
    insertIcon,
    insertTable,
    insertImageBox,
    setText,
    setHtml,
    getHtml,
    setIcon,
    removeIcon,
    setIconSize,
    copy,
    cut,
    paste,
    duplicate,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    moveRow,
    moveColumn,
    setRowHeight,
    setColumnWidth,
    undo,
    redo,
    getSelected: () => selected,
    getSelectionSet,
    setMultiSelected,
    getIcon: findIcon,
    isEditing: () => editing,
    isTextEditing: () => textEditing,
    isEditingText: () => !!(selected && (editing || selected.getAttribute("contenteditable") === "true")),
    destroy,
  };
}
