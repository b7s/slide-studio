import { describe, it, expect } from "vitest";
import { setRoutes, route } from "../lib/routes";

describe("client route resolver", () => {
  it("returns the raw key when the route is unknown", () => {
    setRoutes({});
    expect(route("unknown.name")).toBe("unknown.name");
  });

  it("resolves a known route without params", () => {
    setRoutes({ slidesIndex: "/api/v1/slides" });
    expect(route("slidesIndex")).toBe("/api/v1/slides");
  });

  it("swaps the slide token and encodes the filename", () => {
    setRoutes({
      slideSave: "/api/v1/slides/__FILE__",
      slideToken: "__FILE__",
    });

    const url = route("slideSave", { slide: "intro/Slide 1.html" });

    expect(url).toBe("/api/v1/slides/intro%2FSlide%201.html");
  });

  it("swaps presentation, generation and user tokens", () => {
    setRoutes({
      sharesUpdate: "/api/v1/presentations/__PRES__/shares/__USER__",
      slideToken: "__FILE__",
      presentationToken: "__PRES__",
      userToken: "__USER__",
      generationToken: "__GEN__",
    });

    const url = route("sharesUpdate", {
      presentation: "my-deck",
      user: 42,
    });

    expect(url).toBe("/api/v1/presentations/my-deck/shares/42");
  });

  it("appends a query string to a bare route", () => {
    setRoutes({ slidesHtml: "/api/v1/slides/html" });

    const url = route("slidesHtml", { query: { file: "s1.html", root: "deck" } });

    expect(url).toBe("/api/v1/slides/html?file=s1.html&root=deck");
  });

  it("appends a query string after a token swap", () => {
    setRoutes({
      slidesHtml: "/api/v1/slides/html?file=__FILE__",
      slideToken: "__FILE__",
    });

    const url = route("slidesHtml", {
      slide: "s1.html",
      query: { root: "templates" },
    });

    expect(url).toBe("/api/v1/slides/html?file=s1.html&root=templates");
  });

  it("omits an empty query string", () => {
    setRoutes({ slidesIndex: "/api/v1/slides" });

    const url = route("slidesIndex", { query: {} });

    expect(url).toBe("/api/v1/slides");
  });
});
