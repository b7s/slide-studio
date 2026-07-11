<?php

use App\Actions\Generation\StartGeneration;
use App\Ai\Agents\SlideDeckGenerator;
use App\Data\Generation\GenerateSlidesData;
use App\Data\Generation\GenerationRequestedData;
use App\Enums\Generation\GenerationStatus;
use App\Jobs\Generation\GenerateSlides;
use App\Models\Generation;
use App\Models\Presentation;
use App\Models\Slide;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

function makePresentation(string $slug = 'demo-x'): Presentation
{
    $user = User::factory()->create();

    return Presentation::create([
        'user_id' => $user->id,
        'title' => 'Demo',
        'slug' => $slug,
        'deck_path' => '/presentation',
        'template_path' => '/templates',
    ]);
}

test('generation status transitions only from valid states', function () {
    $generation = Generation::create([
        'presentation_id' => makePresentation()->id,
        'prompt' => 'hi',
        'provider' => 'openai',
        'model' => 'gpt-4o',
        'status' => GenerationStatus::Pending,
    ]);

    $started = $generation->markProcessing();
    expect($started->generationId)->toBe($generation->id);
    expect($generation->refresh()->status)->toBe(GenerationStatus::Processing);

    $completed = $generation->markCompleted(3);
    expect($completed->slideCount)->toBe(3);
    expect($generation->refresh()->status)->toBe(GenerationStatus::Completed);
    expect($generation->slide_count)->toBe(3);

    $generation->markFailed('boom');
    expect($generation->refresh()->status)->toBe(GenerationStatus::Failed);
    expect($generation->error)->toBe('boom');
});

test('generation cannot process twice', function () {
    $generation = Generation::create([
        'presentation_id' => makePresentation()->id,
        'prompt' => 'hi',
        'provider' => 'openai',
        'model' => 'gpt-4o',
        'status' => GenerationStatus::Pending,
    ]);

    $generation->markProcessing();
    $generation->markCompleted(1);

    $generation->markProcessing();
})->throws(RuntimeException::class);

test('start generation creates a pending record and dispatches the event', function () {
    Event::fake([GenerationRequestedData::class]);
    $presentation = makePresentation();

    $generation = (new StartGeneration)($presentation, new GenerateSlidesData('a deck about cats', 6));

    expect($generation->status)->toBe(GenerationStatus::Pending);
    expect($generation->prompt)->toBe('a deck about cats');
    expect($generation->provider)->toBe('openai');

    Event::assertDispatched(GenerationRequestedData::class, function (GenerationRequestedData $e) use ($generation) {
        return $e->generationId === $generation->id && $e->maxSlides === 6;
    });
});

test('generation job creates slides from the agent output', function () {
    $presentation = makePresentation('job-pres');
    $user = User::factory()->create();
    $generation = (new StartGeneration)($presentation, new GenerateSlidesData('a deck about cats', 6), $user);

    SlideDeckGenerator::fake([
        [
            'title' => 'My Deck',
            'slides' => [
                ['title' => 'Slide 1', 'html' => '<section>one</section>'],
                ['title' => 'Slide 2', 'html' => '<section>two</section>'],
            ],
        ],
    ]);

    GenerateSlides::dispatchSync($generation->id);

    $generation->refresh();
    expect($generation->status)->toBe(GenerationStatus::Completed);
    expect($generation->slide_count)->toBe(2);

    $slides = Slide::query()->where('generation_id', $generation->id)->orderBy('position')->get();
    expect($slides)->toHaveCount(2);
    expect($slides[0]->title)->toBe('Slide 1');
    expect($slides[0]->html)->toBe('<section>one</section>');
    expect($slides[0]->source_mode->value)->toBe('deck');
    expect($slides[0]->generation_id)->toBe($generation->id);
});

test('POST /api/v1/presentations/{presentation}/generate validates and starts', function () {
    Bus::fake();
    $presentation = makePresentation('demo-gen');

    $this->postJson(route('api.v1.generate', ['presentation' => 'demo-gen']), ['prompt' => ''])
        ->assertStatus(422);

    $this->postJson(route('api.v1.generate', ['presentation' => 'demo-gen']), [
        'prompt' => 'a deck about renewable energy',
        'max_slides' => 4,
    ])
        ->assertStatus(202)
        ->assertJsonStructure(['generation_id', 'status'])
        ->assertJsonPath('status', 'pending');

    Bus::assertDispatched(GenerateSlides::class);
    expect(Generation::query()->count())->toBe(1);
});

test('GET /api/v1/generations/{generation} reports status', function () {
    $presentation = makePresentation();
    $generation = Generation::create([
        'presentation_id' => $presentation->id,
        'prompt' => 'p',
        'provider' => 'openai',
        'model' => 'gpt-4o',
        'status' => GenerationStatus::Completed,
        'slide_count' => 5,
    ]);

    $this->getJson(route('api.v1.generation.show', ['generation' => $generation->id]))
        ->assertOk()
        ->assertJsonPath('status', 'completed')
        ->assertJsonPath('slide_count', 5);
});
