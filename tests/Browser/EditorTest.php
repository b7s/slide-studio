<?php

use App\Enums\Slide\SourceMode;
use App\Models\Presentation;
use App\Models\Slide;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

/**
 * End-to-end browser coverage for the editor (Pest Browser / Playwright).
 * The Laravel HTTP server runs in-process, so it shares this test's
 * in-memory SQLite database — the real `database/database.sqlite` is never
 * touched. Every string is resolved through Laravel's `__()` helper (the
 * same pt_BR source the UI renders) so the assertions stay locale-safe and
 * survive copy changes. URLs use named routes where available.
 */
function seedEditorFor(User $user): void
{
    $team = Team::query()->create([
        'user_id' => $user->id,
        'name' => "{$user->name} Team",
        'slug' => 'team-'.Str::random(6),
        'personal' => true,
    ]);
    $team->members()->attach($user->id, ['role' => 'admin']);
    $user->update(['current_team_id' => $team->id]);

    $presentation = Presentation::query()->create([
        'user_id' => $user->id,
        'team_id' => $team->id,
        'title' => 'Demo Deck',
        'slug' => 'demo-deck',
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);

    Slide::query()->create([
        'presentation_id' => $presentation->id,
        'position' => 1,
        'filename' => '01-capa.html',
        'title' => 'Capa',
        'html' => '<section><h1>Capa</h1></section>',
        'source_mode' => SourceMode::Deck,
    ]);
}

test('guests are redirected from the editor to the login screen', function (): void {
    $this->visit(route('login'))
        ->assertSee('Slide Studio')
        ->assertSee(__('messages.auth.email'));
});

test('an authenticated user can open the editor', function (): void {
    $user = User::factory()->create();
    seedEditorFor($user);

    $this->visit(route('login'))
        ->type('#email', $user->email)
        ->type('#password', 'password')
        ->click('button[type=submit]')
        ->waitForText(__('messages.root.deck'))
        ->assertSee(__('messages.root.deck'))
        // Sidebar + Inspector inline panels render at the default (xl) width.
        ->assertSee(__('messages.sidebar.title'))
        ->assertSee(__('messages.inspector.tab_props'));
});

test('the editor collapses the sidebar below the lg breakpoint', function (): void {
    $user = User::factory()->create();
    seedEditorFor($user);

    $this->visit(route('login'))
        ->type('#email', $user->email)
        ->type('#password', 'password')
        ->click('button[type=submit]')
        ->waitForText(__('messages.root.deck'))
        // Narrow viewport (mobile): the inline sidebar is hidden, reachable
        // only via the drawer sheet, so the slide list leaves the DOM.
        ->resize(360, 740)
        ->assertDontSee(__('messages.sidebar.title'));
});

/**
 * Responsive contract across the five canonical widths (360 / 640 / 1024 / 1366
 * / 1920). The inline sidebar is visible at `lg`+ (1024) and the inline
 * inspector at `xl`+ (1280); below those they collapse into drawers and drop
 * out of the DOM. Strings are resolved via `__()` to stay locale-safe.
 *
 * @dataProvider array<int, array{0: int, 1: bool, 2: bool}>
 */
test('editor panels adapt across the responsive breakpoints', function (int $width, bool $sidebarVisible, bool $inspectorVisible): void {
    $user = User::factory()->create();
    seedEditorFor($user);

    $browser = $this->visit(route('login'))
        ->type('#email', $user->email)
        ->type('#password', 'password')
        ->click('button[type=submit]')
        ->waitForText(__('messages.root.deck'))
        ->resize($width, 820)
        ->assertSee(__('messages.root.deck'));

    $browser->{$sidebarVisible ? 'assertSee' : 'assertDontSee'}(__('messages.sidebar.title'));
    $browser->{$inspectorVisible ? 'assertSee' : 'assertDontSee'}(__('messages.inspector.tab_props'));
})->with([
    [360, false, false],
    [640, false, false],
    [1024, true, false],
    [1366, true, true],
    [1920, true, true],
]);
