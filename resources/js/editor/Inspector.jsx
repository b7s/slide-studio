import { useEffect, useRef, useState } from "react";
import { toHex, withAlpha, splitColorAlpha } from "../lib/color";
import { applyListToElement } from "./listFormat";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../Components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "../Components/ui/popover";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../Components/ui/accordion";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
} from "lucide-react";
import { useEditor } from "./EditorContext";
import { __ } from "../lib/i18n";
import { cn } from "../Components/lib/utils";
import { MediaPickerDialog } from "./MediaPickerDialog";
import { touchAsset } from "../lib/api";

const FONTS = ["Inter", "Georgia", "Roboto", "Arial", "Times New Roman", "Courier New"];

function AlignOption({ icon: Icon, active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-8 items-center justify-center rounded-md hover:bg-[var(--navy)]/5",
        active ? "bg-[var(--navy)]/10 text-[var(--navy)] ring-1 ring-[var(--navy)]/30" : "text-[var(--foreground)]"
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

// Tags we keep when round-tripping HTML between the slide and the rich-text
// editor. Everything else is unwrapped so the slide never inherits stray
// markup (icons, layout wrappers, data attributes) from the inspector.
const RICH_ALLOWED = new Set([
  "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "BR", "DIV", "P", "SPAN",
]);

// Inline text-formatting properties that survive the round-trip through the
// rich-text editor. Layout/box properties (position, sizing, background,
// border, shadow, flex…) are stripped so the panel stays a pure text surface.
// Keeping colour/font properties means a child that already carries a direct
// style never loses it, and a child without one keeps inheriting its parent's
// colour/font — exactly as the user expects when applying a new transformation
// to a sub-selection: only the changed runs change, the rest inherits.
const RICH_STYLE_PROPS = new Set([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "text-decoration",
  "text-decoration-line",
  "text-align",
  "line-height",
  "letter-spacing",
  "text-transform",
  "vertical-align",
  "white-space",
]);

// Strip presentation-only attributes (style/class/positioning data) and drop
// disallowed tags, unwrapping their children. This keeps semantic formatting
// (bold, italic, lists, line breaks) without leaking slide-specific layout
// styles, while preserving each element's own colour/font so round-tripping
// never drops inherited or directly-applied text formatting.
export function cleanHtml(html) {
  const host = document.createElement("div");
  host.innerHTML = html || "";
  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType !== 1) return;
      if (!RICH_ALLOWED.has(child.tagName)) {
        const parent = child.parentNode;
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        parent.removeChild(child);
        return;
      }
      if (child.tagName === "UL" || child.tagName === "OL") {
        // Preserve the list bullet style (disc/circle/square) so list
        // formatting round-trips; strip every other presentational attribute.
        const lst = child.style.listStyleType;
        child.removeAttribute("style");
        if (lst && lst !== "disc") child.style.listStyleType = lst;
      } else {
        // Keep only text-formatting inline styles, drop layout/box styles.
        const keep = [];
        for (let i = 0; i < child.style.length; i += 1) {
          const prop = child.style.item(i);
          if (RICH_STYLE_PROPS.has(prop.toLowerCase())) {
            keep.push(`${prop}:${child.style.getPropertyValue(prop)}`);
          }
        }
        child.removeAttribute("style");
        if (keep.length) child.setAttribute("style", keep.join(";"));
      }
      child.removeAttribute("class");
      child.removeAttribute("data-slide-icon");
      walk(child);
    });
  };
  walk(host);
  return host.innerHTML;
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : "";
}

// CSS `linear-gradient` angle semantics: 0deg points up, 90deg right, etc.
// The grid below is laid out top-left → bottom-right with the matching angle.
const GRADIENT_DIRS = [
  { key: "tl", angle: 315, Icon: ArrowUpLeft },
  { key: "t", angle: 0, Icon: ArrowUp },
  { key: "tr", angle: 45, Icon: ArrowUpRight },
  { key: "l", angle: 270, Icon: ArrowLeft },
  { key: "r", angle: 90, Icon: ArrowRight },
  { key: "bl", angle: 225, Icon: ArrowDownLeft },
  { key: "b", angle: 180, Icon: ArrowDown },
  { key: "br", angle: 135, Icon: ArrowDownRight },
];

