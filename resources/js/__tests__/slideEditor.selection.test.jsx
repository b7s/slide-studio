import {describe, expect, it, vi} from "vitest";
import {createSlideEditor} from "../editor/slideEditor";

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

  it("draws the hover indicator in an overlay so it never leaks into content", () => {
    const root = mount();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection: vi.fn() });
    const el = box(root);

    // Hover the element — the dotted indicator is drawn in a dedicated overlay
    // layer, never as an inline style on the slide element itself.
    pointer("pointermove", el, { clientX: 120, clientY: 60 });

    const layer = root.querySelector("[data-slide-hover]");
    expect(layer).not.toBeNull();
    expect(layer.querySelector("[data-slide-hover-leaf]").style.display).toBe("block");
    expect(el.getAttribute("style") || "").not.toContain("outline");

    // Moving onto the slide stage clears the hover indicator…
    pointer("pointermove", root.querySelector(".slide"), { clientX: 5, clientY: 5 });
    expect(layer.querySelector("[data-slide-hover-leaf]").style.display).toBe("none");
    // …and the element is still untouched.
    expect(el.getAttribute("style") || "").not.toContain("outline");

    engine.destroy();
    root.remove();
  });

  it("exposes background styles so the Filler section can detect image/gradient modes", () => {
    const root = mount();
    const onSelection = vi.fn();
    const engine = createSlideEditor({ root, onChange: vi.fn(), onSelection });
    const el = box(root);

    el.style.backgroundImage = 'url("/storage/media/x.png")';
    el.style.backgroundSize = "cover";
    el.click();

    const info = onSelection.mock.calls[0][0];
    expect(info.styles.backgroundImage).toBe('url("/storage/media/x.png")');
    expect(info.styles.backgroundSize).toBe("cover");

    engine.destroy();
    root.remove();
  });

  it("strips bogus attributes left by a corrupted style attribute when snapshotting", () => {
    const root = mount();
    const onChange = vi.fn();
    const engine = createSlideEditor({ root, onChange, onSelection: vi.fn() });
    const el = box(root);
    // A box whose style attribute broke during an earlier serialisation: the
    // stray URL/style fragments leak out as bogus attributes on the element.
    el.setAttribute("slide-studio.testmedia", "");
    el.setAttribute("asset.webp", "");
    el.setAttribute("background-repeat:", "");
    el.click();

    // A drag triggers a snapshot (pushHistory -> onChange(html)).
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 120, clientY: 60 }));
    el.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 125, clientY: 65 }));
    el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 125, clientY: 65 }));

    const html = onChange.mock.calls.at(-1)?.[0];
    expect(html).not.toContain("slide-studio.testmedia");
    expect(html).not.toContain("asset.webp");
    expect(html).not.toContain("background-repeat:");

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
