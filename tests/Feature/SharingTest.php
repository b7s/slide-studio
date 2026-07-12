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

function makeTeamPresentation(?User $owner = null): array
{
    $owner ??= User::factory()->create();
    $team = Team::create([
        'user_id' => $owner->id,
        'name' => 'Test Team',
        'personal' => true,
    ]);
    $team->members()->attach($owner, ['role' => 'admin']);
    $owner->update(['current_team_id' => $team->id]);

    $presentation = Presentation::create([
        'user_id' => $owner->id,
        'team_id' => $team->id,
        'title' => 'Demo',
        'slug' => 'demo-'.uniqid(),
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);

    return [$owner, $team, $presentation];
}

test('owner can share a presentation with another user', function () {
    [$owner, $team, $presentation] = makeTeamPresentation();
    $other = User::factory()->create();
    $team->members()->attach($other, ['role' => 'member']);

    $this->actingAs($owner)
        ->putJson(route('api.v1.shares.update', [
            'presentation' => $presentation->slug,
            'user' => $other->id,
        ]), ['role' => 'editor'])
        ->assertOk()
        ->assertJsonPath('role', 'editor');

    expect(PresentationUser::query()->count())->toBe(1);
    expect(AuditLog::where('event', 'presentation.shared')->count())->toBe(1);
});

test('non-owner cannot share a presentation', function () {
    [$owner, $team, $presentation] = makeTeamPresentation();
    $viewer = User::factory()->create();
    $team->members()->attach($viewer, ['role' => 'member']);
    $target = User::factory()->create();

    $this->actingAs($viewer)
        ->putJson(route('api.v1.shares.update', [
            'presentation' => $presentation->slug,
            'user' => $target->id,
        ]), ['role' => 'editor'])
        ->assertStatus(403);
});

test('owner can change a share role', function () {
    [$owner, $team, $presentation] = makeTeamPresentation();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => 'member']);

    $this->actingAs($owner)
        ->putJson(route('api.v1.shares.update', [
            'presentation' => $presentation->slug,
            'user' => $user->id,
        ]), ['role' => 'editor'])
        ->assertOk();

    $this->actingAs($owner)
        ->putJson(route('api.v1.shares.update', [
            'presentation' => $presentation->slug,
            'user' => $user->id,
        ]), ['role' => 'viewer'])
        ->assertOk()
        ->assertJsonPath('role', 'viewer');
});

test('owner can remove a share', function () {
    [$owner, $team, $presentation] = makeTeamPresentation();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => 'member']);
    $this->actingAs($owner)->putJson(route('api.v1.shares.update', [
        'presentation' => $presentation->slug,
        'user' => $user->id,
    ]), ['role' => 'viewer'])->assertOk();

    $this->actingAs($owner)
        ->deleteJson(route('api.v1.shares.destroy', [
            'presentation' => $presentation->slug,
            'user' => $user->id,
        ]))
        ->assertOk()
        ->assertJsonPath('ok', true);

    expect(PresentationUser::query()->count())->toBe(0);
    expect(AuditLog::where('event', 'presentation.unshared')->count())->toBe(1);
});

test('shares index returns all current shares for a presentation', function () {
    [$owner, $team, $presentation] = makeTeamPresentation();
    $userA = User::factory()->create();
    $userB = User::factory()->create();
    $team->members()->attach($userA, ['role' => 'member']);
    $team->members()->attach($userB, ['role' => 'member']);

    $this->actingAs($owner)->putJson(route('api.v1.shares.update', [
        'presentation' => $presentation->slug, 'user' => $userA->id,
    ]), ['role' => 'editor'])->assertOk();

    $this->actingAs($owner)->putJson(route('api.v1.shares.update', [
        'presentation' => $presentation->slug, 'user' => $userB->id,
    ]), ['role' => 'viewer'])->assertOk();

    $this->actingAs($owner)
        ->getJson(route('api.v1.shares.index', ['presentation' => $presentation->slug]))
        ->assertOk()
        ->assertJsonCount(2, 'shares');
});

test('users search spans every team, not just the current one', function () {
    [$owner, $team, $presentation] = makeTeamPresentation();
    $teammate = User::factory()->create(['name' => 'Alice Doe']);
    $outsider = User::factory()->create(['name' => 'Bob Outsider']);
    $team->members()->attach($teammate, ['role' => 'member']);

    $this->actingAs($owner)
        ->getJson(route('api.v1.users.search', ['q' => 'Doe']))
        ->assertOk()
        ->assertJsonCount(1, 'users')
        ->assertJsonPath('users.0.id', $teammate->id);

    // The outsider belongs to a different team but is still discoverable
    // because sharing is now cross-team.
    $this->actingAs($owner)
        ->getJson(route('api.v1.users.search', ['q' => 'Outsider']))
        ->assertOk()
        ->assertJsonCount(1, 'users')
        ->assertJsonPath('users.0.id', $outsider->id);

    // The owner never sees themselves in the results.
    $this->actingAs($owner)
        ->getJson(route('api.v1.users.search', ['q' => $owner->name]))
        ->assertJsonCount(0, 'users');
});

test('an owner can grant a presentation to a user from another team', function () {
    [$owner, $team, $presentation] = makeTeamPresentation();

    $otherTeam = Team::create([
        'user_id' => $owner->id,
        'name' => 'Other Team',
        'slug' => 'other-'.Str::random(6),
        'personal' => false,
    ]);
    $outsider = User::factory()->create(['name' => 'Carol Cross']);
    $otherTeam->members()->attach($outsider, ['role' => 'member']);
    $outsider->update(['current_team_id' => $otherTeam->id]);

    $this->actingAs($owner)
        ->putJson(route('api.v1.shares.update', [
            'presentation' => $presentation->slug, 'user' => $outsider->id,
        ]), ['role' => 'editor'])
        ->assertOk()
        ->assertJsonPath('role', 'editor');

    // The pivot records which team the grantee belongs to.
    $share = PresentationUser::query()
        ->where('presentation_id', $presentation->id)
        ->where('user_id', $outsider->id)
        ->first();
    expect($share)->not->toBeNull();
    expect($share->team_id)->toBe($otherTeam->id);

    // The cross-team user can now open the editor (the controller allows
    // access via the shared pivot regardless of team).
    $this->actingAs($outsider)
        ->get(route('editor', ['presentation' => $presentation->slug]))
        ->assertOk();
});

test('invalid role returns 422 Problem+JSON', function () {
    [$owner, $team, $presentation] = makeTeamPresentation();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => 'member']);

    $this->actingAs($owner)
        ->putJson(route('api.v1.shares.update', [
            'presentation' => $presentation->slug, 'user' => $user->id,
        ]), ['role' => 'gibberish'])
        ->assertStatus(422)
        ->assertJsonPath('status', 422);
});

test('PresentationRole helpers express correct privileges', function () {
    expect(PresentationRole::Owner->canWrite())->toBeTrue();
    expect(PresentationRole::Owner->canShare())->toBeTrue();
    expect(PresentationRole::Owner->canDelete())->toBeTrue();

    expect(PresentationRole::Editor->canWrite())->toBeTrue();
    expect(PresentationRole::Editor->canShare())->toBeFalse();
    expect(PresentationRole::Editor->canDelete())->toBeFalse();

    expect(PresentationRole::Viewer->canWrite())->toBeFalse();
    expect(PresentationRole::Viewer->canShare())->toBeFalse();
    expect(PresentationRole::Viewer->canDelete())->toBeFalse();
});
