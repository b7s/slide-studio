import {describe, expect, it, vi} from "vitest";
import {createSlideEditor} from "./slideEditor";

function makeRoot() {
  const root = document.createElement("div");
  const slide = document.createElement("div");
  slide.className = "slide";
  slide.style.position = "relative";
  const a = document.createElement("div");
  a.textContent = "A";
  const b = document.createElement("div");
  b.textContent = "B";
  slide.appendChild(a);
  slide.appendChild(b);
  root.appendChild(slide);
  return { root, a, b };
}

describe("slideEditor.duplicate", () => {
  it("clones the box as a sibling and selects the new copy", () => {
    const { root, a, b } = makeRoot();
    const engine = createSlideEditor({
      root,
      onChange: vi.fn(),
      onSelection: vi.fn(),
    });

    engine.select(a);
    const before = root.querySelector(".slide").children.length;
    engine.duplicate();
    const after = root.querySelector(".slide").children.length;

    expect(after).toBe(before + 1);
    // The clone sits right after the original (sibling, not nested).
    expect(a.nextElementSibling).not.toBe(b);
    expect(a.nextElementSibling.textContent).toBe("A");
    // Selection moved to the freshly duplicated box.
    expect(engine.getSelected()).toBe(a.nextElementSibling);

    engine.destroy();
  });

  it("duplicates the whole box even when a nested child (e.g. a table cell) is selected", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });
    const slide = root.querySelector(".slide");

    // A positioned box containing a table; select the inner <td> (what a real
    // click on a table would select).
    const box = document.createElement("div");
    box.style.position = "absolute";
    box.style.left = "50px";
    box.style.top = "40px";
    box.style.width = "300px";
    box.style.height = "120px";
    const table = document.createElement("table");
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.textContent = "X";
    tr.appendChild(td);
    table.appendChild(tr);
    box.appendChild(table);
    slide.appendChild(box);

    engine.select(td);
    expect(engine.getSelected()).toBe(td);

    const before = slide.children.length;
    engine.duplicate();

    // The clone is a sibling of the whole box, not a stray cell inside the row.
    expect(slide.children.length).toBe(before + 1);
    const clone = engine.getSelected();
    expect(clone.tagName.toLowerCase()).toBe("div");
    expect(clone.querySelector("table")).not.toBeNull();
    // Offset by 16px from the original box position (50 -> 66).
    expect(clone.style.left).toBe("66px");
    expect(clone.style.top).toBe("56px");

    engine.destroy();
  });

  it("offsets the duplicate so it does not sit on top of the original", () => {
    const { root, a } = makeRoot();
    const engine = createSlideEditor({
      root,
      onChange: vi.fn(),
      onSelection: vi.fn(),
    });

    engine.select(a);
    a.style.left = "100px";
    a.style.top = "80px";
    engine.duplicate();

    const clone = engine.getSelected();
    expect(clone).not.toBe(a);
    // Nudged by 16px so the copy is visibly distinct, clamped to the slide.
    expect(clone.style.left).toBe("116px");
    expect(clone.style.top).toBe("96px");

    engine.destroy();
  });

  it("clears contenteditable when a text-editing box loses focus", () => {
    const { root, a } = makeRoot();
    const engine = createSlideEditor({
      root,
      onChange: vi.fn(),
      onSelection: vi.fn(),
    });

    engine.select(a);
    engine.beginTextEdit();
    expect(a.getAttribute("contenteditable")).toBe("true");

    // Focus leaves the box (e.g. clicking elsewhere) — it must stop being
    // editable instead of lingering as contenteditable="true".
    root.dispatchEvent(new Event("blur"));
    expect(a.getAttribute("contenteditable")).toBe("false");

    engine.destroy();
  });

  it("does not drag an inline element that has no explicit position", () => {
    const { root } = makeRoot();
    const span = document.createElement("span");
    span.textContent = "hi";
    root.querySelector(".slide").appendChild(span);

    const engine = createSlideEditor({
      root,
      onChange: vi.fn(),
      onSelection: vi.fn(),
    });

    engine.select(span);
    // An inline <span> has no left/top, so it must not become draggable/absolute.
    expect(span.style.position).not.toBe("absolute");

    engine.destroy();
  });

  it("edits the top-level box when double-clicking nested HTML", () => {
    const { root } = makeRoot();
    const slide = root.querySelector(".slide");
    // A text box with nested wrappers down to the actual text node.
    const box = document.createElement("div");
    box.style.left = "10px";
    box.style.top = "10px";
    const inner = document.createElement("div");
    const leaf = document.createElement("span");
    leaf.textContent = "nested";
    inner.appendChild(leaf);
    box.appendChild(inner);
    slide.appendChild(box);

    const engine = createSlideEditor({
      root,
      onChange: vi.fn(),
      onSelection: vi.fn(),
    });

    // Double-clicking the innermost leaf should edit the whole box, not the tiny
    // inner <span> — otherwise the caret never becomes active for typing.
    leaf.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));

    expect(engine.getSelected()).toBe(box);
    expect(box.getAttribute("contenteditable")).toBe("true");
    expect(leaf.getAttribute("contenteditable")).toBeNull();

    engine.destroy();
  });

  it("never saves the transient contenteditable attribute", () => {
    const { root, a } = makeRoot();
    let saved = null;
    // jsdom has no execCommand; stub it so applyTextCommand can run + emit.
    document.execCommand = vi.fn();
    const engine = createSlideEditor({
      root,
      onChange: (html) => {
        saved = html;
      },
      onSelection: vi.fn(),
    });

    engine.select(a);
    engine.beginTextEdit();
    // Any edit emits a snapshot; the live box is contenteditable, but the
    // persisted HTML must not carry that attribute (otherwise it reloads
    // editable with a selection/focus border).
    engine.applyTextCommand("bold");

    expect(a.getAttribute("contenteditable")).toBe("true");
    expect(saved).not.toContain("contenteditable");

    engine.destroy();
  });
});

