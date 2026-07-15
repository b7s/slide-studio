// Same goal: trace where the gradient disappears. jsdom cannot clone shadow
// roots, so we clone the slide root as a regular element.
import {describe, expect, it} from "vitest";

const INVALID_ATTR = /[:;"'=<>\s)]|:\/\/|\.(test|com|net|org|webp|png|jpe?g|gif|svg)/i;
function sanitizeClone(root) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  clone.querySelectorAll("*").forEach((el) => {
    for (const name of [...el.getAttributeNames()]) {
      if (INVALID_ATTR.test(name)) el.removeAttribute(name);
    }
  });
  return clone.innerHTML;
}

function elem(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

describe("gradient serialization through snapshot", () => {
  it("fresh box: setting style.background persists through clone serialize", () => {
    const root = elem(
      `<div class="slide" data-slide-root="1" style="position:relative">` +
      `<div id="box" style="position:absolute;left:10px;top:10px;width:120px;padding:24px">x</div>` +
      `</div>`
    );
    const box = root.querySelector("#box");
    box.style.background = "linear-gradient(135deg, rgb(255, 255, 255), rgb(0, 0, 0))";
    console.log("DIRECT READ box.style.background:", box.style.background);
    console.log("OUTER:", box.outerHTML);
    const saved = sanitizeClone(root);
    console.log("SAVED:", saved);
    expect(saved).toContain("linear-gradient");
  });

  it("reload into a fresh root: gradient survives re-parse", () => {
    const root = elem(
      `<div class="slide" data-slide-root="1" style="position:relative">` +
      `<div id="box" style="position:absolute;left:10px;top:10px;width:120px;padding:24px">x</div>` +
      `</div>`
    );
    const box = root.querySelector("#box");
    box.style.background = "linear-gradient(135deg, rgb(255, 200, 0), rgb(0, 0, 200))";
    const saved = sanitizeClone(root);
    expect(saved).toContain("linear-gradient");

    const fresh = elem(`<div class="slide" data-slide-root="1"><div id="box" style="">x</div></div>`);
    fresh.innerHTML = saved;
    const reloaded = fresh.querySelector("#box");
    console.log("RELOADED outerHTML:", reloaded.outerHTML);
    console.log("reloaded.style.background:", reloaded.style.background);
    console.log("reloaded.style.backgroundImage:", reloaded.style.backgroundImage);
    const finalBg = reloaded.style.background || reloaded.style.backgroundImage || "";
    expect(finalBg.toLowerCase()).toContain("linear-gradient");
  });
});
