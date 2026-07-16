<?php

namespace App\Actions\Slide;

use App\Data\Slide\DuplicateSlideData;
use App\Data\Slide\SlideDuplicatedData;
use App\Models\Slide;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Throwable;

final class DuplicateSlide
{
    /**
     * @throws Throwable
     */
    public function __invoke(Slide $slide, DuplicateSlideData $data): Slide
    {
        return DB::transaction(function () use ($slide, $data): Slide {
            // The source slide keeps its filename; the copy needs a fresh one
            // that does not collide with any slide in the same presentation.
            $filename = UniqueSlideFilename::resolve(
                $slide->presentation_id,
                $data->filename
            );

            $copy = new Slide([
                'presentation_id' => $slide->presentation_id,
                'position' => $slide->position + 1,
                'filename' => $filename,
                'title' => $data->title ?? $slide->title.' '.__('messages.slide.copy_suffix'),
                'html' => $slide->html,
                'source_mode' => $slide->source_mode,
            ]);
            $copy->save();

            Audit::record('slide.duplicated', $slide, [
                'copy_id' => $copy->id,
                'filename' => $filename,
            ]);

            DB::afterCommit(static fn () => event(new SlideDuplicatedData($copy->id, $filename)));

            return $copy;
        });
    }
}
