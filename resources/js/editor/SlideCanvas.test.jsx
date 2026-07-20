import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render} from "@testing-library/react";
import SlideCanvas from "./SlideCanvas";

afterEach(() => cleanup());

function shadowOf(container) {
  const host = container.querySelector('[class]') || container.firstElementChild;
  return host?.shadowRoot ?? null;
}

describe("SlideCanvas slide root handling", () => {
  it("wraps legacy inner-content html in a .slide root", () => {
    const { container } = render(<SlideCanvas html='<div>hello</div>' />);
    const shadow = shadowOf(container);
    expect(shadow).not.toBeNull();
    const slide = shadow.querySelector(".slide");
    expect(slide).not.toBeNull();
    expect(slide.innerHTML).toContain("hello");
  });

  it("injects a saved .slide element verbatim so its own styles survive", () => {
    const { container } = render(
      <SlideCanvas html='<div class="slide" data-slide-root="1" style="background:#000;font-size:40px">hi</div>' />
    );
    const shadow = shadowOf(container);
    const slide = shadow.querySelector(".slide");
    expect(slide).not.toBeNull();
    // No double-wrap: exactly one .slide, carrying the persisted style.
    expect(shadow.querySelectorAll(".slide").length).toBe(1);
    expect(slide.getAttribute("style")).toContain("background:#000");
    expect(slide.getAttribute("style")).toContain("40px");
  });
});
