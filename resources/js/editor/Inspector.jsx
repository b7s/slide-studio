import { useEffect, useRef, useState, createElement } from "react";
import { toHex } from "../lib/color";
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
  Trash2,
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useEditor } from "./EditorContext";
import { __ } from "../lib/i18n";
import { cn } from "../Components/lib/utils";
import { ICON_CATALOG } from "./icons.config";

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
      child.removeAttribute("data-g4-icon");
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
  const { selection, cmd } = useEditor();
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

        <p className="mx-4 mb-1 mt-3 truncate text-[11.5px] font-medium text-[var(--muted-foreground)]">
          {s ? s.tag : __("messages.inspector.no_selection")}
        </p>

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

            <Section id="color" label={__("messages.inspector.section_color")}>
              <div className="grid grid-cols-2 gap-2">
                <ColorField label={__("messages.inspector.color_text")} value={st.color} onChange={(v) => setStyle("color", v)} />
                <ColorField label={__("messages.inspector.color_fill")} value={st.backgroundColor} onChange={(v) => setStyle("backgroundColor", v)} />
              </div>
              <Label>
                <span>{__("messages.inspector.gradient_image")}</span>
                <Input
                  placeholder={__("messages.inspector.gradient_placeholder")}
                  onBlur={(e) => e.target.value && setStyle("background", e.target.value)}
                />
              </Label>
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
                <Input
                  placeholder={__("messages.inspector.shadow_placeholder")}
                  onBlur={(e) => e.target.value && setStyle("boxShadow", e.target.value)}
                />
              </Label>
            </Section>

            <Section id="media" label={__("messages.inspector.section_media")}>
              <Label>
                <span>{__("messages.inspector.image_source")}</span>
                <Input placeholder={__("messages.inspector.image_placeholder")} />
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" disabled={disabled} onClick={() => setStyle("objectFit", "cover")}>{__("messages.inspector.cover")}</Button>
                <Button variant="secondary" disabled={disabled} onClick={() => setStyle("objectFit", "contain")}>{__("messages.inspector.contain")}</Button>
              </div>
            </Section>

            <Section id="icon" label={__("messages.inspector.section_icon")}>
              <div className="grid grid-cols-6 gap-1.5">
                {Object.keys(ICON_CATALOG).map((name) => {
                  const active = s?.icon?.name === name;
                  const entry = ICON_CATALOG[name];
                  const segments = entry.entries ?? [{ tag: entry.tag, attrs: entry.attrs }];
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      aria-label={name}
                      aria-pressed={active}
                      onClick={() => {
                        if (s) cmd.setIcon(name);
                        else cmd.insertIcon(name);
                      }}
                      className={[
                        "grid aspect-square place-items-center rounded-md border text-[var(--foreground)]",
                        active
                          ? "border-[var(--gold)] bg-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--secondary)] hover:bg-[var(--navy)]/5",
                      ].join(" ")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        {segments.map((seg, i) => {
                          const { key, ...rest } = seg.attrs;
                          void key;
                          return createElement(seg.tag, { key: i, ...rest });
                        })}
                      </svg>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <NumberField
                  label={__("messages.inspector.icon_size")}
                  unit="px"
                  value={s?.icon?.size ?? null}
                  onChange={(v) => cmd.setIconSize(v === "" ? 24 : Number(v))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || !s?.icon}
                  aria-label={__("messages.inspector.icon_remove")}
                  onClick={cmd.removeIcon}
                  title={__("messages.inspector.icon_remove")}
                >
                  <Trash2 />
                </Button>
              </div>
            </Section>

            <Section id="table" label={__("messages.inspector.section_table")}>
              <p className="text-[11.5px] text-[var(--muted-foreground)]">
                {s?.table?.isCell
                  ? __("messages.inspector.table_hint")
                  : __("messages.inspector.table_select_hint")}
              </p>
              <div className="grid gap-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <Button variant="secondary" disabled={!s?.table?.isCell} onClick={() => cmd.insertRow(false)}>
                    <Plus className="mr-1 size-3.5" />{__("messages.inspector.add_row_before")}
                  </Button>
                  <Button variant="secondary" disabled={!s?.table?.isCell} onClick={() => cmd.insertRow(true)}>
                    <Plus className="mr-1 size-3.5" />{__("messages.inspector.add_row_after")}
                  </Button>
                  <Button variant="secondary" disabled={!s?.table?.isCell || (s?.table?.rowCount ?? 0) <= 1} onClick={cmd.deleteRow}>
                    <Minus className="mr-1 size-3.5" />{__("messages.inspector.rem_row")}
                  </Button>
                  <div className="nudge-pad">
                    <Button variant="ghost" size="icon-sm" disabled={!s?.table?.isCell || (s?.table?.rowIndex ?? 0) <= 0} onClick={() => cmd.moveRow(-1)} aria-label={__("messages.inspector.up_row")}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" disabled={!s?.table?.isCell || (s?.table?.rowIndex ?? 0) >= (s?.table?.rowCount ?? 1) - 1} onClick={() => cmd.moveRow(1)} aria-label={__("messages.inspector.down_row")}><ArrowDown /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button variant="secondary" disabled={!s?.table?.isCell} onClick={() => cmd.insertColumn(false)}>
                    <Plus className="mr-1 size-3.5" />{__("messages.inspector.add_col_before")}
                  </Button>
                  <Button variant="secondary" disabled={!s?.table?.isCell} onClick={() => cmd.insertColumn(true)}>
                    <Plus className="mr-1 size-3.5" />{__("messages.inspector.add_col_after")}
                  </Button>
                  <Button variant="secondary" disabled={!s?.table?.isCell || (s?.table?.colCount ?? 0) <= 1} onClick={cmd.deleteColumn}>
                    <Minus className="mr-1 size-3.5" />{__("messages.inspector.rem_col")}
                  </Button>
                  <div className="nudge-pad">
                    <Button variant="ghost" size="icon-sm" disabled={!s?.table?.isCell || (s?.table?.colIndex ?? 0) <= 0} onClick={() => cmd.moveColumn(-1)} aria-label={__("messages.inspector.left_col")}><ArrowLeft /></Button>
                    <Button variant="ghost" size="icon-sm" disabled={!s?.table?.isCell || (s?.table?.colIndex ?? 0) >= (s?.table?.colCount ?? 1) - 1} onClick={() => cmd.moveColumn(1)} aria-label={__("messages.inspector.right_col")}><ArrowRight /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label={__("messages.inspector.row_height")} unit="px" value={num(s?.table?.rowHeight)} onChange={(v) => cmd.setRowHeight(v)} />
                  <NumberField label={__("messages.inspector.col_width")} unit="px" value={num(s?.table?.colWidth)} onChange={(v) => cmd.setColumnWidth(v)} />
                </div>
              </div>
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
