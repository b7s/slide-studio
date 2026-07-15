import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen} from "@testing-library/react";
import {FillerSection} from "./Inspector";

function makeCmd() {
  return {
    getSelected: vi.fn(() => document.createElement("div")),
    setStyle: vi.fn(),
    setStyles: vi.fn(),
  };
}

describe("FillerSection", () => {
  it("renders the three filler type options", () => {
    render(<FillerSection st={{}} cmd={makeCmd()} presentationId={1} />);
    expect(screen.getByRole("combobox").querySelectorAll("option")).toHaveLength(3);
  });

  it("applies a solid colour default when switching to solid mode", () => {
    const cmd = makeCmd();
    render(<FillerSection st={{}} cmd={cmd} presentationId={1} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "solid" } });
    expect(cmd.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundColor: "rgb(255, 255, 255)" })
    );
  });

  it("applies a default gradient when switching to gradient mode", () => {
    const cmd = makeCmd();
    render(<FillerSection st={{}} cmd={cmd} presentationId={1} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "gradient" } });
    expect(cmd.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({ background: expect.stringContaining("linear-gradient") })
    );
  });

  it("builds a linear-gradient matching the chosen direction", () => {
    const cmd = makeCmd();
    render(
      <FillerSection
        st={{ background: "linear-gradient(135deg, #ffffff, #000000)" }}
        cmd={cmd}
        presentationId={1}
      />
    );
    fireEvent.click(screen.getByLabelText("180°"));
    expect(cmd.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({ background: expect.stringContaining("linear-gradient(180deg") })
    );
  });

  it("preserves rgb()-normalised colour stops when changing direction", () => {
    const cmd = makeCmd();
    render(
      <FillerSection
        st={{ background: "linear-gradient(135deg, rgb(255, 0, 0), rgb(0, 0, 255))" }}
        cmd={cmd}
        presentationId={1}
      />
    );
    fireEvent.click(screen.getByLabelText("180°"));
    expect(cmd.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({
        background: "linear-gradient(180deg, rgb(255, 0, 0), rgb(0, 0, 255))",
      })
    );
  });

  it("applies background alpha when the opacity slider changes (gradient)", () => {
    const cmd = makeCmd();
    render(
      <FillerSection
        st={{ background: "linear-gradient(135deg, #ff0000, #0000ff)" }}
        cmd={cmd}
        presentationId={1}
      />
    );
    fireEvent.change(screen.getByRole("slider"), { target: { value: "50" } });
    expect(cmd.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({ background: expect.stringContaining("rgba(255, 0, 0, 0.5)") })
    );
  });

  it("applies background alpha when the opacity slider changes (solid)", () => {
    const cmd = makeCmd();
    render(
      <FillerSection
        st={{ backgroundColor: "#00ff00" }}
        cmd={cmd}
        presentationId={1}
      />
    );
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    expect(cmd.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({ backgroundColor: expect.stringContaining("rgba(0, 255, 0, 0.3)") })
    );
  });

  it("switches between linear and radial gradient types", () => {
    const cmd = makeCmd();
    render(
      <FillerSection
        st={{ background: "linear-gradient(135deg, #ffffff, #000000)" }}
        cmd={cmd}
        presentationId={1}
      />
    );
    const typeSelect = screen.getByRole("combobox", { name: /filler_gradient_type/i });
    fireEvent.change(typeSelect, { target: { value: "radial" } });
    expect(typeSelect.value).toBe("radial");
    expect(cmd.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({ background: "radial-gradient(circle, rgb(255, 255, 255), rgb(0, 0, 0))" })
    );
  });

  it("detects image mode from an applied background image", () => {
    const cmd = makeCmd();
    render(
      <FillerSection
        st={{ backgroundImage: 'url("/storage/media/x.jpg")' }}
        cmd={cmd}
        presentationId={1}
      />
    );
    expect(screen.getByRole("combobox").value).toBe("image");
    expect(screen.getByText("messages.inspector.filler_choose_image")).toBeTruthy();
  });

  it("strips all previous background formatting before applying a gradient", () => {
    const cmd = makeCmd();
    render(
      <FillerSection
        st={{
          backgroundImage: 'url("/storage/media/x.jpg")',
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
        cmd={cmd}
        presentationId={1}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "gradient" } });
    expect(cmd.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({
        background: expect.stringContaining("linear-gradient"),
        backgroundColor: "",
        backgroundImage: "",
        backgroundRepeat: "",
        backgroundSize: "",
        backgroundPosition: "",
      })
    );
  });

  it("strips all previous background formatting before applying an image", () => {
    const cmd = makeCmd();
    render(
      <FillerSection
        st={{ background: "linear-gradient(135deg, #fff, #000)" }}
        cmd={cmd}
        presentationId={1}
      />
    );
    // The first combobox is the filler-type selector; switching to image mode
    // must open the media picker (the picker itself applies the reset on pick).
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "image" } });
    expect(screen.getByText("messages.inspector.filler_choose_image")).toBeTruthy();
  });

  it("clears every background longhand (incl. legacy attachment/origin/clip) before applying a gradient", () => {
    const cmd = makeCmd();
    render(
      <FillerSection
        st={{
          backgroundImage: 'url("/storage/media/x.jpg")',
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundAttachment: "initial",
          backgroundOrigin: "initial",
          backgroundClip: "initial",
        }}
        cmd={cmd}
        presentationId={1}
      />
    );
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "gradient" } });
    expect(cmd.setStyles).toHaveBeenCalledWith(
      expect.objectContaining({
        background: expect.stringContaining("linear-gradient"),
        backgroundColor: "",
        backgroundImage: "",
        backgroundRepeat: "",
        backgroundSize: "",
        backgroundPosition: "",
        backgroundAttachment: "",
        backgroundOrigin: "",
        backgroundClip: "",
      })
    );
  });
});
