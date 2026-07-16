<?php

namespace App\Actions\Presentation;

use App\Models\Presentation;
use App\Models\Team;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

final class CreatePresentation
{
    /**
     * Create a fresh presentation in the given team. Picks a unique title so two
     * presentations never share a name inside the same team:
     *
     *  - When the caller omits a title, the default is `"Sem título <YYYY-MM-DD>"`
     *    (today) so most manual creations land in the same-day bucket by name.
     *  - When that base title is already taken in the team, append ` 2`, ` 3`,
     *    … until the title is free. The same suffix rule applies to explicit
     *    titles supplied by the user, so e.g. a duplicate "Q3 Roadmap" becomes
     *    "Q3 Roadmap 2".
     *
     * The presentation is opened with a single starter slide (the "Capa") as a
     * reference — additional slides are added via the editor's Add Slide
     * control.
     */
    public function __invoke(Team $team, ?string $title): Presentation
    {
        return DB::transaction(function () use ($team, $title): Presentation {
            $base = $title ?: sprintf('%s %s', __('messages.presentation.untitled'), now()->format('Y-m-d'));
            $resolved = $base;
            $suffix = 1;
            while (
                Presentation::query()
                    ->where('team_id', $team->id)
                    ->where('title', $resolved)
                    ->exists()
            ) {
                $suffix++;
                $resolved = $base.' '.$suffix;
            }

            $presentation = Presentation::createForTeam($team, $resolved);
            CreateStarterPresentation::seed($presentation);

            Audit::record('presentation.created', $presentation, [
                'team_id' => $team->id,
                'starter' => false,
            ], $team->owner);

            return $presentation;
        });
    }
}
