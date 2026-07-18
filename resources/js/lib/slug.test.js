import {describe, expect, it} from "vitest";
import {slugify, summarizeText} from "./slug";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with dashes", () => {
    expect(slugify("Company Logo.png")).toBe("company-logo-png");
  });

  it("strips accents", () => {
    expect(slugify("Apresentação Top")).toBe("apresentacao-top");
  });

  it("collapses repeated dashes and trims edges", () => {
    expect(slugify("  My---Great   Heading! ")).toBe("my-great-heading");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
    expect(slugify(null)).toBe("");
  });

  it("caps length at the given maximum", () => {
    expect(slugify("a very long label that should be truncated", 10)).toBe("a-very-lon");
  });
});

describe("summarizeText", () => {
  it("keeps only the first few words as a slug", () => {
    expect(summarizeText("My Great Heading About Things", 3)).toBe("my-great-heading");
  });

  it("returns empty when there is no meaningful content", () => {
    expect(summarizeText("   ")).toBe("");
  });
});
