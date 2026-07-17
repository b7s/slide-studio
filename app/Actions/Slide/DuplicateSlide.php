<?php

namespace App\Actions\Slide;

use App\Data\Slide\DuplicateSlideData;
use App\Data\Slide\SlideDuplicatedData;
use App\Models\Slide;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class DuplicateSlide
{
    /**
     * Duplicate a slide: copy the HTML/source, append it right after the source
     * (position+1), and derive the stored filename from the new title — same
     * pattern as RenameSlide, so the user types a human-readable name and the
     * server owns canonical filename + uniqueness.
     *
     * Empty or whitespace-only titles fall back to `<source> <copy_suffix>` so
     * the action is still useful for keyboard-driven "quick duplicate" flows
     * where the user might just press Enter.
     *
     * @throws Throwable
     */
    public function __invoke(Slide $slide, DuplicateSlideData $data): Slide
    {
        return DB::transaction(function () use ($slide, $data): Slide {
            // Title is the user-facing string. Trim first so implicit-empty clues
            // fall through to the suffix fallback uniformly.
            $baseTitle = trim($data->title);
            $suffix = __('messages.slide.copy_suffix');
            $resolvedTitle = $baseTitle !== '' ? $baseTitle : $slide->title.' '.$suffix;

            // The HTML filename is derived from the resolved title to keep
            // on-disk filenames self-describing. Slug-normalises and strips
            // accents so the URL stays portable.
            $base = Str::slug(Str::ascii($resolvedTitle));
            if ($base === '') {
                $base = Str::slug(Str::ascii($slide->title));
            }
            if ($base === '') {
                $base = 'slide';
            }

            // Generated filename avoids collisions with any other slide in
            // the same presentation.
            $filename = UniqueSlideFilename::resolve(
                $slide->presentation_id,
                $base.'.html'
            );

            $copy = new Slide([
                'presentation_id' => $slide->presentation_id,
                'position' => $slide->position + 1,
                'filename' => $filename,
                'title' => $resolvedTitle,
                'html' => $slide->html,
                'source_mode' => $slide->source_mode,
            ]);
            $copy->save();

            Audit::record('slide.duplicated', $slide, [
                'copy_id' => $copy->id,
                'filename' => $filename,
                'title' => $resolvedTitle,
            ]);

            DB::afterCommit(static fn () => event(new SlideDuplicatedData($copy->id, $filename)));

            return $copy;
        });
    }
}