describe("slideEditor.setTextColor", () => {
  it("colors the whole box when no text is selected", () => {
    document.execCommand = vi.fn();
    const { root, a } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.select(a);
    engine.beginTextEdit();
    engine.setTextColor("#e11d48");

    // No in-box selection → the colour is applied to the entire box.
    expect(a.style.color).not.toBe("");

    engine.destroy();
  });

  it("colors only the selected text when a range is active", () => {
    document.execCommand = vi.fn();
    const { root, a } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    // Drive the document selection directly: jsdom's Selection.addRange does not
    // register the range, so we return a non-collapsed in-box range instead.
    const selStub = {
      isCollapsed: false,
      anchorNode: a,
      rangeCount: 1,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
      getRangeAt: () => ({ commonAncestorContainer: a, cloneRange: () => ({ commonAncestorContainer: a }) }),
    };
    const realGetSelection = window.getSelection;
    window.getSelection = () => selStub;

    engine.select(a);
    engine.beginTextEdit();
    engine.saveSelection();
    engine.setTextColor("#22c55e");

    // With an active selection the whole-box style.color must stay empty — the
    // colour is directed at the selection via execCommand('foreColor').
    expect(a.style.color).toBe("");
    expect(document.execCommand).toHaveBeenCalledWith("foreColor", false, "#22c55e");

    window.getSelection = realGetSelection;
    engine.destroy();
  });
});

describe("slideEditor.insertTable", () => {
  it("inserts an absolutely-positioned box with the requested grid", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertTable(3, 2);

    const slide = root.querySelector(".slide");
    const boxes = slide.querySelectorAll(':scope > div');
    const table = slide.querySelector("table");
    expect(table).not.toBeNull();
    expect(table.querySelectorAll("tr")).toHaveLength(3);
    expect(table.querySelectorAll("tr:first-child td")).toHaveLength(2);
    // The table is wrapped in a positioned box that becomes the selection.
    expect(boxes.length).toBeGreaterThan(0);
    expect(engine.getSelected()).not.toBeNull();
    expect(engine.getSelected().style.position).toBe("absolute");

    engine.destroy();
  });

  it("clamps out-of-range dimensions to sane bounds", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertTable(0, 99);

    const table = root.querySelector("table");
    expect(table.querySelectorAll("tr")).toHaveLength(1);
    expect(table.querySelectorAll("td")).toHaveLength(20);

    engine.destroy();
  });
});

describe("slideEditor.insertImageBox", () => {
  it("inserts a positioned box filled with the asset as a cover background", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertImageBox({ id: 7, url: "media/logo.svg" });

    const box = engine.getSelected();
    expect(box).not.toBeNull();
    expect(box.style.position).toBe("absolute");
    expect(box.style.backgroundImage).toContain("media/logo.svg");
    expect(box.style.backgroundSize).toBe("contain");
    expect(box.style.backgroundRepeat).toBe("no-repeat");

    engine.destroy();
  });

  it("ignores a missing asset without inserting anything", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertImageBox(null);

    expect(root.querySelector("table, [style*='background-image']")).toBeNull();
    expect(engine.getSelected()).toBeNull();

    engine.destroy();
  });
});

