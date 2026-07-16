<?php

namespace App\Actions\Presentation;

use App\Models\Presentation;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class RenamePresentation
{
    /**
     * Rename a presentation: update its human title and re-derive the URL slug.
     * If the new title collides with another presentation in the same team, the
     * resolved title is suffixed (` 2`, ` 3`, …) until free — mirroring
     * CreatePresentation's uniqueness loop so the user never lands on a
     * duplicate name. The slug is regenerated from the resolved title so the
     * URL stays in sync.
     *
     * @throws Throwable
     */
    public function __invoke(Presentation $presentation, string $title): Presentation
    {
        return DB::transaction(function () use ($presentation, $title): Presentation {
            $base = trim($title);
            if ($base === '') {
                $base = __('messages.presentation.untitled');
            }

            // Title collision is scoped to the team so two different spaces can
            // legitimately share a presentation name. Excludes the presentation
            // being renamed because its current title will be replaced atomically.
            $teamId = $presentation->team_id;
            $resolved = $base;
            $suffix = 1;
            while (
                Presentation::query()
                    ->where('team_id', $teamId)
                    ->where('id', '!=', $presentation->id)
                    ->where('title', $resolved)
                    ->exists()
            ) {
                $suffix++;
                $resolved = $base.' '.$suffix;
            }

            $previousTitle = $presentation->title;
            $presentation->title = $resolved;
            if ($title !== '') {
                $presentation->slug = Str::slug($resolved).'-'.Str::random(4);
            }
            $presentation->save();

            Audit::record('presentation.renamed', $presentation, [
                'team_id' => $teamId,
                'previous_title' => $previousTitle,
                'title' => $resolved,
            ]);

            return $presentation;
        });
    }
}
