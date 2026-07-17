import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "../Components/ui/tooltip";
import { setTranslations } from "../lib/i18n";

// Seed just the keys this test cares about — `__()` returns the key when
// the translation map is empty, which would break the suffix-prefill test.
setTranslations({
  "messages.slide.copy_suffix": "(cópia)",
  "messages.sidebar.duplicate_placeholder": "Duplicar slide atual como…",
});

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({
    props: { app: { name: "Slide Studio", short: "SS" }, auth: { user: null } },
  }),
  router: { visit: vi.fn() },
}));

const deleteSlide = vi.fn();
const undo = vi.fn(async () => false);
const redo = vi.fn(async () => false);
const duplicate = vi.fn();

vi.mock("./EditorContext", () => ({
  useEditor: () => ({
    root: "deck",
    selectFile: vi.fn(),
    duplicate,
    reorder: vi.fn(),
    copyTemplate: vi.fn(),
    createSlide: vi.fn(),
    deleteSlide,
    renameSlide: vi.fn(),
    undo,
    redo,
    permissions: { canEdit: true, canShare: true, canDelete: true },
  }),
}));

import LeftPanel from "./LeftPanel";

const slides = [
  // Filenames deliberately use `01-capa.html`-style shapes to make sure the
  // bug from the previous approach doesn't reappear: the duplicate dialog
  // and bottom-row input must use the SLIDE TITLE (not the filename).
  { file: "01-capa.html", title: "Capa", number: "1", revision: null, source_mode: "deck", html: "<section/>" },
  { file: "02-agenda.html", title: "Agenda", number: "2", revision: null, source_mode: "deck", html: "<section/>" },
];

describe("LeftPanel slide removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a confirmation dialog and deletes the slide when confirmed", async () => {
    render(
      <TooltipProvider>
        <LeftPanel slides={slides} selectedFile="01-capa.html" onSelect={vi.fn()} count={2} />
      </TooltipProvider>,
    );

    const removeButtons = screen.getAllByLabelText("messages.sidebar.remove_tip");
    expect(removeButtons.length).toBeGreaterThan(0);

    await userEvent.click(removeButtons[0]);

    expect(screen.getByText("messages.sidebar.remove_confirm_title")).toBeInTheDocument();

    await userEvent.click(screen.getByText("messages.sidebar.remove_confirm"));

    expect(deleteSlide).toHaveBeenCalledWith("01-capa.html");
  });

  it("does not delete the slide when the dialog is cancelled", async () => {
    render(
      <TooltipProvider>
        <LeftPanel slides={slides} selectedFile="01-capa.html" onSelect={vi.fn()} count={2} />
      </TooltipProvider>,
    );

    const removeButtons = screen.getAllByLabelText("messages.sidebar.remove_tip");
    await userEvent.click(removeButtons[0]);
    await userEvent.click(screen.getByText("messages.sidebar.remove_cancel"));

    expect(deleteSlide).not.toHaveBeenCalled();
  });
});

describe("LeftPanel duplicate flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pre-fills the bottom-row duplicate input with the slide title (not the filename)", () => {
    render(
      <TooltipProvider>
        <LeftPanel slides={slides} selectedFile="01-capa.html" onSelect={vi.fn()} count={2} />
      </TooltipProvider>,
    );

    const input = screen.getByPlaceholderText("Duplicar slide atual como…");
    // Prefilled with the title + copy suffix — NOT the filename stripped of .html.
    expect(input.value).toBe("Capa (cópia)");
    expect(input.value).not.toContain("01-capa");
    expect(input.value).not.toContain(".html");
  });

  it("passes the typed title to duplicate when the bottom-row Input is submitted", async () => {
    render(
      <TooltipProvider>
        <LeftPanel slides={slides} selectedFile="01-capa.html" onSelect={vi.fn()} count={2} />
      </TooltipProvider>,
    );

    const input = screen.getByPlaceholderText("Duplicar slide atual como…");
    fireEvent.change(input, { target: { value: "Capa (custom)" } });
    await userEvent.click(screen.getByLabelText("messages.sidebar.duplicate"));

    expect(duplicate).toHaveBeenCalledTimes(1);
    expect(duplicate).toHaveBeenCalledWith("01-capa.html", "Capa (custom)");
  });

  it("does not duplicate when the bottom-row Input is empty", async () => {
    render(
      <TooltipProvider>
        <LeftPanel slides={slides} selectedFile="01-capa.html" onSelect={vi.fn()} count={2} />
      </TooltipProvider>,
    );

    const input = screen.getByPlaceholderText("Duplicar slide atual como…");
    fireEvent.change(input, { target: { value: "   " } });
    await userEvent.click(screen.getByLabelText("messages.sidebar.duplicate"));

    expect(duplicate).not.toHaveBeenCalled();
  });
});
