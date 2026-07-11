<?php

use App\Enums\Sharing\PresentationRole;
use App\Models\Presentation;
use App\Models\Team;
use App\Models\User;
use App\Policies\PresentationPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makePolicyPresentation(?User $owner = null): array
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

test('owner can view, edit, share, and delete', function () {
    [$owner, $team, $presentation] = makePolicyPresentation();
    $policy = new PresentationPolicy;

    expect($policy->view($owner, $presentation))->toBeTrue();
    expect($policy->edit($owner, $presentation))->toBeTrue();
    expect($policy->share($owner, $presentation))->toBeTrue();
    expect($policy->delete($owner, $presentation))->toBeTrue();
});

test('editor can view and edit but not share or delete', function () {
    [$owner, $team, $presentation] = makePolicyPresentation();
    $editor = User::factory()->create();
    $team->members()->attach($editor, ['role' => 'member']);
    $presentation->sharedUsers()->attach($editor->id, ['role' => PresentationRole::Editor, 'shared_by' => $owner->id]);

    $policy = new PresentationPolicy;

    expect($policy->view($editor, $presentation))->toBeTrue();
    expect($policy->edit($editor, $presentation))->toBeTrue();
    expect($policy->share($editor, $presentation))->toBeFalse();
    expect($policy->delete($editor, $presentation))->toBeFalse();
});

test('viewer can view only', function () {
    [$owner, $team, $presentation] = makePolicyPresentation();
    $viewer = User::factory()->create();
    $team->members()->attach($viewer, ['role' => 'member']);
    $presentation->sharedUsers()->attach($viewer->id, ['role' => PresentationRole::Viewer, 'shared_by' => $owner->id]);

    $policy = new PresentationPolicy;

    expect($policy->view($viewer, $presentation))->toBeTrue();
    expect($policy->edit($viewer, $presentation))->toBeFalse();
    expect($policy->share($viewer, $presentation))->toBeFalse();
    expect($policy->delete($viewer, $presentation))->toBeFalse();
});

test('a user without any share cannot view', function () {
    [$owner, $team, $presentation] = makePolicyPresentation();
    $stranger = User::factory()->create();

    $policy = new PresentationPolicy;

    expect($policy->view($stranger, $presentation))->toBeFalse();
    expect($policy->edit($stranger, $presentation))->toBeFalse();
    expect($policy->share($stranger, $presentation))->toBeFalse();
    expect($policy->delete($stranger, $presentation))->toBeFalse();
});
