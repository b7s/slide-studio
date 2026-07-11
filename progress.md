# Slide Studio — Progress

Replica of G4 Slide Studio: a slide presentation editor (like PowerPoint) powered by AI generation followed by a visual editor where users manually tweak slides (text, fonts, colors, backgrounds, images, gradients, shapes, layers).

## Stack

- **Backend**: Laravel 13, PHP 8.4 — renders only a single root Blade view; **no Blade-rendered UI**
- **Frontend**: React (latest) + Inertia.js — **owns 100% of every interface** (topbar, sidebar, workspace, inspector, modals, toasts, banners, context menus, every input/control). All panels are React components driven by Inertia props, not Blade.
- **UI**: shadcn/ui for all interface components (built on Radix + Tailwind)
- **Slide rendering**: iframe-based canvas (1600×900) — slides are HTML files
- **Database**: SQLite for now (zero-setup, fast to iterate); migrate to PostgreSQL later via env-driven driver — no schema changes required
- **Persistence model**: both **auto-save** (debounced timer every N seconds while dirty) **and** manual **Save** button (immediate). Save writes the slide HTML + revision to the DB.

## Cross-cutting requirement — localization (pt_BR default, `__()` everywhere)

Every user-facing string in the app MUST be defined in a `lang/pt_BR` language file and resolved via Laravel's `__()` helper. The default app locale is `pt_BR` (`config/app.php`); `en` is the fallback. This applies to **both** backend and frontend:

- **Backend:** controllers, Form Request `messages()`/`attributes()`, `ProblemJsonException` titles/details, jobs, mail — all use `__()`.
- **Frontend (React/Inertia):** UI text is NOT hardcoded in `.jsx`. Strings live in `lang/pt_BR` and are exposed to the client (Inertia shared prop and/or a client translation module mirroring `lang/`), read through a client `__()` wrapper. No raw `pt_BR`/`en` literals in components.
- Keys are namespaced by surface (`messages.*`, `validation.*`, `editor.*`, `inspector.*`, …). New keys go in `lang/pt_BR`; provide `lang/en` entries for any key needing an English fallback.
- Review rejects inline literals in PHP and JSX.

## Cross-cutting requirement — responsive on every interface

Every visible surface must be responsive from the start and across all breakpoints; nothing is desktop-only.

- **Single source of truth for layout**: Tailwind container + `grid` with fluid, breakpoint-aware track sizing. The 3-column shell degrades gracefully: `grid-cols-1` (base) → `lg:` two-track (sidebar + stack) → `xl:` three-track (sidebar + workspace + inspector).
- **Panel collapse from mobile → desktop**: icons/buttons stay reachable; panels become sheet/drawer/`Sheet` (shadcn) on small screens and inline rails on large screens.
- **Topbar**: wraps and reflows; action row collapses to icon-only below `md`; segmented tabs stay centered; paths become a Sheet on small screens.
- **Sidebar**: collapses to a modal `Sheet` on `< lg`; thumbnails remain readable; view-toggle (list/grid) adapts card size to viewport.
- **Workspace toolbar**: wraps to multiple lines or condenses to an icon set; center crumb truncates; zoom group keeps min tap targets (≥44px).
- **Inspector**: becomes a bottom `Sheet` / drawer on `< lg`; accordion sections scroll; color/shape grids reflow.
- **Canvas (iframe)**: scales to fit width (`preview-frame` uses `transform: scale(--fit)` with a `ResizeObserver` to compute fit-to-screen); pinch/trackpad-friendly; no horizontal scroll.
- **Modals/dialogs/toasts**: shadcn `Dialog`/`Sheet`/`Sonner` are responsive by default; max-width adapts (`sm:max-w-md` → `xl:max-w-2xl`).
- **Forms**: every input is full-width on small screens; `field-grid`/`color-grid` use `grid-cols-2 sm:grid-cols-2` and reflow to 1 column on small screens.
- **Touch**: drag/resize handles enlarged (≥44px tap targets); long-press opens the context menu on touch; no hover-only affordances.
- **A11y pairing**: responsive and accessible together — focus traps in sheets, `aria-hidden`/`inert` on collapsed panels, visible focus ring, keyboard parity for every pointer interaction.
- **Testing**: snapshot/visual checks at widths 360 / 640 / 1024 / 1366 / 1920 in Phase 7.

## Reference — original G4 Slide Studio layout

### Topbar (full width)
- Brand block (mark + "Slide Studio" title + deck label + runtime badge)
- Segmented tabs: **Apresentação** (deck) | **Modelos** (templates)
- Folder paths popover (`path-controls`): deck path + templates path inputs + "Abrir" button
- Help button + help modal ("How to organize your presentation")
- Action row: preview (open slide in new tab), reload, save (disabled until dirty), inspector toggle

