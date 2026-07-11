<?php

namespace App\Jobs\Generation;

use App\Enums\Slide\SourceMode;
use App\Models\Generation;
use App\Models\Slide;
use App\Services\Generation\SlideGenerator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class GenerateSlides implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public function __construct(public int $generationId) {}

    public function handle(SlideGenerator $generator): void
    {
        $generation = Generation::query()->findOrFail($this->generationId);

        event($generation->markProcessing());

        $presentation = $generation->presentation;
        $maxSlides = (int) Config::get('slides.generation.max_slides', 8);

        try {
            $deck = $generator->generate($presentation, $generation->prompt, $maxSlides);

            $count = DB::transaction(function () use ($generation, $presentation, $deck): int {
                $position = (int) ($presentation->slides()->max('position') ?? 0);
                $count = 0;

                foreach ($deck['slides'] as $slide) {
                    $position++;
                    $count++;

                    Slide::create([
                        'presentation_id' => $presentation->id,
                        'generation_id' => $generation->id,
                        'position' => $position,
                        'filename' => $this->filenameFor($position),
                        'title' => $slide['title'],
                        'html' => $slide['html'],
                        'source_mode' => SourceMode::Deck,
                    ]);
                }

                return $count;
            });

            event($generation->markCompleted($count));
        } catch (Throwable $e) {
            event($generation->markFailed($e->getMessage()));
        }
    }

    private function filenameFor(int $position): string
    {
        return sprintf('%02d-%s.html', $position, Str::slug(Str::random(6)));
    }
}
