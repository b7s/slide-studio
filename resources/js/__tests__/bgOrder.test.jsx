// Probe whether jsdom mirrors Chrome's bg-shorthand normalisation. If jsdom
// keeps the gradient in `style.background` then we'll need Playwright to
// reproduce; if not, this test catches the real-Chrome bug locally.
import { describe, it, expect } from "vitest";

describe("background shorthand round-trip", () => {
  it("set style.background to a gradient then removeProperty('background-image')", () => {
    const box = document.createElement("div");
    box.style.background = "linear-gradient(135deg, rgb(255, 255, 255), rgb(0, 0, 0))";
    console.log("After set bg:");
    console.log("  style.background:", box.style.background);
    console.log("  style.backgroundImage:", box.style.backgroundImage);
    console.log("  style.cssText:", box.style.cssText);
    box.style.removeProperty("background-image");
    console.log("After remove bg-image:");
    console.log("  style.background:", box.style.background);
    console.log("  style.backgroundImage:", box.style.backgroundImage);
    console.log("  style.cssText:", box.style.cssText);
    console.log("  outerHTML:", box.outerHTML);
    const value = box.style.background || box.style.backgroundImage;
    expect(value.toLowerCase()).toContain("gradient");
  });

  it("end-to-end setStyles flushes a gradient and saves it", () => {
    const box = document.createElement("div");
    box.style.background = "linear-gradient(135deg, rgb(255, 255, 255), rgb(0, 0, 0))";
    // Then call removeProperty('background-image') — does it strip the gradient?
    box.style.removeProperty("background-image");
    const tmp = document.createElement("div");
    tmp.appendChild(box);
    console.log("serialized:", box.outerHTML);
    expect(box.outerHTML.toLowerCase()).toContain("gradient");
  });
});
