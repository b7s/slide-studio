<?php

namespace App\Actions\Slide;

use App\Models\Slide;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class RenameSlide
{
    /**
     * Rename a slide: update its human title and the stored HTML filename
     * (always slug-derived from the title so filenames stay URL- and
     * filename-safe, including for accents stripped down to ASCII). If the
     * generated slug would collide with another slide in the same
     * presentation, append an incrementing suffix until it is unique.
     *
     * @throws Throwable
     */
    public function __invoke(Slide $slide, string $title): Slide
    {
        return DB::transaction(function () use ($slide, $title): Slide {
            $base = Str::slug(Str::ascii($title));
            if ($base === '') {
                $base = 'slide';
            }

            // Generated filename avoids collisions with any other slide in
            // the same presentation. Excludes the slide being renamed because
            // its old filename will be replaced atomically with the new one.
            $filename = UniqueSlideFilename::resolve(
                $slide->presentation_id,
                $base.'.html',
                $slide->id
            );

            $slide->title = $title;
            $slide->filename = $filename;
            $slide->save();

            Audit::record('slide.renamed', $slide, [
                'presentation_id' => $slide->presentation_id,
                'filename' => $filename,
            ]);

            return $slide;
        });
    }
}
