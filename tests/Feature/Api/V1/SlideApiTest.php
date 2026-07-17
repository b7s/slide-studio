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

test('POST /api/v1/slides creates a blank deck slide and audits it', function () {
    $p = seedPresentation();

    $expectedPosition = (int) Slide::query()->where('presentation_id', $p->id)->max('position') + 1;

    $response = $this->postJson('/api/v1/slides', [
        'presentation_id' => $p->id,
    ]);

    $response->assertCreated();
    expect($response->json('data'))->toMatchArray([
        'title' => 'Novo slide',
        'source_mode' => SourceMode::Deck->value,
    ]);
    expect($response->json('data.file'))->toMatch('/\\.html$/');

    $created = Slide::query()->where('filename', $response->json('data.file'))->first();
    expect($created)->not->toBeNull();
    expect($created->position)->toBe($expectedPosition);
    expect($created->html)->toMatch('/<section class="slide"/');
    expect(AuditLog::where('event', 'slide.created')->count())->toBe(1);
});

test('POST /api/v1/slides uses a custom title when provided', function () {
    seedPresentation();

    $response = $this->postJson('/api/v1/slides', [
        'presentation_id' => Presentation::query()->first()->id,
        'title' => 'Introdução',
    ]);

    $response->assertCreated();
    expect($response->json('data.title'))->toBe('Introdução');
});

test('POST /api/v1/slides/{file}/duplicate creates a copy and audits it', function () {
    seedPresentation();

    // The frontend sends only the human title now; the server derives the
    // filename from it (same pattern as RenameSlide).
    $response = $this->postJson('/api/v1/slides/01-a.html/duplicate', [
        'title' => 'Capa B',
    ]);

    $response->assertCreated();
    expect(Slide::where('filename', 'capa-b.html')->exists())->toBeTrue();
    expect($response->json('data.title'))->toBe('Capa B');
    expect(AuditLog::where('event', 'slide.duplicated')->count())->toBe(1);
});

test('POST /api/v1/slides/{file}/duplicate slugifies accents in the derived filename', function () {
    seedPresentation();

    $response = $this->postJson('/api/v1/slides/01-a.html/duplicate', [
        'title' => 'Apêndice — Próxima Página',
    ]);

    $response->assertCreated();
    expect(Slide::where('filename', 'apendice-proxima-pagina.html')->exists())->toBeTrue();
});

test('POST /api/v1/slides/{file}/duplicate falls back to a suffix when title is omitted', function () {
    seedPresentation();

    // No title at all → the action falls back to "<source-title> (cópia)".
    // Note: whitespace-only titles are rejected at the Form Request layer
    // (min:1), keeping the contract explicit at the input boundary.
    $response = $this->postJson('/api/v1/slides/01-a.html/duplicate', []);

    $response->assertStatus(422);

    // Now send an empty string in the title field — Laravel's validation
    // considers "" not "filled", so it also fails. Real bug: a frontend
    // passing the typed value through its trim pipeline should always yield
    // a non-empty value when the user pressed Enter.
    $this->postJson('/api/v1/slides/01-a.html/duplicate', [
        'title' => '',
    ])->assertStatus(422);
});

test('POST /api/v1/slides/{file}/duplicate avoids colliding filenames in the deck', function () {
    seedPresentation();

    // Pre-seed a slide with the title the duplicate is about to take. Since
    // the filename is derived uniquely from the title, the duplicate must
    // land under a suffixed filename rather than shadowing the existing row.
    Slide::create([
        'presentation_id' => Presentation::query()->first()->id,
        'filename' => 'capa.html',
        'title' => 'Capa',
        'position' => 99,
        'source_mode' => SourceMode::Deck,
    ]);

    $this->postJson('/api/v1/slides/01-a.html/duplicate', [
        'title' => 'Capa',
    ])->assertCreated();

    expect(Slide::where('filename', 'capa.html')->count())->toBe(1);
    expect(Slide::where('filename', 'capa-2.html')->exists())->toBeTrue();
});

test('POST /api/v1/slides/{file}/duplicate rejects a missing title', function () {
    seedPresentation();

    $this->postJson('/api/v1/slides/01-a.html/duplicate', [])
        ->assertStatus(422);
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

test('DELETE /api/v1/slides/{file} removes the slide and renumbers the deck', function () {
    $p = seedPresentation();
    $p->slides()->where('filename', '01-a.html')->first()->update(['html' => '<section class="slide">A</section>']);

    $this->deleteJson('/api/v1/slides/01-a.html')->assertOk();

    expect(Slide::where('filename', '01-a.html')->exists())->toBeFalse();
    // Gap closed: the former 02-b.html slides down into position 1.
    expect(Slide::where('filename', '02-b.html')->first()->position)->toBe(1);
    expect(AuditLog::where('event', 'slide.deleted')->count())->toBe(1);
});

test('POST /api/v1/slides/restore re-creates a deleted slide at its position', function () {
    $p = seedPresentation();
    $deleted = $p->slides()->where('filename', '02-b.html')->first();
    $deleted->update(['html' => '<section class="slide">B</section>']);

    $this->deleteJson('/api/v1/slides/02-b.html')->assertOk();

    $restore = $this->postJson('/api/v1/slides/restore', [
        'presentation_id' => $p->id,
        'filename' => '02-b.html',
        'title' => 'B',
        'position' => 2,
        'html' => '<section class="slide">B</section>',
        'source_mode' => 'deck',
    ]);

    $restore->assertCreated();
    expect(Slide::where('filename', '02-b.html')->exists())->toBeTrue();
    // The restored slide keeps its original position, others shift down.
    expect(Slide::where('filename', '02-b.html')->first()->position)->toBe(2);
    expect(AuditLog::where('event', 'slide.restored')->count())->toBe(1);
});

test('POST /api/v1/slides/restore validates required fields', function () {
    seedPresentation();

    $this->postJson('/api/v1/slides/restore', ['presentation_id' => 1])
        ->assertStatus(422)
        ->assertJsonPath('status', 422);
});

test('POST /api/v1/slides/{file}/rename updates title and slugifies the filename', function () {
    seedPresentation();

    $response = $this->postJson('/api/v1/slides/01-a.html/rename', [
        'title' => 'Apresentação Inicial',
    ]);

    $response->assertOk();
    // accented characters are stripped to ASCII ("apresentacao-inicial.html").
    expect(Slide::where('filename', '01-a.html')->first())->toBeNull();
    expect(Slide::where('filename', 'apresentacao-inicial.html')->first()->title)->toBe('Apresentação Inicial');
    expect(AuditLog::where('event', 'slide.renamed')->count())->toBe(1);
});

test('POST /api/v1/slides/{file}/rename avoids filename collisions in the same deck', function () {
    $p = seedPresentation();
    Slide::create([
        'presentation_id' => $p->id,
        'filename' => 'capa.html',
        'title' => 'Capa',
        'position' => 3,
        'source_mode' => SourceMode::Deck,
    ]);

    $this->postJson('/api/v1/slides/01-a.html/rename', ['title' => 'Capa'])
        ->assertOk();

    // The new file gets a "-2" suffix because "capa.html" already exists.
    expect(Slide::where('filename', 'capa.html')->count())->toBe(1);
    expect(Slide::where('filename', 'capa-2.html')->exists())->toBeTrue();
});

test('POST /api/v1/slides/{file}/rename requires a title', function () {
    seedPresentation();

    $this->postJson('/api/v1/slides/01-a.html/rename', [])
        ->assertStatus(422)
        ->assertJsonPath('status', 422);
});
