<?php

use App\Enums\Slide\SourceMode;
use App\Models\Presentation;
use App\Models\Slide;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('duplicate from the bug report flow reproduces (422 if body has no title, 201 if it does)', function () {
    // Reproduce the exact scenario the user reported
    $user = User::factory()->create();
    $team = Team::create(['user_id' => $user->id, 'name' => 'X', 'personal' => true]);
    $team->members()->attach($user, ['role' => 'admin']);
    $user->update(['current_team_id' => $team->id]);

    $presentation = Presentation::create([
        'user_id' => $user->id,
        'team_id' => $team->id,
        'title' => 'T',
        'slug' => 'p-'.uniqid(),
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);

    Slide::create([
        'presentation_id' => $presentation->id, // equals the user's current_team_id's first presentation... wait, pres 10 belongs to team X, but we just created a new team
        'filename' => 'super-teste.html',
        'title' => 'Super teste',
        'position' => 0,
        'source_mode' => SourceMode::Deck,
    ]);

    $this->actingAs($user);

    // Case 1 — body has title → 201
    $response = $this->postJson(
        "/api/v1/slides/super-teste.html/duplicate?presentation_id={$presentation->id}",
        ['title' => 'Super teste (cópia)']
    );
    $response->assertCreated();

    // Case 2 — body has empty title → 422
    $response = $this->postJson(
        "/api/v1/slides/super-teste.html/duplicate?presentation_id={$presentation->id}",
        ['title' => '']
    );
    expect($response->status())->toBe(422);

    // Case 3 — body has whitespace-only title → 422
    $response = $this->postJson(
        "/api/v1/slides/super-teste.html/duplicate?presentation_id={$presentation->id}",
        ['title' => '   ']
    );
    expect($response->status())->toBe(422);

    // Case 4 — body is empty (no title) → 422
    $response = $this->postJson(
        "/api/v1/slides/super-teste.html/duplicate?presentation_id={$presentation->id}",
        []
    );
    expect($response->status())->toBe(422);
});
