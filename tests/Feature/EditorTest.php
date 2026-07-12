<?php

use App\Models\Presentation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

test('a user with a team but no presentation is given a starter space instead of a 403', function (): void {
    // Mirrors a manually-provisioned account (e.g. created via tinker) that
    // has a personal team but no presentation yet.
    $user = User::factory()->create(['password' => Hash::make('Sup3rSecret!')]);
    $team = Team::query()->create([
        'user_id' => $user->id,
        'name' => "{$user->name} Team",
        'slug' => 'team-'.Str::random(6),
        'personal' => true,
    ]);
    $team->members()->attach($user->id, ['role' => 'admin']);
    $user->update(['current_team_id' => $team->id]);

    expect(Presentation::query()->where('team_id', $team->id)->count())->toBe(0);

    $this->actingAs($user)
        ->get('/') // no presentation yet → lazy starter space
        ->assertOk();

    $presentation = Presentation::query()->where('team_id', $team->id)->first();
    expect($presentation)->not->toBeNull();
    expect($presentation->slides)->toHaveCount(1);
});

test('a logged-in user can open the editor on first login', function (): void {
    $user = User::factory()->create(['password' => Hash::make('Sup3rSecret!')]);
    $team = Team::query()->create([
        'user_id' => $user->id,
        'name' => "{$user->name} Team",
        'slug' => 'team-'.Str::random(6),
        'personal' => true,
    ]);
    $team->members()->attach($user->id, ['role' => 'admin']);
    $user->update(['current_team_id' => $team->id]);

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'Sup3rSecret!',
    ]);

    $this->assertAuthenticatedAs($user);

    $this->get('/')->assertOk();
});