### Left panel — `Sidebar` (304px)
- Panel head: "Slides" title + slide count + grid/list view toggle
- Source note (deck/templates state, folder connected, samples, etc.)
- Compatibility panel (warnings/errors per slide, rescan, collapse)
- Template tools box (when in templates mode): copy template-as input + button
- Slide list:
  - Slide cards with thumbnail (scaled-down iframe 1600×900 → ~104px wide)
  - Slide number badge, title, filename
  - Drag to reorder (Alt+ArrowUp/Down also works)
  - Active card highlighted (gold accent)
- Sidebar dock at bottom: duplicate slide input + button

### Center — `Workspace`
- Floating toolbar (top-center, glassmorphism): undo/redo | copy/cut/paste | delete | crumb (selected element name) | zoom out / value / zoom in / fit-to-screen
- Preview stage (dotted bg): `preview-frame` 1600×900 holding `slideFrame` iframe
- Click elements in the iframe to select; drag to move; resize handles; right-click context menu
- Status bar (bottom): status icon + message | "Alterações não salvas" dirty badge

### Right panel — `Inspector` (352px)
Two tabs: **Propriedades** (Inspect) | **Camadas** (Layers)

**Properties tab** — collapsible sections (shadcn `Accordion`):
1. **Texto** — textarea for selected text; bold/italic/list tool buttons; "Editar no slide" (contenteditable on canvas) + "Elemento pai"
2. **Posição e tamanho** — X / Y / W / H number fields (px); nudge step + 4 arrow buttons
3. **Tipografia** — font family `<select>`; size / line-height / letter-spacing / opacity
4. **Cor** — text color picker + fill color picker (with hex label); gradient/image text input
5. **Forma** — border radius / border width / border style / border color; box-shadow input; "Usar como espaço para imagem" button
6. **Mídia** (when image selected) — image source input; replace/clear/fit-cover/fit-contain buttons; hidden file input
7. **Ícone** — icon type select + add/remove buttons
8. **Tabela** (when table cell selected) — add/remove row/col, move row/col up/down/left/right, row height & col width
9. **Ações** — group / ungroup / make absolute (movable) / lift to slide level
- Footer: "Limpar formatação" button

**Layers tab** — z-order controls (bring forward/backward/front/back) + layer list (rows with name, meta, z-index badge, depth indentation)

## Phases

### Phase 0 — Scaffold
- [x] Create Laravel 13 project with PHP 8.4 (13.19 in `/home/b7s/documents/projects/b7s/slide-studio`)
- [x] Install Inertia.js + React (with Vite). Using JSX for speed; shadcn is framework-agnostic.
- [x] Install & configure shadcn/ui primitives (Radix + Tailwind v4 + `cn` util): button, input, label, badge, separator, accordion, tabs, dialog, sheet, popover, select, tooltip, scroll-area, sonner. Structure under `resources/js/Components/ui`.
- [x] Set up base layout (`AppShell`) with the responsive 3-column shell (topbar + sidebar + workspace + inspector) using Tailwind grid to match the reference (floating panels, gaps, rounded corners, elevation). Inline rails on `lg`/`xl`; Sheets (drawers) below that — panels collapse from mobile to desktop, persisted to localStorage.
- [x] Configure database: SQLite for dev (`DB_CONNECTION=sqlite`, `DB_DATABASE=database/database.sqlite`), ran migrations. `SESSION_DRIVER=file` (Laravel 13 default migrations omit the `sessions` table). `.env.example` documents future PostgreSQL switch (`DB_CONNECTION=pgsql`) with no schema changes.
- [x] Base Tailwind theme tokens matching reference palette (navy `#001F35`, gold `#b9915b`, ink `#17232d`, paper, lines, focus ring) in `resources/css/app.css` (light + dark).
- [x] `EditorController` returns sample slides + sample slide HTML via `/api/slides/html`; save endpoint stubbed. Verified: `/` -> Inertia `Editor/Index` (HTTP 200), plus `/api/config`, `/api/slides`, `/api/slides/html` all 200. `npm run build` passes.

### Phase 1 — Domain model (presentations & slides)
- [x] Migrations: `presentations`, `slides`, `templates`, `assets` (images), `revisions` (optional — skipped)
  - `presentations`: id, user_id, title, slug, deck_path, template_path, settings(json), timestamps
  - `slides`: id, presentation_id, position, filename, title, html, source_mode(deck/template enum), timestamps
  - `assets`: id, presentation_id, path, mime, data(data-url or storage path), timestamps
