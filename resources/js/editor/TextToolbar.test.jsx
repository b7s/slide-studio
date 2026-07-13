import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "../Components/ui/tooltip";
import TextToolbar from "./TextToolbar";

// In tests no translations are seeded, so __() falls back to the key itself.
const K = {
  bold: "messages.inspector.bold",
  italic: "messages.inspector.italic",
  list: "messages.inspector.list",
  ordered: "messages.inspector.list_ordered",
  none: "messages.editor.text_toolbar.list_none",
  color: "messages.editor.text_toolbar.text_color",
  delete: "messages.editor.text_toolbar.delete_box",
};

function makeCmd(overrides = {}) {
  return {
    getSelected: vi.fn(() => document.createElement("div")),
    applyTextCommand: vi.fn(),
    setTextColor: vi.fn(),
    applyList: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

const selection = {
  list: null,
  styles: { color: "#ff0000" },
};

describe("TextToolbar", () => {
  it("renders bold/italic/delete and triggers the right commands", () => {
    const cmd = makeCmd();
    render(<TooltipProvider><TextToolbar style={{ left: 0, top: 0 }} selection={selection} cmd={cmd} /></TooltipProvider>);

    fireEvent.click(screen.getByLabelText(K.bold));
    expect(cmd.applyTextCommand).toHaveBeenCalledWith("bold");

    fireEvent.click(screen.getByLabelText(K.italic));
    expect(cmd.applyTextCommand).toHaveBeenCalledWith("italic");

    fireEvent.click(screen.getByLabelText(K.delete));
    expect(cmd.remove).toHaveBeenCalled();
  });

  it("opens the list menu and applies the chosen kind", () => {
    const cmd = makeCmd();
    render(<TooltipProvider><TextToolbar style={{ left: 0, top: 0 }} selection={selection} cmd={cmd} /></TooltipProvider>);

    fireEvent.click(screen.getByLabelText(K.list));
    fireEvent.click(screen.getByText(K.ordered));
    expect(cmd.applyList).toHaveBeenCalledWith("ordered");
  });

  it("shows the 'no list' option in the menu", () => {
    const cmd = makeCmd();
    render(<TooltipProvider><TextToolbar style={{ left: 0, top: 0 }} selection={selection} cmd={cmd} /></TooltipProvider>);
    fireEvent.click(screen.getByLabelText(K.list));
    expect(screen.getByText(K.none)).toBeTruthy();
  });

  it("applies a quick color swatch", () => {
    const cmd = makeCmd();
    render(<TooltipProvider><TextToolbar style={{ left: 0, top: 0 }} selection={selection} cmd={cmd} /></TooltipProvider>);

    fireEvent.click(screen.getByLabelText(K.color));
    const swatch = screen.getByLabelText("#22c55e");
    fireEvent.click(swatch);
    expect(cmd.setTextColor).toHaveBeenCalledWith("#22c55e");
  });
});
