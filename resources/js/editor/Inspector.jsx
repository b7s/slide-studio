import { useEffect, useState, createElement } from "react";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../Components/ui/tabs";
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
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Trash2,
} from "lucide-react";
import { useEditor } from "./EditorContext";
import { __ } from "../lib/i18n";
import { ICON_CATALOG } from "./icons.config";

const FONTS = ["Inter", "Georgia", "Roboto", "Arial", "Times New Roman", "Courier New"];

function toHex(color) {
  if (!color) return "#000000";
  if (color.startsWith("#")) return color;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return "#000000";
  const hex = (n) => Number(n).toString(16).padStart(2, "0");
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
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

  const s = selection;
  const box = s?.box ?? {};
  const st = s?.styles ?? {};
  const disabled = !s;

  const [text, setText] = useState("");
  useEffect(() => {
    setText(s?.text ?? "");
  }, [s]);

  const setStyle = (prop, value) => cmd.setStyle(prop, value);
  const setPx = (prop, value) => cmd.setStyle(prop, value === "" ? "" : `${value}px`);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--sidebar)] shadow-sm">
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
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={__("messages.inspector.text_placeholder")}
                className="min-h-[84px] w-full resize-y rounded-md border border-[var(--border)] bg-[var(--secondary)] p-2 text-sm focus:border-[var(--focus)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <div className="flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--secondary)]">
                <button onClick={() => cmd.applyTextCommand("bold")} className="flex h-8 flex-1 items-center justify-center border-r border-[var(--border)] font-bold hover:bg-[var(--navy)]/5" aria-label={__("messages.inspector.bold")}>
                  <Bold className="size-4" />
                </button>
                <button onClick={() => cmd.applyTextCommand("italic")} className="flex h-8 flex-1 items-center justify-center border-r border-[var(--border)] italic hover:bg-[var(--navy)]/5" aria-label={__("messages.inspector.italic")}>
                  <Italic className="size-4" />
                </button>
                <button onClick={() => cmd.applyTextCommand("insertUnorderedList")} className="flex h-8 flex-1 items-center justify-center hover:bg-[var(--navy)]/5" aria-label={__("messages.inspector.list")}>
                  <List className="size-4" />
                </button>
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
                <div className="grid grid-cols-4 gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] p-1">
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
                  className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-sm focus:border-[var(--focus)] focus:outline-none"
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
                <NumberField label={__("messages.inspector.radius")} unit="px" value={num(st.borderRadius)} onChange={(v) => setPx("borderRadius", v)} />
                <NumberField label={__("messages.inspector.border")} unit="px" value={num(st.borderWidth)} onChange={(v) => setPx("borderWidth", v)} />
                <Label>
                  <span>{__("messages.inspector.style")}</span>
                  <select
                    value={st.borderStyle || ""}
                    onChange={(e) => setStyle("borderStyle", e.target.value)}
                    className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-sm"
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
                      disabled={disabled}
                      onClick={() => cmd.setIcon(name)}
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
                          void key; // lucide-only HOC key, irrelevant at runtime
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
