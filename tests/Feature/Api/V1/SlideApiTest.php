<?php

use App\Enums\Slide\SourceMode;
use App\Models\AuditLog;
use App\Models\Presentation;
use App\Models\Slide;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function seedPresentation(): Presentation
{
    $user = User::factory()->create();
    $team = Team::create([
        'user_id' => $user->id,
        'name' => 'Test Team',
        'personal' => true,
    ]);
    $team->members()->attach($user, ['role' => 'admin']);
    $user->update(['current_team_id' => $team->id]);

    $presentation = Presentation::create([
        'user_id' => $user->id,
        'team_id' => $team->id,
        'title' => 'Demo',
        'slug' => 'demo-'.uniqid(),
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);

    Slide::create(['presentation_id' => $presentation->id, 'filename' => '01-a.html', 'title' => 'A', 'position' => 1, 'source_mode' => SourceMode::Deck]);
    Slide::create(['presentation_id' => $presentation->id, 'filename' => '02-b.html', 'title' => 'B', 'position' => 2, 'source_mode' => SourceMode::Deck]);

    test()->actingAs($user);

    return $presentation;
}

test('every api response carries an X-Request-ID header', function () {
    $this->actingAs(User::factory()->create());
    $response = $this->getJson('/api/v1/config');

    $response->assertOk();
    expect($response->headers->get('X-Request-ID'))->not->toBeNull();
});

test('GET /api/v1/config returns editor config', function () {
    $this->actingAs(User::factory()->create());
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

test('POST /api/v1/slides/{file}/copy-to-deck materialises a deck slide from a template', function () {
    $p = seedPresentation();

    $template = Slide::create([
        'presentation_id' => $p->id,
        'filename' => 'tmpl-x.html',
        'title' => 'Hero',
        'position' => 99,
        'source_mode' => SourceMode::Template,
        'html' => '<section class="slide">Template</section>',
    ]);

    $expectedPosition = (int) Slide::query()->where('presentation_id', $p->id)->max('position') + 1;

    $response = $this->postJson('/api/v1/slides/tmpl-x.html/copy-to-deck', [
        'presentation_id' => $p->id,
        'title' => 'My Hero',
    ]);

    $response->assertCreated();
    expect($response->json('data.file'))->toMatch('/\\.html$/');
    expect($response->json('data.title'))->toBe('My Hero');
    expect($response->json('data.source_mode'))->toBe(SourceMode::Deck->value);

    $copy = Slide::query()->where('filename', $response->json('data.file'))->first();
    expect($copy)->not->toBeNull();
    expect($copy->source_mode)->toBe(SourceMode::Deck);
    expect($copy->html)->toBe('<section class="slide">Template</section>');
    expect($copy->position)->toBe($expectedPosition);

    // The original template is untouched.
    expect(Slide::where('filename', 'tmpl-x.html')->first()->source_mode)->toBe(SourceMode::Template);

    expect(AuditLog::where('event', 'slide.copied_from_template')->count())->toBe(1);
});

test('POST /api/v1/slides/{file}/copy-to-deck requires a valid presentation_id', function () {
    $p = seedPresentation();

    Slide::create([
        'presentation_id' => $p->id,
        'filename' => 'tmpl-y.html',
        'title' => 'Hero',
        'position' => 99,
        'source_mode' => SourceMode::Template,
    ]);

    $this->postJson('/api/v1/slides/tmpl-y.html/copy-to-deck', ['presentation_id' => 999999])
        ->assertStatus(422)
        ->assertJsonPath('status', 422);
});
