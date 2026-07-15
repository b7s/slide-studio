// Integration test: the full FillerSection → cmd.setStyles → engine.setStyles
// → DOM + selectionInfo + onChange round-trip. Verifies that the selected
// element ends up showing the chosen colour after applying a SOLID background,
// even when starting from a gradient or from no background at all — and that
// the backing `st` re-emitted to React afterwards still reflects it.
import {describe, expect, it, vi} from "vitest";
import {createSlideEditor} from "../editor/slideEditor";

function makeHost(html = "") {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML =
    `<div class="slide" data-slide-root="1" style="position:relative;width:100%;height:100%">${
      html || '<div id="box" style="position:absolute;left:10px;top:10px;width:120px;height:80px;padding:24px;cursor:move;z-index:1;outline:none">x</div>'
    }</div>`;
  return { host, shadow };
}

describe("background color application through engine", () => {
  it("applies a SOLID background colour to a fresh box and reports it back", () => {
    const { shadow } = makeHost();
    const onSelection = vi.fn();
    const engine = createSlideEditor({
      root: shadow,
      onChange: () => {},
      onSelection,
      editable: true,
    });
    const box = shadow.getElementById("box");
    engine.select(box);

    // Exactly what FillerSection.applyBackground({ backgroundColor: ... }) sends
    // (the spread of cleared longhands + the new color).
    engine.setStyles({
      background: "",
      backgroundImage: "",
      backgroundRepeat: "",
      backgroundSize: "",
      backgroundPosition: "",
      backgroundAttachment: "",
      backgroundOrigin: "",
      backgroundClip: "",
      backgroundColor: "rgb(255, 0, 0)",
    });

    expect(box.style.backgroundColor).toBe("rgb(255, 0, 0)");

    const last = onSelection.mock.calls.at(-1)[0];
    expect(last.styles.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("applies a SOLID background colour on TOP of an existing gradient", () => {
    const { shadow } = makeHost(
      `<div id="box" style="position:absolute;left:10px;top:10px;width:120px;height:80px;padding:24px;cursor:move;z-index:1;outline:none;background:linear-gradient(135deg,rgb(255,255,255),rgb(0,0,0))">x</div>`
    );
    const onSelection = vi.fn();
    const engine = createSlideEditor({
      root: shadow,
      onChange: () => {},
      onSelection,
      editable: true,
    });
    const box = shadow.getElementById("box");
    engine.select(box);

    // Switch mode from gradient → solid red. applyBackground strips the
    // gradient first then applies backgroundColor.
    engine.setStyles({
      background: "",
      backgroundImage: "",
      backgroundRepeat: "",
      backgroundSize: "",
      backgroundPosition: "",
      backgroundAttachment: "",
      backgroundOrigin: "",
      backgroundClip: "",
      backgroundColor: "rgb(0, 128, 255)",
    });

    expect(box.style.backgroundColor).toBe("rgb(0, 128, 255)");
    // Gradient must be fully removed too.
    expect(box.style.background || "").not.toContain("gradient");
    expect(box.style.backgroundImage || "").not.toContain("gradient");

    const last = onSelection.mock.calls.at(-1)[0];
    // The re-emitted `st` must say this is a SOLID: no gradient anywhere and
    // backgroundColor present.
    expect(last.styles.background || "").not.toContain("gradient");
    expect(last.styles.backgroundImage || "").not.toContain("gradient");
    expect(last.styles.backgroundColor).toBe("rgb(0, 128, 255)");
  });

  it("applies a new GRADIENT colour and reports the new gradient back", () => {
    const { shadow } = makeHost();
    const onSelection = vi.fn();
    const engine = createSlideEditor({
      root: shadow,
      onChange: () => {},
      onSelection,
      editable: true,
    });
    const box = shadow.getElementById("box");
    engine.select(box);

    engine.setStyles({
      backgroundColor: "",
      backgroundImage: "",
      backgroundRepeat: "",
      backgroundSize: "",
      backgroundPosition: "",
      backgroundAttachment: "",
      backgroundOrigin: "",
      backgroundClip: "",
      background: "linear-gradient(135deg, rgb(255, 200, 0), rgb(0, 0, 200))",
    });

    expect((box.style.background || "").toLowerCase()).toContain("gradient");

    const last = onSelection.mock.calls.at(-1)[0];
    // Selection reports the gradient in either background or backgroundImage.
    const bg = last.styles.background || last.styles.backgroundImage || "";
    expect(bg.toLowerCase()).toContain("gradient");
  });
});
