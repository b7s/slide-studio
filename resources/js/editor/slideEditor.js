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

// Icon catalog. The path data + tag references live in a single generated
// file (`icons.config.js`) sourced from the installed `lucide-react` package
// via `scripts/icons.mjs`. Do not hand-edit icon paths inside this file — to
// change the catalog, update the ICONS whitelist in `scripts/icons.mjs`
// (or bump `lucide-react` in `package.json`) and re-run `npm run icons`.
import { ICON_CATALOG } from "./icons.config";

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function boxOf(el) {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}

function snapshot(root) {
  return root.innerHTML;
}

function parseBox(el) {
  const cs = getComputedStyle(el);
  return {
    x: num(el.style.left) || num(cs.left),
    y: num(el.style.top) || num(cs.top),
    w: num(el.style.width) || el.offsetWidth,
    h: num(el.style.height) || el.offsetHeight,
  };
}

export function createSlideEditor({ root, onChange, onSelection, onEditingChange, onContextMenu }) {
  let selected = null;
  let editing = false;
  let overlay = null;
  let history = [];
  let histIndex = -1;
  let clipboard = null;
  let drag = null;
  let resize = null;

  const slideRoot = () =>
    root.querySelector("[data-slide], .slide, .slide-root") || root.firstElementChild || root;

  function pushHistory() {
    const snap = snapshot(root);
    if (history[histIndex] === snap) return;
    history = history.slice(0, histIndex + 1);
    history.push(snap);
    if (history.length > 60) history.shift();
    histIndex = history.length - 1;
    emit();
  }

  function emit() {
    onChange(snapshot(root));
  }

  function selectionInfo() {
    if (!selected) {
      onSelection(null);
      return;
    }
    const box = boxOf(selected);
    onSelection({
      tag: selected.tagName.toLowerCase(),
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
        borderRadius: selected.style.borderRadius,
        borderWidth: selected.style.borderWidth,
        borderStyle: selected.style.borderStyle,
        borderColor: selected.style.borderColor,
        boxShadow: selected.style.boxShadow,
      },
      icon: findIcon(),
      editableText: isTextEditable(selected),
      table: tableInfo(),
    });
  }

  function isTextEditable(el) {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "li", "a", "div", "td", "th", "button"].includes(tag);
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

  function buildOverlay() {
    const ov = document.createElement("div");
    ov.setAttribute("data-slide-overlay", "1");
    ov.style.position = "absolute";
    ov.style.pointerEvents = "none";
    ov.style.border = "1.5px solid #b9915b";
    ov.style.zIndex = "2147483646";
    ov.style.boxSizing = "border-box";
    HANDLES.forEach((pos) => {
      const h = document.createElement("div");
      h.setAttribute("data-slide-handle", pos);
      h.style.position = "absolute";
      h.style.width = "10px";
      h.style.height = "10px";
      h.style.background = "#b9915b";
      h.style.border = "1.5px solid #fff";
      h.style.borderRadius = "2px";
      h.style.pointerEvents = "auto";
      h.style.cursor = cursorFor(pos);
      ov.appendChild(h);
    });
    root.appendChild(ov);
    return ov;
  }

  function cursorFor(pos) {
    const map = {
      nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize",
      e: "ew-resize", se: "nwse-resize", s: "ns-resize",
      sw: "nesw-resize", w: "ew-resize",
    };
    return map[pos] || "default";
  }

  function positionOverlay() {
    if (!overlay || !selected) return;
    const r = selected.getBoundingClientRect();
    const host = root.host ?? root;
    const sr = host.getBoundingClientRect();
    // The host may carry a CSS transform (zoom) — its layout box
    // (`offsetWidth`/`offsetHeight`) is unscaled, so `sr.width` divided by
    // that is the scale factor. Convert the post-transform screen delta
    // into the unscaled local coordinate space the overlay lives in.
    const scale = sr.width > 0 ? sr.width / Math.max(1, host.offsetWidth) : 1;
    const x = (r.left - sr.left) / scale;
    const y = (r.top - sr.top) / scale;
    const w = r.width / scale;
    const h = r.height / scale;
    overlay.style.left = `${x}px`;
    overlay.style.top = `${y}px`;
    overlay.style.width = `${w}px`;
    overlay.style.height = `${h}px`;
    const handles = overlay.querySelectorAll("[data-slide-handle]");
    handles.forEach((h) => {
      const pos = h.getAttribute("data-slide-handle");
      const [hx, hy] = handleXY(pos, w, h);
      h.style.left = `${hx - 5}px`;
      h.style.top = `${hy - 5}px`;
    });
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

  function select(el) {
    if (!el || el === root || el === slideRoot() || el.getAttribute("data-slide-overlay") !== null) {
      clearSelection();
      return;
    }
    selected = el;
    if (overlay) overlay.style.display = "block";
    else overlay = buildOverlay();
    if (editing) setEditable(true);
    positionOverlay();
    selectionInfo();
  }

  function clearSelection() {
    if (selected && editing) setEditable(false);
    selected = null;
    if (overlay) overlay.style.display = "none";
    onSelection(null);
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
  }

  // ---- pointer interactions (drag + resize) ----
  function onPointerDown(e) {
    const handle = e.target.getAttribute && e.target.getAttribute("data-slide-handle");
    if (handle) {
      e.preventDefault();
      const r = selected.getBoundingClientRect();
      resize = {
        pos: handle,
        startX: e.clientX,
        startY: e.clientY,
        box: parseBox(selected),
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      return;
    }
    if (e.target === overlay) {
      e.preventDefault();
      const cs = getComputedStyle(selected);
      drag = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: num(selected.style.left) || num(cs.left) || 0,
        baseY: num(selected.style.top) || num(cs.top) || 0,
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }
  }

  function onPointerMove(e) {
    if (resize) {
      const dx = e.clientX - resize.startX;
      const dy = e.clientY - resize.startY;
      const { pos, box } = resize;
      let { x, y, w, h } = box;
      if (pos.includes("e")) w = box.w + dx;
      if (pos.includes("s")) h = box.h + dy;
      if (pos.includes("w")) { w = box.w - dx; x = box.x + dx; }
      if (pos.includes("n")) { h = box.h - dy; y = box.y + dy; }
      applyBox({ x, y, w: Math.max(8, w), h: Math.max(8, h) });
    } else if (drag) {
      const nx = drag.baseX + (e.clientX - drag.startX);
      const ny = drag.baseY + (e.clientY - drag.startY);
      selected.style.left = `${nx}px`;
      selected.style.top = `${ny}px`;
      selected.style.position = selected.style.position || "absolute";
    }
    positionOverlay();
  }

  function onPointerUp() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if ((drag || resize) && selected) {
      drag = null;
      resize = null;
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

  function setStyles(obj) {
    if (!selected) return;
    Object.entries(obj).forEach(([k, v]) => {
      if (v === "" || v === null || v === undefined) selected.style.removeProperty(k);
      else selected.style[k] = v;
    });
    positionOverlay();
    selectionInfo();
    emit();
  }

  function applyTextCommand(cmd) {
    if (!selected || !editing) return;
    selected.focus();
    document.execCommand(cmd, false, null);
    emit();
  }

  function remove() {
    if (!selected) return;
    selected.remove();
    selected = null;
    if (overlay) overlay.style.display = "none";
    onSelection(null);
    pushHistory();
    emit();
  }

  function zStep(dir) {
    if (!selected) return;
    const cur = num(selected.style.zIndex) || 0;
    selected.style.zIndex = String(cur + (dir > 0 ? 1 : -1));
    pushHistory();
    emit();
  }

  function group() {
    if (!selected) return;
    const wrap = document.createElement("div");
    wrap.setAttribute("data-slide-group", "1");
    selected.parentNode.insertBefore(wrap, selected);
    wrap.appendChild(selected);
    select(wrap);
    pushHistory();
    emit();
  }

  function ungroup() {
    if (!selected || !selected.getAttribute("data-slide-group")) return;
    const parent = selected.parentNode;
    while (selected.firstChild) parent.insertBefore(selected.firstChild, selected);
    parent.removeChild(selected);
    selected = null;
    if (overlay) overlay.style.display = "none";
    onSelection(null);
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

  // ---- icon decoration ----
  // The current icon (if any) is the first `<svg data-g4-icon="1">` child of
  // the selected element. The catalog is keyed by name → path data; the SVG we
  // materialise uses an inline `<path>` with `currentColor`, so the icon
  // inherits the element's color and stays sizeable via inline width/height.
  function findIcon() {
    if (!selected) return null;
    const svg = selected.querySelector('[data-g4-icon="1"]');
    if (!(svg instanceof Element)) return null;
    const name = svg.getAttribute("data-icon-name") || "";
    const w = parseFloat(svg.getAttribute("width")) || svg.clientWidth || 24;
    const h = parseFloat(svg.getAttribute("height")) || svg.clientHeight || 24;
    return { name, size: Math.round(w) };
  }

  function ensureIconCleared() {
    if (!selected) return;
    selected.querySelectorAll('[data-g4-icon="1"]').forEach((n) => n.remove());
  }

  function buildIconSvg(name) {
    const entry = ICON_CATALOG[name];
    if (!entry || !selected) return;
    const size = findIcon()?.size ?? 24;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-g4-icon", "1");
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
    if (!selected) return;
    const icon = findIcon();
    if (!icon) return;
    const svg = selected.querySelector('[data-g4-icon="1"]');
    const v = Math.max(8, Math.min(512, Number(px) || 24));
    svg.setAttribute("width", String(v));
    svg.setAttribute("height", String(v));
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
    copy();
    paste();
    const nodes = (selected || slideRoot()).children;
    const node = nodes[nodes.length - 1];
    if (node) select(node);
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

  function nudge(dx, dy) {
    if (!selected) return;
    applyBox({ x: parseBox(selected).x + dx, y: parseBox(selected).y + dy });
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
    root.innerHTML = history[histIndex];
    clearSelection();
    emit();
  }

  // ---- document-level listeners ----
  function onDocClick(e) {
    if (e.target === overlay) return;
    if (e.target.getAttribute && e.target.getAttribute("data-slide-handle")) return;
    select(e.target);
  }

  function onContextMenu(e) {
    e.preventDefault();
    select(e.target);
    if (onContextMenu) {
      onContextMenu(e.clientX, e.clientY, !!selected);
    }
  }

  function onDocInput() {
    if (selected && editing) selectionInfo();
  }

  function onDocBlur() {
    if (selected && editing) pushHistory();
  }

  function onScrollOrResize() {
    positionOverlay();
  }

  root.addEventListener("click", onDocClick, true);
  root.addEventListener("pointerdown", onPointerDown, true);
  root.addEventListener("contextmenu", onContextMenu, true);
  root.addEventListener("input", onDocInput, true);
  root.addEventListener("blur", onDocBlur, true);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize, true);
  if (overlay) positionOverlay();

  function destroy() {
    root.removeEventListener("click", onDocClick, true);
    root.removeEventListener("pointerdown", onPointerDown, true);
    root.removeEventListener("contextmenu", onContextMenu, true);
    root.removeEventListener("input", onDocInput, true);
    root.removeEventListener("blur", onDocBlur, true);
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize, true);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  return {
    select,
    clearSelection,
    setEditing,
    setStyle,
    setStyles,
    applyTextCommand,
    nudge,
    remove,
    bringForward: () => zStep(1),
    sendBackward: () => zStep(-1),
    group,
    ungroup,
    clearFormatting,
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
    getIcon: findIcon,
    isEditing: () => editing,
    destroy,
  };
}
