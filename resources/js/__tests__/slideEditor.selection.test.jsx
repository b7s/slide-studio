import { describe, it, expect, vi } from "vitest";
import { createSlideEditor } from "../editor/slideEditor";

// Mount a real `.slide` root so slideRoot() resolves to the wrapper and the
// box is a child (mirrors SlideCanvas). snapshot() then serialises the box.
function mount() {
  const root = document.createElement("div");
  root.innerHTML =
    '<div class="slide">' +
    '<div class="box" style="position:absolute;left:100px;top:50px;width:200px;height:80px">hi</div>' +
    "</div>";
  document.body.appendChild(root);
  return root;
}

function box(root) {
  return root.querySelector(".box");
}

function pointer(type, target, opts = {}) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...opts }));
}

describe("slideEditor selection vs. edits", () => {
  it("does not emit or pollute styles when an element is merely clicked", () => {
    const root = mount();
    const onChange = vi.fn();
    const engine = createSlideEditor({ root, onChange, onSelection: vi.fn() });
    const el = box(root);

    // Select it (a click, no drag).
    el.click();

    // A press + release with no movement — this is what a plain click does at
    // the pointer level once the element is already selected.
    pointer("pointerdown", el, { clientX: 120, clientY: 60 });
    pointer("pointerup", window, { clientX: 120, clientY: 60 });

    expect(onChange).not.toHaveBeenCalled();
    // Transient interaction styles must not be baked into the content.
    expect(el.style.userSelect).toBe("");
    expect(el.getAttribute("style")).not.toContain("user-select");

    engine.destroy();
    root.remove();
  });

  it("restores hover chrome so outline-offset never leaks into content", () => {
    const root = mount();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });
    const el = box(root);

    // Hover the element (applies the dotted indicator + outline-offset)…
    pointer("pointermove", el, { clientX: 120, clientY: 60 });
    // …then move onto the slide stage, which clears the hover indicator.
    pointer("pointermove", root.querySelector(".slide"), { clientX: 5, clientY: 5 });

    expect(el.style.outlineOffset).toBe("");
    expect(el.getAttribute("style") || "").not.toContain("outline-offset");

    engine.destroy();
    root.remove();
  });

  it("still emits a change when the element is actually dragged", () => {
    const root = mount();
    const onChange = vi.fn();
    const engine = createSlideEditor({ root, onChange, onSelection: vi.fn() });
    const el = box(root);

    el.click();
    pointer("pointerdown", el, { clientX: 120, clientY: 60 });
    pointer("pointermove", window, { clientX: 160, clientY: 90 });
    pointer("pointerup", window, { clientX: 160, clientY: 90 });

    expect(onChange).toHaveBeenCalled();
    // Moved by (+40, +30) from its 100/50 origin.
    expect(el.style.left).toBe("140px");
    expect(el.style.top).toBe("80px");

    engine.destroy();
    root.remove();
  });
});
