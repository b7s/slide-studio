import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Large viewports so both panels can render inline.
vi.mock("../editor/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

vi.mock("../lib/api", () => ({
  fetchSlides: vi.fn(),
  fetchSlideHtml: vi.fn(),
  saveSlide: vi.fn(),
  duplicateSlide: vi.fn(),
  copyTemplateToDeck: vi.fn(),
  reorderSlides: vi.fn(),
  generateSlides: vi.fn(),
  generationStatus: vi.fn(),
  fetchShares: vi.fn(),
  updateShare: vi.fn(),
  removeShare: vi.fn(),
  searchUsers: vi.fn(),
  fetchLibraryGroups: vi.fn(),
  fetchPresentations: vi.fn(),
  createPresentation: vi.fn(),
}));

// Avoid loading the real slide engine (DOM-heavy) in jsdom.
vi.mock("../editor/slideEditor", () => ({
  createSlideEditor: () => ({
    setEditing: vi.fn(),
    destroy: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    copy: vi.fn(),
    cut: vi.fn(),
    paste: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
    nudge: vi.fn(),
    group: vi.fn(),
    ungroup: vi.fn(),
    bringForward: vi.fn(),
    sendBackward: vi.fn(),
    clearSelection: vi.fn(),
  }),
}));

const baseEditor = {
  root: "deck",
  setRoot: vi.fn(),
  slides: [],
  selectedFile: null,
  selectFile: vi.fn(),
  dirty: false,
  statusKey: "messages.workspace.reload",
  statusTone: "idle",
  selectedLabel: "",
  save: vi.fn(),
  reload: vi.fn(),
  preview: vi.fn(),
  deckRoot: "/deck",
  templateRoot: "/templates",
  permissions: { canEdit: true, canShare: true },
  presentationSlug: "x",
  generate: vi.fn(),
  html: "<section><h1>Hi</h1></section>",
  slideKey: "k",
  editMode: false,
  toggleEditMode: vi.fn(),
  onHtmlChange: vi.fn(),
  registerEngine: vi.fn(),
  onEngineSelection: vi.fn(),
  cmd: {},
  duplicate: vi.fn(),
  reorder: vi.fn(),
  copyTemplate: vi.fn(),
  selection: { styles: {} },
};

vi.mock("../editor/EditorContext", () => ({
  useEditor: () => baseEditor,
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({
    props: { app: { name: "Slide Studio", short: "SS" }, auth: { user: null } },
  }),
  router: { visit: vi.fn() },
}));

import AppShell from "../editor/AppShell";
import { TooltipProvider } from "../Components/ui/tooltip";

// The Topbar reads the Inertia `app` global (brand name/short) provided by
// the real layout. Seed it for the test runtime.
globalThis.app = { name: "Slide Studio", short: "SS" };

describe("Editor panel toggles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the canvas visible and can re-pin the slides panel after collapsing", async () => {
    render(
      <TooltipProvider>
        <AppShell />
      </TooltipProvider>,
    );

    // Canvas (Workspace) is rendered initially.
    expect(screen.getAllByText("messages.workspace.save").length).toBeGreaterThan(0);

    const hideBtn = screen.getByLabelText("messages.topbar.hide_slides");
    await userEvent.click(hideBtn);

    // After collapsing, the canvas must still be present (not squeezed to 0px).
    expect(screen.getAllByText("messages.workspace.save").length).toBeGreaterThan(0);

    // The control is now an "open" button that re-pins the panel inline.
    const openBtn = screen.getByLabelText("messages.topbar.open_slides");
    expect(openBtn).toBeInTheDocument();

    await userEvent.click(openBtn);

    // Panel is pinned back inline and the canvas is still visible.
    expect(screen.getByLabelText("messages.topbar.hide_slides")).toBeInTheDocument();
    expect(screen.getAllByText("messages.workspace.save").length).toBeGreaterThan(0);
  });

  it("keeps the canvas visible and can re-pin the inspector after collapsing", async () => {
    render(
      <TooltipProvider>
        <AppShell />
      </TooltipProvider>,
    );

    expect(screen.getAllByText("messages.workspace.save").length).toBeGreaterThan(0);

    const hideBtn = screen.getByLabelText("messages.topbar.hide_props");
    await userEvent.click(hideBtn);

    expect(screen.getAllByText("messages.workspace.save").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("messages.topbar.open_props")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("messages.topbar.open_props"));

    expect(screen.getByLabelText("messages.topbar.hide_props")).toBeInTheDocument();
    expect(screen.getAllByText("messages.workspace.save").length).toBeGreaterThan(0);
  });
});
