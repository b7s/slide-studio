<?php

namespace App\Actions\Slide;

use App\Data\Slide\CreateSlideData;
use App\Enums\Slide\SourceMode;
use App\Models\Presentation;
use App\Models\Slide;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class CreateSlide
{
    /**
     * Create a fresh, empty deck slide appended at the end of the given
     * presentation. The slide starts with no HTML content so the editor opens
     * a blank canvas and the first edit becomes its initial revision.
     *
     * @throws Throwable
     */
    public function __invoke(CreateSlideData $data): Slide
    {
        return DB::transaction(function () use ($data): Slide {
            $presentation = Presentation::query()->findOrFail($data->presentationId);

            $max = (int) Slide::query()
                ->where('presentation_id', $presentation->id)
                ->max('position');

            $filename = (string) Str::uuid7().'.html';
            $title = $data->title ?? __('messages.slide.new');

            $slide = new Slide([
                'presentation_id' => $presentation->id,
                'position' => $max + 1,
                'filename' => $filename,
                'title' => $title,
                'html' => '<section class="slide" data-file="'.$filename.'"></section>',
                'source_mode' => SourceMode::Deck,
            ]);
            $slide->save();

            Audit::record('slide.created', $slide, [
                'presentation_id' => $presentation->id,
                'filename' => $slide->filename,
            ]);

            return $slide;
        });
    }
}
