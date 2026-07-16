import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorProvider, useEditor } from "../editor/EditorContext";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

vi.mock("../lib/api", () => ({
  fetchSlides: vi.fn(),
  fetchSlideHtml: vi.fn(),
  saveSlide: vi.fn(),
  saveSlideBeacon: vi.fn(),
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

const INITIAL_HTML = "<section><h1>start</h1></section>";
const SHORT_HTML = "<div>short</div>";
const LONG_HTML = "<div>much longer content that must not be lost</div>";

// Harness lets the test drive independent edits + saves so we can reproduce
// the out-of-order overwrite race that made content revert.
function Harness() {
  const e = useEditor();
  return (
    <div>
      <span data-testid="dirty">{String(e.dirty)}</span>
      <button data-testid="edit-short" onClick={() => e.onHtmlChange(SHORT_HTML)}>
        short
      </button>
      <button data-testid="edit-long" onClick={() => e.onHtmlChange(LONG_HTML)}>
        long
      </button>
      <button data-testid="save" onClick={() => e.save(true)}>
        save
      </button>
    </div>
  );
}

function renderEditor() {
  api.fetchSlides.mockResolvedValue([
    { file: "s1.html", title: "Slide 1", number: "1", revision: "r1", source_mode: "deck" },
  ]);
  api.fetchSlideHtml.mockResolvedValue(INITIAL_HTML);

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
    >
      <Harness />
    </EditorProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditorProvider save race", () => {
  it("coalesces concurrent saves and persists the latest content", async () => {
    // First save hangs so a second save is requested while it is in flight.
    let resolveFirst;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    api.saveSlide
      .mockReturnValueOnce(first)
      .mockResolvedValue({ revision: "r3" });

    renderEditor();
    await waitFor(() => expect(api.fetchSlideHtml).toHaveBeenCalled());

    // Edit A (short) and kick off a save; it is now in flight.
    await userEvent.click(screen.getByTestId("edit-short"));
    await userEvent.click(screen.getByTestId("save"));
    expect(api.saveSlide).toHaveBeenCalledTimes(1);
    expect(api.saveSlide).toHaveBeenNthCalledWith(1, "s1.html", {
      html: SHORT_HTML,
      revision: null,
      overwrite: true,
    }, 1);

    // Edit B (long) and request another save while the first is still pending.
    // No second concurrent request must start.
    await userEvent.click(screen.getByTestId("edit-long"));
    await userEvent.click(screen.getByTestId("save"));
    expect(api.saveSlide).toHaveBeenCalledTimes(1);

    // Finish the first save; the follow-up must persist the LATEST content.
    await act(async () => {
      resolveFirst({ revision: "r2" });
      await Promise.resolve();
    });

    await waitFor(() => expect(api.saveSlide).toHaveBeenCalledTimes(2));
    expect(api.saveSlide).toHaveBeenLastCalledWith("s1.html", {
      html: LONG_HTML,
      revision: null,
      overwrite: true,
    }, 1);

    // The final persisted snapshot is the newest content, so it is not dirty.
    await waitFor(() => expect(screen.getByTestId("dirty").textContent).toBe("false"));
  });

  it("never sends an older payload after a newer one completes", async () => {
    const calls = [];
    api.saveSlide.mockImplementation((_file, body) => {
      calls.push(body.html);
      return Promise.resolve({ revision: "r-next" });
    });

    renderEditor();
    await waitFor(() => expect(api.fetchSlideHtml).toHaveBeenCalled());

    await userEvent.click(screen.getByTestId("edit-long"));
    await userEvent.click(screen.getByTestId("save"));
    await userEvent.click(screen.getByTestId("edit-short"));
    await userEvent.click(screen.getByTestId("save"));

    await waitFor(() => expect(screen.getByTestId("dirty").textContent).toBe("false"));

    // Whatever order saves fired, the final one carries the last edit (short),
    // so the persisted content is never reverted to an earlier value.
    expect(calls[calls.length - 1]).toBe(SHORT_HTML);
  });
});
