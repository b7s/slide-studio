<?php

namespace App\Actions\Slide;

use App\Data\Slide\CopyTemplateData;
use App\Data\Slide\SlideCopiedData;
use App\Enums\Slide\SourceMode;
use App\Models\Presentation;
use App\Models\Slide;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class CopyTemplateToDeck
{
    /**
     * Copy a template slide (source_mode = Template) into the target
     * presentation as a new deck slide (source_mode = Deck), preserving the
     * template's HTML. The new slide is appended at the end of the deck.
     *
     * @throws Throwable
     */
    public function __invoke(Slide $template, CopyTemplateData $data): Slide
    {
        return DB::transaction(function () use ($template, $data): Slide {
            $presentation = Presentation::query()->findOrFail($data->presentationId);

            $max = (int) Slide::query()
                ->where('presentation_id', $presentation->id)
                ->max('position');

            $copy = new Slide([
                'presentation_id' => $presentation->id,
                'position' => $max + 1,
                'filename' => (string) Str::uuid7().'.html',
                'title' => $data->title ?? $template->title,
                'html' => $template->html,
                'source_mode' => SourceMode::Deck,
            ]);
            $copy->save();

            Audit::record('slide.copied_from_template', $template, [
                'copy_id' => $copy->id,
                'presentation_id' => $presentation->id,
                'filename' => $copy->filename,
            ]);

            DB::afterCommit(static fn () => event(new SlideCopiedData($copy->id, $copy->filename)));

            return $copy;
        });
    }
}
