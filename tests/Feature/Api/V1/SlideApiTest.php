<?php

use App\Enums\Slide\SourceMode;
use App\Models\AuditLog;
use App\Models\Presentation;
use App\Models\Slide;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function seedPresentation(): Presentation
{
    $user = User::factory()->create();

    $presentation = Presentation::create([
        'user_id' => $user->id,
        'title' => 'Demo',
        'slug' => 'demo-'.uniqid(),
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);

    Slide::create(['presentation_id' => $presentation->id, 'filename' => '01-a.html', 'title' => 'A', 'position' => 1, 'source_mode' => SourceMode::Deck]);
    Slide::create(['presentation_id' => $presentation->id, 'filename' => '02-b.html', 'title' => 'B', 'position' => 2, 'source_mode' => SourceMode::Deck]);

    return $presentation;
}

test('every api response carries an X-Request-ID header', function () {
    $response = $this->getJson('/api/v1/config');

    $response->assertOk();
    expect($response->headers->get('X-Request-ID'))->not->toBeNull();
});

test('GET /api/v1/config returns editor config', function () {
    $this->getJson('/api/v1/config')
        ->assertOk()
        ->assertJsonStructure(['mode', 'deckRoot', 'templateRoot', 'deckAvailable', 'templatesAvailable']);
});

test('GET /api/v1/slides lists deck slides from the database', function () {
    seedPresentation();

    $this->getJson('/api/v1/slides?root=deck')
        ->assertOk()
        ->assertJsonPath('using_samples', false)
        ->assertJsonCount(2, 'slides')
        ->assertJsonPath('slides.0.file', '01-a.html');
});

test('GET /api/v1/slides/html returns the stored html', function () {
    $p = seedPresentation();
    $slide = $p->slides()->where('filename', '01-a.html')->first();
    $slide->update(['html' => '<section class="slide">Hello</section>']);

    $this->get('/api/v1/slides/html?file=01-a.html')
        ->assertOk()
        ->assertSee('<section class="slide">Hello</section>', false);
});

test('POST /api/v1/slides/{file} saves html, writes an audit record, and returns the new revision', function () {
    seedPresentation();

    $response = $this->postJson('/api/v1/slides/01-a.html', [
        'html' => '<section class="slide">Updated</section>',
        'revision' => 'rev-1',
    ]);

    $response->assertOk();
    expect($response->json('revision'))->not->toBe('rev-1');

    expect(Slide::where('filename', '01-a.html')->first()->html)->toBe('<section class="slide">Updated</section>');
    expect(AuditLog::where('event', 'slide.saved')->count())->toBe(1);
});

test('POST save with a stale revision and overwrite=false returns 409 Problem+JSON', function () {
    seedPresentation();

    $this->postJson('/api/v1/slides/01-a.html', ['html' => 'v1', 'revision' => 'rev-1'])->assertOk();
    // Simulate a concurrent save that advanced the stored revision.
    Slide::where('filename', '01-a.html')->update(['revision' => 'rev-concurrent']);
    // Client still holds the stale 'rev-1'.
    $this->postJson('/api/v1/slides/01-a.html', ['html' => 'v2', 'revision' => 'rev-1'])
        ->assertStatus(409)
        ->assertJsonPath('status', 409)
        ->assertJsonPath('title', 'Conflito')
        ->assertJsonStructure(['type', 'title', 'status', 'detail', 'instance']);
});

test('POST save missing html returns 422 Problem+JSON with errors', function () {
    seedPresentation();

    $this->postJson('/api/v1/slides/01-a.html', [])
        ->assertStatus(422)
        ->assertJsonPath('status', 422)
        ->assertJsonStructure(['type', 'title', 'status', 'detail', 'instance', 'errors']);
});

test('POST /api/v1/slides/{file}/duplicate creates a copy and audits it', function () {
    seedPresentation();

    $response = $this->postJson('/api/v1/slides/01-a.html/duplicate', [
        'filename' => '03-c.html',
        'title' => 'C',
    ]);

    $response->assertCreated();
    expect(Slide::where('filename', '03-c.html')->exists())->toBeTrue();
    expect(AuditLog::where('event', 'slide.duplicated')->count())->toBe(1);
});

test('POST /api/v1/reorder persists slide positions', function () {
    $p = seedPresentation();

    $this->postJson('/api/v1/reorder', [
        'presentation_id' => $p->id,
        'order' => ['01-a.html' => 2, '02-b.html' => 1],
    ])->assertOk();

    expect(Slide::where('filename', '01-a.html')->first()->position)->toBe(2);
    expect(Slide::where('filename', '02-b.html')->first()->position)->toBe(1);
});
