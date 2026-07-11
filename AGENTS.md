# AGENTS.md

Compact guidance for agents working in this repo. Read `progress.md` for the phase roadmap.

## Stack (versions matter)
- Laravel 13 (PHP 8.4). **Backend follows the `laravel-statecraft` skill** (Bounded Contexts + State Machines + Job Orchestration) for ALL backend changes.
- **Testing is Pest** (not PHPUnit) for the backend — `phpunit.xml` is replaced by Pest config; `./vendor/bin/pest` is the runner. Frontend uses Vitest/RTL/Playwright.
- Inertia 3 + React 19 + Vite 8. Frontend is **all React**; the only Blade file is `resources/views/app.blade.php` (Inertia root view named `app`).
- Tailwind v4 + hand-built shadcn-style components. No `components.json`.
- DB: **SQLite** for dev (`database/database.sqlite`), PostgreSQL later — same schema, just change `DB_CONNECTION`. No migration changes expected.
- `b7s/catraca` (dev dependency) is the quality gate. Run `vendor/bin/catraca`.

## Setup & running
- Full setup once: `composer setup` (installs PHP + JS deps, generates key, migrates, builds).
- Dev (full app needs BOTH servers): `composer dev` runs `php artisan serve` + queue + pail + `npm run dev` together. `npm run dev` alone only starts Vite; without `php artisan serve` the page won't load.
- Frontend build / single check: `npm run build`.

## Testing
- Backend: **Pest** — `./vendor/bin/pest` (or `./vendor/bin/pest --parallel`). Run `php artisan pest:install` once if config is missing.
- `composer test` clears config then runs the test suite (uses in-memory SQLite, `SESSION_DRIVER=array`).
- Single test: `./vendor/bin/pest tests/Feature/EditorTest.php` or `--filter=MethodName`.
- Frontend: Vitest + React Testing Library (`npm run test`), Playwright for e2e.
- **Database safety:** tests run on the dedicated in-memory test DB only; never against dev/prod. `DB_CONNECTION` in testing points to a separate DB.

## Backend architecture — laravel-statecraft (authoritative for backend)

For every backend change, apply the skill's patterns. Summary of the mandatory rules:

### 1. Bounded Contexts first
- Each context owns its own Eloquent model, enum, and `Data` DTOs. Split before you share.
- Directory layout (no `app/Domain/`, no `app/ValueObjects/`):
  ```
  app/
  ├── Models/                     # Eloquent models with transition methods
  ├── Enums/{Context}/            # Status enums (one per context), with default()
  ├── Data/{Context}/             # Typed DTOs: input payloads + event data
  ├── Exceptions/                 # Typed domain exceptions
  ├── Actions/{Context}/          # One action per file, flat
  ├── Listeners/{Context}/        # Event listeners (start job chains)
  ├── Jobs/{Context}/             # Queued jobs for side effects
  ├── Services/{Context}/         # Orchestrator services (2+ operations)
  ├── Infrastructure/{Context}/ACL/  # Anti-Corruption Layer (rarely)
  └── Http/
      ├── Controllers/            # Single-action invokable where possible
      └── Requests/               # Form Requests only
  ```

### 2. State machines live in the model
- Enum for status with a `default()` method. Status checks ONLY in the model, never in controllers/services.
- Transition methods validate state, mutate, persist via `$this->save()`, and **return a Data DTO** (the domain event). No facades, no cross-context columns, no emails/API calls in transitions.

### 3. Events are facts; actions dispatch them
- Transitions return Data DTOs. The **Action** dispatches the event by default via `DB::afterCommit(fn () => event($data))` — the model does NOT dispatch.
- Every state-changing Action writes an **append-only audit record** inside `DB::transaction()` (via `Audit::record(...)`) BEFORE dispatching jobs/events.

### 4. Side effects belong to queued Jobs
- Email/SMS/API calls live in `Jobs/{Context}`. Use `Bus::chain()`, `Bus::batch()`, and `->delay()` for async. Listeners turn DTOs into job chains.

### 5. Request flow (convergent)
- HTTP → Route → **FormRequest** (validation) → Controller (`$request->payload()`).
- Simple path: Controller → Action → `Model.transition()` inside `DB::transaction()` → `Audit::record()` → `DB::afterCommit(event)` → response.
- Complex path: Controller → Service → multiple Actions (each with its own transaction/audit/afterCommit) → Service dispatches Jobs.
- Decision: 1 operation → Action; 2+ operations / workflow → Service; just a query → Action.

