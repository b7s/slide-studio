import {describe, expect, it} from "vitest";
import {rewriteMediaUrlsToPreview, rewriteMediaUrlsToStorage,} from "../lib/mediaUrl";

describe("mediaUrl rewriting", () => {
  it("stores a relative media path on serialise, absolute on preview", () => {
    const html = '<div style="background-image:url(\'/storage/media/x.jpg\')"></div>';
    expect(rewriteMediaUrlsToStorage(html)).toContain("media/x.jpg");
    expect(rewriteMediaUrlsToPreview(html)).toContain("/storage/media/x.jpg");
  });

  it("rewrites a relative path to absolute for preview", () => {
    const html = '<div style="background:url(\'media/logo.png\')"></div>';
    expect(rewriteMediaUrlsToPreview(html)).toContain("url(/storage/media/logo.png)");
  });

  it("keeps unrelated urls but emits them unquoted so they cannot break HTML", () => {
    const html = '<div style="background-image:url(\'https://cdn.example.com/a.png\')"></div>';
    const stored = rewriteMediaUrlsToStorage(html);
    const preview = rewriteMediaUrlsToPreview(html);
    expect(stored).toBe('<div style="background-image:url(https://cdn.example.com/a.png)"></div>');
    expect(preview).toBe('<div style="background-image:url(https://cdn.example.com/a.png)"></div>');
  });

  it("handles HTML-escaped quotes (&quot;) from serialised style attributes", () => {
    const html =
      '<div style="background-image: url(&quot;/storage/media/x.png&quot;);"></div>';
    const stored = rewriteMediaUrlsToStorage(html);
    expect(stored).toContain("url(media/x.png)");
    expect(stored).not.toContain("&quot;");
    expect(rewriteMediaUrlsToPreview(stored)).toContain("url(/storage/media/x.png)");
  });

  it("survives an innerHTML round-trip without breaking the style attribute", () => {
    const html =
      '<div style="background-image: url(&quot;/storage/media/x.png&quot;); background-repeat: no-repeat"></div>';
    const stored = rewriteMediaUrlsToStorage(html);
    // The stored form must contain NO double quote that could close the
    // attribute, so parsing it back via innerHTML keeps a single style attr.
    const round = document.createElement("div");
    round.innerHTML = stored;
    const child = round.firstElementChild;
    expect(child.getAttribute("style")).toContain("url(media/x.png)");
    expect(child.getAttribute("style")).not.toContain("https:");
    // And previewing it yields a valid, renderable absolute URL.
    const previewed = document.createElement("div");
    previewed.innerHTML = rewriteMediaUrlsToPreview(stored);
    expect(previewed.firstElementChild.getAttribute("style")).toContain(
      "url(/storage/media/x.png)"
    );
  });
});
