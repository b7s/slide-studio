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
            $copy = new Slide([
                'presentation_id' => $slide->presentation_id,
                'position' => $slide->position + 1,
                'filename' => $data->filename,
                'title' => $data->title ?? $slide->title.' '.__('messages.slide.copy_suffix'),
                'html' => $slide->html,
                'source_mode' => $slide->source_mode,
            ]);
            $copy->save();

            Audit::record('slide.duplicated', $slide, [
                'copy_id' => $copy->id,
                'filename' => $copy->filename,
            ]);

            DB::afterCommit(static fn () => event(new SlideDuplicatedData($copy->id, $copy->filename)));

            return $copy;
        });
    }
}
