import {describe, expect, it} from "vitest";
import {createSlideEditor} from "../editor/slideEditor";

function makeHost(html) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML =
    `<div class="slide" data-slide-root="1" style="position:relative;width:100%;height:100%">${html}</div>`;
  return { host, shadow };
}

describe("engine gradient apply on legacy-corrupted box", () => {
  it("applies the gradient shorthand and drops legacy background longhands", () => {
    const { shadow } = makeHost(
      `<div id="box" style="position:absolute;left:10px;top:10px;width:100px;min-height:12px;padding:24px;cursor:move;z-index:1;outline:none;background-attachment:initial;background-origin:initial;background-clip:initial">Novo fundo</div>`
    );
    let saved = "";
    const engine = createSlideEditor({
      root: shadow,
      onChange: (h) => { saved = h; },
      onSelection: () => {},
      editable: true,
    });
    const box = shadow.getElementById("box");
    engine.select(box);
    // Exactly what FillerSection.applyBackground({ background: value }) sends.
    engine.setStyles({
      backgroundColor: "",
      backgroundImage: "",
      backgroundRepeat: "",
      backgroundSize: "",
      backgroundPosition: "",
      backgroundAttachment: "",
      backgroundOrigin: "",
      backgroundClip: "",
      background: "linear-gradient(135deg, #ff0000, #000000)",
    });
    expect(box.style.background).toContain("linear-gradient");
    expect(saved).toContain("linear-gradient");
    expect(saved).not.toContain("background-attachment");
  });

  it("engine.setStyles self-clears longhands when a background shorthand is set", () => {
    const { shadow } = makeHost(
      `<div id="box" style="position:absolute;left:10px;top:10px;background-attachment:initial;background-origin:initial;background-clip:initial">x</div>`
    );
    const engine = createSlideEditor({
      root: shadow,
      onChange: () => {},
      onSelection: () => {},
      editable: true,
    });
    const box = shadow.getElementById("box");
    engine.select(box);
    engine.setStyles({ background: "radial-gradient(circle, #fff, #000)" });
    expect(box.style.background).toContain("radial-gradient");
  });
});
