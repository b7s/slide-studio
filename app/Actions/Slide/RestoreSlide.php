<?php

namespace App\Actions\Slide;

use App\Data\Slide\RestoreSlideData;
use App\Enums\Slide\SourceMode;
use App\Models\Presentation;
use App\Models\Slide;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class RestoreSlide
{
    /**
     * Re-create a previously deleted slide at its original position. Any slide
     * that now sits at or after that position is shifted down by one so the
     * restored slide slots back in without colliding. Used by the undo stack
     * so a slide removal can be reversed.
     *
     * @throws Throwable
     */
    public function __invoke(RestoreSlideData $data): Slide
    {
        return DB::transaction(function () use ($data): Slide {
            $presentation = Presentation::query()->findOrFail($data->presentationId);

            $slide = new Slide([
                'presentation_id' => $presentation->id,
                'position' => $data->position,
                'filename' => $data->filename,
                'title' => $data->title,
                'html' => $data->html,
                'source_mode' => SourceMode::from($data->sourceMode),
                'revision' => $data->revision ?? (string) Str::uuid7(),
            ]);
            $slide->save();

            Slide::query()
                ->where('presentation_id', $presentation->id)
                ->where('id', '!=', $slide->id)
                ->where('position', '>=', $data->position)
                ->increment('position');

            Audit::record('slide.restored', $slide, [
                'presentation_id' => $presentation->id,
                'filename' => $slide->filename,
            ]);

            return $slide;
        });
    }
}
