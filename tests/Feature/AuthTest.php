<?php

use App\Models\Presentation;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('a guest is redirected from the editor to the login page', function () {
    $this->get('/')->assertRedirect('/login');
});

test('a guest can view the login page', function () {
    $this->get('/login')->assertOk();
});

test('a guest can view the register page', function () {
    $this->get('/register')->assertOk();
});

test('a new user is registered with a personal team and current_team_id set', function () {
    $response = $this->post('/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'Sup3rSecret!',
        'password_confirmation' => 'Sup3rSecret!',
    ]);

    $response->assertSessionHasNoErrors();
    $this->assertAuthenticated();

    $user = User::query()->where('email', 'jane@example.com')->first();
    expect($user)->not->toBeNull();
    expect($user->current_team_id)->not->toBeNull();

    $team = Team::query()->where('user_id', $user->id)->first();
    expect($team)->not->toBeNull();
    expect($team->personal)->toBeTrue();
    expect($team->members)->toHaveCount(1);
    expect($team->members->first()->id)->toBe($user->id);

    // A starter "space" is created so the editor never 403s on first login.
    $presentation = Presentation::query()->where('team_id', $team->id)->first();
    expect($presentation)->not->toBeNull();
    expect($presentation->slides)->toHaveCount(1);
});

test('an authenticated user can log out', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/logout');

    $this->assertGuest();
});

test('a user can log in with valid credentials', function () {
    $user = User::factory()->create(['password' => 'Sup3rSecret!']);

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'Sup3rSecret!',
    ]);

    $this->assertAuthenticatedAs($user);
});

test('a user cannot log in with invalid credentials', function () {
    $user = User::factory()->create(['password' => 'Sup3rSecret!']);

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});
