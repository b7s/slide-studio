// E2E: mount FillerSection wired to a REAL slideEditor engine, drive modes
// and colours, verify the selected box's DOM `style` after each step.
import { describe, it, expect, beforeEach } from "vitest";
import React, { useEffect, useState } from "react";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { createSlideEditor } from "../editor/slideEditor";
import { FillerSection } from "../editor/Inspector";

function freshShadow() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML =
    `<div class="slide" data-slide-root="1" style="position:relative;width:100%;height:100%">` +
    `<div id="box" style="position:absolute;left:10px;top:10px;width:120px;height:80px;padding:24px;cursor:move;z-index:1;outline:none">hello</div>` +
    `</div>`;
  return shadow;
}

function freshEditor(shadow) {
  let setter = () => {};
  const engine = createSlideEditor({
    root: shadow,
    onChange: () => {},
    onSelection: (info) => setter(info),
    editable: true,
  });
  engine.select(shadow.getElementById("box"));
  return {
    engine,
    cmd: {
      getSelected: () => engine.getSelected(),
      setStyle: (...a) => engine.setStyle(...a),
      setStyles: (...a) => engine.setStyles(...a),
    },
    setBridge: (fn) => { setter = fn; },
  };
}

function App({ setup }) {
  const [sel, setSel] = useState(null);
  useEffect(() => setup.setBridge(setSel), [setup]);
  const st = sel?.styles ?? {};
  return <FillerSection st={st} cmd={setup.cmd} presentationId={1} />;
}

describe("FillerSection E2E (real engine)", () => {
  let shadow, setup;

  beforeEach(() => {
    shadow = freshShadow();
    setup = freshEditor(shadow);
  });

  it("applies a SOLID colour and the DOM shows it", () => {
    render(<App setup={setup} />);
    const box = shadow.getElementById("box");

    // Switch the type selector to SOLID
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "solid" } });
    expect(box.style.backgroundColor).not.toBe("");

    // Pick a new colour
    const colorInput = document.querySelector("input[type=color]");
    expect(colorInput).toBeTruthy();
    fireEvent.change(colorInput, { target: { value: "#00ff00" } });
    expect(box.style.backgroundColor).toBe("rgb(0, 255, 0)");
  });

  it("applies a GRADIENT colour change", () => {
    render(<App setup={setup} />);
    const box = shadow.getElementById("box");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "gradient" } });
    expect((box.style.background || "").toLowerCase()).toContain("gradient");

    const colorInputs = document.querySelectorAll("input[type=color]");
    expect(colorInputs.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(colorInputs[0], { target: { value: "#ff0000" } });
    const applied = (box.style.background || "").toLowerCase();
    expect(applied).toContain("gradient");
    expect(applied).toContain("rgb(255, 0, 0)");
  });

  it("switches solid over an existing gradient and the gradient is removed", () => {
    // Pre-load a gradient on the box, then mount.
    setup.engine.setStyles({
      background: "",
      backgroundColor: "",
      backgroundImage: "",
      backgroundRepeat: "",
      backgroundSize: "",
      backgroundPosition: "",
      backgroundAttachment: "",
      backgroundOrigin: "",
      backgroundClip: "",
      background: "linear-gradient(135deg, #888, #111)",
    });
    render(<App setup={setup} />);
    const box = shadow.getElementById("box");
    expect((box.style.background || "").toLowerCase()).toContain("gradient");

    // Switch to solid
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "solid" } });
    expect(box.style.backgroundColor).not.toBe("");
    // Gradient must be gone from BOTH background and backgroundImage
    expect((box.style.background || "").toLowerCase()).not.toContain("gradient");
    expect((box.style.backgroundImage || "").toLowerCase()).not.toContain("gradient");
  });

  it("shows correct colour when box starts with a round-tripped gradient in backgroundImage", () => {
    // Simulate the round-trip: gradient lands in backgroundImage (no shorthand).
    // We trigger the styles update AFTER render so the bridge has had a chance
    // to install; the inspector then resolves the dropdown from the bridge-fed
    // `st` and must report "gradient". Wrap in act() so the bridge's setSel
    // queues its re-render before we assert.
    render(<App setup={setup} />);
    act(() => {
      setup.engine.setStyles({
        background: "",
        backgroundColor: "",
        backgroundImage: "linear-gradient(135deg, rgb(120, 50, 200), rgb(20, 200, 80))",
        backgroundRepeat: "",
        backgroundSize: "",
        backgroundPosition: "",
        backgroundAttachment: "",
        backgroundOrigin: "",
        backgroundClip: "",
      });
    });
    // The type dropdown must report GRADIENT, not "image".
    expect(screen.getByLabelText(/filler_type/i).value).toBe("gradient");
  });
});
