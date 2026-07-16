<?php

namespace App\Actions\Slide;

use App\Models\Slide;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Throwable;

final class DeleteSlide
{
    /**
     * Remove a slide from its presentation and close the gap left behind by
     * decrementing the position of every later slide, keeping the deck order
     * contiguous. The deletion is audited so it can be surfaced and reversed.
     *
     * @throws Throwable
     */
    public function __invoke(Slide $slide): void
    {
        DB::transaction(function () use ($slide): void {
            $presentationId = $slide->presentation_id;
            $position = $slide->position;
            $filename = $slide->filename;

            $slide->delete();

            Slide::query()
                ->where('presentation_id', $presentationId)
                ->where('position', '>', $position)
                ->decrement('position');

            Audit::record('slide.deleted', $slide, [
                'presentation_id' => $presentationId,
                'filename' => $filename,
            ]);
        });
    }
}