### 6. Validation & API contracts (mandatory)
- **Form Requests only** — never `$request->validate()` inline. Form Request returns 422 Problem+JSON automatically; controller reads `$request->payload()` (typed DTO).
- All API errors return **RFC 9457 Problem+JSON**. Domain exceptions map to informative 422s, not generic 500s.
- **All API routes versioned from day one:** `/api/v1/...` prefix.
- **`X-Request-ID` middleware** on every API route for request tracing.

### 7. Localization — every string via `__()` (mandatory)
- **Default language is `pt_BR`** (`config/app.php` `locale`; `en` is the fallback). All translation strings live in `lang/pt_BR/*.php`.
- **No hardcoded user-facing text anywhere.** Every visible string — UI labels, buttons, menu items, placeholders, toasts, modal copy, validation messages, and RFC 9457 Problem+JSON `title`/`detail` — MUST be defined in a language file and resolved with Laravel's `__()` helper (e.g. `__('messages.save')`). The same literal must never appear inline in PHP or JSX.
- **Backend:** use `__()` directly (controllers, Form Request `messages()`/`attributes()`, `ProblemJsonException` text, mail/jobs).
- **Frontend (React/Inertia):** UI strings are NOT hardcoded in `.jsx`. They are sourced from the `lang/pt_BR` files and exposed to the client (Inertia shared prop and/or a translation module that mirrors `lang/`), then read through a client `__()` wrapper. Do not introduce raw Portuguese/English literals into components.
- Keep keys namespaced by surface (`messages.*`, `validation.*`, `editor.*`, `inspector.*`, etc.). Add new keys to `lang/pt_BR`; provide `en` equivalents in `lang/en` for any key that needs an English fallback.

### Quality gates (run after every backend change)
```
./vendor/bin/pest --parallel
./vendor/bin/catraca
./vendor/bin/pint
./vendor/bin/phpstan analyse   # level 6
```
- Context isolation, transition ownership in models, side-effect purity, event explicitness, audit trail, transaction safety (`DB::afterCommit`), and API error consistency are all enforced by catraca + review.

## Architecture conventions (non-obvious — frontend/integration)
- Inertia pages live in `resources/js/Pages/**/*.jsx`, resolved by `import.meta.glob` in `resources/js/app.jsx`. Component path = Inertia name (e.g. `Editor/Index`).
- UI primitives: `resources/js/Components/ui/*.jsx` (shadcn-style, built on Radix + `cn` util). Editor-specific layout/logic: `resources/js/editor/*.jsx`; the responsive 3-column shell is `resources/js/editor/AppShell.jsx`.
- Backend returns `Inertia::render('Editor/Index', [...])` for pages and plain `response()->json()` for everything under `/api/*` (see `routes/web.php`). **New API endpoints must use `/api/v1/...`.**
- Slide canvas is an `<iframe>`; its HTML is served dynamically by `GET /api/v1/slides/html?file=...` (`EditorController`), NOT a static file. `sandbox="allow-same-origin allow-scripts"`.

## Gotchas
- **Sessions table is missing in Laravel 13's default migrations.** `.env` uses `SESSION_DRIVER=file` for this reason. Switching to `database` sessions will 500 until you add a `sessions` migration. (Tests already use `array`.)
- **Slides ARE persisted to DB** (Phase 1 + 2 done). `EditorController` serves real slides; `save()` is a real `Slide::saveContent()` transition (DB write + audit). Saved slides survive restart.
- **Save flow**: both manual Save and auto-save hit `POST /api/v1/slides/{file}` — same endpoint, `{ html, revision?, overwrite? }` payload. `Slide::saveContent()` returns `SlideSavedData`; on a stale `revision` with `overwrite:false` it throws a 409 `ProblemJsonException` (optimistic concurrency). Route key is `filename` (bound via `Route::bind('slide', ...)`).
- Lucide icon names here follow the current `lucide-react` (e.g. `PanelLeft`, `ChevronsUp`/`ChevronsDown`); `LayoutSidebar` and `ChevronBarUp/Down` do NOT exist in this version — build fails if used.
- `composer setup` runs `npm install --ignore-scripts`; if you need native build steps, run `npm install` separately.
- **Pest not PHPUnit:** backend tests use Pest. Do not add PHPUnit test classes for new backend features.
- **No hardcoded user-facing strings:** every visible string (backend + frontend) must go through a `lang/pt_BR` language file via `__()` — see section 7. Review rejects inline literals in PHP/JSX.

## Roadmap
`progress.md` tracks 8 phases. Phase 0 (scaffold) and most of Phase 3 (responsive editor shell) are done; Phase 1 (DB model), Phase 2 (full API), Phase 4 (iframe editing engine), Phase 5 (persistence), Phase 6 (AI hook), Phase 7 (QA) are pending. All Phase 1+ backend work follows the laravel-statecraft patterns above.