// Drop the optional quotes around a `url("…")` value. Returns "" unless the
// value is an actual `url(...)` — a serialised gradient (which the browser may
// move into `background-image` after a round-trip) must NOT be treated as an
// image here, or the filler type would flip to "image" on its own.
function urlOf(value) {
  const v = (value || "").trim();
  if (!/^url\(/i.test(v)) return "";
  return v.replace(/^url\(['"]?/i, "").replace(/['"]?\)$/, "").trim();
}

function isGradient(value) {
  return /gradient\(/i.test(value || "");
}

// The element's gradient may live in either `background` or `background-image`
// (the latter after a serialisation round-trip expands the shorthand), so we
// check both. A real image only counts when it's an actual `url(...)`.
function detectFillerMode(st) {
  const image = urlOf(st.backgroundImage);
  if (image && image !== "none") return "image";
  if (isGradient(st.background) || isGradient(st.backgroundImage)) return "gradient";
  return "solid";
}

// Read the gradient from whichever property currently holds it.
function gradientSource(st) {
  return st.background || st.backgroundImage || "";
}

function parseGradient(bg) {
  const m = (bg || "").match(/(linear|radial)-gradient\(([\s\S]+)\)$/);
  if (!m) {
    return { type: "linear", angle: 135, c1: "#ffffff", c2: "#000000", alpha: 1 };
  }
  const inner = m[2];
  const type = m[1];
  // Match hex colours and rgb()/rgba() functions so the picker reflects the
  // gradient's actual stops (the browser normalises `linear-gradient(...)` to
  // `rgb(...)` values) and its alpha.
  const colors = inner.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/gi) || [];
  const am = inner.match(/(\d+)\s*deg/);
  const angle = am ? parseInt(am[1], 10) : 135;
  const a1 = splitColorAlpha(colors[0]);
  const a2 = splitColorAlpha(colors[1]);
  return {
    type,
    angle: type === "radial" ? 0 : angle,
    c1: a1.rgb,
    c2: a2.rgb,
    alpha: a1.alpha,
  };
}

// Split a solid background colour into its opaque form and alpha.
function parseSolid(bgColor) {
  const { rgb, alpha } = splitColorAlpha(bgColor || "#ffffff");
  return { color: rgb, alpha };
}

export function FillerSection({ st, cmd, presentationId }) {
  const [mediaOpen, setMediaOpen] = useState(false);
  // `mode` is a controlled local state so the filler-type dropdown switches
  // immediately on change. It re-syncs to the actual box style whenever the
  // selected box's background signature changes (e.g. a new selection, or the
  // autosave round-trip refreshing `st`), so it always reflects reality.
  const [mode, setMode] = useState(() => detectFillerMode(st));
  const [grad, setGrad] = useState(() => parseGradient(gradientSource(st)));
  // Re-sync the controlled `mode`/`grad` whenever the resolved background
  // signature changes — covers a brand-new selection AND a round-trip
  // (e.g. the autosave refreshes `st` with a fresh gradient living in
  // `background-image` after a serialisation cycle, while the selected DOM
  // node stays the same). A plain DOM-identity check misses the second case
  // and the dropdown blanked to the mount-time default.
  // We compare the resolved signature, NOT a one-line `st.background` ref,
  // because jsdom (and the browser after a round-trip) move the gradient
  // between `background` and `background-image` indistinguishably.
  const sigRef = useRef(null);
  useEffect(() => {
    const sig = gradientSource(st) || st.backgroundColor || "";
    if (sig !== sigRef.current) {
      sigRef.current = sig;
      setMode(detectFillerMode(st));
      setGrad(parseGradient(gradientSource(st)));
    }
  }, [st, cmd]);
  const imageUrl = urlOf(st.backgroundImage);

  // Every background change must first strip ALL previous background
  // formatting (solid colour, gradient, or image + its repeat/size/position),
  // then apply only the new mode. This prevents leftover properties from a
  // previous mode (including a corrupted legacy `background-image`) surviving
  // alongside the new one.
  const applyBackground = (styles) =>
    cmd.setStyles({
      background: "",
      backgroundColor: "",
      backgroundImage: "",
      backgroundRepeat: "",
      backgroundSize: "",
      backgroundPosition: "",
      backgroundAttachment: "",
      backgroundOrigin: "",
      backgroundClip: "",
      ...styles,
    });

  const applyGradient = (type, angle, c1, c2, alpha = 1) => {
    const a = alpha ?? 1;
    const value =
      type === "radial"
        ? `radial-gradient(circle, ${withAlpha(c1, a)}, ${withAlpha(c2, a)})`
        : `linear-gradient(${angle}deg, ${withAlpha(c1, a)}, ${withAlpha(c2, a)})`;
    setGrad({ type, angle: type === "radial" ? 0 : angle, c1, c2, alpha: a });
    applyBackground({ background: value });
  };

  const applySolid = (color, alpha = 1) => {
    const a = alpha ?? 1;
    applyBackground({ backgroundColor: withAlpha(color, a) });
  };

  const handleModeChange = (next) => {
    setMode(next);
    if (next === "gradient") {
      // Preserve the existing gradient (it may live in `background` or, after a
      // serialisation round-trip, `background-image`) instead of resetting to a
      // white default every time the mode is (re)selected.
      if (isGradient(st.background) || isGradient(st.backgroundImage)) {
        applyGradient(grad.type, grad.angle, grad.c1, grad.c2, grad.alpha);
      } else {
        applyGradient("linear", 135, "#ffffff", "#000000", 1);
      }
    } else if (next === "solid") {
      const s = parseSolid(st.backgroundColor);
      applySolid(s.color, s.alpha);
    } else if (next === "image") {
      setMediaOpen(true);
    }
  };

  const handleImagePick = (asset) => {
    applyBackground({
      backgroundImage: `url("${asset.url}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: st.backgroundSize || "cover",
      backgroundPosition: "center",
    });
    setMediaOpen(false);
    if (presentationId) {
      touchAsset(asset.id, presentationId).catch(() => {});
    }
  };

  const setImageFit = (size) => cmd.setStyle("backgroundSize", size);
  const removeImage = () => applyBackground({});

  return (
    <>
      <Label>
        <span>{__("messages.inspector.filler_type")}</span>
        <select
          value={mode}
          onChange={(e) => handleModeChange(e.target.value)}
          className="input-base h-9 w-full bg-[var(--secondary)] px-2"
        >
          <option value="solid">{__("messages.inspector.filler_type_solid")}</option>
          <option value="gradient">{__("messages.inspector.filler_type_gradient")}</option>
          <option value="image">{__("messages.inspector.filler_type_image")}</option>
        </select>
      </Label>

      {mode === "solid" && (() => {
        const s = parseSolid(st.backgroundColor);
        return (
          <div className="grid gap-2">
            <ColorField
              label={__("messages.inspector.filler_color")}
              value={s.color}
              onChange={(v) => applySolid(v, s.alpha)}
            />
            <OpacityControl value={s.alpha} onChange={(a) => applySolid(s.color, a)} />
          </div>
        );
      })()}

      {mode === "gradient" && (
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label={__("messages.inspector.filler_from")}
              value={grad.c1}
              onChange={(v) => applyGradient(grad.type, grad.angle, v, grad.c2, grad.alpha)}
            />
            <ColorField
              label={__("messages.inspector.filler_to")}
              value={grad.c2}
              onChange={(v) => applyGradient(grad.type, grad.angle, grad.c1, v, grad.alpha)}
            />
          </div>
          <OpacityControl
            value={grad.alpha}
            onChange={(a) => applyGradient(grad.type, grad.angle, grad.c1, grad.c2, a)}
          />
          <Label>
            <span>{__("messages.inspector.filler_gradient_type")}</span>
            <select
              value={grad.type}
              onChange={(e) => applyGradient(e.target.value, grad.angle, grad.c1, grad.c2, grad.alpha)}
              className="input-base h-9 w-full bg-[var(--secondary)] px-2"
            >
              <option value="linear">{__("messages.inspector.filler_linear")}</option>
              <option value="radial">{__("messages.inspector.filler_radial")}</option>
            </select>
          </Label>
          <div>
            <span className="mb-1 block text-[11px] font-medium text-[var(--muted-foreground)]">
              {__("messages.inspector.filler_direction")}
            </span>
            <div
              className="grid grid-cols-3 gap-1"
              style={{ gridTemplateAreas: '"tl t tr" "l . r" "bl b br"' }}
            >
               {GRADIENT_DIRS.map((d) => {
                const DirIcon = d.Icon;
                return (
                <button
                  key={d.key}
                  type="button"
                  disabled={grad.type === "radial"}
                  onClick={() => applyGradient("linear", d.angle, grad.c1, grad.c2, grad.alpha)}
                  aria-label={`${d.angle}°`}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-md border border-[var(--border)] text-base disabled:opacity-30",
                    grad.type !== "radial" && grad.angle === d.angle
                      ? "bg-[var(--navy)]/10 text-[var(--navy)] ring-1 ring-[var(--navy)]/30"
                      : "hover:bg-[var(--navy)]/5"
                  )}
                  style={{ gridArea: d.key }}
                >
                  <DirIcon className="h-4 w-4" />
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mode === "image" && (
        <div className="grid gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!cmd.getSelected()}
            onClick={() => setMediaOpen(true)}
          >
            {__("messages.inspector.filler_choose_image")}
          </Button>
          {imageUrl && imageUrl !== "none" && (
            <div className="overflow-hidden rounded-md border border-[var(--border)]">
              <img
                src={imageUrl.startsWith("media/") ? `/storage/${imageUrl}` : imageUrl}
                alt=""
                className="h-24 w-full object-cover"
              />
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={st.backgroundSize === "cover" ? "default" : "secondary"}
              disabled={!cmd.getSelected()}
              onClick={() => setImageFit("cover")}
            >
              {__("messages.inspector.filler_fit_cover")}
            </Button>
            <Button
              type="button"
              variant={st.backgroundSize === "contain" ? "default" : "secondary"}
              disabled={!cmd.getSelected()}
              onClick={() => setImageFit("contain")}
            >
              {__("messages.inspector.filler_fit_contain")}
            </Button>
            <Button
              type="button"
              variant={st.backgroundSize === "auto" ? "default" : "secondary"}
              disabled={!cmd.getSelected()}
              onClick={() => setImageFit("auto")}
            >
              {__("messages.inspector.filler_fit_auto")}
            </Button>
          </div>
          {imageUrl && imageUrl !== "none" && (
            <Button type="button" variant="ghost" disabled={!cmd.getSelected()} onClick={removeImage}>
              {__("messages.inspector.filler_remove_image")}
            </Button>
          )}
        </div>
      )}

      <MediaPickerDialog
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onPick={handleImagePick}
        presentationId={presentationId}
      />
    </>
  );
}

function ColorField({ label, value, onChange }) {
  const hex = toHex(value);
  return (
    <Label>
      <span>{label}</span>
      <span className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] p-1 pl-1.5">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-5 w-5 rounded border-0 bg-transparent p-0"
        />
        <span className="truncate text-[11.5px] font-semibold uppercase">{hex}</span>
      </span>
    </Label>
  );
}

// Background-opacity slider. Lives below the colour pickers for both solid and
// gradient fills; the chosen alpha is folded into the colour via `withAlpha`.
function OpacityControl({ value, onChange }) {
  const pct = Math.round((value ?? 1) * 100);
  return (
    <Label>
      <span className="flex items-center justify-between">
        <span>{__("messages.inspector.filler_opacity")}</span>
        <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">{pct}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--secondary)] accent-[var(--navy)]"
      />
    </Label>
  );
}

// box-shadow direction vectors: where the shadow offset falls. A 3×3 grid
// lets the user pick an angle, and a single "distance" slider sets its length.
const SHADOW_DIRS = [
  { key: "tl", sx: -1, sy: -1, Icon: ArrowUpLeft },
  { key: "t", sx: 0, sy: -1, Icon: ArrowUp },
  { key: "tr", sx: 1, sy: -1, Icon: ArrowUpRight },
  { key: "l", sx: -1, sy: 0, Icon: ArrowLeft },
  { key: "r", sx: 1, sy: 0, Icon: ArrowRight },
  { key: "bl", sx: -1, sy: 1, Icon: ArrowDownLeft },
  { key: "b", sx: 0, sy: 1, Icon: ArrowDown },
  { key: "br", sx: 1, sy: 1, Icon: ArrowDownRight },
];

const SHADOW_DEFAULTS = {
  active: false,
  color: "#000000",
  alpha: 0.2,
  blur: 30,
  spread: 0,
  distance: 10,
  dir: "b",
  inset: false,
};

// Parse a CSS `box-shadow` string into the structured fields the popover
// edits. Anything we can't interpret falls back to the defaults (a down-facing
// soft shadow) so the UI always has a sane starting point.
function parseBoxShadow(value) {
  const v = (value || "").trim();
  if (!v || v === "none") return { ...SHADOW_DEFAULTS };
  const inset = /\binset\b/i.test(v);
  const body = v.replace(/\binset\b/i, "").trim();
  let color = "#000000";
  let alpha = 0.2;
  const colorMatch = body.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
  if (colorMatch) {
    const parsed = splitColorAlpha(colorMatch[0]);
    color = toHex(parsed.rgb);
    alpha = parsed.alpha;
  }
  const nums = body
    .replace(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g, "")
    .trim()
    .split(/\s+/)
    .map(parseFloat)
    .filter((n) => Number.isFinite(n));
  const offsetX = nums[0] || 0;
  const offsetY = nums[1] || 0;
  const blur = nums[2] || 0;
  const spread = nums[3] || 0;
  const dirKey =
    `${offsetY < 0 ? "t" : offsetY > 0 ? "b" : ""}${offsetX < 0 ? "l" : offsetX > 0 ? "r" : ""}` || "b";
  const distance = Math.max(Math.abs(offsetX), Math.abs(offsetY)) || 10;
  return { active: true, color, alpha, blur, spread, distance, dir: dirKey, inset };
}

// Serialise the structured fields back to a CSS `box-shadow` string.
function buildBoxShadow(s) {
  if (!s.active) return "none";
  const dir = SHADOW_DIRS.find((d) => d.key === s.dir) ?? SHADOW_DIRS[6];
  const ox = Math.round(dir.sx * s.distance);
  const oy = Math.round(dir.sy * s.distance);
  const color = withAlpha(s.color, s.alpha);
  const inset = s.inset ? "inset " : "";
  return `${inset}${ox}px ${oy}px ${s.blur}px ${s.spread}px ${color}`;
}

// Shadow editor: a popover with a live miniature, a direction grid, and
// sliders for distance / intensity / blur / spread plus a colour picker.
// Replaces the previous free-text box-shadow input so users don't have to
// remember the CSS syntax.
function ShadowField({ value, onChange }) {
  const [state, setState] = useState(() => parseBoxShadow(value));
  const lastEmitted = useRef(null);

  // Re-sync ONLY when the incoming value differs from what we last emitted
  // (i.e. a different selection / round-trip), so a user drag is never
  // clobbered by the slide re-emitting the same value.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setState(parseBoxShadow(value));
    }
  }, [value]);

  const update = (patch) => {
    const next = { ...state, ...patch };
    setState(next);
    const built = buildBoxShadow(next);
    lastEmitted.current = built;
    onChange(built);
  };

  const previewShadow = state.active ? buildBoxShadow(state) : "none";
  const pct = Math.round((state.alpha ?? 0) * 100);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 hover:bg-[var(--navy)]/5 focus-ring"
        >
          <span
            className="h-5 w-5 shrink-0 rounded-sm border border-[var(--border)] bg-[var(--card)]"
            style={{ boxShadow: previewShadow }}
          />
          <span className="truncate text-[11.5px] font-semibold">
            {state.active ? __("messages.inspector.shadow_edit") : __("messages.inspector.shadow_none")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] grid gap-3 p-3" align="start">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--muted-foreground)]">
            {__("messages.inspector.shadow")}
          </span>
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={state.active}
              onChange={(e) => update({ active: e.target.checked })}
              className="accent-[var(--navy)]"
            />
            {__("messages.inspector.shadow_enabled")}
          </label>
        </div>

        <div className="flex justify-center rounded-md border border-[var(--border)] bg-[var(--secondary)] py-4">
          <div
            className="h-12 w-20 rounded-md bg-[var(--card)]"
            style={{ boxShadow: previewShadow, opacity: state.active ? 1 : 0.35 }}
            aria-hidden
          />
        </div>

        <div className={cn("grid gap-3", !state.active && "pointer-events-none opacity-40")}>
          <div>
            <span className="mb-1 block text-[11px] font-medium text-[var(--muted-foreground)]">
              {__("messages.inspector.shadow_direction")}
            </span>
            <div
              className="grid grid-cols-3 gap-1"
              style={{ gridTemplateAreas: '"tl t tr" "l . r" "bl b br"' }}
            >
              {SHADOW_DIRS.map((d) => {
                const DirIcon = d.Icon;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => update({ dir: d.key })}
                    aria-label={d.key}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-md border border-[var(--border)]",
                      state.dir === d.key
                        ? "bg-[var(--navy)]/10 text-[var(--navy)] ring-1 ring-[var(--navy)]/30"
                        : "hover:bg-[var(--navy)]/5"
                    )}
                    style={{ gridArea: d.key }}
                  >
                    <DirIcon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <NumberField
            label={__("messages.inspector.shadow_distance")}
            unit="px"
            value={state.distance}
            onChange={(v) => update({ distance: Number(v) || 0 })}
          />

          <Label>
            <span className="flex items-center justify-between">
              <span>{__("messages.inspector.shadow_intensity")}</span>
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">{pct}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => update({ alpha: Number(e.target.value) / 100 })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--secondary)] accent-[var(--navy)]"
            />
          </Label>

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={__("messages.inspector.shadow_blur")}
              unit="px"
              value={state.blur}
              onChange={(v) => update({ blur: Number(v) || 0 })}
            />
            <NumberField
              label={__("messages.inspector.shadow_spread")}
              unit="px"
              value={state.spread}
              onChange={(v) => update({ spread: Number(v) || 0 })}
            />
          </div>

          <ColorField
            label={__("messages.inspector.shadow_color")}
            value={state.color}
            onChange={(v) => update({ color: v })}
          />

          <button
            type="button"
            onClick={() => update({ ...SHADOW_DEFAULTS, active: true })}
            className="h-8 rounded-md border border-[var(--border)] text-[11.5px] font-semibold hover:bg-[var(--navy)]/5"
          >
            {__("messages.inspector.shadow_reset")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NumberField({ label, unit, value, onChange }) {
  return (
    <Label>
      <span>{label}</span>
      <span className="relative flex items-center">
        <Input
          type="number"
          className="pr-7 text-right"
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
        />
        {unit && (
          <span className="pointer-events-none absolute right-2 text-[11px] text-[var(--muted-foreground)]">
            {unit}
          </span>
        )}
      </span>
    </Label>
  );
}

function Section({ id, label, children }) {
  return (
    <AccordionItem value={id}>
      <AccordionTrigger>{label}</AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

export default function Inspector() {
  const { selection, cmd, presentationId } = useEditor();
  const [tab, setTab] = useState("props");
  const [nudgeStep, setNudgeStep] = useState(8);
  const [listKind, setListKind] = useState(null);

  const s = selection;
  const box = s?.box ?? {};
  const st = s?.styles ?? {};
  const disabled = !s;

  const editorRef = useRef(null);
  // Whether the user has actually edited the rich-text editor since it was
  // last loaded/written. We only push the editor's HTML back to the slide when
  // this is true, so clicking an Inspector control (which blurs the editor)
  // does NOT clobber the selected element with the editor's sanitised copy —
  // cleanHtml() strips non-text content (icons, tables, coloured spans) that
  // the editor can't represent, and writing that back would silently delete it.
  const editorDirty = useRef(false);
  // Signature of the element whose HTML is currently loaded in the editor.
  // Used to avoid reloading (and losing the caret) on every slide emit while
  // the user is typing in the same element.
  const loadedSig = useRef(null);

  // Load the selected element's content into the rich-text editor whenever a
  // *different* element is selected. The slide's custom colors and positioning
  // are stripped so the panel shows the text with its structural formatting
  // only — the slide keeps its own palette.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // Key the reload on the selected element's identity (a stable DOM
    // reference from the engine), NOT on its box dimensions — otherwise
    // typing that changes the box height would reload the editor mid-keystroke
    // and corrupt the caret/text. We only reload when a *different* element is
    // selected.
    const sel = cmd.getSelected();
    if (!sel) {
      if (el.innerHTML !== "") el.innerHTML = "";
      loadedSig.current = null;
      setListKind(computeListKind());
      return;
    }
    if (sel === loadedSig.current) {
      // Same element, caret moved within it: refresh the list indicator from the
      // new caret position without reloading the editor (which would clobber the
      // caret). This makes the List button track the actual list under the caret.
      setListKind(computeListKind());
      return;
    }
    loadedSig.current = sel;
    el.innerHTML = cleanHtml(cmd.getHtml());
    editorDirty.current = false;
    setListKind(computeListKind());
  }, [s, cmd]);

  // Push the editor's HTML back to the slide, stripped of panel-only styling.
  // Only when the user actually edited the editor (editorDirty) — never on a
  // passive blur caused by interacting with other Inspector controls, which
  // would otherwise overwrite the element with the sanitised (content-stripped)
  // copy and lose icons/tables/colours.
  const syncToSlide = (force = false) => {
    const el = editorRef.current;
    if (!el) return;
    if (!force && !editorDirty.current) return;
    // Collapse a stray <br> left by the browser when the user clears the box
    // so the CSS :empty placeholder shows and we don't persist empty markup.
    if (!el.textContent.trim() && !el.querySelector("ul,ol,li")) el.innerHTML = "";
    cmd.setHtml(cleanHtml(el.innerHTML));
    editorDirty.current = false;
  };

  // Chromium leaves the caret in a bad spot after execCommand turns a paragraph
  // into a list, which makes the next Enter split the list incorrectly (new
  // item appears above, orphaning existing text). Force the caret to the end
  // of the last list item so subsequent Enters append cleanly.
  const placeCaretAtEnd = (el) => {
    const lis = el.querySelectorAll("li");
    const target = lis.length ? lis[lis.length - 1] : el;
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  // Apply a rich-text command to the editor itself (not the slide), then sync.
  // onMouseDown preventDefault keeps the editor focused so execCommand targets it.
  const format = (command) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, null);
    if (command === "insertUnorderedList" || command === "insertOrderedList") {
      placeCaretAtEnd(el);
    }
    syncToSlide(true);
  };

  const pd = (e) => e.preventDefault();

  // Derive the active list kind from the slide's selection snapshot. This is the
  // authoritative source for the List button: it follows the caret on the slide
  // (including moving to a non-list part of the same box, or losing the
  // selection), rather than naively scanning the inline editor's mirrored HTML.
  const listFromSnapshot = (snap) => {
    if (!snap || !snap.list) return null;
    if (snap.list.tag === "ol") return "ordered";
    const t = snap.list.style || "disc";
    return t === "circle" ? "circle" : t === "square" ? "square" : "disc";
  };
  // When the user is actively editing in the inline editor, its own caret wins;
  // otherwise fall back to the slide snapshot (e.g. after clicking the slide).
  const computeListKind = () => {
    const el = editorRef.current;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    let node = sel && sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    while (node && node !== el) {
      if (node.tagName === "OL") return "ordered";
      if (node.tagName === "UL") {
        const t = (node.style.listStyleType || "disc").replace(/["']/g, "");
        return t === "circle" ? "circle" : t === "square" ? "square" : "disc";
      }
      node = node.parentNode;
    }
    return listFromSnapshot(s);
  };
  // The DOM list-toggle logic lives in listFormat (shared with the engine's
  // floating toolbar); here we only drive the inline editor then sync to slide.
  const applyList = (kind) => {
    const el = editorRef.current;
    if (!el) return;
    applyListToElement(el, kind);
    syncToSlide(true);
    setListKind(computeListKind());
  };

  const setStyle = (prop, value) => cmd.setStyle(prop, value);
  const setPx = (prop, value) => cmd.setStyle(prop, value === "" ? "" : `${value}px`);

  const V_MAP = { start: "flex-start", center: "center", end: "flex-end" };
  const H_MAP = { left: "flex-start", center: "center", right: "flex-end" };
  const decodeV = (jc) => (jc === "center" ? "center" : jc === "flex-end" ? "end" : "start");
  const vAlign = st.display === "flex" ? decodeV(st.justifyContent) : "start";
  const hAlign = st.textAlign || "left";
  const applyAlign = (v, h) => {
    if (v === "start" && h === "left") {
      cmd.setStyles({ display: "", flexDirection: "", justifyContent: "", alignItems: "", textAlign: "" });
    } else {
      cmd.setStyles({
        display: "flex",
        flexDirection: "column",
        justifyContent: V_MAP[v],
        alignItems: H_MAP[h],
        textAlign: h,
      });
    }
  };
  const setVAlign = (v) => applyAlign(v, hAlign);
  const setHAlign = (h) => applyAlign(vAlign, h);

  return (
    <div className="panel-sidebar flex h-full flex-col overflow-hidden">
      <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
        <div className="m-4 mb-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="props">{__("messages.inspector.tab_props")}</TabsTrigger>
            <TabsTrigger value="layers">{__("messages.inspector.tab_layers")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="props" className="flex-1 overflow-auto px-4 pb-4">
          <Accordion type="multiple" defaultValue={["text", "position"]} className="grid gap-2">
            <Section id="text" label={__("messages.inspector.section_text")}>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => { editorDirty.current = true; syncToSlide(); }}
                onBlur={() => syncToSlide()}
                data-placeholder={__("messages.inspector.text_placeholder")}
                className="rt-editor min-h-[84px] w-full resize-y overflow-auto rounded-md border border-[var(--border)] bg-[var(--secondary)] p-2 text-sm leading-relaxed text-[var(--foreground)] outline-none focus-ring [&_ul]:list-disc [&_ul]:m-0 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:m-0 [&_ol]:pl-5 [&_li]:my-0.5"
              />
              <div className="mt-1.5 flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--secondary)]">
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => format("bold")} className="flex h-8 flex-1 items-center justify-center border-r border-[var(--border)] font-bold hover:bg-[var(--navy)]/5" aria-label={__("messages.inspector.bold")}>
                  <Bold className="size-4" />
                </button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => format("italic")} className="flex h-8 flex-1 items-center justify-center border-r border-[var(--border)] italic hover:bg-[var(--navy)]/5" aria-label={__("messages.inspector.italic")}>
                  <Italic className="size-4" />
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      className={cn("flex h-8 flex-1 items-center justify-center border-r border-[var(--border)] hover:bg-[var(--navy)]/5", listKind && "bg-[var(--navy)]/10 text-[var(--navy)]")}
                      aria-label={__("messages.inspector.list")}
                    >
                      <List className="size-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-1" align="start">
                    {[
                      { k: "ordered", label: __("messages.inspector.list_ordered"), Icon: ListOrdered },
                      { k: "disc", label: __("messages.inspector.list_disc"), Icon: List },
                      { k: "circle", label: __("messages.inspector.list_circle"), Icon: List },
                      { k: "square", label: __("messages.inspector.list_square"), Icon: List },
                    ].map((opt) => (
                      <button
                        key={opt.k}
                        type="button"
                        onMouseDown={pd}
                        onClick={() => applyList(opt.k)}
                        aria-pressed={listKind === opt.k}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--navy)]/5",
                          listKind === opt.k ? "bg-[var(--navy)]/10 text-[var(--navy)]" : "text-[var(--foreground)]"
                        )}
                      >
                        <opt.Icon className="size-4" />
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      className="flex h-8 flex-1 items-center justify-center hover:bg-[var(--navy)]/5"
                      aria-label={__("messages.inspector.align")}
                    >
                      {hAlign === "center" ? <AlignCenter className="size-4" /> : hAlign === "right" ? <AlignRight className="size-4" /> : <AlignLeft className="size-4" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--muted-foreground)]">{__("messages.inspector.align_horizontal")}</p>
                    <div className="grid grid-cols-3 gap-1">
                      <AlignOption icon={AlignLeft} active={hAlign === "left"} label={__("messages.inspector.align_left")} onClick={() => setHAlign("left")} />
                      <AlignOption icon={AlignCenter} active={hAlign === "center"} label={__("messages.inspector.align_center")} onClick={() => setHAlign("center")} />
                      <AlignOption icon={AlignRight} active={hAlign === "right"} label={__("messages.inspector.align_right")} onClick={() => setHAlign("right")} />
                    </div>
                    <p className="mb-1 mt-2 px-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--muted-foreground)]">{__("messages.inspector.align_vertical")}</p>
                    <div className="grid grid-cols-3 gap-1">
                      <AlignOption icon={AlignStartVertical} active={vAlign === "start"} label={__("messages.inspector.align_top")} onClick={() => setVAlign("start")} />
                      <AlignOption icon={AlignCenterVertical} active={vAlign === "center"} label={__("messages.inspector.align_middle")} onClick={() => setVAlign("center")} />
                      <AlignOption icon={AlignEndVertical} active={vAlign === "end"} label={__("messages.inspector.align_bottom")} onClick={() => setVAlign("end")} />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </Section>

            <Section id="position" label={__("messages.inspector.section_position")}>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label={__("messages.inspector.label_x")} unit="px" value={num(st.left) || box.x} onChange={(v) => setPx("left", v)} />
                <NumberField label={__("messages.inspector.label_y")} unit="px" value={num(st.top) || box.y} onChange={(v) => setPx("top", v)} />
                <NumberField label={__("messages.inspector.label_w")} unit="px" value={num(st.width) || box.w} onChange={(v) => setPx("width", v)} />
                <NumberField label={__("messages.inspector.label_h")} unit="px" value={num(st.height) || box.h} onChange={(v) => setPx("height", v)} />
              </div>
              <div className="grid grid-cols-2 items-end gap-2">
                <NumberField label={__("messages.inspector.step")} unit="px" value={nudgeStep} onChange={(v) => setNudgeStep(Number(v) || 1)} />
                <div className="nudge-pad grid-cols-4 gap-1">
                  <Button variant="ghost" size="icon-sm" disabled={disabled} onClick={() => cmd.nudge(-nudgeStep, 0)} aria-label={__("messages.layers.left")}><ChevronDown className="rotate-90" /></Button>
                  <Button variant="ghost" size="icon-sm" disabled={disabled} onClick={() => cmd.nudge(0, -nudgeStep)} aria-label={__("messages.layers.up")}><ChevronUp /></Button>
                  <Button variant="ghost" size="icon-sm" disabled={disabled} onClick={() => cmd.nudge(0, nudgeStep)} aria-label={__("messages.layers.down")}><ChevronDown /></Button>
                  <Button variant="ghost" size="icon-sm" disabled={disabled} onClick={() => cmd.nudge(nudgeStep, 0)} aria-label={__("messages.layers.right")}><ChevronUp className="rotate-90" /></Button>
                </div>
              </div>
            </Section>

            <Section id="typography" label={__("messages.inspector.section_typography")}>
              <Label>
                <span>{__("messages.inspector.font")}</span>
                <select
                  value={st.fontFamily?.replace(/["']/g, "") || ""}
                  onChange={(e) => setStyle("fontFamily", e.target.value)}
                  className="input-base focus-ring h-9 w-full bg-[var(--secondary)] px-2"
                >
                  <option value="" />
                  {FONTS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label={__("messages.inspector.size")} unit="px" value={num(st.fontSize)} onChange={(v) => setPx("fontSize", v)} />
                <NumberField label={__("messages.inspector.line_height")} value={num(st.lineHeight)} onChange={(v) => setStyle("lineHeight", v)} />
                <NumberField label={__("messages.inspector.letter_spacing")} unit="px" value={num(st.letterSpacing)} onChange={(v) => setPx("letterSpacing", v)} />
                <NumberField label={__("messages.inspector.opacity")} value={num(st.opacity)} onChange={(v) => setStyle("opacity", v)} />
              </div>
            </Section>

            <Section id="filler" label={__("messages.inspector.section_filler")}>
              <FillerSection st={st} cmd={cmd} presentationId={presentationId} />
            </Section>

            <Section id="shape" label={__("messages.inspector.section_shape")}>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label={__("messages.inspector.space")} unit="px" value={num(st.padding)} onChange={(v) => setPx("padding", v)} />
                <NumberField label={__("messages.inspector.radius")} unit="px" value={num(st.borderRadius)} onChange={(v) => setPx("borderRadius", v)} />
                <NumberField label={__("messages.inspector.border")} unit="px" value={num(st.borderWidth)} onChange={(v) => setPx("borderWidth", v)} />
                <Label>
                  <span>{__("messages.inspector.style")}</span>
                  <select
                    value={st.borderStyle || ""}
                    onChange={(e) => setStyle("borderStyle", e.target.value)}
                    className="input-base h-9 w-full bg-[var(--secondary)] px-2"
                  >
                    <option value="">{__("messages.inspector.style_auto")}</option>
                    <option value="none">{__("messages.inspector.style_none")}</option>
                    <option value="solid">{__("messages.inspector.style_solid")}</option>
                    <option value="dashed">{__("messages.inspector.style_dashed")}</option>
                  </select>
                </Label>
                <ColorField label={__("messages.inspector.border_color")} value={st.borderColor} onChange={(v) => setStyle("borderColor", v)} />
              </div>
              <Label>
                <span>{__("messages.inspector.shadow")}</span>
                <ShadowField value={st.boxShadow} onChange={(v) => setStyle("boxShadow", v)} />
              </Label>
            </Section>

            <Section id="actions" label={__("messages.inspector.section_actions")}>
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="secondary" disabled={disabled} onClick={cmd.group}>{__("messages.inspector.group")}</Button>
                <Button variant="secondary" disabled={disabled} onClick={cmd.ungroup}>{__("messages.inspector.ungroup")}</Button>
                <Button variant="secondary" disabled={disabled} onClick={() => setStyle("position", "absolute")}>{__("messages.inspector.make_absolute")}</Button>
              </div>
            </Section>
          </Accordion>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={cmd.clearFormatting}
            className="mt-3 w-full border-[var(--red)] text-[var(--red)] hover:bg-[var(--red)]/10"
          >
            {__("messages.inspector.clear_formatting")}
          </Button>
        </TabsContent>

        <TabsContent value="layers" className="flex-1 overflow-auto px-4 pb-4">
          <div className="grid gap-2">
            <div className="grid grid-cols-4 gap-1.5">
              <Button variant="secondary" size="icon" disabled={disabled} onClick={cmd.bringForward} aria-label={__("messages.layers.forward")}><ChevronUp /></Button>
              <Button variant="secondary" size="icon" disabled={disabled} onClick={cmd.sendBackward} aria-label={__("messages.layers.backward")}><ChevronDown /></Button>
              <Button variant="secondary" size="icon" disabled={disabled} onClick={cmd.bringForward} aria-label={__("messages.layers.front")}><ChevronsUp /></Button>
              <Button variant="secondary" size="icon" disabled={disabled} onClick={cmd.sendBackward} aria-label={__("messages.layers.back")}><ChevronsDown /></Button>
            </div>
            <p className="text-[11.5px] text-[var(--muted-foreground)]">
              {s ? s.tag : __("messages.inspector.no_selection")}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
