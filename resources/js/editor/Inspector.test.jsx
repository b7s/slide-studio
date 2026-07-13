import { describe, it, expect } from "vitest";
import { cleanHtml } from "./Inspector";

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
