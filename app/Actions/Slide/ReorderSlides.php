<?php

namespace App\Actions\Slide;

use App\Data\Slide\ReorderSlidesData;
use App\Models\Presentation;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Throwable;

final class ReorderSlides
{
    /**
     * @throws Throwable
     */
    public function __invoke(Presentation $presentation, ReorderSlidesData $data): void
    {
        DB::transaction(function () use ($presentation, $data): void {
            foreach ($data->order as $filename => $position) {
                $presentation->slides()->where('filename', $filename)->update(['position' => $position]);
            }

            Audit::record('slides.reordered', $presentation, [
                'order' => $data->order,
            ]);
        });
    }
}
