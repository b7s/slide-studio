import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorProvider, useEditor } from "../editor/EditorContext";
import { toast } from "sonner";

// Sonner is a DOM/browser concern irrelevant to logic tests.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

// Replacement for the versioned API client. Every function is a spy we can
// drive per-test; the mock module is hoisted above the imports.
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
}));

import * as api from "../lib/api";

const SAMPLE_HTML = "<section><h1>Hello</h1></section>";

// Harness exposes the live editor context so the test can drive save/load
// flows without any DOM canvas.
function Harness() {
  const e = useEditor();
  return (
    <div>
      <span data-testid="dirty">{String(e.dirty)}</span>
      <span data-testid="status">{e.statusKey}</span>
      <span data-testid="selected">{String(e.selectedFile)}</span>
      <button data-testid="change" onClick={() => e.onHtmlChange("<div>edited</div>")}>
        change
      </button>
      <button data-testid="save" onClick={() => e.save()}>
        save
      </button>
      <button data-testid="copy" onClick={() => e.copyTemplate("tmpl.html")}>
        copy
      </button>
    </div>
  );
}

function renderEditor(overrides = {}) {
  api.fetchSlides.mockResolvedValue([
    { file: "s1.html", title: "Slide 1", number: "1", revision: "r1", source_mode: "deck" },
  ]);
  api.fetchSlideHtml.mockResolvedValue(SAMPLE_HTML);
  api.saveSlide.mockResolvedValue({ revision: "r2" });

  return render(
    <EditorProvider
      config={{ deckRoot: "/deck", templateRoot: "/tpl" }}
      initialSlides={[
        { file: "s1.html", title: "Slide 1", number: "1", revision: "r1", source_mode: "deck" },
      ]}
      initialFile="s1.html"
      presentationId={1}
      presentationSlug="deck"
      permissions={{ role: "owner", canEdit: true, canShare: true, canDelete: true }}
      {...overrides}
    >
      <Harness />
    </EditorProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditorProvider", () => {
  it("loads the initial slide and marks it not-dirty", async () => {
    renderEditor();

    await waitFor(() => expect(api.fetchSlideHtml).toHaveBeenCalledWith("s1.html"));

    expect(screen.getByTestId("selected").textContent).toBe("s1.html");
    expect(screen.getByTestId("dirty").textContent).toBe("false");
    expect(screen.getByTestId("status").textContent).toBe("messages.editor.ready");
  });

  it("becomes dirty after html changes and clears on save", async () => {
    renderEditor();
    await waitFor(() => expect(api.fetchSlideHtml).toHaveBeenCalled());

    await userEvent.click(screen.getByTestId("change"));
    expect(screen.getByTestId("dirty").textContent).toBe("true");

    await userEvent.click(screen.getByTestId("save"));
    await waitFor(() => expect(api.saveSlide).toHaveBeenCalledTimes(1));

    expect(api.saveSlide).toHaveBeenCalledWith("s1.html", {
      html: "<div>edited</div>",
      revision: "r1",
      overwrite: false,
    });
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("messages.editor.saved")
    );
    // snapshot updated → not dirty anymore
    expect(screen.getByTestId("dirty").textContent).toBe("false");
  });

  it("does not save when the viewer is read-only", async () => {
    renderEditor({
      permissions: { role: "viewer", canEdit: false, canShare: false, canDelete: false },
    });
    await waitFor(() => expect(api.fetchSlideHtml).toHaveBeenCalled());

    await userEvent.click(screen.getByTestId("change"));
    await act(async () => {
      await userEvent.click(screen.getByTestId("save"));
    });

    expect(api.saveSlide).not.toHaveBeenCalled();
  });

  it("surfaces a conflict status on a 409 response", async () => {
    renderEditor();
    await waitFor(() => expect(api.fetchSlideHtml).toHaveBeenCalled());

    api.saveSlide.mockRejectedValue(
      Object.assign(new Error("conflict"), { code: 409 })
    );

    await userEvent.click(screen.getByTestId("change"));
    await act(async () => {
      await userEvent.click(screen.getByTestId("save"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("messages.errors.conflict")
    );
  });

  it("copies a template into the deck and selects the new slide", async () => {
    renderEditor();
    await waitFor(() => expect(api.fetchSlideHtml).toHaveBeenCalled());

    api.copyTemplateToDeck.mockResolvedValue({ file: "new-slide.html", title: "Hero" });

    await userEvent.click(screen.getByTestId("copy"));

    expect(api.copyTemplateToDeck).toHaveBeenCalledWith("tmpl.html", {
      presentationId: 1,
      title: null,
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("messages.templates.copied")
    );
    expect(api.fetchSlides).toHaveBeenCalledWith("deck");
    expect(api.fetchSlideHtml).toHaveBeenCalledWith("new-slide.html");
  });
});
