import { useState } from "react";
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
} from "lucide-react";
import { __ } from "../lib/i18n";

function ColorField({ label, id }) {
  const [value, setValue] = useState("#001F35");
  return (
    <Label>
      <span>{label}</span>
      <span className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] p-1 pl-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-5 w-5 rounded border-0 bg-transparent p-0"
        />
        <span className="truncate text-[11.5px] font-semibold uppercase">{value}</span>
      </span>
    </Label>
  );
}

function NumberField({ label, unit }) {
  return (
    <Label>
      <span>{label}</span>
      <span className="relative flex items-center">
        <Input type="number" className="pr-7 text-right" />
        {unit && (
          <span className="pointer-events-none absolute right-2 text-[11px] text-[var(--muted-foreground)]">
            {unit}
          </span>
        )}
      </span>
    </Label>
  );
}

function Section({ id, label, children, defaultOpen = false }) {
  return (
    <AccordionItem value={id}>
      <AccordionTrigger>{label}</AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

export default function Inspector({ selectedLabel }) {
  const [tab, setTab] = useState("props");

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
          {selectedLabel || __("messages.inspector.no_selection")}
        </p>

        <TabsContent value="props" className="flex-1 overflow-auto px-4 pb-4">
          <Accordion type="multiple" defaultValue={["text", "position"]} className="grid gap-2">
            <Section id="text" label={__("messages.inspector.section_text")}>
              <textarea
                rows={4}
                placeholder={__("messages.inspector.text_placeholder")}
                className="min-h-[84px] w-full resize-y rounded-md border border-[var(--border)] bg-[var(--secondary)] p-2 text-sm focus:border-[var(--focus)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <div className="flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--secondary)]">
                <button className="flex h-8 flex-1 items-center justify-center border-r border-[var(--border)] font-bold hover:bg-[var(--navy)]/5" aria-label={__("messages.inspector.bold")}>
                  <Bold className="size-4" />
                </button>
                <button className="flex h-8 flex-1 items-center justify-center border-r border-[var(--border)] italic hover:bg-[var(--navy)]/5" aria-label={__("messages.inspector.italic")}>
                  <Italic className="size-4" />
                </button>
                <button className="flex h-8 flex-1 items-center justify-center hover:bg-[var(--navy)]/5" aria-label={__("messages.inspector.list")}>
                  <List className="size-4" />
                </button>
                <button className="flex h-8 flex-1 items-center justify-center border-l border-[var(--border)] text-xs font-semibold hover:bg-[var(--navy)]/5">
                  {__("messages.inspector.edit")}
                </button>
                <button className="flex h-8 flex-1 items-center justify-center border-l border-[var(--border)] text-xs font-semibold hover:bg-[var(--navy)]/5">
                  {__("messages.inspector.parent")}
                </button>
              </div>
            </Section>

            <Section id="position" label={__("messages.inspector.section_position")}>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label={__("messages.inspector.label_x")} unit="px" />
                <NumberField label={__("messages.inspector.label_y")} unit="px" />
                <NumberField label={__("messages.inspector.label_w")} unit="px" />
                <NumberField label={__("messages.inspector.label_h")} unit="px" />
              </div>
              <div className="grid grid-cols-2 items-end gap-2">
                <Label>
                  <span>{__("messages.inspector.step")}</span>
                  <NumberField label="" unit="px" />
                </Label>
                <div className="grid grid-cols-4 gap-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] p-1">
                  <Button variant="ghost" size="icon-sm" aria-label={__("messages.layers.left")}><ChevronDown className="rotate-90" /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={__("messages.layers.up")}><ChevronUp /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={__("messages.layers.down")}><ChevronDown /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={__("messages.layers.right")}><ChevronUp className="rotate-90" /></Button>
                </div>
              </div>
            </Section>

            <Section id="typography" label={__("messages.inspector.section_typography")}>
              <Label>
                <span>{__("messages.inspector.font")}</span>
                <select className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-sm focus:border-[var(--focus)] focus:outline-none">
                  <option>Inter</option>
                  <option>Georgia</option>
                  <option>Roboto</option>
                </select>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label={__("messages.inspector.size")} unit="px" />
                <NumberField label={__("messages.inspector.line_height")} />
                <NumberField label={__("messages.inspector.letter_spacing")} unit="px" />
                <NumberField label={__("messages.inspector.opacity")} />
              </div>
            </Section>

            <Section id="color" label={__("messages.inspector.section_color")} defaultOpen>
              <div className="grid grid-cols-2 gap-2">
                <ColorField label={__("messages.inspector.color_text")} id="fcolor" />
                <ColorField label={__("messages.inspector.color_fill")} id="fbg" />
              </div>
              <Label>
                <span>{__("messages.inspector.gradient_image")}</span>
                <Input placeholder="linear-gradient(…)" />
              </Label>
            </Section>

            <Section id="shape" label={__("messages.inspector.section_shape")} defaultOpen>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label={__("messages.inspector.radius")} unit="px" />
                <NumberField label={__("messages.inspector.border")} unit="px" />
                <Label>
                  <span>{__("messages.inspector.style")}</span>
                  <select className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-sm">
                    <option>{__("messages.inspector.style_auto")}</option>
                    <option>{__("messages.inspector.style_none")}</option>
                    <option>{__("messages.inspector.style_solid")}</option>
                    <option>{__("messages.inspector.style_dashed")}</option>
                  </select>
                </Label>
                <ColorField label={__("messages.inspector.border_color")} id="fborder" />
              </div>
              <Label>
                <span>{__("messages.inspector.shadow")}</span>
                <Input placeholder="0 10px 30px rgba(0,0,0,.2)" />
              </Label>
              <Button variant="secondary" className="w-full">{__("messages.inspector.use_as_image")}</Button>
            </Section>

            <Section id="media" label={__("messages.inspector.section_media")}>
              <Label>
                <span>{__("messages.inspector.image_source")}</span>
                <Input placeholder="assets/imagem.png ou URL" />
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary">{__("messages.inspector.replace")}</Button>
                <Button variant="secondary">{__("messages.inspector.remove")}</Button>
                <Button variant="secondary">{__("messages.inspector.cover")}</Button>
                <Button variant="secondary">{__("messages.inspector.contain")}</Button>
              </div>
            </Section>

            <Section id="icon" label={__("messages.inspector.section_icon")}>
              <div className="grid grid-cols-[1fr_auto_auto] items-end gap-1.5">
                <Label className="grid-cols-1">
                  <span>{__("messages.inspector.type")}</span>
                  <select className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 text-sm">
                    <option>{__("messages.inspector.icon_checkmark")}</option>
                    <option>X</option>
                    <option>{__("messages.inspector.icon_right_arrow")}</option>
                  </select>
                </Label>
                <Button variant="secondary">{__("messages.inspector.add")}</Button>
                <Button variant="secondary">{__("messages.inspector.rem")}</Button>
              </div>
            </Section>

            <Section id="table" label={__("messages.inspector.section_table")}>
              <p className="text-[11.5px] text-[var(--muted-foreground)]">{__("messages.inspector.table_hint")}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  __("messages.inspector.add_row"),
                  __("messages.inspector.rem_row"),
                  __("messages.inspector.add_col"),
                  __("messages.inspector.rem_col"),
                  __("messages.inspector.up_row"),
                  __("messages.inspector.down_row"),
                  __("messages.inspector.left_col"),
                  __("messages.inspector.right_col"),
                ].map((t) => (
                  <Button key={t} variant="secondary" className="h-7 px-1.5 text-[11.5px]">
                    {t}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label={__("messages.inspector.row_height")} unit="px" />
                <NumberField label={__("messages.inspector.col_width")} unit="px" />
              </div>
            </Section>

            <Section id="actions" label={__("messages.inspector.section_actions")} defaultOpen>
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="secondary">{__("messages.inspector.group")}</Button>
                <Button variant="secondary">{__("messages.inspector.ungroup")}</Button>
                <Button variant="secondary">{__("messages.inspector.make_absolute")}</Button>
                <Button variant="secondary">{__("messages.inspector.lift_to_slide")}</Button>
              </div>
            </Section>
          </Accordion>
          <Button variant="outline" className="mt-3 w-full border-[var(--red)] text-[var(--red)] hover:bg-[var(--red)]/10">
            {__("messages.inspector.clear_formatting")}
          </Button>
        </TabsContent>

        <TabsContent value="layers" className="flex-1 overflow-auto px-4 pb-4">
          <div className="grid gap-2">
            <div className="grid grid-cols-4 gap-1.5">
              <Button variant="secondary" size="icon" aria-label={__("messages.layers.forward")}><ChevronUp /></Button>
              <Button variant="secondary" size="icon" aria-label={__("messages.layers.backward")}><ChevronDown /></Button>
              <Button variant="secondary" size="icon" aria-label={__("messages.layers.front")}><ChevronsUp /></Button>
              <Button variant="secondary" size="icon" aria-label={__("messages.layers.back")}><ChevronsDown /></Button>
            </div>
            <div className="grid gap-1">
              {["Título", "Subtítulo", "Imagem de fundo", "Logo"].map((name, i) => (
                <button
                  key={name}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--secondary)] p-2 text-left hover:border-[var(--gold)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-semibold">{name}</span>
                    <span className="block truncate text-[10.5px] text-[var(--muted-foreground)]">
                      {name}
                    </span>
                  </span>
                  <span className="rounded-full border border-[var(--border)] px-1.5 text-[10px] text-[var(--muted-foreground)]">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