describe("slideEditor icon sizing", () => {
  it("makes the icon fill its box so it scales up and down on resize", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertIcon("arrow-down");
    const box = engine.getSelected();
    const svg = box.querySelector("svg");

    // The glyph fills the wrapper (CSS 100%) so resizing the box scales it.
    expect(svg.style.width).toBe("100%");
    expect(svg.style.height).toBe("100%");

    // Growing the icon resizes the box and keeps the glyph in sync.
    engine.setIconSize(200);
    expect(box.style.width).toBe("200px");
    expect(box.style.height).toBe("200px");
    expect(svg.getAttribute("width")).toBe("200");

    // Shrinking it again also updates the box.
    engine.setIconSize(48);
    expect(box.style.width).toBe("48px");
    expect(box.style.height).toBe("48px");
    expect(svg.getAttribute("width")).toBe("48");

    engine.destroy();
  });

  it("preserves the multi-selection when right-clicking an already-selected box", () => {
    const { root, a, b } = makePositionedRoot();
    document.body.appendChild(root);
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.select(a);
    engine.select(b, { additive: true });
    expect(engine.getSelectionSet()).toHaveLength(2);

    // Right-click on `b` (already selected) must keep both boxes selected.
    const ctx = new MouseEvent("contextmenu", { bubbles: true });
    Object.defineProperty(ctx, "target", { value: b });
    root.dispatchEvent(ctx);

    expect(engine.getSelectionSet()).toHaveLength(2);
    expect(engine.getSelectionSet()).toContain(a);
    expect(engine.getSelectionSet()).toContain(b);

    engine.destroy();
  });
});

function makePositionedRoot() {
  const root = document.createElement("div");
  const slide = document.createElement("div");
  slide.className = "slide";
  slide.style.position = "relative";
  const mk = (id, x, y) => {
    const el = document.createElement("div");
    el.setAttribute("data-id", id);
    el.style.position = "absolute";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = "100px";
    el.style.height = "60px";
    slide.appendChild(el);
    return el;
  };
  const a = mk("a", 100, 100);
  const b = mk("b", 300, 100);
  const c = mk("c", 500, 200);
  root.appendChild(slide);
  return { root, slide, a, b, c };
}

describe("slideEditor multi-select + group/ungroup", () => {
  it("ctrl/cmd+click toggles boxes into a multi-selection", () => {
    const { root, a, b } = makePositionedRoot();
    document.body.appendChild(root);
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.select(a);
    engine.select(b, { additive: true });

    const set = engine.getSelectionSet();
    expect(set).toContain(a);
    expect(set).toContain(b);
    expect(set).toHaveLength(2);

    // Toggling off removes the box.
    engine.select(b, { additive: true });
    expect(engine.getSelectionSet()).toHaveLength(1);
    expect(engine.getSelectionSet()).toContain(a);

    engine.destroy();
  });

  it("group wraps all selected boxes into one wrapper preserving absolute positions", () => {
    const { root, slide, a, b } = makePositionedRoot();
    document.body.appendChild(root);
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.select(a);
    engine.select(b, { additive: true });
    engine.group();

    const wrap = engine.getSelected();
    expect(wrap.getAttribute("data-slide-group")).toBe("1");
    expect(wrap.parentElement).toBe(slide);
    // Both boxes now live inside the wrapper.
    expect(wrap.contains(a)).toBe(true);
    expect(wrap.contains(b)).toBe(true);
    // Positions are preserved relative to the wrapper origin (offset by 100).
    expect(parseFloat(a.style.left)).toBe(0);
    expect(parseFloat(b.style.left)).toBe(200); // 300 - 100
    // wrapper bounds all children
    expect(parseFloat(wrap.style.left)).toBe(100);
    expect(parseFloat(wrap.style.top)).toBe(100);
    expect(parseFloat(wrap.style.width)).toBe(300); // 100..400

    engine.destroy();
  });

  it("ungroup releases children back to the slide with slide-space coordinates", () => {
    const { root, slide, a, b } = makePositionedRoot();
    document.body.appendChild(root);
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.select(a);
    engine.select(b, { additive: true });
    engine.group();
    const wrap = engine.getSelected();
    engine.ungroup();

    expect(slide.querySelector("[data-slide-group]")).toBeNull();
    // Children restored to absolute slide coordinates.
    expect(parseFloat(a.style.left)).toBe(100);
    expect(parseFloat(a.style.top)).toBe(100);
    expect(parseFloat(b.style.left)).toBe(300);
    expect(parseFloat(b.style.top)).toBe(100);
    expect(slide.contains(a)).toBe(true);
    expect(slide.contains(b)).toBe(true);
    expect(wrap.isConnected).toBe(false);

    engine.destroy();
  });

  it("descends into a selected group when ctrl+clicking a child", () => {
    const { root, a, b } = makePositionedRoot();
    document.body.appendChild(root);
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    // Put a labelled child inside `a` so we can descend to it.
    const child = document.createElement("div");
    child.setAttribute("data-child", "1");
    child.style.position = "absolute";
    child.style.left = "10px";
    child.style.top = "10px";
    a.appendChild(child);

    engine.select(a);
    engine.select(b, { additive: true });
    engine.group();
    const wrap = engine.getSelected();

    // Simulate a ctrl+click on the child inside the group.
    const click = new MouseEvent("click", { bubbles: true, ctrlKey: true });
    Object.defineProperty(click, "target", { value: child });
    root.dispatchEvent(click);

    // Selection is now the child (descended), not the whole group.
    expect(engine.getSelected()).toBe(child);
    expect(engine.getSelectionSet()).toContain(wrap);

    engine.destroy();
  });
});

