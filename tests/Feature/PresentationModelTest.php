<?php

use App\Enums\Slide\SourceMode;
use App\Models\Presentation;
use App\Models\Slide;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('a presentation owns ordered slides ordered by position', function () {
    $user = User::factory()->create();
    $presentation = Presentation::create([
        'user_id' => $user->id,
        'title' => 'Demo',
        'slug' => 'demo-'.uniqid(),
    ]);

    $second = Slide::create([
        'presentation_id' => $presentation->id,
        'filename' => '02.html',
        'position' => 2,
    ]);
    $first = Slide::create([
        'presentation_id' => $presentation->id,
        'filename' => '01.html',
        'position' => 1,
    ]);

    expect($presentation->slides()->first()->id)->toBe($first->id)
        ->and($presentation->slides()->count())->toBe(2)
        ->and($presentation->slides()->get()[1]->id)->toBe($second->id);
});

test('a slide defaults to the deck source mode enum', function () {
    $slide = Slide::create([
        'presentation_id' => Presentation::create([
            'user_id' => User::factory()->create()->id,
            'title' => 'Demo',
            'slug' => 'demo-'.uniqid(),
        ])->id,
        'filename' => '01.html',
    ]);

    expect($slide->source_mode)->toBe(SourceMode::Deck)
        ->and($slide->source_mode)->toBeInstanceOf(SourceMode::class);
});

test('a slide can be flagged as a template source', function () {
    $slide = Slide::create([
        'presentation_id' => Presentation::create([
            'user_id' => User::factory()->create()->id,
            'title' => 'Demo',
            'slug' => 'demo-'.uniqid(),
        ])->id,
        'filename' => 'tpl.html',
        'source_mode' => SourceMode::Template,
    ]);

    expect($slide->source_mode)->toBe(SourceMode::Template);
});

test('presentation settings are cast to an array', function () {
    $presentation = Presentation::create([
        'user_id' => User::factory()->create()->id,
        'title' => 'Demo',
        'slug' => 'demo-'.uniqid(),
        'settings' => ['theme' => 'navy-gold'],
    ]);

    expect($presentation->settings)->toBe(['theme' => 'navy-gold']);
});

test('deleting a presentation cascades its slides', function () {
    $presentation = Presentation::create([
        'user_id' => User::factory()->create()->id,
        'title' => 'Demo',
        'slug' => 'demo-'.uniqid(),
    ]);
    Slide::create(['presentation_id' => $presentation->id, 'filename' => '01.html']);

    $presentation->delete();

    expect(Slide::count())->toBe(0);
});
