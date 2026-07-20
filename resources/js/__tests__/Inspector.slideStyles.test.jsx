import {beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {EditorProvider} from "../editor/EditorContext";
import Inspector from "../editor/Inspector";
import * as api from "../lib/api";
import {setRoutes} from "../lib/routes";

vi.mock("@inertiajs/react", () => ({
  router: { visit: vi.fn(), replace: vi.fn(), get: vi.fn(), post: vi.fn() },
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
  renamePresentation: vi.fn(),
  saveSlideBeacon: vi.fn(),
}));

const STYLED_HTML =
  '<div class="slide" data-slide-root="1" style="position:relative;width:100%;height:100%;overflow:hidden;font-size:42px;background:#ff0000">hello</div>';

function renderEditor() {
  api.fetchSlides.mockResolvedValue([
    { file: "s1.html", title: "Slide 1", number: "1", revision: "r1", source_mode: "deck" },
  ]);
  api.fetchSlideHtml.mockResolvedValue(STYLED_HTML);
  api.saveSlide.mockResolvedValue({ revision: "r2" });
  setRoutes({
    editor: "/presentations/__PRESENTATION__",
    presentationToken: "__PRESENTATION__",
    slideToken: "__FILE__",
  });

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
      <Inspector />
    </EditorProvider>
  );
}

describe("Inspector slide-mode styles on load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("populates the typography inputs from the slide html after load", async () => {
    renderEditor();

    // The slide is loaded with no box selected → slide mode. The size input
    // must reflect the persisted `font-size:42px` from the html, not stay blank.
    await waitFor(() => expect(screen.getByDisplayValue("42")).toBeTruthy());
  });
});
