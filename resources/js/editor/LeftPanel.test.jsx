import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "../Components/ui/tooltip";

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({
    props: { app: { name: "Slide Studio", short: "SS" }, auth: { user: null } },
  }),
  router: { visit: vi.fn() },
}));

const deleteSlide = vi.fn();
const undo = vi.fn(async () => false);
const redo = vi.fn(async () => false);

vi.mock("./EditorContext", () => ({
  useEditor: () => ({
    root: "deck",
    selectFile: vi.fn(),
    duplicate: vi.fn(),
    reorder: vi.fn(),
    copyTemplate: vi.fn(),
    createSlide: vi.fn(),
    deleteSlide,
    undo,
    redo,
  }),
}));

import LeftPanel from "./LeftPanel";

const slides = [
  { file: "01-a.html", title: "A", number: "1", revision: null, source_mode: "deck", html: "<section/>" },
  { file: "02-b.html", title: "B", number: "2", revision: null, source_mode: "deck", html: "<section/>" },
];

describe("LeftPanel slide removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a confirmation dialog and deletes the slide when confirmed", async () => {
    render(
      <TooltipProvider>
        <LeftPanel slides={slides} selectedFile="01-a.html" onSelect={vi.fn()} count={2} />
      </TooltipProvider>,
    );

    const removeButtons = screen.getAllByLabelText("messages.sidebar.remove_tip");
    expect(removeButtons.length).toBeGreaterThan(0);

    await userEvent.click(removeButtons[0]);

    expect(screen.getByText("messages.sidebar.remove_confirm_title")).toBeInTheDocument();

    await userEvent.click(screen.getByText("messages.sidebar.remove_confirm"));

    expect(deleteSlide).toHaveBeenCalledWith("01-a.html");
  });

  it("does not delete the slide when the dialog is cancelled", async () => {
    render(
      <TooltipProvider>
        <LeftPanel slides={slides} selectedFile="01-a.html" onSelect={vi.fn()} count={2} />
      </TooltipProvider>,
    );

    const removeButtons = screen.getAllByLabelText("messages.sidebar.remove_tip");
    await userEvent.click(removeButtons[0]);
    await userEvent.click(screen.getByText("messages.sidebar.remove_cancel"));

    expect(deleteSlide).not.toHaveBeenCalled();
  });
});
