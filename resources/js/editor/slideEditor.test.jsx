import { describe, it, expect, vi } from "vitest";
import { createSlideEditor } from "./slideEditor";

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
