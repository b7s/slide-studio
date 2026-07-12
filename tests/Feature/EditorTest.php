<?php

use App\Models\Presentation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

test('a user with a team but no presentation sees the library page instead of a 403', function (): void {
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

    // The home page now shows the library, not the editor.
    $this->actingAs($user)
        ->get('/')
        ->assertOk();

    // No starter space is auto-created — the user must create one via the UI.
    expect(Presentation::query()->where('team_id', $team->id)->count())->toBe(0);
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
