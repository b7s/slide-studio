<?php

namespace App\Actions\Generation;

use App\Data\Generation\GenerateSlidesData;
use App\Data\Generation\GenerationRequestedData;
use App\Enums\Generation\GenerationStatus;
use App\Models\Generation;
use App\Models\Presentation;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

final class StartGeneration
{
    public function __invoke(Presentation $presentation, GenerateSlidesData $data, ?User $user = null): Generation
    {
        return DB::transaction(function () use ($presentation, $data, $user): Generation {
            $generation = new Generation([
                'presentation_id' => $presentation->id,
                'user_id' => $user?->id,
                'prompt' => $data->prompt,
                'provider' => (string) Config::get('slides.generation.provider', 'openai'),
                'model' => (string) Config::get('slides.generation.model', 'gpt-4o'),
                'status' => GenerationStatus::Pending,
            ]);
            $generation->save();

            Audit::record('generation.requested', $generation, [
                'prompt' => $data->prompt,
                'max_slides' => $data->maxSlides,
            ]);

            DB::afterCommit(static fn () => event(new GenerationRequestedData(
                generationId: $generation->id,
                presentationId: $presentation->id,
                prompt: $data->prompt,
                maxSlides: $data->maxSlides,
            )));

            return $generation;
        });
    }
}