describe("slideEditor item naming", () => {
  it("assigns a placeholder name to a freshly inserted text box", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertText();
    const box = engine.getSelected();
    expect(box.getAttribute("data-slide-name")).toBe("texto");
    // Flagged as a placeholder so it can upgrade once the user types.
    expect(box.hasAttribute("data-slide-name-default")).toBe(true);

    engine.destroy();
  });

  it("upgrades a placeholder text name to a summary once content is added", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertText();
    const box = engine.getSelected();
    box.textContent = "My Great Heading";
    // The upgrade runs on the same `input` event the browser fires as the user
    // types into the contenteditable box.
    box.dispatchEvent(new Event("input", { bubbles: true, composed: true }));

    expect(box.getAttribute("data-slide-name")).toBe("my-great-heading");
    expect(box.hasAttribute("data-slide-name-default")).toBe(false);

    engine.destroy();
  });

  it("names an icon from its catalog name", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertIcon("arrow-down");
    const box = engine.getSelected();
    expect(box.getAttribute("data-slide-name")).toBe("icon-arrow-down");

    engine.destroy();
  });

  it("names an image from its original filename (slugified)", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertImageBox({ id: 7, url: "media/logo.svg", originalName: "Company Logo.png" });
    const box = engine.getSelected();
    expect(box.getAttribute("data-slide-name")).toBe("company-logo");

    engine.destroy();
  });

  it("falls back to a path-derived name when no original filename is given", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertImageBox({ id: 7, url: "media/logo.svg", path: "media/logo.svg" });
    const box = engine.getSelected();
    expect(box.getAttribute("data-slide-name")).toBe("logo");

    engine.destroy();
  });

  it("names a table and a group from their type", () => {
    const { root } = makeRoot();
    const slide = root.querySelector(".slide");
    document.body.appendChild(root);
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertTable(2, 2);
    expect(engine.getSelected().getAttribute("data-slide-name")).toBe("tabela");

    const a = document.createElement("div");
    a.style.position = "absolute";
    a.style.left = "100px";
    a.style.top = "100px";
    const b = document.createElement("div");
    b.style.position = "absolute";
    b.style.left = "300px";
    b.style.top = "100px";
    slide.append(a, b);
    engine.select(a);
    engine.select(b, { additive: true });
    engine.group();
    expect(engine.getSelected().getAttribute("data-slide-name")).toBe("grupo");

    engine.destroy();
    root.remove();
  });

  it("makes duplicated names unique", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertText();
    const first = engine.getSelected();
    expect(first.getAttribute("data-slide-name")).toBe("texto");

    engine.duplicate();
    const clone = engine.getSelected();
    expect(clone.getAttribute("data-slide-name")).toBe("texto-2");
    // The clone is a distinct element from the original.
    expect(clone).not.toBe(first);
    // Both names co-exist on the slide without colliding.
    const names = [...root.querySelectorAll("[data-slide-name]")].map((n) => n.getAttribute("data-slide-name"));
    expect(names).toContain("texto");
    expect(names).toContain("texto-2");

    engine.destroy();
  });

  it("keeps an existing real name and never overwrites it", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertText();
    const box = engine.getSelected();
    box.setAttribute("data-slide-name", "hero-title");
    box.removeAttribute("data-slide-name-default");
    engine.insertText(); // a second text box must not disturb the first

    expect(box.getAttribute("data-slide-name")).toBe("hero-title");

    engine.destroy();
  });

  it("surfaces the name in getLayerTree", () => {
    const { root } = makeRoot();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });

    engine.insertIcon("star");
    const tree = engine.getLayerTree();
    const iconNode = tree.find((n) => n.tag === "div" && n.name === "icon-star");
    expect(iconNode).toBeTruthy();
    // Legacy content-derived `text` field is gone; names drive the panel.
    expect(iconNode.text).toBeUndefined();

    engine.destroy();
  });

  it("persists the name through the serialized snapshot", () => {
    const { root } = makeRoot();
    const onChange = vi.fn();
    const engine = createSlideEditor({ root, onChange, onSelection: vi.fn() });

    engine.insertImageBox({ id: 1, url: "media/a.svg", originalName: "Banner.png" });
    // The engine emits the full-slide serialized HTML (incl. names) via onChange.
    const html = onChange.mock.calls.at(-1)[0];
    expect(html).toContain('data-slide-name="banner"');

    engine.destroy();
  });
});
