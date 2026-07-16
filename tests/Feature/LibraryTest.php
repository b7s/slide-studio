<?php

use App\Enums\Sharing\PresentationRole;
use App\Models\Presentation;
use App\Models\Slide;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function makeLibraryUser(): array
{
    $user = User::factory()->create();
    $team = Team::create([
        'user_id' => $user->id,
        'name' => "{$user->name} Team",
        'slug' => 'team-'.Str::random(6),
        'personal' => true,
    ]);
    $team->members()->attach($user, ['role' => 'admin']);
    $user->update(['current_team_id' => $team->id]);

    return [$user, $team];
}

function makeLibraryPresentation(User $user, Team $team, string $title, ?string $cover = null): Presentation
{
    $presentation = Presentation::create([
        'user_id' => $user->id,
        'team_id' => $team->id,
        'title' => $title,
        'slug' => Str::slug($title).'-'.uniqid(),
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);

    if ($cover !== null) {
        Slide::create([
            'presentation_id' => $presentation->id,
            'position' => 0,
            'filename' => 'index.html',
            'html' => $cover,
        ]);
    }

    return $presentation;
}

test('library groups list personal space first then teams then shared', function (): void {
    [$user, $personal] = makeLibraryUser();

    $team = Team::create([
        'user_id' => $user->id,
        'name' => 'Marketing',
        'slug' => 'marketing-'.Str::random(6),
        'personal' => false,
    ]);
    $team->members()->attach($user, ['role' => 'admin']);

    [$other, $otherTeam] = makeLibraryUser();
    $shared = makeLibraryPresentation($other, $otherTeam, 'Shared Deck', '<h1>hi</h1>');
    $shared->sharedUsers()->attach($user->id, ['role' => PresentationRole::Viewer->value]);

    makeLibraryPresentation($user, $personal, 'Alpha Deck', '<h1>alpha</h1>');
    makeLibraryPresentation($user, $team, 'Beta Deck');

    $this->actingAs($user)
        ->getJson(route('api.v1.library.groups'))
        ->assertOk()
        ->assertJsonCount(3, 'groups')
        ->assertJsonPath('groups.0.key', 'personal')
        ->assertJsonPath('groups.0.count', 1)
        ->assertJsonPath('groups.1.key', 'team')
        ->assertJsonPath('groups.1.count', 1)
        ->assertJsonPath('groups.2.key', 'shared')
        ->assertJsonPath('groups.2.count', 1);
});

test('personal group lists owned presentations with cover and role', function (): void {
    [$user, $personal] = makeLibraryUser();
    makeLibraryPresentation($user, $personal, 'My Deck', '<h1>hi</h1>');

    $this->actingAs($user)
        ->getJson(route('api.v1.library.index', ['group' => 'personal']))
        ->assertOk()
        ->assertJsonPath('presentations.0.title', 'My Deck')
        ->assertJsonPath('presentations.0.role', 'owner')
        ->assertJsonPath('presentations.0.cover_html', '<h1>hi</h1>')
        ->assertJsonPath('pagination.total', 1);
});

test('search filters presentations by title', function (): void {
    [$user, $personal] = makeLibraryUser();
    makeLibraryPresentation($user, $personal, 'Apple Deck');
    makeLibraryPresentation($user, $personal, 'Banana Deck');

    $this->actingAs($user)
        ->getJson(route('api.v1.library.index', ['group' => 'personal', 'q' => 'Apple']))
        ->assertOk()
        ->assertJsonPath('presentations.0.title', 'Apple Deck')
        ->assertJsonPath('pagination.total', 1);
});

test('sorting by name asc and desc works', function (): void {
    [$user, $personal] = makeLibraryUser();
    makeLibraryPresentation($user, $personal, 'Zebra');
    makeLibraryPresentation($user, $personal, 'Alpha');

    $asc = $this->actingAs($user)
        ->getJson(route('api.v1.library.index', ['group' => 'personal', 'sort' => 'name', 'dir' => 'asc']))
        ->assertOk()->json()['presentations'];
    expect($asc[0]['title'])->toBe('Alpha');

    $desc = $this->actingAs($user)
        ->getJson(route('api.v1.library.index', ['group' => 'personal', 'sort' => 'name', 'dir' => 'desc']))
        ->assertOk()->json()['presentations'];
    expect($desc[0]['title'])->toBe('Zebra');
});

test('shared group lists only decks shared with the user', function (): void {
    [$user, $personal] = makeLibraryUser();
    $other = User::factory()->create();
    $otherTeam = Team::create([
        'user_id' => $other->id,
        'name' => "{$other->name} Team",
        'slug' => 'other-'.Str::random(6),
        'personal' => true,
    ]);
    $otherTeam->members()->attach($other, ['role' => 'admin']);

    $shared = Presentation::create([
        'user_id' => $other->id,
        'team_id' => $otherTeam->id,
        'title' => 'Shared With Me',
        'slug' => 'shared-'.uniqid(),
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);
    $shared->sharedUsers()->attach($user->id, ['role' => PresentationRole::Editor->value]);

    $this->actingAs($user)
        ->getJson(route('api.v1.library.index', ['group' => 'shared']))
        ->assertOk()
        ->assertJsonPath('presentations.0.title', 'Shared With Me')
        ->assertJsonPath('presentations.0.role', 'editor')
        ->assertJsonPath('presentations.0.shared', true);
});

test('user without membership on a team receives 403', function (): void {
    [$user, $personal] = makeLibraryUser();
    $stranger = User::factory()->create();
    $strangerTeam = Team::create([
        'user_id' => $stranger->id,
        'name' => 'Stranger',
        'slug' => 'stranger-'.Str::random(6),
        'personal' => false,
    ]);

    $this->actingAs($user)
        ->getJson(route('api.v1.library.index', ['group' => 'team', 'team_id' => $strangerTeam->id]))
        ->assertForbidden();
});

test('creating a presentation without a team uses the personal space', function (): void {
    [$user, $personal] = makeLibraryUser();

    $response = $this->actingAs($user)
        ->postJson(route('api.v1.library.store'), ['title' => null])
        ->assertCreated();

    $expectedPrefix = __('messages.presentation.untitled').' '.now()->format('Y-m-d');
    expect($response->json('title'))->toBe($expectedPrefix);

    expect(Presentation::query()->where('team_id', $personal->id)->count())->toBe(1);
});

test('creating a presentation seeds exactly one starter slide', function (): void {
    [$user] = makeLibraryUser();

    $response = $this->actingAs($user)
        ->postJson(route('api.v1.library.store'), ['title' => 'Project Alpha'])
        ->assertCreated()
        ->assertJsonPath('title', 'Project Alpha');

    $presentationId = $response->json('id');
    expect(Slide::query()->where('presentation_id', $presentationId)->count())->toBe(1);
    expect(Slide::query()->where('presentation_id', $presentationId)->first()->filename)->toBe('01-capa.html');
});

test('creating a presentation appends a number when the title already exists in the team', function (): void {
    [$user] = makeLibraryUser();

    $this->actingAs($user)->postJson(route('api.v1.library.store'), ['title' => 'Q3 Roadmap'])->assertCreated();
    $second = $this->actingAs($user)->postJson(route('api.v1.library.store'), ['title' => 'Q3 Roadmap'])->assertCreated();
    expect($second->json('title'))->toBe('Q3 Roadmap 2');

    $third = $this->actingAs($user)->postJson(route('api.v1.library.store'), ['title' => 'Q3 Roadmap'])->assertCreated();
    expect($third->json('title'))->toBe('Q3 Roadmap 3');
});

test('default title with the date is suffixed on collision within the same day', function (): void {
    [$user] = makeLibraryUser();

    $expectedToday = sprintf('%s %s', __('messages.presentation.untitled'), now()->format('Y-m-d'));
    // First call picks the base default title (no collision in a fresh team).
    $first = $this->actingAs($user)->postJson(route('api.v1.library.store'), ['title' => null])->assertCreated();
    expect($first->json('title'))->toBe($expectedToday);

    // A second call on the same day collides with the first and is suffixed.
    $second = $this->actingAs($user)->postJson(route('api.v1.library.store'), ['title' => null])->assertCreated();
    expect($second->json('title'))->toBe($expectedToday.' 2');
});

test('creating a presentation in a team the user belongs to works', function (): void {
    [$user, $personal] = makeLibraryUser();
    $team = Team::create([
        'user_id' => $user->id,
        'name' => 'Project',
        'slug' => 'project-'.Str::random(6),
        'personal' => false,
    ]);
    $team->members()->attach($user, ['role' => 'admin']);

    $this->actingAs($user)
        ->postJson(route('api.v1.library.store'), ['title' => 'Team Deck', 'team_id' => $team->id])
        ->assertCreated()
        ->assertJsonPath('title', 'Team Deck');

    expect(Presentation::query()->where('team_id', $team->id)->count())->toBe(1);
});

test('unauthenticated user cannot reach the library', function (): void {
    $this->getJson(route('api.v1.library.groups'))->assertUnauthorized();
    $this->get(route('library'))->assertRedirect();
});
