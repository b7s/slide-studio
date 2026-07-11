<?php

namespace App\Actions\Slide;

use App\Models\Slide;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

final class SaveSlide
{
    public function __invoke(Slide $slide, string $html, ?string $revision, bool $overwrite): Slide
    {
        return DB::transaction(function () use ($slide, $html, $revision, $overwrite): Slide {
            $data = $slide->saveContent($html, $revision, $overwrite);

            Audit::record('slide.saved', $slide, [
                'filename' => $data->filename,
                'revision' => $data->revision,
                'html_length' => strlen($data->html),
            ]);

            DB::afterCommit(static fn () => event($data));

            return $slide->refresh();
        });
    }
}
