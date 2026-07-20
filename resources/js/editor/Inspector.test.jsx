import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {cleanHtml, NumberField} from "./Inspector";

beforeEach(() => {
  // jsdom lacks layout, but NumberField only needs a controlled input.
});

afterEach(() => cleanup());

describe("NumberField", () => {
  it("keeps the typed value on blur instead of reverting to the prop", () => {
    const onChange = vi.fn();
    // `value` stays "12" (the engine already holds it) to mimic the real flow
    // where the prop reflects the saved style, not the keystrokes.
    render(<NumberField label="X" value={12} onChange={onChange} />);
    const input = screen.getByDisplayValue("12");
    fireEvent.change(input, { target: { value: "48" } });
    expect(onChange).toHaveBeenCalledWith("48");
    fireEvent.blur(input);
    expect(input).toHaveValue("48");
  });

  it("does not clobber mid-typing when the prop updates to the typed value", () => {
    const onChange = vi.fn();
    const { rerender } = render(<NumberField label="X" value={12} onChange={onChange} />);
    const input = screen.getByDisplayValue("12");
    fireEvent.change(input, { target: { value: "120" } });
    // Parent re-renders with the new value (engine persisted it).
    rerender(<NumberField label="X" value={120} onChange={onChange} />);
    expect(input).toHaveValue("120");
    fireEvent.blur(input);
    expect(input).toHaveValue("120");
  });

  it("rejects non-numeric characters", () => {
    const onChange = vi.fn();
    render(<NumberField label="X" value="" onChange={onChange} />);
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "ab" } });
    // Invalid input updates the local buffer but is never emitted.
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("ab");
  });

  it("syncs from the prop when an external value arrives (e.g. a nudge)", () => {
    const onChange = vi.fn();
    const { rerender } = render(<NumberField label="X" value={10} onChange={onChange} />);
    rerender(<NumberField label="X" value={250} onChange={onChange} />);
    expect(screen.getByDisplayValue("250")).toBeTruthy();
  });
});

describe("cleanHtml", () => {
  it("strips layout/box styles but keeps text-formatting styles", () => {
    const html =
      '<p style="color:#ff0000;font-family:Georgia;position:absolute;width:100px;background:#000">Hello</p>';
    const out = cleanHtml(html);
    expect(out).toMatch(/color\s*:\s*#?ff0000|color\s*:\s*rgb\(255,\s*0,\s*0\)/i);
    expect(out).toContain("font-family:Georgia");
    expect(out).not.toContain("position");
    expect(out).not.toContain("width");
    expect(out).not.toContain("background");
  });

  it("does not drop a child's own colour/font so it round-trips intact", () => {
    const html = '<p style="color:#ff0000;font-size:24px">Hello <b>world</b></p>';
    const out = cleanHtml(html);
    expect(out).toMatch(/color\s*:/i);
    expect(out).toContain("font-size:24px");
    expect(out).toContain("<b>world</b>");
  });

  it("drops disallowed tags but keeps their text content", () => {
    const html = '<div><img src="x.png" /><span>keep</span></div>';
    const out = cleanHtml(html);
    expect(out).not.toContain("<img");
    expect(out).toContain("keep");
  });

  it("preserves list bullet style while stripping other styles", () => {
    const html = '<ul style="list-style-type:circle;color:#fff"><li>a</li></ul>';
    const out = cleanHtml(html);
    expect(out).toContain("list-style-type");
    expect(out).toMatch(/circle/i);
    expect(out).not.toContain("color:#fff");
    expect(out).not.toContain("rgb(255, 255, 255)");
  });
});