- [x] Eloquent models with relationships + casts (`Presentation`, `Slide`, `Template`, `Asset`; `SourceMode` enum with `default()`)
- [x] Policies (user owns presentation) — `PresentationPolicy`
- [x] Seeders: `SamplePresentationSeeder` (demo user + presentation with 4 slides)
- [x] Backend test runner switched to **Pest** (skill mandate); `phpstan.neon` level 6; Pest tests for models/enum/policy

### Phase 2 — Backend API (serves the editor)
Implemented under `routes/api.php` with the `/api/v1` prefix (skill mandate: versioned from day one), following laravel-statecraft (Form Requests + typed Data DTOs + Actions in `DB::transaction` + `Audit::record` + `DB::afterCommit` events + RFC 9457 Problem+JSON + X-Request-ID via `AssignRequestId` middleware):
- [x] `GET /` → Inertia render `Editor/Index` (loads first presentation + slides) — `EditorController`
- [x] `GET /api/v1/config` → { mode, deckRoot, templateRoot, deckAvailable, templatesAvailable }
- [x] `GET /api/v1/slides?presentation_id=` → list slides via `SlideResource` (file, title, number, source_mode, revision)
- [x] `GET /api/v1/slides/html?file=` → raw slide HTML for the iframe (`sandbox="allow-same-origin allow-scripts"`)
- [x] `POST /api/v1/slides/{file}` → save HTML; body `{ html, revision?, overwrite? }`; optimistic-concurrency 409 on stale `revision` + `overwrite:false` (returns `SlideSavedData` via `Slide::saveContent()` in `SaveSlide` action)
- [x] `POST /api/v1/slides/{file}/duplicate` → creates a copy (`DuplicateSlide` action → `SlideDuplicatedData`)
- [x] `POST /api/v1/reorder` → persist slide positions (`ReorderSlides` action → `ReorderSlidesData`)
- [x] Append-only audit trail: `audit_logs` table + `App\Models\AuditLog` + `App\Services\Audit` (`Audit::record` inside each action's transaction)
- [x] `App\Http\Resources\SlideResource`, `App\Http\Requests\Slide/*`, `App\Http\Controllers\Api/V1/*`
- [x] `bootstrap/app.php`: `AssignRequestId` middleware on api group; `render()` hook returns RFC 9457 Problem+JSON for `api/*` (Validation 422, `ProblemJsonException`, 404, 403)
- [x] Pest feature suite (`tests/Feature/Api/V1/SlideApiTest`) — X-Request-ID, config, list, html, save+audit, 409 conflict, 422, duplicate, reorder; full gates pass (`pint`/`phpstan`/`pest`/`catraca` 8/8)
- Not yet built (deferred): `GET /api/compatibility`, `POST /api/assets`, `POST /api/select-folder`, `/presentations/{id}` Inertia view, auth.

### Phase 3 — Editor shell (React + Inertia + shadcn)
- [ ] `AppShell` grid layout component (`grid-template-columns: 304px 1fr 352px`) with collapsible sidebar/inspector (persisted to localStorage)
- [ ] `Topbar`:
  - Brand block + deck label + runtime badge (`Badge`)
  - Segmented tabs (`Tabs`/`ToggleGroup`): Apresentação | Modelos
  - Folder paths popover (`Popover` with two `Input` + "Abrir" button)
  - Help button → `Dialog` (help modal content)
  - Action row: preview (`Button` ghost, opens iframe in new tab), reload (`Button` icon), save (`Button` with dark gradient variant, disabled until dirty), inspector toggle (`Button` icon)
- [ ] `Sidebar`:
  - Panel head (`Card`-like): title, count, view toggle (`Button` icon)
  - Source note (`Alert`/`Card` variants per state: web/folder/samples/warn)
  - Compatibility panel (`Card`): summary chips, rescan, collapse, per-current-slide list
  - Slide list: `SlideCard` component with thumbnail iframe (scaled), number badge, title, filename; drag-to-reorder (dnd-kit or native draggable); active highlight
  - Sidebar dock: duplicate-slide input + button
- [ ] `Workspace`:
  - Floating toolbar (`ButtonGroup`): undo, redo, |, copy, cut, paste, |, delete (danger) + crumb (`badge`) + zoom group (out, value, in, |, fit)
  - `PreviewStage` with `PreviewFrame` (1600×900) hosting the slide iframe; click-to-select via postMessage / injected editor bridge
  - Status bar: status icon + text (`Badge`) + dirty badge
- [ ] `Inspector`:
  - Tabs: Propriedades | Camadas
  - Properties: shadcn `Accordion` for each collapsible section; inputs use `Input`, `Select`, `ColorPicker`(shadcn or custom), `Button`
  - Layers: z-order buttons (`ButtonGroup`) + `LayerList` (`Command`-like list with rows)

### Phase 4 — Slide editing engine (the core)
- [ ] **Editor bridge**: inject a JS bridge into the slide iframe on load; bridge handles selection, drag-move, resize handles, contenteditable toggle, context menu; posts messages (selection change, element info, dirty) to parent
- [ ] **Selection model** in React state: `selectedElement`, `selectedElements[]`, `editingOnCanvas`, `dirty`, `clipboard`
- [ ] **History**: undo/redo stack (snapshots of slide body HTML); push on every mutation; limits (60 entries / 24MB)
- [ ] **Drag/resize**: pointer-event handlers in bridge; on drag end, post new x/y/w/h → React updates slide DOM via bridge commands
- [ ] **Text editing**: inline contenteditable via bridge; textarea in inspector mirrors selection; bold/italic/list toggle; "select parent" command
- [ ] **Position & size** binding: X/Y/W/H inputs ↔ selected element style; nudge buttons move by step
- [ ] **Typography** binding: font-family select (web-safe list + deck fonts), size, line-height, letter-spacing, opacity
- [ ] **Color & background**: text color, fill color (color input + hex text), gradient/image text field (writes `background` shorthand)
- [ ] **Shape**: border radius, border width, border style, border color, box-shadow; "use as image placeholder" action
- [ ] **Media**: image src input (path or data-url), replace (file input → upload via `/api/assets` → assign src), clear, fit cover/contain (object-fit)
- [ ] **Icon**: add/remove inline SVG icon inside selected element
- [ ] **Table**: detect table cell selection; add/remove rows/cols; move row/col; row-height & col-width fields
- [ ] **Actions**: group/ungroup (wrap/unwrap `<div data-g4-group>`), make absolute (position:absolute), lift to slide (append to `.slide` root)
- [ ] **Clear formatting**: strip inline styles on selected element
- [ ] **Context menu** (right-click on canvas): cut/copy/paste/duplicate/delete/bring forward/send backward/group/ungroup
- [ ] **Keyboard shortcuts**: undo/redo (Cmd/Ctrl+Z / Shift+Z), copy/cut/paste (Cmd/Ctrl+C/X/V), delete (Del), arrow-key nudge, escape to deselect, enter to edit text

### Phase 5 — Commands & persistence
- [ ] Slide save flow: diff current HTML vs saved snapshot → enable Save button → POST `/api/slides/{id}` with html + revision; update `savedSnapshotKey`; disable Save; revise revision history
- [ ] **Auto-save**: while dirty, debounced timer (e.g. every 5s after last edit, configurable) POSTs the slide HTML to `/api/slides/{id}`; shows "Salvando…" / "Salvo" status; manual Save forces immediate flush. Never loses work.
- [ ] Duplicate slide: input name → POST `/api/slides/{id}/duplicate` → refresh list → select new slide
- [ ] Reorder slides: drag or Alt+Arrow → POST `/api/reorder` → refresh
- [ ] Reload slide: re-fetch HTML, restore savedSnapshotKey, clear history, reset dirty
- [ ] Preview in new tab: open `/api/slides/{id}/html` in new window
- [ ] Templates mode: switch root → list templates; "copy template to deck" action

### Phase 6 — AI generation integration (hook)
- [ ] `generate` command/service stub: accept prompt → (external AI provider) → produce slide HTML list → store as `slides` → redirect into editor
- [ ] The editor opens with the generated slides, user tweaks manually (the editor flow built in Phase 3–5)
- [ ] Guard the editor with auth; per-user presentation ownership

### Phase 7 — Polish & QA
- [ ] Responsive breakpoints (collapse panels below 1240px / 1179px / 980px) matching reference media queries
- [ ] Accessibility: tablist keyboard nav, focus-visible rings, aria-labels on icon buttons, inert on collapsed panels
- [ ] Browser-compat banner (Safari warning) — informational in our app
- [ ] Toast notifications for save/duplicate/error (shadcn `Sonner`)
- [ ] Dark mode support (shadcn themes)
- [ ] Tests: Pest feature tests for API; Vitest + React Testing Library for editor components; Playwright for end-to-end slide editing

## Status

| Phase | Status |
|-------|--------|
| 0 — Scaffold | Done |
| 1 — Domain model | Done |
| 2 — Backend API | Done (versioned `/api/v1` endpoints on real DB models + audit + Problem+JSON; gates 8/8) |
| 3 — Editor shell | Partial (responsive shell + Topbar/Sidebar/Workspace/Inspector built with shadcn; panels wired but not yet bound to editing engine) |
| 4 — Editing engine | Not started |
| 5 — Persistence | Not started |
| 6 — AI hook | Not started |
| 7 — Polish & QA | Not started |
