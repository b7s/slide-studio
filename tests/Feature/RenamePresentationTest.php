<?php

use App\Enums\Sharing\PresentationRole;
use App\Models\AuditLog;
use App\Models\Presentation;
use App\Models\PresentationUser;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function makeRenamePresentationFixture(): array
{
    $owner = User::factory()->create();
    $team = Team::create([
        'user_id' => $owner->id,
        'name' => 'Rename Team',
        'slug' => 'rename-team-'.Str::random(6),
        'personal' => true,
    ]);
    $team->members()->attach($owner, ['role' => 'admin']);
    $owner->update(['current_team_id' => $team->id]);

    $presentation = Presentation::create([
        'user_id' => $owner->id,
        'team_id' => $team->id,
        'title' => 'Original',
        'slug' => 'original-'.Str::random(4),
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);

    return [$owner, $team, $presentation];
}

test('owner can rename a presentation', function () {
    [$owner, $team, $presentation] = makeRenamePresentationFixture();

    $this->actingAs($owner)
        ->putJson(route('api.v1.presentations.rename', ['presentation' => $presentation->slug]), ['title' => 'Renamed'])
        ->assertOk()
        ->assertJsonPath('title', 'Renamed');

    $this->assertDatabaseHas('presentations', [
        'id' => $presentation->id,
        'title' => 'Renamed',
    ]);
    expect(AuditLog::query()->where('event', 'presentation.renamed')->count())->toBe(1);
});

test('renaming regenerates the slug from the new title', function () {
    [$owner, , $presentation] = makeRenamePresentationFixture();

    $this->actingAs($owner)
        ->putJson(route('api.v1.presentations.rename', ['presentation' => $presentation->slug]), ['title' => 'New Title 2025'])
        ->assertOk();

    $present = Presentation::query()->findOrFail($presentation->id);
    expect($present->slug)->toStartWith('new-title-2025-');
    expect($present->slug)->not->toBe($presentation->slug);
});

test('rename collision within the team uses an incrementing suffix', function () {
    [$owner, $team, $first] = makeRenamePresentationFixture();

    // Pre-existing presentation in the team using the new name.
    Presentation::create([
        'user_id' => $owner->id,
        'team_id' => $team->id,
        'title' => 'Q3 Roadmap',
        'slug' => 'q3-roadmap-'.Str::random(4),
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);

    $response = $this->actingAs($owner)
        ->putJson(route('api.v1.presentations.rename', ['presentation' => $first->slug]), ['title' => 'Q3 Roadmap'])
        ->assertOk()
        ->assertJsonPath('title', 'Q3 Roadmap 2');

    expect($response->json('title'))->toBe('Q3 Roadmap 2');
    $renamed = Presentation::query()->where('title', 'Q3 Roadmap 2')->first();
    expect($renamed)->not->toBeNull();
});

test('whitespace-only title is rejected', function () {
    [$owner, , $presentation] = makeRenamePresentationFixture();

    $this->actingAs($owner)
        ->putJson(route('api.v1.presentations.rename', ['presentation' => $presentation->slug]), ['title' => '   '])
        ->assertStatus(422);
});

test('missing title is rejected', function () {
    [$owner, , $presentation] = makeRenamePresentationFixture();

    $this->actingAs($owner)
        ->putJson(route('api.v1.presentations.rename', ['presentation' => $presentation->slug]), [])
        ->assertStatus(422);
});

test('editor (non-owner) can rename a shared presentation', function () {
    [$owner, $team, $presentation] = makeRenamePresentationFixture();
    $editor = User::factory()->create();
    $team->members()->attach($editor, ['role' => 'member']);
    PresentationUser::create([
        'presentation_id' => $presentation->id,
        'user_id' => $editor->id,
        'role' => PresentationRole::Editor->value,
        'shared_by' => $owner->id,
        'team_id' => $team->id,
    ]);

    $this->actingAs($editor)
        ->putJson(route('api.v1.presentations.rename', ['presentation' => $presentation->slug]), ['title' => 'By Editor'])
        ->assertOk();

    $this->assertDatabaseHas('presentations', [
        'id' => $presentation->id,
        'title' => 'By Editor',
    ]);
});

test('viewer cannot rename a shared presentation', function () {
    [$owner, $team, $presentation] = makeRenamePresentationFixture();
    $viewer = User::factory()->create();
    $team->members()->attach($viewer, ['role' => 'member']);
    PresentationUser::create([
        'presentation_id' => $presentation->id,
        'user_id' => $viewer->id,
        'role' => PresentationRole::Viewer->value,
        'shared_by' => $owner->id,
        'team_id' => $team->id,
    ]);

    $this->actingAs($viewer)
        ->putJson(route('api.v1.presentations.rename', ['presentation' => $presentation->slug]), ['title' => 'Nope'])
        ->assertStatus(403);

    expect($presentation->fresh()->title)->toBe('Original');
});

test('outsider cannot rename a presentation', function () {
    [$owner, , $presentation] = makeRenamePresentationFixture();
    $stranger = User::factory()->create();

    $this->actingAs($stranger)
        ->putJson(route('api.v1.presentations.rename', ['presentation' => $presentation->slug]), ['title' => 'Hijack'])
        ->assertStatus(403);
});

test('unauthenticated cannot rename', function () {
    [, , $presentation] = makeRenamePresentationFixture();

    $this->putJson(route('api.v1.presentations.rename', ['presentation' => $presentation->slug]), ['title' => 'X'])
        ->assertUnauthorized();
});

test('collision does not collide against the presentation being renamed itself', function () {
    [$owner, , $presentation] = makeRenamePresentationFixture();

    // Renaming to its own current title should be a no-op (no suffix added),
    // because the exclusion clause skips the presentation being renamed.
    $this->actingAs($owner)
        ->putJson(route('api.v1.presentations.rename', ['presentation' => $presentation->slug]), ['title' => 'Original'])
        ->assertOk()
        ->assertJsonPath('title', 'Original');
});
