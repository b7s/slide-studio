import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {FontSelector} from "./FontSelector";
import {buildFontFaceCss, FONT_CATALOG, FONT_CATEGORIES, FONT_FACE_CSS} from "./fonts.config";

afterEach(() => cleanup());

// In tests no translations are seeded, so __() returns the key itself. We
// assert against stable keys / font family names that are part of the
// generated catalog.
const INHERIT_KEY = "messages.fonts.inherit";
const SEARCH_KEY = "messages.fonts.search_placeholder";

function openPopover() {
    fireEvent.click(screen.getByLabelText("messages.inspector.font"));
}

describe("fonts.config (generated catalog)", () => {
    it("exports a non-empty catalog with the expected categories", () => {
        expect(FONT_CATALOG.length).toBeGreaterThan(20);
        const ids = FONT_CATEGORIES.map((c) => c.id);
        expect(ids).toEqual(["sans", "serif", "mono", "display", "script", "system"]);
    });

    it("every catalog entry has family + stack + weights + category", () => {
        for (const f of FONT_CATALOG) {
            expect(typeof f.family).toBe("string");
            expect(f.family.length).toBeGreaterThan(0);
            expect(typeof f.stack).toBe("string");
            expect(Array.isArray(f.weights)).toBe(true);
            expect(f.weights.length).toBeGreaterThan(0);
            expect(typeof f.category).toBe("string");
            expect(typeof f.system).toBe("boolean");
        }
    });

    it("FONT_FACE_CSS uses relative /fonts/ paths by default", () => {
        expect(FONT_FACE_CSS).toContain('url(/fonts/');
        expect(FONT_FACE_CSS).toContain("font-family: 'Inter';");
    });

    it("buildFontFaceCss(origin) rewrites every /fonts/ path to absolute", () => {
        const abs = buildFontFaceCss("https://studio.example.test");
        expect(abs).toContain('url(https://studio.example.test/fonts/');
        expect(abs).not.toMatch(/url\((?!https:\/\/studio\.example\.test\/fonts)/);
        // Empty origin returns the relative version untouched.
        expect(buildFontFaceCss("")).toBe(FONT_FACE_CSS);
    });

    it("system fonts have system: true and no @font-face entry", () => {
        const systemFonts = FONT_CATALOG.filter((f) => f.system);
        expect(systemFonts.length).toBeGreaterThan(0);
        for (const f of systemFonts) {
            expect(FONT_FACE_CSS).not.toContain(`font-family: '${f.family}';`);
        }
    });
});

describe("FontSelector", () => {
    it("renders the trigger with the inherit label when no value is set", () => {
        render(<FontSelector value="" onChange={() => {}} />);
        const trigger = screen.getByLabelText("messages.inspector.font");
        expect(trigger).toBeTruthy();
        expect(trigger.textContent).toContain(INHERIT_KEY);
    });

    it("renders the trigger with the selected family name", () => {
        render(<FontSelector value={'"Inter",system-ui,sans-serif'} onChange={() => {}} />);
        const trigger = screen.getByLabelText("messages.inspector.font");
        expect(trigger.textContent).toContain("Inter");
    });

    it("recognises a bare family name (legacy saved value)", () => {
        render(<FontSelector value="Inter" onChange={() => {}} />);
        expect(screen.getByLabelText("messages.inspector.font").textContent).toContain("Inter");
    });

    it("opens the popover and lists fonts grouped by category", async () => {
        render(<FontSelector value="" onChange={() => {}} />);
        openPopover();

        await waitFor(() => {
            expect(screen.getByPlaceholderText(SEARCH_KEY)).toBeTruthy();
        });

        // Category headers (keys, since no translations are seeded).
        expect(screen.getByText("messages.fonts.category_sans")).toBeTruthy();
        expect(screen.getByText("messages.fonts.category_serif")).toBeTruthy();
        expect(screen.getByText("messages.fonts.category_mono")).toBeTruthy();
        expect(screen.getByText("messages.fonts.category_system")).toBeTruthy();

        // A known font appears.
        expect(screen.getByText("Inter")).toBeTruthy();
    });

    it("filters fonts by the search query", async () => {
        render(<FontSelector value="" onChange={() => {}} />);
        openPopover();

        const search = await screen.findByPlaceholderText(SEARCH_KEY);
        fireEvent.change(search, {target: {value: "JetBrains"}});

        expect(screen.getByText("JetBrains Mono")).toBeTruthy();
        expect(screen.queryByText("Inter")).toBeNull();
    });

    it("shows the no-results hint when the query matches nothing", async () => {
        render(<FontSelector value="" onChange={() => {}} />);
        openPopover();

        const search = await screen.findByPlaceholderText(SEARCH_KEY);
        fireEvent.change(search, {target: {value: "zzzzzNoSuchFont"}});

        expect(screen.getByText("messages.fonts.no_results")).toBeTruthy();
    });

    it("calls onChange with the full stack when a font is picked", async () => {
        const onChange = vi.fn();
        render(<FontSelector value="" onChange={onChange} />);
        openPopover();

        const item = await screen.findByText("Poppins");
        fireEvent.click(item);

        expect(onChange).toHaveBeenCalledTimes(1);
        const stack = onChange.mock.calls[0][0];
        expect(stack.startsWith('"Poppins"')).toBe(true);
        expect(stack).toContain("sans-serif");
    });

    it("calls onChange with empty string when Inherit is clicked", async () => {
        const onChange = vi.fn();
        render(<FontSelector value={'"Inter",system-ui,sans-serif'} onChange={onChange} />);
        openPopover();

        const inherit = await screen.findByText(INHERIT_KEY);
        fireEvent.click(inherit);

        expect(onChange).toHaveBeenCalledWith("");
    });

    it("marks the selected font with a check icon (active state)", async () => {
        render(<FontSelector value={'"Poppins",system-ui,sans-serif'} onChange={() => {}} />);
        openPopover();

        // Wait for the popover list to render. The selected font name
        // appears both in the trigger and in the list option — we want
        // the option (a button rendered with its own fontFamily style).
        const options = await screen.findAllByText("Poppins");
        const styledOption = options.find(
            (el) => el.closest("button")?.getAttribute("style")?.includes("Poppins")
        );
        expect(styledOption).toBeTruthy();
        const btn = styledOption.closest("button");
        const check = btn.querySelector("svg.lucide-check, svg[class*='lucide-check']");
        expect(check).not.toBeNull();
    });

    it("renders the scrollable font list when open (so long lists don't overflow)", async () => {
        render(<FontSelector value="" onChange={() => {}} />);
        openPopover();

        await waitFor(() => {
            expect(screen.getByPlaceholderText(SEARCH_KEY)).toBeTruthy();
        });

        // The scroll container is the only DataAttribute marker we expose.
        const list = document.querySelector("[data-font-list]");
        expect(list).not.toBeNull();
        expect(list.className).toContain("overflow-y-auto");
        expect(list.className).toContain("flex-1");
        // The popover content must bound its own height so the scroll
        // container can take the remaining space — 43 fonts + inherit
        // would otherwise spill out of the inspector panel.
        const content = list.parentElement;
        expect(content.className).toContain("max-h-");
        expect(content.className).toContain("overflow-hidden");
        expect(content.className).toContain("flex");
        expect(content.className).toContain("flex-col");
    });
});
